import { describe, expect, it } from "vitest";
import {
  applyInput,
  createGameState,
  getStageSecondsLeft,
  resetGame,
  resumeGameAfterPause,
  STAGE_ONE_DURATION_MS,
  STAGE_ONE_TARGET_SCORE,
  startGame,
  tickGame,
} from "./gameEngine";
import type { GameState } from "./types";
import { countStraightSteps, getRouteStep } from "./stairRoute";
import { getStageRule, STAGE_RULES } from "./stageRules";

const randomFiveSteps = () => 0.5;

function playingState(overrides: Partial<GameState> = {}): GameState {
  return { ...startGame(createGameState(randomFiveSteps), 0), ...overrides };
}

describe("createGameState", () => {
  it("starts with three lives, a pursuer four steps away, and a right-facing route", () => {
    const state = createGameState(randomFiveSteps);
    expect(state).toMatchObject({
      status: "ready",
      stage: 1,
      stageEndsAt: null,
      endReason: null,
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
    const started = startGame(ready, 1_000);

    expect(started.status).toBe("playing");
    expect(ready.status).toBe("ready");
    expect(started.stageEndsAt).toBe(91_000);
    expect(ready.stageEndsAt).toBeNull();
    expect(startGame(started, 2_000)).toBe(started);
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

describe("timed stage progression", () => {
  it("exports the stage-one rules and leaves ready games unarmed", () => {
    const ready = createGameState(randomFiveSteps);
    expect(STAGE_ONE_DURATION_MS).toBe(90_000);
    expect(STAGE_ONE_TARGET_SCORE).toBe(300);
    expect(tickGame(ready, 1_000_000)).toBe(ready);
    expect(getStageSecondsLeft(ready, 1_000_000)).toBe(90);
  });

  it.each([false, true])("promotes using the actual score before the deadline (bonus=%s)", (bonus) => {
    const before = playingState({
      stageEndsAt: 91_000,
      score: 299,
      lives: 1,
      pursuerDistance: 1,
      eventSteps: 12,
      eventEndsAt: bonus ? 120_000 : null,
    });
    const snapshot = structuredClone(before);
    const after = applyInput(before, "forward", 90_999);
    expect(after).toMatchObject({
      status: "playing", stage: 2, stageEndsAt: 165_999, endReason: null,
      score: bonus ? 301 : 300, stepsClimbed: 1, lives: 3, pursuerDistance: 4,
      eventSteps: bonus ? 12 : 13, eventEndsAt: before.eventEndsAt,
      direction: "right", straightStepsRemaining: 4,
    });
    expect(getRouteStep(after.route, 1)).toBe(getRouteStep(before.route, 1));
    expect(before).toEqual(snapshot);
    expect(applyInput(before, "forward", 90_999)).toEqual(after);
  });

  it.each([91_000, 91_001])("expires before an otherwise promoting input at %s", (now) => {
    const before = playingState({ stageEndsAt: 91_000, score: 299, lives: 1, pursuerDistance: 1 });
    const after = applyInput(before, "forward", now);
    expect(after).toMatchObject({
      status: "game-over", stage: 1, stageEndsAt: 91_000, endReason: "time-limit",
      score: 299, stepsClimbed: 0, lives: 1, pursuerDistance: 1,
      recoveryEndsAt: null, lastMistake: false,
    });
    expect(after.route).toBe(before.route);
    expect(applyInput(after, "forward", now + 1_000)).toBe(after);
    expect(startGame(after, now + 1_000)).toBe(after);
  });

  it("expires without input and processes simultaneous event expiry", () => {
    const before = playingState({ eventEndsAt: 90_000, eventSteps: 8 });
    expect(tickGame(before, 89_999)).toBe(before);
    const after = tickGame(before, 90_000);
    expect(after).toMatchObject({
      status: "game-over", endReason: "time-limit", eventEndsAt: null, eventSteps: 0,
      score: 0, lives: 3, pursuerDistance: 4,
    });
    expect(after.route).toBe(before.route);
  });

  it("preserves a bonus starting on the same move as promotion", () => {
    const after = applyInput(playingState({ score: 299, eventSteps: 29 }), "forward", 1_000);
    expect(after).toMatchObject({ stage: 2, score: 300, eventSteps: 0, eventEndsAt: 31_000 });
    const later = applyInput({ ...after, lives: 2, pursuerDistance: 2 }, "forward", 31_000);
    expect(later).toMatchObject({ status: "playing", stage: 2, stageEndsAt: 76_000, score: 301, lives: 2, pursuerDistance: 2 });
    expect(tickGame(later, 76_000)).toMatchObject({ status: "game-over", endReason: "time-limit", stage: 2 });
    expect(resetGame(randomFiveSteps)).toMatchObject({
      status: "ready", stage: 1, stageEndsAt: null, endReason: null, score: 0,
    });
  });

  it("clears pending recovery on timeout without changing lives or route", () => {
    const caught = applyInput(playingState({ stageEndsAt: 1_200, pursuerDistance: 1 }), "turn", 1_000);
    expect(caught).toMatchObject({ status: "playing", lives: 2, recoveryEndsAt: 1_500 });
    const expired = tickGame(caught, 1_200);
    expect(expired).toMatchObject({
      status: "game-over", endReason: "time-limit", lives: 2, recoveryEndsAt: null, lastMistake: false,
    });
    expect(expired.route).toBe(caught.route);
  });

  it("preserves the fatal-catch reason after its old deadline passes", () => {
    const caught = applyInput(playingState({ lives: 1, pursuerDistance: 1, stageEndsAt: 1_200 }), "turn", 1_000);
    expect(caught).toMatchObject({ status: "game-over", endReason: "caught", recoveryEndsAt: 1_500 });
    expect(tickGame(caught, 1_200)).toBe(caught);
    expect(tickGame(caught, 1_500)).toMatchObject({
      status: "game-over", endReason: "caught", lives: 0, recoveryEndsAt: null, lastMistake: false,
    });
  });

  it("returns ceiling seconds for timed stages without changing state", () => {
    const state = playingState({ stageEndsAt: 91_000 });
    const snapshot = structuredClone(state);
    expect(getStageSecondsLeft(state, 1_000)).toBe(90);
    expect(getStageSecondsLeft(state, 1_001)).toBe(90);
    expect(getStageSecondsLeft(state, 2_000)).toBe(89);
    expect(getStageSecondsLeft(state, 90_999)).toBe(1);
    expect(getStageSecondsLeft(state, 91_000)).toBe(0);
    expect(getStageSecondsLeft(state, 95_000)).toBe(0);
    expect(getStageSecondsLeft(tickGame(state, 95_000), 1_000)).toBe(0);
    expect(getStageSecondsLeft({ ...state, stage: 2, stageEndsAt: 76_000 }, 1_000)).toBe(75);
    expect(state).toEqual(snapshot);
  });

  it.each([-1, NaN, Infinity])("rejects invalid timestamps consistently: %s", (time) => {
    const ready = createGameState(randomFiveSteps);
    expect(() => startGame(ready, time)).toThrow(RangeError);
    expect(() => getStageSecondsLeft(ready, time)).toThrow(RangeError);
    expect(() => resumeGameAfterPause(ready, time, 1_000)).toThrow(RangeError);
    expect(() => resumeGameAfterPause(ready, 1_000, time)).toThrow(RangeError);
  });
});

describe("resumeGameAfterPause", () => {
  it("shifts both active deadlines exactly once and keeps the state immutable", () => {
    const state = { ...startGame(createGameState(randomFiveSteps), 1_000), eventEndsAt: 31_000 };
    const snapshot = structuredClone(state);
    const after = resumeGameAfterPause(state, 11_000, 46_000);
    expect(after).toMatchObject({ status: "playing", stageEndsAt: 126_000, eventEndsAt: 66_000 });
    expect(getStageSecondsLeft(after, 46_000)).toBe(80);
    expect(state).toEqual(snapshot);
    expect(resumeGameAfterPause(state, 11_000, 46_000)).toEqual(after);
    expect(resumeGameAfterPause(after, 46_000, 46_000)).toBe(after);
    expect(tickGame(after, 126_000).endReason).toBe("time-limit");
  });

  it("does not revive stage or bonus deadlines already expired on open", () => {
    const state = playingState({ eventEndsAt: 10_000 });
    expect(resumeGameAfterPause(state, 90_000, 200_000)).toMatchObject({
      status: "game-over", endReason: "time-limit", stageEndsAt: 90_000, eventEndsAt: null,
    });
    expect(resumeGameAfterPause(state, 10_000, 20_000)).toMatchObject({
      status: "playing", stageEndsAt: 100_000, eventEndsAt: null,
    });
  });

  it("keeps ready unarmed and final caught games ended while clearing recovery", () => {
    const ready = createGameState(randomFiveSteps);
    expect(resumeGameAfterPause(ready, 1_000, 200_000)).toBe(ready);
    const caught = applyInput(playingState({ lives: 1, pursuerDistance: 1 }), "turn", 1_000);
    expect(resumeGameAfterPause(caught, 1_100, 200_000)).toMatchObject({
      status: "game-over", endReason: "caught", stageEndsAt: 90_000, recoveryEndsAt: null,
    });
  });

  it("allows recovery to elapse during pause without extending it", () => {
    const fallen = applyInput(playingState(), "turn", 1_000);
    expect(resumeGameAfterPause(fallen, 1_100, 10_000)).toMatchObject({
      status: "playing", stageEndsAt: 98_900, recoveryEndsAt: null, lastMistake: false,
    });
  });

  it("shifts stage two and its event and ignores negative pause duration", () => {
    const state = playingState({ stage: 2, stageEndsAt: 76_000, eventEndsAt: 31_000 });
    expect(resumeGameAfterPause(state, 11_000, 46_000)).toMatchObject({
      stage: 2, stageEndsAt: 111_000, eventEndsAt: 66_000,
    });
    const withoutEvent = { ...state, eventEndsAt: null };
    expect(resumeGameAfterPause(withoutEvent, 11_000, 200_000)).toMatchObject({ stage: 2, stageEndsAt: 265_000, eventEndsAt: null });
    expect(resumeGameAfterPause(state, 11_000, 10_000)).toBe(state);
  });
});

describe("five timed stages", () => {
  it.each(STAGE_RULES.slice(0, 4))("promotes stage $stage with one completed move and preserves bonus state", (rule) => {
    for (const bonus of [false, true]) {
      const before = playingState({
        stage: rule.stage, stageEndsAt: 10_000, score: rule.targetScore - 1,
        lives: 1, pursuerDistance: 1, eventSteps: 12, eventEndsAt: bonus ? 40_000 : null,
      });
      const snapshot = structuredClone(before);
      const nextRule = STAGE_RULES[rule.stage];
      const after = applyInput(before, "forward", 9_999);
      expect(after).toMatchObject({
        status: "playing", stage: nextRule.stage, stageEndsAt: 9_999 + nextRule.durationMs,
        score: rule.targetScore + Number(bonus), lives: 3, pursuerDistance: 4,
        stepsClimbed: 1, eventSteps: bonus ? 12 : 13, eventEndsAt: before.eventEndsAt,
        recoveryEndsAt: null, lastMistake: false, endReason: null,
      });
      expect(getRouteStep(after.route, 1)).toBe(getRouteStep(before.route, 1));
      expect(applyInput(before, "forward", 9_999)).toEqual(after);
      expect(before).toEqual(snapshot);
    }
  });

  it.each(STAGE_RULES)("stage $stage expires before a goal-reaching input at its exact deadline", (rule) => {
    const before = playingState({
      stage: rule.stage, stageEndsAt: 5_000, score: rule.targetScore - 1,
      lives: 2, pursuerDistance: 2, eventEndsAt: 5_000, eventSteps: 29,
    });
    expect(tickGame(before, 4_999)).toBe(before);
    const after = applyInput(before, "forward", 5_000);
    expect(after).toMatchObject({
      status: "game-over", stage: rule.stage, score: rule.targetScore - 1,
      stepsClimbed: 0, lives: 2, pursuerDistance: 2, endReason: "time-limit",
      eventEndsAt: null, eventSteps: 0, recoveryEndsAt: null, lastMistake: false,
    });
    expect(tickGame(before, 5_000)).toEqual(after);
    expect(after.route).toBe(before.route);
    expect(applyInput(after, "forward", 5_001)).toBe(after);
    expect(startGame(after, 5_001)).toBe(after);
  });

  it.each([false, true])("clears stage five with the actual final score and no healing (bonus=%s)", (bonus) => {
    const before = playingState({
      stage: 5, stageEndsAt: 10_000, score: 1_499, lives: 1, pursuerDistance: 1,
      eventSteps: 12, eventEndsAt: bonus ? 40_000 : null,
    });
    const snapshot = structuredClone(before);
    const cleared = applyInput(before, "forward", 9_999);
    expect(cleared).toMatchObject({
      status: "game-over", stage: 5, stageEndsAt: 10_000, endReason: "cleared",
      score: bonus ? 1_501 : 1_500, stepsClimbed: 1, lives: 1, pursuerDistance: 1,
      recoveryEndsAt: null, lastMistake: false, eventSteps: bonus ? 12 : 13,
    });
    expect(getRouteStep(cleared.route, 1)).toBe(getRouteStep(before.route, 1));
    expect(getStageSecondsLeft(cleared, 0)).toBe(0);
    expect(applyInput(cleared, "forward", 10_000)).toBe(cleared);
    expect(startGame(cleared, 10_000)).toBe(cleared);
    expect(tickGame(cleared, 10_000)).toBe(cleared);
    expect(resumeGameAfterPause(cleared, 10_000, 100_000)).toMatchObject({ status: "game-over", stage: 5, endReason: "cleared", score: cleared.score });
    expect(applyInput(before, "forward", 9_999)).toEqual(cleared);
    expect(before).toEqual(snapshot);
  });

  it.each(STAGE_RULES)("completes a new bonus before stage $stage promotion or clear", (rule) => {
    const after = applyInput(playingState({
      stage: rule.stage, stageEndsAt: 10_000, score: rule.targetScore - 1, eventSteps: 29,
    }), "forward", 1_000);
    expect(after).toMatchObject({
      score: rule.targetScore, stepsClimbed: 1, eventEndsAt: 31_000, eventSteps: 0,
      stage: Math.min(5, rule.stage + 1), endReason: rule.stage === 5 ? "cleared" : null,
    });
  });

  it.each(STAGE_RULES)("pauses both deadlines once in stage $stage", (rule) => {
    const before = playingState({ stage: rule.stage, stageEndsAt: rule.durationMs + 1_000, eventEndsAt: 31_000 });
    const after = resumeGameAfterPause(before, 11_000, 106_000);
    expect(after).toMatchObject({ stage: rule.stage, stageEndsAt: rule.durationMs + 96_000, eventEndsAt: 126_000 });
    expect(getStageSecondsLeft(after, 106_000)).toBe(rule.durationMs / 1000 - 10);
    expect(resumeGameAfterPause(after, 106_000, 106_000)).toBe(after);
  });

  it.each(STAGE_RULES)("shows rule duration when stage $stage has no armed deadline", (rule) => {
    expect(getStageSecondsLeft({ ...createGameState(randomFiveSteps), stage: rule.stage }, 1_000_000)).toBe(rule.durationMs / 1000);
  });

  it("plays through all promotions and final clear using only real inputs", () => {
    let state = startGame(createGameState(randomFiveSteps), 1_000);
    const reached: number[] = [1];
    for (let action = 0; action < 1_500 && state.status === "playing"; action += 1) {
      const next = getRouteStep(state.route, state.stepsClimbed + 1);
      const previousStage = state.stage;
      const now = 1_000 + action * 10;
      state = applyInput(state, next.direction === state.direction ? "forward" : "turn", now);
      if (state.stage !== previousStage) {
        reached.push(state.stage);
        expect(state.stageEndsAt).toBe(now + getStageRule(state.stage).durationMs);
      }
    }
    expect(reached).toEqual([1, 2, 3, 4, 5]);
    expect(state).toMatchObject({ status: "game-over", stage: 5, endReason: "cleared", lives: 3 });
    expect(state.score).toBeGreaterThanOrEqual(1_500);
    expect(state.score).toBeLessThanOrEqual(1_501);
    expect(resetGame(randomFiveSteps)).toMatchObject({ status: "ready", stage: 1, score: 0, stageEndsAt: null });
  });
});
