import { getHighestUnlockedStage, getStageRule, isClearedStage, isGameStage } from "../src/game/stageRules";
import type { ClearedStage, GameStage, StageResult } from "../src/game/types";

export type ResultInput = Pick<StageResult, "stage" | "score" | "remainingTimeCs" | "outcome">;

export interface SharedBest {
  accountId: string;
  displayName: string;
  bestStage: GameStage;
  bestScore: number;
  remainingTimeCs: number;
  achievedAt: string;
}

export interface SharedProfile {
  accountId: string;
  displayName: string;
  highestClearedStage: ClearedStage;
  best: SharedBest | null;
}

export interface AuthenticatedActor {
  accountId: string;
  displayName: string;
}

export interface SubmitResultRequest {
  submissionId: string;
  result: ResultInput;
}

export interface SubmitResultResponse {
  submissionId: string;
  profile: SharedProfile;
  entries: SharedBest[];
}

export interface LeaderboardResponse {
  entries: SharedBest[];
}

export type ApiErrorCode = "unauthenticated" | "invalid-request" | "stage-locked"
  | "conflict" | "storage-unavailable";

export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}

export type ResultValidation = { ok: true } | {
  ok: false;
  code: "invalid-request" | "stage-locked";
  message: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_KEYS = ["submissionId", "result"];
const RESULT_KEYS = ["stage", "score", "remainingTimeCs", "outcome"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactOwnKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length &&
    keys.every((key) => typeof key === "string" && expected.includes(key));
}

function hasResultFields(value: unknown): value is ResultInput {
  if (!isRecord(value)) return false;
  return isGameStage(value.stage) &&
    typeof value.score === "number" && Number.isSafeInteger(value.score) && value.score >= 0 &&
    typeof value.remainingTimeCs === "number" && Number.isSafeInteger(value.remainingTimeCs) && value.remainingTimeCs >= 0 &&
    (value.outcome === "cleared" || value.outcome === "caught" || value.outcome === "time-limit");
}

/** Structural boundary only; stage-specific limits and unlocks require validateResultForProfile. */
export function isSubmitResultRequest(value: unknown): value is SubmitResultRequest {
  return isRecord(value) && hasExactOwnKeys(value, REQUEST_KEYS) &&
    typeof value.submissionId === "string" && UUID_PATTERN.test(value.submissionId) &&
    isRecord(value.result) && hasExactOwnKeys(value.result, RESULT_KEYS) && hasResultFields(value.result);
}

export function validateResultForProfile(result: ResultInput, highest: ClearedStage): ResultValidation {
  if (!isClearedStage(highest)) throw new RangeError("highest must be an integer from 0 to 5.");
  if (!hasResultFields(result)) {
    return { ok: false, code: "invalid-request", message: "Invalid result fields." };
  }

  const rule = getStageRule(result.stage);
  if (result.score > rule.scoreRequired || result.remainingTimeCs > rule.durationMs / 10) {
    return { ok: false, code: "invalid-request", message: "Result exceeds the stage score or time limits." };
  }
  const cleared = result.outcome === "cleared";
  if (cleared !== (result.score >= rule.scoreRequired) ||
    (result.outcome === "time-limit" && result.remainingTimeCs !== 0)) {
    return { ok: false, code: "invalid-request", message: "Result outcome does not match its score or time." };
  }
  if (result.stage > getHighestUnlockedStage(highest)) {
    return { ok: false, code: "stage-locked", message: "Clear the preceding stage before submitting this stage." };
  }
  return { ok: true };
}

function comparePerformanceTuple(
  a: Pick<SharedBest, "bestStage" | "bestScore" | "remainingTimeCs">,
  b: Pick<SharedBest, "bestStage" | "bestScore" | "remainingTimeCs">,
): number {
  return b.bestStage - a.bestStage || b.bestScore - a.bestScore || b.remainingTimeCs - a.remainingTimeCs;
}

/** A negative result places a ahead of b; account IDs break exact timestamp ties across runtimes. */
export function compareSharedPerformance(a: SharedBest, b: SharedBest): number {
  return comparePerformanceTuple(a, b) || Date.parse(a.achievedAt) - Date.parse(b.achievedAt) ||
    (a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0);
}

export function getSharedTopScores(entries: readonly SharedBest[], limit = 10): SharedBest[] {
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new RangeError("limit must be a positive safe integer.");
  const unique = new Map<string, SharedBest>();
  for (const entry of entries) {
    const previous = unique.get(entry.accountId);
    if (!previous || compareSharedPerformance(entry, previous) < 0) unique.set(entry.accountId, entry);
  }
  return [...unique.values()].sort(compareSharedPerformance).slice(0, limit);
}

function normalizeServerTime(value: string): string {
  // Accept UTC ISO seconds or milliseconds, but not permissive Date.parse inputs or normalized invalid dates.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new RangeError("serverNowIso must be a valid UTC ISO timestamp.");
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new RangeError("serverNowIso must be a valid UTC ISO timestamp.");
  const normalized = new Date(milliseconds).toISOString();
  if (normalized !== (value.includes(".") ? value : value.replace("Z", ".000Z"))) {
    throw new RangeError("serverNowIso must be a valid UTC ISO timestamp.");
  }
  return normalized;
}

/** Caller must validate the result against the latest stored profile before every conditional-write attempt. */
export function mergeSharedResult(
  previous: SharedProfile | null,
  actor: AuthenticatedActor,
  input: ResultInput,
  serverNowIso: string,
): { profile: SharedProfile; changed: boolean } {
  if (typeof actor.accountId !== "string" || !actor.accountId.trim() || typeof actor.displayName !== "string") {
    throw new RangeError("A verified actor with a non-empty accountId is required.");
  }
  if (previous && (previous.accountId !== actor.accountId ||
    (previous.best !== null && previous.best.accountId !== actor.accountId))) {
    throw new RangeError("The previous profile must belong to the authenticated actor.");
  }
  const achievedAt = normalizeServerTime(serverNowIso);
  const candidate: SharedBest = {
    accountId: actor.accountId,
    displayName: actor.displayName,
    bestStage: input.stage,
    bestScore: input.score,
    remainingTimeCs: input.remainingTimeCs,
    achievedAt,
  };
  let best = previous?.best ?? null;
  // Timestamp and name are not performance improvements. Preserve the first accepted equal tuple.
  if (!best || comparePerformanceTuple(candidate, best) < 0) best = candidate;
  else if (best.displayName !== actor.displayName) best = { ...best, displayName: actor.displayName };

  const highestClearedStage = Math.max(
    previous?.highestClearedStage ?? 0,
    input.outcome === "cleared" ? input.stage : 0,
  ) as ClearedStage;
  const changed = !previous || previous.displayName !== actor.displayName ||
    previous.highestClearedStage !== highestClearedStage || previous.best !== best;
  if (!changed) return { profile: previous, changed: false };
  return {
    profile: { accountId: actor.accountId, displayName: actor.displayName, highestClearedStage, best },
    changed: true,
  };
}
