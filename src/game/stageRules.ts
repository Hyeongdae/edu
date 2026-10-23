import type { GameStage } from "./types";

export interface StageRule {
  readonly stage: GameStage;
  readonly durationMs: number;
  readonly targetScore: number;
  readonly obstacleProbability: number;
  readonly pursuerStepIntervalMs: number;
}

export const STAGE_RULES: readonly StageRule[] = [
  { stage: 1, durationMs: 90_000, targetScore: 300, obstacleProbability: 0.1, pursuerStepIntervalMs: 1_000 },
  { stage: 2, durationMs: 75_000, targetScore: 600, obstacleProbability: 0.2, pursuerStepIntervalMs: 800 },
  { stage: 3, durationMs: 65_000, targetScore: 900, obstacleProbability: 0.3, pursuerStepIntervalMs: 600 },
  { stage: 4, durationMs: 60_000, targetScore: 1_200, obstacleProbability: 0.4, pursuerStepIntervalMs: 500 },
  { stage: 5, durationMs: 50_000, targetScore: 1_500, obstacleProbability: 0.5, pursuerStepIntervalMs: 400 },
];

export function isGameStage(value: unknown): value is GameStage {
  return STAGE_RULES.some((rule) => rule.stage === value);
}

export function getStageRule(stage: GameStage): Readonly<StageRule> {
  const rule = STAGE_RULES.find((entry) => entry.stage === stage);
  if (!rule) throw new RangeError("stage must be an integer from 1 to 5.");
  return rule;
}
