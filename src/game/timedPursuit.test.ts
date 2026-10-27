import * as stairObstacles from "./stairObstacles";
import { makeObstacleFixture } from "../test/obstacleFixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyInput, continueGame, createGameState, resetGame, resumeGameAfterPause, startGame, tickGame } from "./gameEngine";
import { advanceStairRoute, countStraightSteps, getRouteStep } from "./stairRoute";
import { buildStairSceneModel } from "./stairSceneModel";
import { getStageRule, STAGE_RULES } from "./stageRules";
import { withPursuitAt } from "../test/gameFixtures";
import type { GameStage, GameState } from "./types";

function playing(stage: GameStage = 1): GameState {
  return startGame(createGameState(() => 0, { stage, highestClearedStage: stage === 1 ? 0 : stage }), 0);
}
function farAhead(): GameState {
  let state = playing();
  for (let index = 1; index <= 120; index++) state = { ...state, route: advanceStairRoute(state.route, index, -4) };
  const direction = getRouteStep(state.route, 120).direction;
  return { ...state, stepsClimbed: 120, score: 399, pursuerDistance: 124, direction,
    straightStepsRemaining: countStraightSteps(state.route, 120, direction) };
}

describe("autonomous pursuit", () => {
  it.each(STAGE_RULES)("moves one real stair each $pursuerStepIntervalMs ms in stage $stage", rule => {
    const state = playing(rule.stage);
    expect(tickGame(state, rule.pursuerStepIntervalMs - 1)).toBe(state);
    const moved = tickGame(state, rule.pursuerStepIntervalMs);
    expect(moved).toMatchObject({ pursuerIndex: -3, pursuerDistance: 3, stepsClimbed: 0, score: 0,
      nextPursuerStepAt: rule.pursuerStepIntervalMs * 2,
      lastPursuerMove: { fromIndex: -4, toIndex: -3, atMs: rule.pursuerStepIntervalMs } });
    expect(tickGame(moved, rule.pursuerStepIntervalMs)).toBe(moved);
    expect(state.pursuerIndex).toBe(-4);
  });

  it("arms only on start and resets a new ready game", () => {
    const ready = createGameState(() => 0);
    expect(ready).toMatchObject({ pursuerIndex: -4, pursuerDistance: 4, nextPursuerStepAt: null,
      lastPursuerMove: null, captureCount: 0, captureEndsAt: null });
    expect(tickGame(ready, 1e6)).toBe(ready);
    const state = startGame(ready, 550);
    expect(state.nextPursuerStepAt).toBe(1350);
    expect(startGame(state, 1000)).toBe(state);
    expect(resetGame(() => 0)).toEqual(ready);
  });

  it.each(STAGE_RULES)("late and incremental ticks agree and capture only once in stage $stage", rule => {
    const initial = playing(rule.stage);
    let incremental = initial;
    for (let step = 1; step <= 15; step++) incremental = tickGame(incremental, rule.pursuerStepIntervalMs * step);
    const late = tickGame(initial, rule.pursuerStepIntervalMs * 15);
    expect(late).toEqual(incremental);
    expect(late).toMatchObject({ status: "game-over", endReason: "caught", captureCount: 1,
      pursuerIndex: -1, pursuerDistance: 1, nextPursuerStepAt: null, captureEndsAt: null });
    expect(late).not.toHaveProperty("lives");
  });

  it("captures at 3200ms and only expires the 500ms cosmetic gate afterward", () => {
    const state = playing();
    const first = tickGame(state, 3200);
    expect(first).toMatchObject({ status: "game-over", captureCount: 1, endReason: "caught",
      pursuerIndex: -1, pursuerDistance: 1, nextPursuerStepAt: null, captureEndsAt: 3700,
      recoveryEndsAt: null, lastMistake: false, lastPursuerMove: null });
    expect(tickGame(first, 3699)).toBe(first);
    expect(tickGame(first, 3700)).toMatchObject({ captureEndsAt: null, captureCount: 1, pursuerIndex: -1 });
    const ended = tickGame(first, 1e6);
    expect(tickGame(ended, 2e6)).toBe(ended);
    expect(applyInput(ended, "forward", 2e6)).toBe(ended);
    expect(buildStairSceneModel(first).pursuer.index).toBe(-1);
  });

  it("does not take another stage-five step during the terminal catch animation", () => {
    const caught = tickGame(playing(5), 1200);
    expect(caught).toMatchObject({ captureEndsAt: 1700, nextPursuerStepAt: null, pursuerIndex: -1 });
    expect(tickGame(caught, 1500)).toBe(caught);
    expect(tickGame(caught, 1700)).toMatchObject({ captureEndsAt: null, pursuerIndex: -1 });
  });

  it("preserves the original schedule during a 500ms mistake in this task", () => {
    const fallen = applyInput(playing(), "turn", 700);
    expect(fallen).toMatchObject({ lastMistake: true, recoveryEndsAt: 1200, pursuerIndex: -4, nextPursuerStepAt: 800 });
    const blocked = applyInput(fallen, "turn", 800);
    expect(blocked).toMatchObject({ recoveryEndsAt: 1200, pursuerIndex: -3, nextPursuerStepAt: 1600 });
    expect(applyInput(blocked, "forward", 1199)).toBe(blocked);
    expect(applyInput(blocked, "forward", 1200)).toMatchObject({ stepsClimbed: 1, score: 1, pursuerIndex: -3,
      pursuerDistance: 4, recoveryEndsAt: null, lastMistake: false, nextPursuerStepAt: 1600 });
  });

  it("widens the gap without advancing the pursuer or resetting its clock", () => {
    const moved = applyInput(playing(), "forward", 100);
    expect(moved).toMatchObject({ pursuerIndex: -4, pursuerDistance: 5, nextPursuerStepAt: 800, lastPursuerMove: null });
    expect(moved.route.steps[0].index).toBe(-4);
    expect(buildStairSceneModel(moved).pursuer.index).toBe(-4);
    expect(tickGame(moved, 800)).toMatchObject({ pursuerIndex: -3, pursuerDistance: 4 });
  });

  it("catches before a tied escaping input but allows the preceding millisecond", () => {
    const state = withPursuitAt(playing(), 0, 1);
    expect(applyInput(state, "forward", 799)).toMatchObject({ score: 1, stepsClimbed: 1 });
    expect(applyInput(state, "forward", 800)).toMatchObject({ status: "game-over", score: 0,
      stepsClimbed: 0, captureCount: 1, captureEndsAt: 1300, recoveryEndsAt: null });
  });

  it("prioritizes tied stage expiry and preserves an earlier capture over a later expiry", () => {
    const state = withPursuitAt({ ...playing(), stageEndsAt: 800, score: 399 }, 0, 1);
    expect(applyInput(state, "forward", 800)).toMatchObject({ endReason: "time-limit", score: 399, captureCount: 0, captureEndsAt: null });
    expect(tickGame({ ...state, stageEndsAt: 1200 }, 2000)).toMatchObject({ endReason: "caught", captureCount: 1, captureEndsAt: null });
  });

  it("processes tied bonus expiry before capture and stops event clocks on true termination", () => {
    expect(tickGame({ ...playing(), eventEndsAt: 3200, eventSteps: 9 }, 3200)).toMatchObject({ captureCount: 1,
      eventEndsAt: null, eventSteps: 0, score: 0, nextPursuerStepAt: null });
    expect(tickGame({ ...playing(), eventEndsAt: 6000, eventSteps: 9 }, 3200)).toMatchObject({ captureCount: 1, eventEndsAt: null, eventSteps: 9 });
  });

  it("retains an offscreen pursuer until a full ninety-second timeout", () => {
    const state = farAhead();
    expect(buildStairSceneModel(state)).toMatchObject({ pursuerVisible: false, pursuer: { index: -4 } });
    const after = tickGame(state, 90000);
    expect(after).toMatchObject({ endReason: "time-limit", captureCount: 0, pursuerIndex: 108, pursuerDistance: 12, score: 399 });
    expect(after.route.steps[0].index).toBe(108);
    expect(getRouteStep(after.route, 108).index).toBe(108);
    expect(state.route.steps[0].index).toBe(-4);
  });

  it("retains real adjacent motion endpoints while trimming history", () => {
    const after = tickGame(farAhead(), 1600);
    expect(after).toMatchObject({ pursuerIndex: -2, pursuerDistance: 122,
      lastPursuerMove: { fromIndex: -3, toIndex: -2, atMs: 1600 } });
    expect(after.route.steps[0].index).toBe(-3);
    expect(buildStairSceneModel(after).pursuerMotion).toMatchObject({ atMs: 1600 });
  });

  it.each(STAGE_RULES.slice(0,4))("freezes at stage $stage completion and rearms only on Continue", rule => {
    const checkpoint = applyInput({ ...playing(rule.stage), score: 399 }, "forward", 100);
    expect(checkpoint).toMatchObject({ stage: rule.stage, status: "checkpoint", nextPursuerStepAt: null });
    expect(tickGame(checkpoint, 100000)).toBe(checkpoint);
    const next = getStageRule((rule.stage + 1) as GameStage);
    const resumed = continueGame(checkpoint, 100000);
    expect(resumed).toMatchObject({ stage: next.stage, pursuerIndex: -3, pursuerDistance: 4,
      nextPursuerStepAt: 100000 + next.pursuerStepIntervalMs, lastPursuerMove: null, captureEndsAt: null });
    expect(applyInput(resumed, "forward", 100001).nextPursuerStepAt).toBe(resumed.nextPursuerStepAt);
  });

  it("stops pursuit permanently on final clear", () => {
    const cleared = applyInput({ ...playing(5), score: 399 }, "forward", 100);
    expect(cleared).toMatchObject({ endReason: "cleared", score: 400, recordStage: 5,
      nextPursuerStepAt: null, lastPursuerMove: null, pursuerDistance: 5 });
    expect(tickGame(cleared, 1e6)).toBe(cleared);
  });

  it("shifts all logical clocks once while cosmetic recovery elapses", () => {
    const fallen = applyInput({ ...playing(), eventEndsAt: 30000 }, "turn", 100);
    const after = resumeGameAfterPause(fallen, 200, 95200);
    expect(after).toMatchObject({ stageEndsAt: 185000, eventEndsAt: 125000, nextPursuerStepAt: 95800,
      pursuerIndex: -4, pursuerDistance: 4, lastMistake: false, recoveryEndsAt: null });
    expect(resumeGameAfterPause(after, 95200, 95200)).toBe(after);
    expect(tickGame(after, 95799)).toBe(after);
    expect(tickGame(after, 95800).pursuerIndex).toBe(-3);
  });

  it("cannot revive captured, expired or ready games by opening settings", () => {
    expect(resumeGameAfterPause(playing(), 3200, 100000)).toMatchObject({ endReason: "caught", nextPursuerStepAt: null });
    expect(resumeGameAfterPause({ ...playing(), stageEndsAt: 500 }, 500, 100000)).toMatchObject({ endReason: "time-limit", stageEndsAt: null });
    expect(resumeGameAfterPause(createGameState(() => 0), 0, 100000).nextPursuerStepAt).toBeNull();
  });

  it("is immutable and deterministic on replay", () => {
    const state = playing(); const snapshot = structuredClone(state); Object.freeze(state);
    expect(tickGame(state, 5500)).toEqual(tickGame(state, 5500)); expect(state).toEqual(snapshot);
  });

  it("rejects invalid clocks, cached gaps, missing nodes and malformed motion", () => {
    const state = playing();
    for (const invalid of [
      { ...state, pursuerDistance: 5 }, { ...state, pursuerIndex: -5, pursuerDistance: 5 },
      { ...state, nextPursuerStepAt: null }, { ...state, nextPursuerStepAt: NaN },
      { ...state, stageEndsAt: null }, { ...state, captureCount: -1 },
      { ...state, lastPursuerMove: { fromIndex: -3, toIndex: -4, atMs: 0 } },
    ]) expect(() => tickGame(invalid, 0)).toThrow(RangeError);
    for (const time of [-1,NaN,Infinity]) expect(() => tickGame(state, time)).toThrow(RangeError);
    expect(() => withPursuitAt(state,0,5)).toThrow(RangeError);
    expect(() => withPursuitAt(state,NaN)).toThrow(RangeError);
    expect(() => withPursuitAt(state,0,0)).toThrow(RangeError);
  });
});
beforeEach(() => {
  vi.spyOn(stairObstacles,"createObstacleState").mockImplementation((route,stage) => makeObstacleFixture(route,0,stage));
  vi.spyOn(stairObstacles,"revealObstacles").mockImplementation((state,route,index,stage) => makeObstacleFixture(route,index,stage,state));
});
afterEach(() => vi.restoreAllMocks());
