import { describe, expect, it } from "vitest";
import { getStageRule, isGameStage, STAGE_RULES } from "./stageRules";
import type { GameStage } from "./types";

describe("stage rules", () => {
  it("shares the five agreed time, goal, obstacle and pursuit settings", () => {
    expect(STAGE_RULES).toEqual([
      { stage: 1, durationMs: 90_000, targetScore: 300, obstacleProbability: 0.1, pursuerStepIntervalMs: 1_000 },
      { stage: 2, durationMs: 75_000, targetScore: 600, obstacleProbability: 0.2, pursuerStepIntervalMs: 800 },
      { stage: 3, durationMs: 65_000, targetScore: 900, obstacleProbability: 0.3, pursuerStepIntervalMs: 600 },
      { stage: 4, durationMs: 60_000, targetScore: 1_200, obstacleProbability: 0.4, pursuerStepIntervalMs: 500 },
      { stage: 5, durationMs: 50_000, targetScore: 1_500, obstacleProbability: 0.5, pursuerStepIntervalMs: 400 },
    ]);
  });

  it.each([1, 2, 3, 4, 5] as const)("accepts numeric stage %s and returns its shared rule", (stage) => {
    expect(isGameStage(stage)).toBe(true);
    expect(getStageRule(stage)).toBe(STAGE_RULES[stage - 1]);
  });

  it.each([0, 6, -1, 1.5, NaN, Infinity, "1", "5", null, undefined, {}, true])(
    "rejects invalid runtime stages: %s", (stage) => {
      expect(isGameStage(stage)).toBe(false);
      expect(() => getStageRule(stage as GameStage)).toThrow(RangeError);
    },
  );
});
