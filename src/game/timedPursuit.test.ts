import * as stairObstacles from "./stairObstacles";
import { makeObstacleFixture } from "../test/obstacleFixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyInput, continueGame, createGameState, FALL_PURSUER_INTERVAL_MS, resetGame, resumeGameAfterPause, startGame, tickGame } from "./gameEngine";
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
  return { ...state, stepsClimbed: 120, score: 149, pursuerDistance: 124, direction,
    isPursuerCatchingUp: true, nextPursuerStepAt: 100,
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
    expect(state.nextPursuerStepAt).toBe(1050);
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

  it("captures at 2000ms and only expires the 500ms cosmetic gate afterward", () => {
    const state = playing();
    const first = tickGame(state, 2000);
    expect(first).toMatchObject({ status: "game-over", captureCount: 1, endReason: "caught",
      pursuerIndex: -1, pursuerDistance: 1, nextPursuerStepAt: null, captureEndsAt: 2500,
      recoveryEndsAt: null, lastMistake: false, lastPursuerMove: null });
    expect(tickGame(first, 2499)).toBe(first);
    expect(tickGame(first, 2500)).toMatchObject({ captureEndsAt: null, captureCount: 1, pursuerIndex: -1 });
    const ended = tickGame(first, 1e6);
    expect(tickGame(ended, 2e6)).toBe(ended);
    expect(applyInput(ended, "forward", 2e6)).toBe(ended);
    expect(buildStairSceneModel(first).pursuer.index).toBe(-1);
  });

  it("does not take another stage-five step during the terminal catch animation", () => {
    const caught = tickGame(playing(5), 1120);
    expect(caught).toMatchObject({ captureEndsAt: 1620, nextPursuerStepAt: null, pursuerIndex: -1 });
    expect(tickGame(caught, 1619)).toBe(caught);
    expect(tickGame(caught, 1620)).toMatchObject({ captureEndsAt: null, pursuerIndex: -1 });
  });

  it("preserves an earlier pending step and accelerates its successor only inside recovery", () => {
    const fallen = applyInput(playing(), "turn", 400);
    expect(fallen).toMatchObject({ lastMistake: true, recoveryEndsAt: 900, pursuerIndex: -4, nextPursuerStepAt: 500 });
    const blocked = applyInput(fallen, "turn", 500);
    expect(blocked).toMatchObject({ recoveryEndsAt: 900, pursuerIndex: -3, nextPursuerStepAt: 750 });
    const second = applyInput(blocked, "forward", 899);
    expect(second).toMatchObject({ recoveryEndsAt: 900, pursuerIndex: -2, nextPursuerStepAt: 1250, score: 0 });
    expect(applyInput(second, "forward", 900)).toMatchObject({ stepsClimbed: 1, score: 1, pursuerIndex: -2,
      pursuerDistance: 3, recoveryEndsAt: null, lastMistake: false, nextPursuerStepAt: 1250 });
  });

  it("widens the gap without advancing the pursuer or resetting its clock", () => {
    const moved = applyInput(playing(), "forward", 100);
    expect(moved).toMatchObject({ pursuerIndex: -4, pursuerDistance: 5, nextPursuerStepAt: 500, lastPursuerMove: null });
    expect(moved.route.steps[0].index).toBe(-4);
    expect(buildStairSceneModel(moved).pursuer.index).toBe(-4);
    expect(tickGame(moved, 500)).toMatchObject({ pursuerIndex: -3, pursuerDistance: 4 });
  });

  it("catches before a tied escaping input but allows the preceding millisecond", () => {
    const state = withPursuitAt(playing(), 0, 1);
    expect(applyInput(state, "forward", 499)).toMatchObject({ score: 1, stepsClimbed: 1 });
    expect(applyInput(state, "forward", 500)).toMatchObject({ status: "game-over", score: 0,
      stepsClimbed: 0, captureCount: 1, captureEndsAt: 1000, recoveryEndsAt: null });
  });

  it("prioritizes tied stage expiry and preserves an earlier capture over a later expiry", () => {
    const state = withPursuitAt({ ...playing(), stageEndsAt: 500, score: 149 }, 0, 1);
    expect(applyInput(state, "forward", 500)).toMatchObject({ endReason: "time-limit", score: 149, captureCount: 0, captureEndsAt: null });
    expect(tickGame({ ...state, stageEndsAt: 1200 }, 2000)).toMatchObject({ endReason: "caught", captureCount: 1, captureEndsAt: null });
  });

  it("processes tied bonus expiry before capture and stops event clocks on true termination", () => {
    expect(tickGame({ ...playing(), eventEndsAt: 2000, eventSteps: 9 }, 2000)).toMatchObject({ captureCount: 1,
      eventEndsAt: null, eventSteps: 0, score: 0, nextPursuerStepAt: null });
    expect(tickGame({ ...playing(), eventEndsAt: 6000, eventSteps: 9 }, 3200)).toMatchObject({ captureCount: 1, eventEndsAt: null, eventSteps: 9 });
  });

  it("retains real offscreen history through catch-up until capture", () => {
    const state = farAhead();
    expect(buildStairSceneModel(state)).toMatchObject({ pursuerVisible: false, pursuer: { index: -4 } });
    const after = tickGame(state, 90000);
    expect(after).toMatchObject({ endReason: "caught", captureCount: 1, pursuerIndex: 119, pursuerDistance: 1, score: 149 });
    expect(after.route.steps[0].index).toBe(116);
    expect(getRouteStep(after.route, 119).index).toBe(119);
    expect(state.route.steps[0].index).toBe(-4);
  });

  it("retains real adjacent motion endpoints while trimming history", () => {
    const after = tickGame(farAhead(), 3200);
    expect(after).toMatchObject({ pursuerIndex: 28, pursuerDistance: 92,
      lastPursuerMove: { fromIndex: 27, toIndex: 28, atMs: 3200 } });
    expect(after.route.steps[0].index).toBe(27);
    expect(buildStairSceneModel(after).pursuerMotion).toMatchObject({ atMs: 3200 });
  });

  it.each(STAGE_RULES.slice(0,4))("freezes at stage $stage completion and rearms only on Continue", rule => {
    const checkpoint = applyInput({ ...playing(rule.stage), score: rule.scoreRequired - 1 }, "forward", 100);
    expect(checkpoint).toMatchObject({ stage: rule.stage, status: "checkpoint", nextPursuerStepAt: null });
    expect(tickGame(checkpoint, 100000)).toBe(checkpoint);
    const next = getStageRule((rule.stage + 1) as GameStage);
    const resumed = continueGame(checkpoint, 100000);
    expect(resumed).toMatchObject({ stage: next.stage, pursuerIndex: -3, pursuerDistance: 4,
      nextPursuerStepAt: 100000 + next.pursuerStepIntervalMs, lastPursuerMove: null, captureEndsAt: null });
    expect(applyInput(resumed, "forward", 100001).nextPursuerStepAt).toBe(resumed.nextPursuerStepAt);
  });

  it("stops pursuit permanently on final clear", () => {
    const cleared = applyInput({ ...playing(5), score: 349 }, "forward", 100);
    expect(cleared).toMatchObject({ endReason: "cleared", score: 350, highestClearedStage: 5,
      nextPursuerStepAt: null, lastPursuerMove: null, pursuerDistance: 5 });
    expect(tickGame(cleared, 1e6)).toBe(cleared);
  });

  it("shifts all logical clocks once while cosmetic recovery elapses", () => {
    const fallen = applyInput({ ...playing(), eventEndsAt: 30000 }, "turn", 100);
    const after = resumeGameAfterPause(fallen, 200, 95200);
    expect(after).toMatchObject({ stageEndsAt: 185000, eventEndsAt: 125000, nextPursuerStepAt: 95350,
      pursuerIndex: -4, pursuerDistance: 4, lastMistake: false, recoveryEndsAt: null });
    expect(resumeGameAfterPause(after, 95200, 95200)).toBe(after);
    expect(tickGame(after, 95349)).toBe(after);
    expect(tickGame(after, 95350).pursuerIndex).toBe(-3);
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
describe("fall pursuit scheduling", () => {
  it.each(STAGE_RULES)("uses exact 250/500ms moves then the base interval in stage $stage", rule => {
    const before = playing(rule.stage);
    const fallen = applyInput(before, "turn", 0);
    expect(FALL_PURSUER_INTERVAL_MS).toBe(250);
    expect(fallen).toEqual({ ...before, lastMove: null, lastMistake: true, recoveryEndsAt: 500, nextPursuerStepAt: 250 });
    expect(tickGame(fallen, 249)).toBe(fallen);
    const first = tickGame(fallen, 250);
    expect(first).toMatchObject({ pursuerIndex: -3, pursuerDistance: 3, nextPursuerStepAt: 500,
      recoveryEndsAt: 500, lastMistake: true, lastPursuerMove: { fromIndex: -4, toIndex: -3, atMs: 250 } });
    expect(tickGame(first, 499)).toBe(first);
    const second = tickGame(first, 500);
    expect(second).toMatchObject({ pursuerIndex: -2, pursuerDistance: 2, nextPursuerStepAt: 500 + rule.pursuerStepIntervalMs,
      recoveryEndsAt: null, lastMistake: false, lastPursuerMove: { fromIndex: -3, toIndex: -2, atMs: 500 } });
    expect(tickGame(second, 500 + rule.pursuerStepIntervalMs - 1)).toBe(second);
    expect(tickGame(second, 500 + rule.pursuerStepIntervalMs)).toMatchObject({ pursuerIndex: -1,
      nextPursuerStepAt: 500 + 2 * rule.pursuerStepIntervalMs,
      lastPursuerMove: { fromIndex: -2, toIndex: -1, atMs: 500 + rule.pursuerStepIntervalMs } });
  });

  it.each(STAGE_RULES)("retains a 100ms pending step, then350 and a base successor in stage $stage", rule => {
    const fallen = applyInput({ ...playing(rule.stage), nextPursuerStepAt: 100 }, "turn", 0);
    expect(fallen.nextPursuerStepAt).toBe(100);
    expect(tickGame(fallen, 99)).toBe(fallen);
    const first = tickGame(fallen, 100);
    expect(first.nextPursuerStepAt).toBe(350);
    const second = tickGame(first, 350);
    expect(second).toMatchObject({ pursuerIndex: -2, nextPursuerStepAt: 350 + rule.pursuerStepIntervalMs });
    const recovered = tickGame(second, 500);
    expect(recovered).toMatchObject({ lastMistake: false, recoveryEndsAt: null,
      pursuerIndex: -2, nextPursuerStepAt: 350 + rule.pursuerStepIntervalMs });
    expect(tickGame(recovered, 350 + rule.pursuerStepIntervalMs).lastPursuerMove?.atMs).toBe(350 + rule.pursuerStepIntervalMs);
  });

  it("does not extend recovery or postpone pursuit on repeated inputs", () => {
    const fallen = applyInput(playing(), "turn", 0);
    const first = tickGame(fallen, 250);
    for (const input of ["forward", "turn", "jump"] as const) {
      expect(applyInput(first, input, 450)).toBe(first);
      expect(first.recoveryEndsAt).toBe(500); expect(first.nextPursuerStepAt).toBe(500);
    }
    expect(applyInput(first, "forward", 500)).toMatchObject({ score: 1, stepsClimbed: 1,
      pursuerIndex: -2, pursuerDistance: 3, nextPursuerStepAt: 1000, recoveryEndsAt: null, lastMistake: false });
  });

  it.each([[1, 250], [2, 500]] as const)("ends once at fast contact with gap%s before an escaping input", (gap, at) => {
    const fallen = applyInput(withPursuitAt(playing(), 0, gap), "turn", 0);
    const caught = applyInput(fallen, "forward", at);
    expect(caught).toMatchObject({ status: "game-over", endReason: "caught", score: 0, stepsClimbed: 0,
      captureCount: 1, captureEndsAt: at + 500, pursuerIndex: -1, pursuerDistance: 1,
      nextPursuerStepAt: null, lastPursuerMove: null, lastMove: null, recoveryEndsAt: null, lastMistake: false });
    expect(tickGame(caught, at + 499)).toBe(caught);
    const ended = tickGame(caught, 1e6);
    expect(ended).toMatchObject({ captureCount: 1, endReason: "caught", captureEndsAt: null });
    expect(tickGame(ended, 2e6)).toBe(ended);
  });

  it.each([[1, 250], [2, 500]] as const)("prioritizes stage expiry over tied fast contact at gap%s", (gap, at) => {
    const fallen = applyInput(withPursuitAt({ ...playing(), stageEndsAt: at }, 0, gap), "turn", 0);
    expect(applyInput(fallen, "forward", at)).toMatchObject({ endReason: "time-limit", score: 0,
      captureCount: 0, captureEndsAt: null, nextPursuerStepAt: null, recoveryEndsAt: null, lastMistake: false });
  });

  it("keeps an earlier250ms catch over a251ms deadline and independently expires a250ms bonus", () => {
    const fatal = applyInput(withPursuitAt({ ...playing(), stageEndsAt: 251 }, 0, 1), "turn", 0);
    expect(tickGame(fatal, 1300)).toMatchObject({ endReason: "caught", captureCount: 1, captureEndsAt: null });
    const bonus = applyInput({ ...playing(), eventEndsAt: 250, eventSteps: 9 }, "turn", 0);
    expect(tickGame(bonus, 250)).toMatchObject({ eventEndsAt: null, eventSteps: 0,
      lastMistake: true, recoveryEndsAt: 500, pursuerIndex: -3, nextPursuerStepAt: 500 });
  });

  it.each(STAGE_RULES)("late and incremental fall ticks replay identically in stage $stage", rule => {
    const fallen = applyInput(playing(rule.stage), "turn", 0), snapshot = structuredClone(fallen);
    let incremental = fallen;
    for (const at of [249, 250, 499, 500, 750, 800, 1150, 1300]) incremental = tickGame(incremental, at);
    expect(tickGame(fallen, 1300)).toEqual(incremental);
    expect(fallen).toEqual(snapshot);
  });

  it("pauses the pending fast step once while the cosmetic recovery elapses", () => {
    const fallen = applyInput({ ...playing(), eventEndsAt: 30_000 }, "turn", 0);
    const paused = resumeGameAfterPause(fallen, 100, 10_100);
    expect(paused).toMatchObject({ stageEndsAt: 100_000, eventEndsAt: 40_000, nextPursuerStepAt: 10_250,
      pursuerIndex: -4, recoveryEndsAt: null, lastMistake: false });
    expect(resumeGameAfterPause(paused, 10_100, 10_100)).toBe(paused);
    expect(tickGame(paused, 10_249)).toBe(paused);
    expect(tickGame(paused, 10_250)).toMatchObject({ pursuerIndex: -3, nextPursuerStepAt: 10_750,
      lastPursuerMove: { fromIndex: -4, toIndex: -3, atMs: 10_250 } });
    expect(resumeGameAfterPause(fallen, 250, 10_250)).toMatchObject({ pursuerIndex: -3,
      nextPursuerStepAt: 10_500, recoveryEndsAt: null, lastMistake: false });
  });

  it("keeps ready/checkpoint/ended states inactive and starts only base pursuit on Continue", () => {
    const ready = createGameState(() => 0);
    expect(applyInput(ready, "turn", 1e6)).toBe(ready);
    const checkpoint = applyInput({ ...playing(), score: 149 }, "forward", 0);
    expect(applyInput(checkpoint, "turn", 95_000)).toBe(checkpoint);
    expect(resumeGameAfterPause(checkpoint, 0, 95_000)).toBe(checkpoint);
    const resumed = continueGame(checkpoint, 95_000);
    expect(resumed).toMatchObject({ lastMistake: false, recoveryEndsAt: null, nextPursuerStepAt: 95_400 });
    const caught = tickGame(withPursuitAt(playing(), 0, 1), 800);
    expect(applyInput(caught, "turn", 800)).toBe(caught);
  });

  it("allows a goal only after recovery and freezes the checkpoint without a remaining fast step", () => {
    const fallen = applyInput({ ...playing(), score: 149, eventEndsAt: 30_000 }, "turn", 0);
    const blocked = applyInput(fallen, "forward", 499);
    expect(blocked).toMatchObject({ status: "playing", score: 149, stepsClimbed: 0, recoveryEndsAt: 500 });
    const checkpoint = applyInput(blocked, "forward", 500);
    expect(checkpoint).toMatchObject({ status: "checkpoint", score: 150, stepsClimbed: 1,
      recoveryEndsAt: null, lastMistake: false, nextPursuerStepAt: null, lastPursuerMove: null });
    expect(tickGame(checkpoint, 95_000)).toBe(checkpoint);
    expect(continueGame(checkpoint, 95_000)).toMatchObject({ status: "playing", stage: 2,
      pursuerDistance: 4, nextPursuerStepAt: 95_400, eventEndsAt: 124_500 });
  });

  it("is pure, reveals no obstacles and consumes no randomness on a mistake or fast tick", () => {
    const state = playing(), snapshot = structuredClone(state);
    const random = vi.spyOn(Math, "random"), reveal = vi.mocked(stairObstacles.revealObstacles);
    reveal.mockClear(); Object.freeze(state);
    const fallen = applyInput(state, "turn", 0);
    expect(applyInput(state, "turn", 0)).toEqual(fallen); expect(state).toEqual(snapshot);
    expect(fallen.route).toBe(state.route); expect(fallen.obstacles).toBe(state.obstacles);
    tickGame(fallen, 1300);
    expect(random).not.toHaveBeenCalled(); expect(reveal).not.toHaveBeenCalled();
    for (const time of [-1, NaN, Infinity]) {
      expect(() => applyInput(fallen, "turn", time)).toThrow(RangeError);
      expect(() => tickGame(fallen, time)).toThrow(RangeError);
    }
  });
});

beforeEach(() => {
  vi.spyOn(stairObstacles,"createObstacleState").mockImplementation((route,stage) => makeObstacleFixture(route,0,stage));
  vi.spyOn(stairObstacles,"revealObstacles").mockImplementation((state,route,index,stage) => makeObstacleFixture(route,index,stage,state));
});
afterEach(() => vi.restoreAllMocks());
