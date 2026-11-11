import { CosmosClient, type ItemDefinition, type SqlQuerySpec } from "@azure/cosmos";
import { createHash } from "node:crypto";
import { getSharedTopInfiniteScores, getSharedTopScores, mergeSharedInfiniteScore, mergeSharedInfiniteV2Score, mergeSharedResult, validateResultForProfile } from "../../shared/companyRecords";
import type { AuthenticatedActor, InfiniteScoreInput, SharedBest, SharedInfiniteBest, SharedProfile, SubmitResultRequest } from "../../shared/companyRecords";
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
  appearance?: CharacterAppearance | ExpandedCharacterAppearance | LegacyCharacterAppearance;
}

interface ItemRead<T> {
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

  return {
    getProfile: (actor) => storageBoundary(async () => {
      const stored = await readStored(actor);
      return stored?.profile ?? { ...actor, highestClearedStage: 0, best: null, infiniteBest: null, infiniteV2Best: null };
    }),

    saveAppearance: (actor, appearance) => storageBoundary(async () => {
      if (!isCharacterAppearance(appearance)) throw new RecordServiceError("invalid-request");
      // Snapshot the request before the first read, including across conflict retries.
      const requestedAppearance = cloneCharacterAppearance(appearance);
      for (let attempt = 0; attempt < 5; attempt++) {
        const stored = await readStored(actor);
        const previous: SharedProfile = stored?.profile ?? { ...actor, highestClearedStage: 0, best: null, infiniteBest: null, infiniteV2Best: null };
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
