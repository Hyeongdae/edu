import { CosmosClient, type ItemDefinition, type SqlQuerySpec } from "@azure/cosmos";
import { createHash } from "node:crypto";
import { getSharedTopScores, mergeSharedResult, validateResultForProfile } from "../../shared/companyRecords";
import type { AuthenticatedActor, SharedBest, SharedProfile, SubmitResultRequest } from "../../shared/companyRecords";
import { getHighestUnlockedStage, getStageRule, isClearedStage, isGameStage } from "../../src/game/stageRules";
import type { ClearedStage, GameStage } from "../../src/game/types";
import { RecordServiceError } from "./errors";

export interface PlayerRepository {
  getProfile(actor: AuthenticatedActor): Promise<SharedProfile>;
  listTopScores(): Promise<SharedBest[]>;
  submit(actor: AuthenticatedActor, input: SubmitResultRequest): Promise<SharedProfile>;
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

  let best: SharedBest | null = null;
  if (hasBest) {
    if (!isGameStage(document.bestStage) ||
      typeof document.bestScore !== "number" || !Number.isSafeInteger(document.bestScore) || document.bestScore < 0 ||
      document.bestScore > getStageRule(document.bestStage).scoreRequired + 3 ||
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

  return {
    accountId: document.accountId,
    displayName: document.displayName,
    highestClearedStage: document.highestClearedStage,
    best,
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

  async function readStored(actor: AuthenticatedActor): Promise<{ profile: SharedProfile; etag: string } | null> {
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
    return { profile, etag: response.etag };
  }

  return {
    getProfile: (actor) => storageBoundary(async () => {
      const stored = await readStored(actor);
      return stored?.profile ?? { ...actor, highestClearedStage: 0, best: null };
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
