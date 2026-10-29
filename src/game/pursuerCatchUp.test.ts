import { describe, expect, it } from "vitest";
import { applyInput, continueGame, createGameState, quitAtCheckpoint, resetGame, resumeGameAfterPause, startGame, tickGame } from "./gameEngine";
import { getPursuerCatchUpState, getPursuerMotionDurationMs } from "./pursuitRules";
import { getStageRule } from "./stageRules";
import { getRouteStep } from "./stairRoute";
import { hasObstacle } from "./stairObstacles";
import { withPursuitAt } from "../test/gameFixtures";
import { withObstacle } from "../test/obstacleFixtures";
import { applyDescentInput, createDescentState, startDescent, tickDescent } from "../descent/descentEngine";
import type { ClearedStage, GameInput, GameStage, GameState } from "./types";

function playing(stage: GameStage = 1): GameState {
  return startGame(createGameState(() => 0, { stage, highestClearedStage: (stage - 1) as ClearedStage }), 0);
}
function legalInput(state: GameState): GameInput {
  return hasObstacle(state.obstacles, state.stepsClimbed + 1) ? "jump"
    : getRouteStep(state.route, state.stepsClimbed + 1).direction === state.direction ? "forward" : "turn";
}
function atGap(distance: number, stage: GameStage = 1): GameState {
  let state = playing(stage);
  while (state.stepsClimbed < distance - 4) state = applyInput(state, legalInput(state), 0);
  expect(state.pursuerDistance).toBe(distance);
  return state;
}

describe("distance based catch-up", () => {
  it.each([[1,600],[2,500],[3,400],[4,300],[5,250]] as const)("uses stage%s base%s and resets mode", (stage, interval) => {
    expect(getStageRule(stage).pursuerStepIntervalMs).toBe(interval);
    const state = playing(stage);
    expect(state).toMatchObject({ isPursuerCatchingUp: false, nextPursuerStepAt: interval });
    expect(tickGame(state, interval - 1)).toBe(state);
    expect(tickGame(state, interval)).toMatchObject({ pursuerIndex: -3, nextPursuerStepAt: interval * 2 });
    expect(resetGame(() => 0).isPursuerCatchingUp).toBe(false);
  });

  it.each([[false,14,false],[false,15,true],[false,16,true],[true,14,true],[true,7,true],[true,6,false],[true,5,false]] as const)(
    "remembers mode%s at gap%s => %s", (before, distance, after) => expect(getPursuerCatchUpState(before, distance)).toBe(after),
  );

  it("enters at exactly15 on a legal step, preserves position and does not postpone on repeated input", () => {
    const before = atGap(14), snapshot = structuredClone(before);
    expect(before).toMatchObject({ isPursuerCatchingUp: false, nextPursuerStepAt: 600 });
    const entered = applyInput(before, legalInput(before), 100);
    expect(entered).toMatchObject({ pursuerIndex: -4, pursuerDistance: 15, isPursuerCatchingUp: true, nextPursuerStepAt: 200 });
    expect(before).toEqual(snapshot);
    const repeated = applyInput(entered, legalInput(entered), 125);
    expect(repeated.nextPursuerStepAt).toBe(200);
    expect(tickGame(repeated, 199)).toBe(repeated);
    expect(tickGame(repeated, 200)).toMatchObject({ pursuerIndex: -3, nextPursuerStepAt: 300 });
    expect(applyInput({ ...before, nextPursuerStepAt: 120 }, legalInput(before), 100).nextPursuerStepAt).toBe(120);
  });

  it("enters when a legal jump crosses gap15 and uses physical stairs instead of bonus score", () => {
    // Move along the real route to the next long-run interior jump takeoff.
    let state = atGap(14);
    while (true) {
      try { state = withObstacle(state, state.stepsClimbed + 1); break; }
      catch { state = applyInput(state, legalInput(state), 0); }
    }
    state = { ...withPursuitAt(state, 0, 14), eventEndsAt: 30_000 };
    const result = applyInput(state, "jump", 0);
    expect(result).toMatchObject({ pursuerDistance: 16, isPursuerCatchingUp: true, nextPursuerStepAt: 100,
      lastMove: { scoreGain: 4, kind: "jump" } });
    const ordinaryState = atGap(10);
    const ordinary = applyInput({ ...ordinaryState, eventEndsAt: 30_000, score: 100 }, legalInput(ordinaryState), 0);
    expect(ordinary.isPursuerCatchingUp).toBe(false);
  });

  it.each([1,2,3,4,5] as const)("walks adjacent stairs every100ms until6 then restores stage%s interval", stage => {
    const initial = atGap(15, stage), snapshot = structuredClone(initial);
    let state = initial;
    for (let step = 1; step <= 9; step++) {
      expect(tickGame(state, step * 100 - 1)).toBe(state);
      state = tickGame(state, step * 100);
      expect(state).toMatchObject({ pursuerIndex: -4 + step, pursuerDistance: 15 - step,
        isPursuerCatchingUp: step < 9,
        lastPursuerMove: { fromIndex: -5 + step, toIndex: -4 + step, atMs: step * 100 } });
      expect(getRouteStep(state.route, -5 + step).index).toBe(-5 + step);
    }
    const next = 900 + getStageRule(stage).pursuerStepIntervalMs;
    expect(state.nextPursuerStepAt).toBe(next);
    expect(tickGame(state, next - 1)).toBe(state);
    expect(tickGame(state, next).pursuerDistance).toBe(5);
    expect(tickGame(initial, 900)).toEqual(state);
    expect(initial).toEqual(snapshot);
    const widened = applyInput(state, legalInput(state), 900);
    expect(widened).toMatchObject({ pursuerDistance: 7, isPursuerCatchingUp: false, nextPursuerStepAt: next });
    let reentered = widened;
    while (reentered.pursuerDistance < 15) reentered = applyInput(reentered, legalInput(reentered), 900);
    expect(reentered).toMatchObject({ isPursuerCatchingUp: true, nextPursuerStepAt: 1000 });
  });

  it("keeps100ms while falling, then restores250ms until recovery and stage speed", () => {
    const exited = tickGame(atGap(15), 800);
    expect(exited.pursuerDistance).toBe(7);
    const fallen = applyInput(exited, "jump", 800);
    expect(fallen).toMatchObject({ lastMistake: true, recoveryEndsAt: 1300, nextPursuerStepAt: 900, isPursuerCatchingUp: true });
    const boundary = tickGame(fallen, 900);
    expect(boundary).toMatchObject({ pursuerDistance: 6, isPursuerCatchingUp: false, nextPursuerStepAt: 1150, recoveryEndsAt: 1300 });
    const after = tickGame(boundary, 1150);
    expect(after).toMatchObject({ pursuerDistance: 5, nextPursuerStepAt: 1750, lastMistake: true });
    expect(tickGame(after, 1300)).toMatchObject({ lastMistake: false, recoveryEndsAt: null, nextPursuerStepAt: 1750 });
    expect(tickGame(fallen, 1750)).toEqual(tickGame(after, 1750));
  });

  it("preserves a pending faster deadline on a catch-up mistake and stops it on expiry", () => {
    const active = { ...atGap(15), nextPursuerStepAt: 20 };
    const fallen = applyInput(active, "jump", 0);
    expect(fallen.nextPursuerStepAt).toBe(20);
    expect(tickGame(fallen, 20)).toMatchObject({ pursuerDistance: 14, isPursuerCatchingUp: true, nextPursuerStepAt: 120 });
    expect(tickGame({ ...active, stageEndsAt: 20 }, 20)).toMatchObject({ endReason: "time-limit", isPursuerCatchingUp: false, nextPursuerStepAt: null });
  });

  it("freezes catch-up once during settings and preserves only the remaining deadline", () => {
    const state = atGap(15);
    const resumed = resumeGameAfterPause(state, 20, 10020);
    expect(resumed).toMatchObject({ isPursuerCatchingUp: true, nextPursuerStepAt: 10100, pursuerDistance: 15 });
    expect(tickGame(resumed, 10099)).toBe(resumed);
    expect(tickGame(resumed, 10100)).toMatchObject({ pursuerDistance: 14, nextPursuerStepAt: 10200 });
    expect(resumeGameAfterPause(resumed, 10020, 10020)).toBe(resumed);
  });

  it("clears mode at checkpoint/quit/final and starts Continue with gap4 and the new base", () => {
    const state = atGap(15);
    const checkpoint = applyInput({ ...state, score: 149 }, legalInput(state), 0);
    expect(checkpoint).toMatchObject({ status: "checkpoint", isPursuerCatchingUp: false, nextPursuerStepAt: null });
    expect(tickGame(checkpoint, 90000)).toBe(checkpoint);
    expect(quitAtCheckpoint(checkpoint, 90000)).toMatchObject({ isPursuerCatchingUp: false, endReason: "quit" });
    expect(continueGame(checkpoint, 90000)).toMatchObject({ stage: 2, score: 0, pursuerDistance: 4, isPursuerCatchingUp: false, nextPursuerStepAt: 90500 });
    const last = atGap(15, 5);
    expect(applyInput({ ...last, score: 349 }, legalInput(last), 0)).toMatchObject({ endReason: "cleared", isPursuerCatchingUp: false });
    const caught = tickGame(state, 10000);
    expect(caught).toMatchObject({ endReason: "caught", isPursuerCatchingUp: false, captureCount: 1 });
  });

  it("gives the standalone experiment the same600ms base and100ms catch-up", () => {
    let state = startDescent(createDescentState(() => 0), 0);
    expect(state.nextPursuerStepAt).toBe(600);
    while (state.pursuerDistance < 15) state = applyDescentInput(state, legalInput(state), 0);
    expect(state).toMatchObject({ stage: 1, isPursuerCatchingUp: true, nextPursuerStepAt: 100 });
    expect(tickDescent(state, 900)).toMatchObject({ pursuerDistance: 6, isPursuerCatchingUp: false, nextPursuerStepAt: 1500 });
  });

  it("shares motion durations and rejects a missing or non-boolean mode", () => {
    expect(getPursuerMotionDurationMs({ isPursuerCatchingUp: true })).toBe(100);
    expect(getPursuerMotionDurationMs({ isPursuerCatchingUp: false })).toBe(240);
    for (const value of [undefined, null, 0, 1, "true"]) {
      expect(() => tickGame({ ...playing(), isPursuerCatchingUp: value } as unknown as GameState, 0)).toThrow(RangeError);
    }
  });
});
