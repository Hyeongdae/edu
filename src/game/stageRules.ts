import type { ClearedStage, GameStage } from "./types";

export interface StageRule {
  readonly stage: GameStage;
  readonly durationMs: number;
  readonly scoreRequired: number;
  readonly obstacleProbability: number;
  readonly pursuerStepIntervalMs: number;
}

export const STAGE_RULES: readonly StageRule[] = [
  { stage: 1, durationMs: 90_000, scoreRequired: 150, obstacleProbability: 0.1, pursuerStepIntervalMs: 500 },
  { stage: 2, durationMs: 75_000, scoreRequired: 200, obstacleProbability: 0.2, pursuerStepIntervalMs: 400 },
  { stage: 3, durationMs: 65_000, scoreRequired: 250, obstacleProbability: 0.3, pursuerStepIntervalMs: 350 },
  { stage: 4, durationMs: 60_000, scoreRequired: 300, obstacleProbability: 0.4, pursuerStepIntervalMs: 300 },
  { stage: 5, durationMs: 50_000, scoreRequired: 350, obstacleProbability: 0.5, pursuerStepIntervalMs: 280 },
];

export function isClearedStage(value: unknown): value is ClearedStage {
  return value === 0 || isGameStage(value);
}

export function getStageTargetScore(stage: GameStage): number {
  return getStageRule(stage).scoreRequired;
}

export function getHighestUnlockedStage(highestClearedStage: ClearedStage): GameStage {
  if (!isClearedStage(highestClearedStage)) throw new RangeError("highestClearedStage must be an integer from 0 to 5.");
  return Math.min(5, highestClearedStage + 1) as GameStage;
}

export function isGameStage(value: unknown): value is GameStage {
  return STAGE_RULES.some((rule) => rule.stage === value);
}

export function getStageRule(stage: GameStage): Readonly<StageRule> {
  const rule = STAGE_RULES.find((entry) => entry.stage === stage);
  if (!rule) throw new RangeError("stage must be an integer from 1 to 5.");
  return rule;
}
