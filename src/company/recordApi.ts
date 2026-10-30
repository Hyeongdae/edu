import type { ApiErrorCode, SharedBest, SharedProfile, SubmitResultRequest, SubmitResultResponse } from "../../shared/companyRecords";
import { getHighestUnlockedStage, getStageRule, isClearedStage, isGameStage } from "../game/stageRules";

type RecordApiErrorCode = ApiErrorCode | "network" | "timeout" | "invalid-response";

export class RecordApiError extends Error {
  constructor(readonly code: RecordApiErrorCode) {
    super(code === "unauthenticated" ? "회사 계정으로 다시 로그인해 주세요." :
      code === "stage-locked" || code === "invalid-request" ? "저장할 기록을 확인하지 못했습니다. 다시 시도해 주세요." :
      "사내 기록을 불러오거나 저장하지 못했습니다. 다시 시도해 주세요.");
    this.name = "RecordApiError";
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSharedBest(value: unknown): value is SharedBest {
  if (!object(value) || typeof value.accountId !== "string" || !value.accountId.trim() ||
    typeof value.displayName !== "string" || !isGameStage(value.bestStage)) return false;
  const rule = getStageRule(value.bestStage);
  return typeof value.bestScore === "number" && Number.isSafeInteger(value.bestScore) && value.bestScore >= 0 &&
    value.bestScore <= rule.scoreRequired + 3 && typeof value.remainingTimeCs === "number" &&
    Number.isSafeInteger(value.remainingTimeCs) && value.remainingTimeCs >= 0 && value.remainingTimeCs <= rule.durationMs / 10 &&
    typeof value.achievedAt === "string" && Number.isFinite(Date.parse(value.achievedAt)) &&
    new Date(value.achievedAt).toISOString() === value.achievedAt;
}

export function isSharedProfile(value: unknown, accountId: string): value is SharedProfile {
  return object(value) && value.accountId === accountId && typeof value.displayName === "string" &&
    isClearedStage(value.highestClearedStage) && (value.best === null ||
      (isSharedBest(value.best) && value.best.accountId === accountId &&
        value.best.bestStage <= getHighestUnlockedStage(value.highestClearedStage) &&
        (value.best.bestScore < getStageRule(value.best.bestStage).scoreRequired || value.highestClearedStage >= value.best.bestStage)));
}

function isEntries(value: unknown): value is SharedBest[] {
  return Array.isArray(value) && value.length <= 10 && value.every(isSharedBest) &&
    new Set(value.map((entry) => entry.accountId)).size === value.length;
}

async function request(path: string, signal: AbortSignal, accountId?: string, payload?: SubmitResultRequest): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal.aborted) controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
  try {
    const response = await fetch(path, {
      method: payload ? "POST" : "GET", credentials: "include", cache: "no-store", redirect: "manual", mode: "same-origin",
      headers: { Accept: "application/json", ...(accountId ? { "X-Game-Account": accountId } : {}),
        ...(payload ? { "Content-Type": "application/json", "X-Game-Request": "1" } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}), signal: controller.signal,
    });
    if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (response.type === "opaqueredirect" || response.redirected || response.status === 401 || response.status === 403 ||
      (response.status >= 300 && response.status < 400)) throw new RecordApiError("unauthenticated");
    if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      throw new RecordApiError(response.status >= 500 ? "storage-unavailable" : "invalid-response");
    }
    let value: unknown;
    try { value = await response.json(); } catch {
      throw new RecordApiError(response.status >= 500 ? "storage-unavailable" : "invalid-response");
    }
    if (!response.ok) {
      const code = object(value) && object(value.error) ? value.error.code : null;
      if (code === "unauthenticated" || code === "invalid-request" || code === "stage-locked" ||
        code === "conflict" || code === "storage-unavailable") throw new RecordApiError(code);
      throw new RecordApiError(response.status >= 500 ? "storage-unavailable" : "invalid-response");
    }
    return value;
  } catch (error) {
    if (timedOut) throw new RecordApiError("timeout");
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (error instanceof RecordApiError) throw error;
    throw new RecordApiError("network");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

export async function fetchProfile(accountId: string, signal: AbortSignal): Promise<SharedProfile> {
  const value = await request("/api/profile", signal, accountId);
  if (!isSharedProfile(value, accountId)) throw new RecordApiError("invalid-response");
  return value;
}

export async function fetchLeaderboard(signal: AbortSignal): Promise<SharedBest[]> {
  const value = await request("/api/leaderboard", signal);
  if (!object(value) || !isEntries(value.entries)) throw new RecordApiError("invalid-response");
  return value.entries;
}

export async function postResult(accountId: string, payload: SubmitResultRequest, signal: AbortSignal): Promise<SubmitResultResponse> {
  const value = await request("/api/results", signal, accountId, payload);
  if (!object(value) || value.submissionId !== payload.submissionId || !isSharedProfile(value.profile, accountId) ||
    !isEntries(value.entries)) throw new RecordApiError("invalid-response");
  return value as unknown as SubmitResultResponse;
}

export interface CompanyRecordApi {
  fetchProfile: typeof fetchProfile;
  fetchLeaderboard: typeof fetchLeaderboard;
  postResult: typeof postResult;
}

export const companyRecordApi: CompanyRecordApi = { fetchProfile, fetchLeaderboard, postResult };
