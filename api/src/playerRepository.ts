import { createHash } from "node:crypto";
import { TableClient } from "@azure/data-tables";
import type { TableEntity } from "@azure/data-tables";
import { getSharedTopScores, mergeSharedResult, validateResultForProfile } from "../../shared/companyRecords";
import type { AuthenticatedActor, SharedBest, SharedProfile, SubmitResultRequest } from "../../shared/companyRecords";
import { getHighestUnlockedStage, getStageRule, isClearedStage, isGameStage } from "../../src/game/stageRules";
import { RecordServiceError } from "./errors";

export interface PlayerRepository {
  getProfile(actor: AuthenticatedActor): Promise<SharedProfile>;
  listTopScores(): Promise<SharedBest[]>;
  submit(actor: AuthenticatedActor, input: SubmitResultRequest): Promise<SharedProfile>;
}

export type PlayerTable = Pick<TableClient, "getEntity" | "createEntity" | "updateEntity" | "listEntities">;
const PARTITION = "descent-v1";
const BEST_FIELDS = ["bestStage", "bestScore", "remainingTimeCs", "achievedAt"];

export function getPlayerRowKey(accountId: string): string {
  return "p_" + createHash("sha256").update(accountId).digest("hex");
}

function statusCode(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "statusCode" in error &&
    typeof error.statusCode === "number" ? error.statusCode : undefined;
}

function isMissingEntity(error: unknown): boolean {
  if (statusCode(error) !== 404 || typeof error !== "object" || error === null) return false;
  // data-tables decodes OData service codes into details; RestError.code may be absent.
  if ("details" in error && typeof error.details === "object" && error.details !== null &&
    "odataError" in error.details && typeof error.details.odataError === "object" && error.details.odataError !== null &&
    "code" in error.details.odataError) return error.details.odataError.code === "ResourceNotFound";
  return "code" in error && error.code === "ResourceNotFound";
}

function decodeEntity(entity: Record<string, unknown>): SharedProfile {
  const fail = () => { throw new RecordServiceError("storage-unavailable"); };
  if (entity.partitionKey !== PARTITION || entity.schemaVersion !== 1 ||
    typeof entity.accountId !== "string" || !entity.accountId.trim() ||
    entity.rowKey !== getPlayerRowKey(entity.accountId) ||
    typeof entity.displayName !== "string" || entity.displayName.length > 200 ||
    !isClearedStage(entity.highestClearedStage)) return fail();

  let best: SharedBest | null = null;
  if (BEST_FIELDS.some((field) => entity[field] !== undefined)) {
    if (!isGameStage(entity.bestStage) ||
      typeof entity.bestScore !== "number" || !Number.isSafeInteger(entity.bestScore) || entity.bestScore < 0 ||
      entity.bestScore > getStageRule(entity.bestStage).scoreRequired + 3 ||
      typeof entity.remainingTimeCs !== "number" || !Number.isSafeInteger(entity.remainingTimeCs) || entity.remainingTimeCs < 0 ||
      entity.remainingTimeCs > getStageRule(entity.bestStage).durationMs / 10 ||
      typeof entity.achievedAt !== "string" || !Number.isFinite(Date.parse(entity.achievedAt)) ||
      new Date(entity.achievedAt).toISOString() !== entity.achievedAt ||
      entity.bestStage > getHighestUnlockedStage(entity.highestClearedStage) ||
      (entity.bestScore >= getStageRule(entity.bestStage).scoreRequired && entity.highestClearedStage < entity.bestStage)) return fail();
    best = {
      accountId: entity.accountId, displayName: entity.displayName, bestStage: entity.bestStage,
      bestScore: entity.bestScore, remainingTimeCs: entity.remainingTimeCs, achievedAt: entity.achievedAt,
    };
  }
  return {
    accountId: entity.accountId, displayName: entity.displayName,
    highestClearedStage: entity.highestClearedStage, best,
  };
}

function encodeEntity(profile: SharedProfile): TableEntity<Record<string, unknown>> {
  return {
    partitionKey: PARTITION, rowKey: getPlayerRowKey(profile.accountId), schemaVersion: 1,
    accountId: profile.accountId, displayName: profile.displayName, highestClearedStage: profile.highestClearedStage,
    ...(profile.best ? {
      bestStage: profile.best.bestStage, bestScore: profile.best.bestScore,
      remainingTimeCs: profile.best.remainingTimeCs, achievedAt: profile.best.achievedAt,
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
  table: PlayerTable,
  options: { now?: () => Date; pageSize?: number } = {},
): PlayerRepository {
  const now = options.now ?? (() => new Date());
  const pageSize = options.pageSize ?? 100;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new RangeError("Invalid page size.");

  async function readStored(actor: AuthenticatedActor): Promise<{ profile: SharedProfile; etag: string } | null> {
    let entity;
    try {
      entity = await table.getEntity<Record<string, unknown>>(PARTITION, getPlayerRowKey(actor.accountId));
    } catch (error) {
      // A missing table is an outage, not an empty official profile.
      if (isMissingEntity(error)) return null;
      throw error;
    }
    const profile = decodeEntity(entity);
    if (profile.accountId !== actor.accountId || typeof entity.etag !== "string" ||
      !entity.etag || entity.etag.trim() !== entity.etag || entity.etag === "*") {
      throw new RecordServiceError("storage-unavailable");
    }
    return { profile, etag: entity.etag };
  }

  return {
    getProfile: (actor) => storageBoundary(async () => {
      const stored = await readStored(actor);
      return stored?.profile ?? { ...actor, highestClearedStage: 0, best: null };
    }),

    listTopScores: () => storageBoundary(async () => {
      let top: SharedBest[] = [];
      const pages = table.listEntities<Record<string, unknown>>({ queryOptions: {
        filter: "PartitionKey eq 'descent-v1' and RowKey ge 'p_' and RowKey lt 'p`'",
      } }).byPage({ maxPageSize: pageSize });
      for await (const page of pages) {
        for (const entity of page) {
          const profile = decodeEntity(entity);
          if (profile.best) top = getSharedTopScores([...top, profile.best]);
        }
      }
      return top;
    }),

    submit: (actor, input) => storageBoundary(async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const stored = await readStored(actor);
        const validation = validateResultForProfile(input.result, stored?.profile.highestClearedStage ?? 0);
        if (!validation.ok) throw new RecordServiceError(validation.code);
        const merged = mergeSharedResult(stored?.profile ?? null, actor, input.result, now().toISOString());
        if (!merged.changed) return merged.profile;
        const entity = encodeEntity(merged.profile);
        try {
          if (stored) await table.updateEntity(entity, "Replace", { etag: stored.etag });
          else await table.createEntity(entity);
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
  const connectionString = env.GAME_RECORDS_CONNECTION_STRING;
  const tableName = env.GAME_RECORDS_TABLE;
  if (!connectionString?.trim() || !tableName || !/^[A-Za-z][A-Za-z0-9]{2,62}$/.test(tableName)) {
    throw new RecordServiceError("storage-unavailable");
  }
  try {
    return createPlayerRepository(TableClient.fromConnectionString(connectionString, tableName, {
      retryOptions: { maxRetries: 2 },
    }));
  } catch {
    throw new RecordServiceError("storage-unavailable");
  }
}
