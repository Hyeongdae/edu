import { CosmosClient, type ItemDefinition, type OperationInput, type SqlQuerySpec } from "@azure/cosmos";
import { createHash } from "node:crypto";
import { createEmptyPointWallet, equipPointEffect as applyEquipPointEffect, getSharedTopInfiniteScores, getSharedTopScores, isCollectPointCoinRequest, isPointEffectId, isPointWallet, mergeSharedInfiniteScore, mergeSharedInfiniteV2Score, mergeSharedResult, purchasePointEffect as applyPurchasePointEffect, validateResultForProfile } from "../../shared/companyRecords";
import type { AuthenticatedActor, InfiniteScoreInput, PointEffectId, SharedBest, SharedInfiniteBest, SharedProfile, SubmitResultRequest } from "../../shared/companyRecords";
import { areCharacterAppearancesEqual, cloneCharacterAppearance, isCharacterAppearance, normalizeCharacterAppearance } from "../../shared/characterAppearance";
import type { CharacterAppearance } from "../../shared/characterAppearance";
import { isCharacterAppearance as isLegacyCharacterAppearance } from "../../shared/legacyCharacterAppearance";
import type { CharacterAppearance as LegacyCharacterAppearance } from "../../shared/legacyCharacterAppearance";
import { isCharacterAppearance as isExpandedCharacterAppearance } from "../../shared/expandedCharacterAppearance";
import type { CharacterAppearance as ExpandedCharacterAppearance } from "../../shared/expandedCharacterAppearance";
import { getHighestUnlockedStage, getStageRule, isClearedStage, isGameStage } from "../../src/game/stageRules";
import type { ClearedStage, GameStage } from "../../src/game/types";
import { RecordServiceError } from "./errors";

export interface PlayerRepository {
  getProfile(actor: AuthenticatedActor): Promise<SharedProfile>;
  listTopScores(): Promise<SharedBest[]>;
  listTopInfiniteScores(): Promise<SharedInfiniteBest[]>;
  listTopInfiniteV2Scores(): Promise<SharedInfiniteBest[]>;
  submit(actor: AuthenticatedActor, input: SubmitResultRequest): Promise<SharedProfile>;
  submitInfiniteScore(actor: AuthenticatedActor, input: InfiniteScoreInput): Promise<SharedProfile>;
  submitInfiniteV2Score(actor: AuthenticatedActor, input: InfiniteScoreInput): Promise<SharedProfile>;
  saveAppearance(actor: AuthenticatedActor, appearance: CharacterAppearance): Promise<SharedProfile>;
  collectPointCoin(actor: AuthenticatedActor, claimId: string): Promise<SharedProfile>;
  purchasePointEffect(actor: AuthenticatedActor, effectId: PointEffectId): Promise<SharedProfile>;
  equipPointEffect(actor: AuthenticatedActor, effectId: PointEffectId | null): Promise<SharedProfile>;
}

export interface PlayerDocument extends ItemDefinition {
  id: string;
  accountId: string;
  schemaVersion: 1;
  displayName: string;
  highestClearedStage: ClearedStage;
  bestStage?: GameStage;
  bestScore?: number;
  remainingTimeCs?: number;
  achievedAt?: string;
  infiniteBestScore?: number;
  infiniteAchievedAt?: string;
  infiniteV2BestScore?: number;
  infiniteV2AchievedAt?: string;
  pointBalance?: number;
  ownedPointEffects?: PointEffectId[];
  equippedPointEffect?: PointEffectId | null;
  appearance?: CharacterAppearance | ExpandedCharacterAppearance | LegacyCharacterAppearance;
}

interface PointCoinReceipt extends ItemDefinition {
  id: string;
  accountId: string;
  kind: "point-coin-claim";
  createdAt: string;
}

interface ItemRead<T extends ItemDefinition> {
  resource?: T;
  etag?: string;
  statusCode?: number;
}

interface PlayerItem {
  read<T extends PlayerDocument>(): Promise<ItemRead<T>>;
  replace<T extends PlayerDocument>(
    document: T,
    options: { accessCondition: { type: "IfMatch"; condition: string } },
  ): Promise<unknown>;
}

export interface PlayerContainer {
  read(): Promise<{ resource?: { id?: string; partitionKey?: { paths?: string[] } } }>;
  item(id: string, partitionKey: string): PlayerItem;
  items: {
    create<T extends PlayerDocument>(document: T): Promise<unknown>;
    query<T extends PlayerDocument>(
      query: SqlQuerySpec,
      options: { maxItemCount: number },
    ): { fetchAll(): Promise<{ resources?: T[] }> };
    batch(operations: OperationInput[], partitionKey: string): Promise<{ result?: Array<{ statusCode: number }> }>;
  };
}

const BEST_FIELDS = ["bestStage", "bestScore", "remainingTimeCs", "achievedAt"] as const;
const TOP_SCORES_QUERY: SqlQuerySpec = {
  query: "SELECT TOP 10 * FROM c WHERE IS_DEFINED(c.bestStage) ORDER BY c.bestStage DESC, c.bestScore DESC, c.remainingTimeCs DESC, c.achievedAt ASC, c.accountId ASC",
};
const TOP_SCORES_OPTIONS = { maxItemCount: 10 };
const TOP_INFINITE_SCORES_QUERY: SqlQuerySpec = {
  query: "SELECT TOP 10 * FROM c WHERE IS_DEFINED(c.infiniteBestScore) ORDER BY c.infiniteBestScore DESC, c.infiniteAchievedAt ASC, c.accountId ASC",
};
const TOP_INFINITE_V2_SCORES_QUERY: SqlQuerySpec = {
  query: "SELECT TOP 10 * FROM c WHERE IS_DEFINED(c.infiniteV2BestScore) ORDER BY c.infiniteV2BestScore DESC, c.infiniteV2AchievedAt ASC, c.accountId ASC",
};

export function getPlayerRowKey(accountId: string): string {
  return "p_" + createHash("sha256").update(accountId).digest("hex");
}

function statusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("statusCode" in error && typeof error.statusCode === "number") return error.statusCode;
  return "code" in error && typeof error.code === "number" ? error.code : undefined;
}

function isMissingItem(error: unknown): boolean {
  if (statusCode(error) !== 404 || typeof error !== "object" || error === null || !("code" in error)) return false;
  // Container existence is checked once before item operations, so only an item NotFound is a new profile.
  return error.code === "NotFound" || error.code === 404;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeDocument(document: unknown): SharedProfile {
  const fail = (): never => { throw new RecordServiceError("storage-unavailable"); };
  if (!isRecord(document) || typeof document.accountId !== "string" || !document.accountId.trim() ||
    document.id !== getPlayerRowKey(document.accountId) || document.schemaVersion !== 1 ||
    typeof document.displayName !== "string" || !document.displayName.trim() || document.displayName.length > 200 ||
    !isClearedStage(document.highestClearedStage) || Object.hasOwn(document, "best")) return fail();

  const hasBest = BEST_FIELDS.some((field) => Object.hasOwn(document, field));
  if (hasBest && !BEST_FIELDS.every((field) => Object.hasOwn(document, field))) return fail();
  const hasInfiniteScore = Object.hasOwn(document, "infiniteBestScore");
  const hasInfiniteAt = Object.hasOwn(document, "infiniteAchievedAt");
  if (hasInfiniteScore !== hasInfiniteAt) return fail();
  const hasInfiniteV2Score = Object.hasOwn(document, "infiniteV2BestScore");
  const hasInfiniteV2At = Object.hasOwn(document, "infiniteV2AchievedAt");
  if (hasInfiniteV2Score !== hasInfiniteV2At) return fail();
  const walletFields = ["pointBalance", "ownedPointEffects", "equippedPointEffect"] as const;
  const walletFieldCount = walletFields.filter((field) => Object.hasOwn(document, field)).length;
  if (walletFieldCount !== 0 && walletFieldCount !== walletFields.length) return fail();
  const wallet = walletFieldCount === 0 ? createEmptyPointWallet() : {
    balance: document.pointBalance,
    ownedEffects: document.ownedPointEffects,
    equippedEffect: document.equippedPointEffect,
  };
  if (!isPointWallet(wallet)) return fail();

  let best: SharedBest | null = null;
  if (hasBest) {
    if (!isGameStage(document.bestStage) ||
      typeof document.bestScore !== "number" || !Number.isSafeInteger(document.bestScore) || document.bestScore < 0 ||
      document.bestScore > getStageRule(document.bestStage).scoreRequired ||
      typeof document.remainingTimeCs !== "number" || !Number.isSafeInteger(document.remainingTimeCs) || document.remainingTimeCs < 0 ||
      document.remainingTimeCs > getStageRule(document.bestStage).durationMs / 10 ||
      typeof document.achievedAt !== "string" || !Number.isFinite(Date.parse(document.achievedAt)) ||
      new Date(document.achievedAt).toISOString() !== document.achievedAt ||
      document.bestStage > getHighestUnlockedStage(document.highestClearedStage) ||
      (document.bestScore >= getStageRule(document.bestStage).scoreRequired && document.highestClearedStage < document.bestStage)) {
      return fail();
    }
    best = {
      accountId: document.accountId,
      displayName: document.displayName,
      bestStage: document.bestStage,
      bestScore: document.bestScore,
      remainingTimeCs: document.remainingTimeCs,
      achievedAt: document.achievedAt,
    };
  }

  let infiniteBest: SharedInfiniteBest | null = null;
  if (hasInfiniteScore) {
    if (typeof document.infiniteBestScore !== "number" || !Number.isSafeInteger(document.infiniteBestScore) ||
      document.infiniteBestScore < 0 || typeof document.infiniteAchievedAt !== "string" ||
      !Number.isFinite(Date.parse(document.infiniteAchievedAt)) ||
      new Date(document.infiniteAchievedAt).toISOString() !== document.infiniteAchievedAt) return fail();
    infiniteBest = { accountId: document.accountId, displayName: document.displayName,
      bestScore: document.infiniteBestScore, achievedAt: document.infiniteAchievedAt };
  }

  let infiniteV2Best: SharedInfiniteBest | null = null;
  if (hasInfiniteV2Score) {
    if (typeof document.infiniteV2BestScore !== "number" || !Number.isSafeInteger(document.infiniteV2BestScore) ||
      document.infiniteV2BestScore < 0 || typeof document.infiniteV2AchievedAt !== "string" ||
      !Number.isFinite(Date.parse(document.infiniteV2AchievedAt)) ||
      new Date(document.infiniteV2AchievedAt).toISOString() !== document.infiniteV2AchievedAt) return fail();
    infiniteV2Best = { accountId: document.accountId, displayName: document.displayName,
      bestScore: document.infiniteV2BestScore, achievedAt: document.infiniteV2AchievedAt };
  }

  const appearance = normalizeCharacterAppearance(document.appearance);
  return {
    accountId: document.accountId,
    displayName: document.displayName,
    highestClearedStage: document.highestClearedStage,
    best,
    infiniteBest,
    infiniteV2Best,
    wallet,
    ...(appearance ? { appearance } : {}),
  };
}

function encodeDocument(profile: SharedProfile): PlayerDocument {
  return {
    id: getPlayerRowKey(profile.accountId),
    accountId: profile.accountId,
    schemaVersion: 1,
    displayName: profile.displayName,
    highestClearedStage: profile.highestClearedStage,
    ...(profile.best ? {
      bestStage: profile.best.bestStage,
      bestScore: profile.best.bestScore,
      remainingTimeCs: profile.best.remainingTimeCs,
      achievedAt: profile.best.achievedAt,
    } : {}),
    ...(profile.infiniteBest ? {
      infiniteBestScore: profile.infiniteBest.bestScore,
      infiniteAchievedAt: profile.infiniteBest.achievedAt,
    } : {}),
    ...(profile.infiniteV2Best ? {
      infiniteV2BestScore: profile.infiniteV2Best.bestScore,
      infiniteV2AchievedAt: profile.infiniteV2Best.achievedAt,
    } : {}),
    pointBalance: profile.wallet.balance,
    ownedPointEffects: [...profile.wallet.ownedEffects],
    equippedPointEffect: profile.wallet.equippedEffect,
    ...(isCharacterAppearance(profile.appearance) ? { appearance: cloneCharacterAppearance(profile.appearance) } : {}),
  };
}

async function storageBoundary<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof RecordServiceError) throw error;
    throw new RecordServiceError("storage-unavailable");
  }
}

export function createPlayerRepository(
  container: PlayerContainer,
  options: { now?: () => Date; containerId?: string } = {},
): PlayerRepository {
  const now = options.now ?? (() => new Date());
  let containerReadiness: Promise<void> | undefined;

  function ensureContainer(): Promise<void> {
    containerReadiness ??= container.read().then(({ resource }) => {
      if (!resource?.id || (options.containerId && resource.id !== options.containerId) ||
        resource.partitionKey?.paths?.length !== 1 || resource.partitionKey.paths[0] !== "/accountId") {
        throw new RecordServiceError("storage-unavailable");
      }
    }).catch((error: unknown) => {
      containerReadiness = undefined;
      throw error;
    });
    return containerReadiness;
  }

  async function readStored(actor: AuthenticatedActor): Promise<{
    profile: SharedProfile; etag: string; appearanceNeedsUpgrade: boolean;
  } | null> {
    await ensureContainer();
    const id = getPlayerRowKey(actor.accountId);
    let response: ItemRead<PlayerDocument>;
    try {
      response = await container.item(id, actor.accountId).read<PlayerDocument>();
    } catch (error) {
      if (isMissingItem(error)) return null;
      throw error;
    }
    if (!response.resource && response.statusCode === 404) return null;
    if (!response.resource) throw new RecordServiceError("storage-unavailable");
    const profile = decodeDocument(response.resource);
    if (profile.accountId !== actor.accountId || typeof response.etag !== "string" ||
      !response.etag || response.etag.trim() !== response.etag || response.etag === "*") {
      throw new RecordServiceError("storage-unavailable");
    }
    return { profile, etag: response.etag, appearanceNeedsUpgrade:
      isLegacyCharacterAppearance(response.resource.appearance) || isExpandedCharacterAppearance(response.resource.appearance) };
  }

  function requireActor(actor: AuthenticatedActor): void {
    if (!actor || typeof actor.accountId !== "string" || !actor.accountId.trim() ||
      typeof actor.displayName !== "string" || !actor.displayName.trim() || actor.displayName.length > 200) {
      throw new RecordServiceError("unauthenticated");
    }
  }

  function newProfile(actor: AuthenticatedActor): SharedProfile {
    return { ...actor, highestClearedStage: 0, best: null, infiniteBest: null, infiniteV2Best: null,
      wallet: createEmptyPointWallet() };
  }

  async function readCoinReceipt(actor: AuthenticatedActor, receiptId: string): Promise<PointCoinReceipt | null> {
    try {
      const response = await container.item(receiptId, actor.accountId).read<PlayerDocument>();
      if (!response.resource && response.statusCode === 404) return null;
      const receipt = response.resource as unknown as PointCoinReceipt | undefined;
      if (!receipt || receipt.id !== receiptId || receipt.accountId !== actor.accountId ||
        receipt.kind !== "point-coin-claim" || typeof receipt.createdAt !== "string" ||
        !Number.isFinite(Date.parse(receipt.createdAt)) || new Date(receipt.createdAt).toISOString() !== receipt.createdAt) {
        throw new RecordServiceError("storage-unavailable");
      }
      return receipt;
    } catch (error) {
      if (isMissingItem(error)) return null;
      throw error;
    }
  }

  async function persistProfile(profile: SharedProfile, stored: Awaited<ReturnType<typeof readStored>>): Promise<void> {
    const document = encodeDocument(profile);
    if (stored) {
      await container.item(getPlayerRowKey(profile.accountId), profile.accountId).replace(document, {
        accessCondition: { type: "IfMatch", condition: stored.etag },
      });
    } else {
      await container.items.create(document);
    }
  }

  async function mutateWallet(
    actor: AuthenticatedActor,
    mutate: (wallet: SharedProfile["wallet"]) =>
      | { ok: true; wallet: SharedProfile["wallet"]; changed: boolean }
      | { ok: false; code: "insufficient-points" | "effect-not-owned" },
  ): Promise<SharedProfile> {
    requireActor(actor);
    for (let attempt = 0; attempt < 5; attempt++) {
      const stored = await readStored(actor);
      const previous = stored?.profile ?? newProfile(actor);
      const result = mutate(previous.wallet);
      if (!result.ok) throw new RecordServiceError(result.code);
      if (!result.changed) return previous;
      const profile: SharedProfile = { ...previous, ...actor, wallet: result.wallet };
      try {
        await persistProfile(profile, stored);
        return profile;
      } catch (error) {
        if ((!stored && statusCode(error) === 409) || (stored && statusCode(error) === 412)) continue;
        throw error;
      }
    }
    throw new RecordServiceError("conflict");
  }

  return {
    getProfile: (actor) => storageBoundary(async () => {
      const stored = await readStored(actor);
      return stored?.profile ?? { ...actor, highestClearedStage: 0, best: null, infiniteBest: null, infiniteV2Best: null,
        wallet: createEmptyPointWallet() };
    }),

    saveAppearance: (actor, appearance) => storageBoundary(async () => {
      if (!isCharacterAppearance(appearance)) throw new RecordServiceError("invalid-request");
      // Snapshot the request before the first read, including across conflict retries.
      const requestedAppearance = cloneCharacterAppearance(appearance);
      for (let attempt = 0; attempt < 5; attempt++) {
        const stored = await readStored(actor);
        const previous: SharedProfile = stored?.profile ?? { ...actor, highestClearedStage: 0, best: null, infiniteBest: null,
          infiniteV2Best: null, wallet: createEmptyPointWallet() };
        if (!stored?.appearanceNeedsUpgrade && previous.appearance && previous.displayName === actor.displayName &&
          areCharacterAppearancesEqual(previous.appearance, requestedAppearance)) return previous;
        const profile: SharedProfile = {
          ...previous,
          ...actor,
          best: previous.best ? { ...previous.best, displayName: actor.displayName } : null,
          infiniteBest: previous.infiniteBest ? { ...previous.infiniteBest, displayName: actor.displayName } : null,
          infiniteV2Best: previous.infiniteV2Best ? { ...previous.infiniteV2Best, displayName: actor.displayName } : null,
          appearance: cloneCharacterAppearance(requestedAppearance),
        };
        const document = encodeDocument(profile);
        try {
          if (stored) {
            await container.item(getPlayerRowKey(actor.accountId), actor.accountId).replace(document, {
              accessCondition: { type: "IfMatch", condition: stored.etag },
            });
          } else {
            await container.items.create(document);
          }
          return profile;
        } catch (error) {
          if ((!stored && statusCode(error) === 409) || (stored && statusCode(error) === 412)) continue;
          throw error;
        }
      }
      throw new RecordServiceError("conflict");
    }),

    collectPointCoin: (actor, claimId) => storageBoundary(async () => {
      requireActor(actor);
      if (!isCollectPointCoinRequest({ claimId })) throw new RecordServiceError("invalid-request");
      await ensureContainer();
      const receiptId = "coin_" + createHash("sha256").update(claimId, "utf8").digest("hex");

      for (let attempt = 0; attempt < 5; attempt++) {
        const stored = await readStored(actor);
        const existingReceipt = await readCoinReceipt(actor, receiptId);
        if (existingReceipt) {
          const current = await readStored(actor);
          if (!current) throw new RecordServiceError("storage-unavailable");
          return current.profile;
        }

        const previous = stored?.profile ?? newProfile(actor);
        if (previous.wallet.balance >= Number.MAX_SAFE_INTEGER) throw new RecordServiceError("storage-unavailable");
        const profile: SharedProfile = { ...previous, ...actor,
          wallet: { ...previous.wallet, balance: previous.wallet.balance + 1 } };
        const receipt: PointCoinReceipt = { id: receiptId, accountId: actor.accountId,
          kind: "point-coin-claim", createdAt: now().toISOString() };
        const operations: OperationInput[] = [
          { operationType: "Create", resourceBody: receipt },
          stored
            ? { operationType: "Replace", id: getPlayerRowKey(actor.accountId), ifMatch: stored.etag, resourceBody: encodeDocument(profile) }
            : { operationType: "Create", resourceBody: encodeDocument(profile) },
        ];

        try {
          const response = await container.items.batch(operations, actor.accountId);
          const failure = response.result?.find((operation) => operation.statusCode >= 400);
          if (!failure) return profile;
          if ([409, 412, 424].includes(failure.statusCode)) {
            const receiptAfterConflict = await readCoinReceipt(actor, receiptId);
            if (receiptAfterConflict) {
              const current = await readStored(actor);
              if (!current) throw new RecordServiceError("storage-unavailable");
              return current.profile;
            }
            continue;
          }
          throw new RecordServiceError("storage-unavailable");
        } catch (error) {
          if (error instanceof RecordServiceError && error.code === "storage-unavailable") throw error;
          if ([409, 412, 424].includes(statusCode(error) ?? 0)) {
            const receiptAfterConflict = await readCoinReceipt(actor, receiptId);
            if (receiptAfterConflict) {
              const current = await readStored(actor);
              if (!current) throw new RecordServiceError("storage-unavailable");
              return current.profile;
            }
            continue;
          }
          throw error;
        }
      }
      throw new RecordServiceError("conflict");
    }),

    purchasePointEffect: (actor, effectId) => storageBoundary(async () => {
      if (!isPointEffectId(effectId)) throw new RecordServiceError("invalid-request");
      return mutateWallet(actor, (wallet) => applyPurchasePointEffect(wallet, effectId));
    }),

    equipPointEffect: (actor, effectId) => storageBoundary(async () => {
      if (effectId !== null && !isPointEffectId(effectId)) throw new RecordServiceError("invalid-request");
      return mutateWallet(actor, (wallet) => applyEquipPointEffect(wallet, effectId));
    }),

    listTopScores: () => storageBoundary(async () => {
      await ensureContainer();
      const { resources = [] } = await container.items.query<PlayerDocument>(TOP_SCORES_QUERY, TOP_SCORES_OPTIONS).fetchAll();
      const bests: SharedBest[] = [];
      for (const document of resources) {
        const profile = decodeDocument(document);
        if (profile.best) bests.push(profile.best);
      }
      return getSharedTopScores(bests);
    }),

    listTopInfiniteScores: () => storageBoundary(async () => {
      await ensureContainer();
      const { resources = [] } = await container.items.query<PlayerDocument>(TOP_INFINITE_SCORES_QUERY, TOP_SCORES_OPTIONS).fetchAll();
      const bests: SharedInfiniteBest[] = [];
      for (const document of resources) {
        const profile = decodeDocument(document);
        if (profile.infiniteBest) bests.push(profile.infiniteBest);
      }
      return getSharedTopInfiniteScores(bests);
    }),

    listTopInfiniteV2Scores: () => storageBoundary(async () => {
      await ensureContainer();
      const { resources = [] } = await container.items.query<PlayerDocument>(TOP_INFINITE_V2_SCORES_QUERY, TOP_SCORES_OPTIONS).fetchAll();
      const bests: SharedInfiniteBest[] = [];
      for (const document of resources) {
        const profile = decodeDocument(document);
        if (profile.infiniteV2Best) bests.push(profile.infiniteV2Best);
      }
      return getSharedTopInfiniteScores(bests);
    }),

    submit: (actor, input) => storageBoundary(async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const stored = await readStored(actor);
        const validation = validateResultForProfile(input.result, stored?.profile.highestClearedStage ?? 0);
        if (!validation.ok) throw new RecordServiceError(validation.code);
        const merged = mergeSharedResult(stored?.profile ?? null, actor, input.result, now().toISOString());
        if (!merged.changed) return merged.profile;
        const document = encodeDocument(merged.profile);
        try {
          if (stored) {
            const id = getPlayerRowKey(actor.accountId);
            await container.item(id, actor.accountId).replace(document, {
              accessCondition: { type: "IfMatch", condition: stored.etag },
            });
          } else {
            await container.items.create(document);
          }
          return merged.profile;
        } catch (error) {
          if ((!stored && statusCode(error) === 409) || (stored && statusCode(error) === 412)) continue;
          throw error;
        }
      }
      throw new RecordServiceError("conflict");
    }),

    submitInfiniteScore: (actor, input) => storageBoundary(async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const stored = await readStored(actor);
        const merged = mergeSharedInfiniteScore(stored?.profile ?? null, actor, input, now().toISOString());
        if (!merged.changed) return merged.profile;
        const document = encodeDocument(merged.profile);
        try {
          if (stored) {
            await container.item(getPlayerRowKey(actor.accountId), actor.accountId).replace(document, {
              accessCondition: { type: "IfMatch", condition: stored.etag },
            });
          } else {
            await container.items.create(document);
          }
          return merged.profile;
        } catch (error) {
          if ((!stored && statusCode(error) === 409) || (stored && statusCode(error) === 412)) continue;
          throw error;
        }
      }
      throw new RecordServiceError("conflict");
    }),

    submitInfiniteV2Score: (actor, input) => storageBoundary(async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const stored = await readStored(actor);
        const merged = mergeSharedInfiniteV2Score(stored?.profile ?? null, actor, input, now().toISOString());
        if (!merged.changed) return merged.profile;
        const document = encodeDocument(merged.profile);
        try {
          if (stored) {
            await container.item(getPlayerRowKey(actor.accountId), actor.accountId).replace(document, {
              accessCondition: { type: "IfMatch", condition: stored.etag },
            });
          } else {
            await container.items.create(document);
          }
          return merged.profile;
        } catch (error) {
          if ((!stored && statusCode(error) === 409) || (stored && statusCode(error) === 412)) continue;
          throw error;
        }
      }
      throw new RecordServiceError("conflict");
    }),
  };
}

export function createPlayerRepositoryFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): PlayerRepository {
  const connectionString = env.GAME_RECORDS_COSMOS_CONNECTION_STRING?.trim();
  const databaseName = env.GAME_RECORDS_COSMOS_DATABASE?.trim();
  const containerName = env.GAME_RECORDS_COSMOS_CONTAINER?.trim();
  if (!connectionString || !databaseName || databaseName.length > 255 || !containerName || containerName.length > 255) {
    throw new RecordServiceError("storage-unavailable");
  }
  try {
    const client = new CosmosClient(connectionString);
    const container = client.database(databaseName).container(containerName);
    return createPlayerRepository(container, { containerId: containerName });
  } catch {
    throw new RecordServiceError("storage-unavailable");
  }
}
