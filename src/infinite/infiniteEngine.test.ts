import { describe, expect, it } from "vitest";
import { advanceStairRoute, countStraightSteps, getRouteStep } from "../game/stairRoute";
import { PURSUER_CATCH_UP_INTERVAL_MS } from "../game/pursuitRules";
import {
  applyInfiniteInput,
  createInfiniteGameState,
  getInfinitePursuerIntervalMs,
  getInfinitePursuerMotionDurationMs,
  startInfiniteGame,
  tickInfiniteGame,
} from "./infiniteEngine";
import type { InfiniteGameState } from "./types";

function inputForNextStep(state: InfiniteGameState): "forward" | "turn" {
  return getRouteStep(state.route, state.stepsClimbed + 1).direction === state.direction ? "forward" : "turn";
}

function afterSteps(count: number, state = startInfiniteGame(createInfiniteGameState(() => 0), 0)): InfiniteGameState {
  let current = state;
  for (let index = 0; index < count; index += 1) {
    current = applyInfiniteInput(current, inputForNextStep(current), 0);
  }
  return current;
}

describe("infinite score engine", () => {
  it("starts with a deterministic route and four-stair pursuit gap without a stage clock", () => {
    const ready = createInfiniteGameState(() => 0);
    expect(ready).toMatchObject({
      status: "ready", score: 0, stepsClimbed: 0, direction: "right",
      pursuerIndex: -4, pursuerDistance: 4, nextPursuerStepAt: null,
      eventSteps: 0, eventEndsAt: null,
    });
    expect(ready.route.runs[0]).toMatchObject({ startIndex: 1, length: 5, direction: "right" });
    expect("stageEndsAt" in ready).toBe(false);
    expect(startInfiniteGame(ready, 100)).toMatchObject({
      status: "playing", nextPursuerStepAt: 350,
    });
  });

  it("reduces the base interval by 10 ms at each 50-point score band and clamps at 100 ms", () => {
    const interval = (score: number, isPursuerCatchingUp = false) => getInfinitePursuerIntervalMs({ score, isPursuerCatchingUp });
    expect(interval(0)).toBe(250);
    expect(interval(49)).toBe(250);
    expect(interval(50)).toBe(240);
    expect(interval(749)).toBe(110);
    expect(interval(750)).toBe(100);
    expect(interval(1_000)).toBe(100);
    expect(interval(0, true)).toBe(100);
  });

  it("accepts forward on a straight run and turn only at a corner", () => {
    const started = startInfiniteGame(createInfiniteGameState(() => 0), 0);
    expect(applyInfiniteInput(started, "forward", 0)).toMatchObject({
      status: "playing", stepsClimbed: 1, score: 1,
      lastMove: { fromIndex: 0, toIndex: 1, scoreGain: 1, isBonus: false },
    });
    expect(applyInfiniteInput(started, "turn", 0)).toMatchObject({
      status: "game-over", endReason: "fall", lastMistake: true,
      stepsClimbed: 0, score: 0, fallEndsAt: 500, nextPursuerStepAt: null,
    });

    const atCorner = afterSteps(5);
    expect(getRouteStep(atCorner.route, atCorner.stepsClimbed + 1).direction).toBe("left");
    expect(applyInfiniteInput(atCorner, "turn", 0)).toMatchObject({
      status: "playing", stepsClimbed: 6, direction: "left", score: 6,
    });
    expect(applyInfiniteInput(atCorner, "forward", 0)).toMatchObject({
      status: "game-over", endReason: "fall", stepsClimbed: 5, score: 5,
    });
  });

  it("fills the 50-stair event gauge and begins the 2x bonus after the threshold stair", () => {
    const before = afterSteps(49);
    expect(before).toMatchObject({ score: 49, eventSteps: 49, eventEndsAt: null });

    const threshold = applyInfiniteInput(before, inputForNextStep(before), 1_000);
    expect(threshold).toMatchObject({
      score: 50, stepsClimbed: 50, eventSteps: 0, eventEndsAt: 31_000,
      lastMove: { scoreGain: 1, isBonus: false },
    });
    expect(getInfinitePursuerIntervalMs({ score: threshold.score, isPursuerCatchingUp: false })).toBe(240);
    const during = applyInfiniteInput(threshold, inputForNextStep(threshold), 1_001);
    expect(during).toMatchObject({
      score: 52, eventSteps: 0, eventEndsAt: 31_000,
      lastMove: { scoreGain: 2, isBonus: true },
    });
    expect(getInfinitePursuerIntervalMs({ score: during.score, isPursuerCatchingUp: false })).toBe(240);
  });

  it("expires an event at its deadline and begins a fresh gauge", () => {
    const eventState = afterSteps(50);
    const delayedPursuer = { ...eventState, nextPursuerStepAt: 60_000 };
    const expired = tickInfiniteGame(delayedPursuer, 30_000);
    expect(expired).toMatchObject({ status: "playing", eventEndsAt: null, eventSteps: 0 });
    const nextMove = applyInfiniteInput(expired, inputForNextStep(expired), 30_001);
    expect(nextMove).toMatchObject({
      score: 51, eventSteps: 1, eventEndsAt: null,
      lastMove: { scoreGain: 1, isBonus: false },
    });
  });

  it("does not cap score at any stage target", () => {
    const state = afterSteps(400);
    expect(state.stepsClimbed).toBe(400);
    expect(state.score).toBeGreaterThan(350);
    expect(state.status).toBe("playing");
  });

  it("moves once per 250 ms and maintains 100 ms catch-up after a 10-stair lead", () => {
    const initial = startInfiniteGame(createInfiniteGameState(() => 0), 0);
    expect(tickInfiniteGame(initial, 249)).toBe(initial);
    expect(tickInfiniteGame(initial, 250)).toMatchObject({
      pursuerIndex: -3, pursuerDistance: 3, nextPursuerStepAt: 500,
      lastPursuerMove: { fromIndex: -4, toIndex: -3, atMs: 250 },
    });

    expect(afterSteps(6)).toMatchObject({
      score: 6, pursuerDistance: 10, isPursuerCatchingUp: true, nextPursuerStepAt: 100,
    });

    const route = advanceStairRoute(initial.route, 11, -4);
    const catchingUp: InfiniteGameState = {
      ...initial,
      stepsClimbed: 11,
      direction: getRouteStep(route, 11).direction,
      straightStepsRemaining: countStraightSteps(route, 11, getRouteStep(route, 11).direction),
      pursuerDistance: 15,
      isPursuerCatchingUp: true,
      nextPursuerStepAt: 100,
      route,
    };
    expect(getInfinitePursuerMotionDurationMs(catchingUp)).toBe(PURSUER_CATCH_UP_INTERVAL_MS);
    expect(tickInfiniteGame(catchingUp, 100)).toMatchObject({
      pursuerIndex: -3, pursuerDistance: 14, isPursuerCatchingUp: true, nextPursuerStepAt: 200,
    });
  });

  it("returns to the score-derived base interval when the catch-up gap reaches six", () => {
    const initial = startInfiniteGame(createInfiniteGameState(() => 0), 0);
    const route = advanceStairRoute(initial.route, 3, -4);
    const catchingUp: InfiniteGameState = {
      ...initial,
      stepsClimbed: 3,
      direction: getRouteStep(route, 3).direction,
      straightStepsRemaining: countStraightSteps(route, 3, getRouteStep(route, 3).direction),
      pursuerDistance: 7,
      isPursuerCatchingUp: true,
      nextPursuerStepAt: 100,
      route,
    };
    const returnedToBase = tickInfiniteGame(catchingUp, 100);
    expect(returnedToBase).toMatchObject({
      pursuerIndex: -3, pursuerDistance: 6, isPursuerCatchingUp: false, nextPursuerStepAt: 350,
    });
    expect(getInfinitePursuerMotionDurationMs(returnedToBase)).toBe(250);
  });

  it("ends on contact, retains the catch animation, then freezes the terminal state", () => {
    const started = startInfiniteGame(createInfiniteGameState(() => 0), 0);
    const oneStepGap: InfiniteGameState = {
      ...started,
      pursuerIndex: -1,
      pursuerDistance: 1,
      nextPursuerStepAt: 250,
    };
    const caught = tickInfiniteGame(oneStepGap, 250);
    expect(caught).toMatchObject({
      status: "game-over", endReason: "caught", captureCount: 1,
      pursuerIndex: -1, pursuerDistance: 1, nextPursuerStepAt: null, captureEndsAt: 750,
    });
    expect(tickInfiniteGame(caught, 500)).toMatchObject({ status: "game-over", captureEndsAt: 750 });
    expect(tickInfiniteGame(caught, 750)).toMatchObject({ status: "game-over", captureEndsAt: null, score: 0 });
  });

  it("keeps fall animation deadline but never lets a terminal run move or score again", () => {
    const started = startInfiniteGame(createInfiniteGameState(() => 0), 0);
    const fallen = applyInfiniteInput(started, "turn", 0);
    expect(applyInfiniteInput(fallen, "forward", 1)).toBe(fallen);
    expect(tickInfiniteGame(fallen, 500)).toMatchObject({
      status: "game-over", endReason: "fall", fallEndsAt: null, score: 0, stepsClimbed: 0,
    });
  });

  it("rejects invalid clocks, malformed distance, input, and score overflow", () => {
    const ready = createInfiniteGameState(() => 0);
    expect(() => startInfiniteGame(ready, Number.NaN)).toThrow(RangeError);
    expect(() => tickInfiniteGame(ready, -1)).toThrow(RangeError);
    expect(() => tickInfiniteGame({ ...ready, pursuerDistance: 3 }, 0)).toThrow(RangeError);
    expect(() => applyInfiniteInput(startInfiniteGame(ready, 0), "jump" as "forward", 0)).toThrow(RangeError);
    const maxScore: InfiniteGameState = { ...startInfiniteGame(ready, 0), score: Number.MAX_SAFE_INTEGER };
    expect(() => applyInfiniteInput(maxScore, "forward", 0)).toThrow(RangeError);
  });
});
