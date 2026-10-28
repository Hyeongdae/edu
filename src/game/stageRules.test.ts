import { describe, expect, it } from "vitest";
import { getHighestUnlockedStage, getStageRule, getStageTargetScore, isClearedStage, isGameStage, STAGE_RULES } from "./stageRules";
import type { ClearedStage, GameStage } from "./types";

describe("stage rules", () => {
  it("shares the five agreed time, goal, obstacle and pursuit settings", () => {
    expect(STAGE_RULES).toEqual([
      { stage: 1, durationMs: 90_000, scoreRequired: 150, obstacleProbability: 0.1, pursuerStepIntervalMs: 600 },
      { stage: 2, durationMs: 75_000, scoreRequired: 200, obstacleProbability: 0.2, pursuerStepIntervalMs: 500 },
      { stage: 3, durationMs: 65_000, scoreRequired: 250, obstacleProbability: 0.3, pursuerStepIntervalMs: 400 },
      { stage: 4, durationMs: 60_000, scoreRequired: 300, obstacleProbability: 0.4, pursuerStepIntervalMs: 300 },
      { stage: 5, durationMs: 50_000, scoreRequired: 350, obstacleProbability: 0.5, pursuerStepIntervalMs: 250 },
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

describe("cleared progress and dynamic goals", () => {
 it.each([0,1,2,3,4,5])("accepts cleared stage %s", stage => expect(isClearedStage(stage)).toBe(true));
 it.each([-1,6,1.5,NaN,Infinity,"0",null,undefined])("rejects invalid cleared stage %s", stage => expect(isClearedStage(stage)).toBe(false));
 it.each([1,2,3,4,5] as const)("returns the stage-local goal for %s", stage => expect(getStageTargetScore(stage)).toBe(100+50*stage));
 it.each([0,6,-1,1.5,NaN,Infinity,"1",null,undefined])("rejects invalid target stage %s", stage => expect(() => getStageTargetScore(stage as GameStage)).toThrow(RangeError));
 it.each([[0,1],[1,2],[2,3],[3,4],[4,5],[5,5]] as const)("unlocks stage after clear %s, capped at five", (highest, unlocked) => expect(getHighestUnlockedStage(highest)).toBe(unlocked));
 it.each([-1,6,1.5,NaN,Infinity,"0",null,undefined])("rejects invalid unlock progress %s", highest => expect(() => getHighestUnlockedStage(highest as ClearedStage)).toThrow(RangeError));
});
