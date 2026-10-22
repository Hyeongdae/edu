import { describe, expect, it } from "vitest";
import {
  applyInput,
  createGameState,
  resetGame,
  startGame,
  tickGame,
} from "./gameEngine";
import type { GameState } from "./types";
import { countStraightSteps, getRouteStep } from "./stairRoute";

const randomFiveSteps = () => 0.5;

function playingState(overrides: Partial<GameState> = {}): GameState {
  return startGame({ ...createGameState(randomFiveSteps), ...overrides });
}

describe("createGameState", () => {
  it("starts with three lives, a pursuer four steps away, and a right-facing route", () => {
    const state = createGameState(randomFiveSteps);
    expect(state).toMatchObject({
      status: "ready",
      score: 0,
      stepsClimbed: 0,
      lives: 3,
      direction: "right",
      straightStepsRemaining: 5,
      pursuerDistance: 4,
      eventSteps: 0,
      eventEndsAt: null,
      recoveryEndsAt: null,
      lastMistake: false,
    });
    expect(state.route.steps).toHaveLength(23);
    expect(countStraightSteps(state.route, 0, "right")).toBe(state.straightStepsRemaining);
  });

  it.each([
    [0, 4],
    [0.999, 6],
  ])("includes the %i random boundary and returns %i steps", (value, expected) => {
    expect(createGameState(() => value).straightStepsRemaining).toBe(expected);
  });

  it.each([-1, 1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid random values: %s",
    (value) => {
      expect(() => createGameState(() => value)).toThrow(RangeError);
    },
  );

  it("starts the game without changing the original state", () => {
    const ready = createGameState(randomFiveSteps);
    const started = startGame(ready);

    expect(started.status).toBe("playing");
    expect(ready.status).toBe("ready");
    expect(startGame(started)).toBe(started);
  });

  it("resets every game field to a fresh ready state", () => {
    expect(resetGame(() => 0)).toEqual(createGameState(() => 0));
  });
});

describe("applyInput", () => {
  it("moves forward on a straight section and adds one point", () => {
    const before = playingState();
    const after = applyInput(before, "forward", 100);

    expect(after).toMatchObject({
      score: 1,
      stepsClimbed: 1,
      straightStepsRemaining: 4,
      eventSteps: 1,
      lastMistake: false,
    });
    expect(before.straightStepsRemaining).toBe(5);
  });

  it("turns and climbs one step at a corner", () => {
    let before = playingState();
    for (let step = 0; step < 5; step += 1) before = applyInput(before, "forward", 100);
    expect(before.straightStepsRemaining).toBe(0);
    const nextRunLength = countStraightSteps(before.route, before.stepsClimbed, "left");
    const nextStep = getRouteStep(before.route, before.stepsClimbed + 1);
    const after = applyInput(before, "turn", 100);

    expect(after).toMatchObject({
      direction: "left",
      straightStepsRemaining: nextRunLength - 1,
      score: 6,
      stepsClimbed: 6,
      eventSteps: 6,
    });
    expect(nextRunLength).not.toBe(5);
    expect(getRouteStep(after.route, after.stepsClimbed)).toBe(nextStep);
  });

  it("makes a wrong input cost one pursuer step and starts a 500 ms recovery", () => {
    const before = playingState({ eventSteps: 12 });
    const after = applyInput(before, "turn", 1_000);

    expect(after).toMatchObject({
      score: 0,
      stepsClimbed: 0,
      eventSteps: 12,
      pursuerDistance: 3,
      lives: 3,
      recoveryEndsAt: 1_500,
      lastMistake: true,
    });
    expect(after.route).toBe(before.route);
  });

  it("ignores inputs during recovery, then accepts input at the recovery boundary", () => {
    const fallen = applyInput(playingState(), "turn", 1_000);
    const blocked = applyInput(fallen, "forward", 1_499);
    const recovered = applyInput(blocked, "forward", 1_500);

    expect(blocked).toBe(fallen);
    expect(blocked.route).toBe(fallen.route);
    expect(recovered).toMatchObject({
      score: 1,
      recoveryEndsAt: null,
      lastMistake: false,
    });
  });

  it("loses a life only when the pursuer catches up and resets its distance", () => {
    const caught = applyInput(playingState({ pursuerDistance: 1 }), "turn", 100);

    expect(caught).toMatchObject({
      lives: 2,
      pursuerDistance: 4,
      status: "playing",
    });
  });

  it("ends the game after the third capture and ignores later inputs", () => {
    const gameOver = applyInput(playingState({ lives: 1, pursuerDistance: 1 }), "turn", 100);
    const afterGameOver = applyInput(gameOver, "forward", 700);

    expect(gameOver).toMatchObject({ lives: 0, status: "game-over" });
    expect(afterGameOver).toMatchObject({
      score: gameOver.score,
      lives: gameOver.lives,
      status: "game-over",
    });
  });

  it("starts the 30 second event on the 30th successful step", () => {
    const before = playingState({ eventSteps: 29 });
    const after = applyInput(before, "forward", 2_000);

    expect(after).toMatchObject({
      score: 1,
      stepsClimbed: 1,
      eventSteps: 0,
      eventEndsAt: 32_000,
    });
  });

  it("awards two points during the event without advancing its gauge", () => {
    const before = playingState({ eventSteps: 8, eventEndsAt: 30_000 });
    const after = applyInput(before, "forward", 29_999);

    expect(after).toMatchObject({
      score: 2,
      eventSteps: 8,
      eventEndsAt: 30_000,
    });
  });

  it("expires an event at its exact end time before scoring the next move", () => {
    const before = playingState({ eventSteps: 8, eventEndsAt: 30_000 });
    const after = applyInput(before, "forward", 30_000);

    expect(after).toMatchObject({
      score: 1,
      eventSteps: 1,
      eventEndsAt: null,
    });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid time %s", (nowMs) => {
    expect(() => applyInput(playingState(), "forward", nowMs)).toThrow(RangeError);
  });

  it("does not change state outside active play", () => {
    const ready = createGameState(randomFiveSteps);

    expect(applyInput(ready, "forward", 100)).toBe(ready);
  });

  it("uses the preview as the input contract and stays deterministic on replayed updaters", () => {
    let state = playingState();

    for (let step = 0; step < 60; step += 1) {
      const preview = getRouteStep(state.route, state.stepsClimbed + 1);
      const atCorner = preview.direction !== state.direction;
      expect(state.straightStepsRemaining === 0).toBe(atCorner);
      const input = atCorner ? "turn" : "forward";
      const before = structuredClone(state);
      const after = applyInput(state, input, 100 + step);

      expect(applyInput(state, input, 100 + step)).toEqual(after);
      expect(state).toEqual(before);
      expect(getRouteStep(after.route, after.stepsClimbed)).toBe(preview);
      expect(after.direction).toBe(preview.direction);
      expect(after.stepsClimbed).toBe(step + 1);
      expect(after.lives).toBe(3);
      state = after;
    }
  });
});

describe("tickGame", () => {
  it("ends an event and clears its gauge at the expiry boundary", () => {
    const eventState = playingState({ eventSteps: 9, eventEndsAt: 10_000 });

    expect(tickGame(eventState, 9_999)).toBe(eventState);
    expect(tickGame(eventState, 10_000)).toMatchObject({
      eventSteps: 0,
      eventEndsAt: null,
    });
  });

  it("clears the fall animation at its recovery boundary", () => {
    const fallen = applyInput(playingState(), "turn", 500);

    expect(tickGame(fallen, 999)).toBe(fallen);
    expect(tickGame(fallen, 1_000)).toMatchObject({
      recoveryEndsAt: null,
      lastMistake: false,
    });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid time %s", (nowMs) => {
    expect(() => tickGame(playingState(), nowMs)).toThrow(RangeError);
  });
});
