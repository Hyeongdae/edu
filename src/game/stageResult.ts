import { getStageRule, isGameStage } from "./stageRules";
import type { GameState, StageResult } from "./types";

export function isStageResult(value: unknown): value is StageResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Partial<StageResult>;
  return isGameStage(result.stage) &&
    typeof result.score === "number" && Number.isInteger(result.score) && result.score >= 0 &&
    result.score <= getStageRule(result.stage).scoreRequired &&
    typeof result.endedAtMs === "number" && Number.isFinite(result.endedAtMs) && result.endedAtMs >= 0 &&
    typeof result.remainingTimeCs === "number" && Number.isSafeInteger(result.remainingTimeCs) &&
    result.remainingTimeCs >= 0 && result.remainingTimeCs <= getStageRule(result.stage).durationMs / 10 &&
    (result.outcome === "cleared" || result.outcome === "caught" ||
      (result.outcome === "time-limit" && result.remainingTimeCs === 0));
}

export function captureStageResult(
  state: Pick<GameState, "stage" | "score" | "stageEndsAt">,
  outcome: StageResult["outcome"],
  endedAtMs: number,
): StageResult {
  if (typeof state !== "object" || state === null || typeof state.stageEndsAt !== "number" ||
    !Number.isFinite(state.stageEndsAt) || state.stageEndsAt < 0 ||
    !Number.isFinite(endedAtMs) || endedAtMs < 0) {
    throw new RangeError("A stage result requires a valid deadline and end time.");
  }
  const result: StageResult = {
    stage: state.stage,
    score: state.score,
    remainingTimeCs: outcome === "time-limit" ? 0 : Math.floor(Math.max(0, state.stageEndsAt - endedAtMs) / 10),
    endedAtMs,
    outcome,
  };
  if (!isStageResult(result)) throw new RangeError("Invalid stage result.");
  return result;
}

export function formatRemainingTimeCs(remainingTimeCs: number): string {
  if (!Number.isSafeInteger(remainingTimeCs) || remainingTimeCs < 0) {
    throw new RangeError("Remaining time must be a non-negative safe integer in centiseconds.");
  }
  return `${Math.floor(remainingTimeCs / 100)}.${String(remainingTimeCs % 100).padStart(2, "0")}초`;
}
