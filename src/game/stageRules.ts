import type { ClearedStage, GameStage } from "./types";

export interface StageRule {
  readonly stage: GameStage;
  readonly durationMs: number;
  readonly scoreRequired: number;
  readonly obstacleProbability: number;
  readonly pursuerStepIntervalMs: number;
}

export const STAGE_SCORE_REQUIRED = 400;
export const STAGE_RULES: readonly StageRule[] = [
  { stage: 1, durationMs: 90_000, scoreRequired: STAGE_SCORE_REQUIRED, obstacleProbability: 0.1, pursuerStepIntervalMs: 800 },
  { stage: 2, durationMs: 75_000, scoreRequired: STAGE_SCORE_REQUIRED, obstacleProbability: 0.2, pursuerStepIntervalMs: 650 },
  { stage: 3, durationMs: 65_000, scoreRequired: STAGE_SCORE_REQUIRED, obstacleProbability: 0.3, pursuerStepIntervalMs: 500 },
  { stage: 4, durationMs: 60_000, scoreRequired: STAGE_SCORE_REQUIRED, obstacleProbability: 0.4, pursuerStepIntervalMs: 400 },
  { stage: 5, durationMs: 50_000, scoreRequired: STAGE_SCORE_REQUIRED, obstacleProbability: 0.5, pursuerStepIntervalMs: 300 },
];

export function isClearedStage(value: unknown): value is ClearedStage {
  return value === 0 || isGameStage(value);
}

export function getStageTargetScore(stageStartScore: number): number {
  if (!Number.isSafeInteger(stageStartScore) || stageStartScore < 0 || !Number.isSafeInteger(stageStartScore + STAGE_SCORE_REQUIRED)) {
    throw new RangeError("stageStartScore and its target must be non-negative safe integers.");
  }
  return stageStartScore + STAGE_SCORE_REQUIRED;
}

export function isGameStage(value: unknown): value is GameStage {
  return STAGE_RULES.some((rule) => rule.stage === value);
}

export function getStageRule(stage: GameStage): Readonly<StageRule> {
  const rule = STAGE_RULES.find((entry) => entry.stage === stage);
  if (!rule) throw new RangeError("stage must be an integer from 1 to 5.");
  return rule;
}
