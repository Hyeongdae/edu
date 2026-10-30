import * as stairObstacles from "./stairObstacles";
import { makeObstacleFixture, withObstacle } from "../test/obstacleFixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyInput,
  continueGame,
  quitAtCheckpoint,
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
import { getStageRule, getStageTargetScore, STAGE_RULES } from "./stageRules";
import { withPursuitAt } from "../test/gameFixtures";

const randomFiveSteps = () => 0;

describe("checkpoint sessions", () => {
  it("exports the stage-one duration and new score requirement", () => {
    expect(STAGE_ONE_DURATION_MS).toBe(90_000);
    expect(STAGE_ONE_TARGET_SCORE).toBe(150);
  });
  it.each(STAGE_RULES)("starts unlocked stage $stage with one seed and zero run score", (rule) => {
    const random = vi.fn(() => 0);
    const ready = createGameState(random, { stage: rule.stage, highestClearedStage: rule.stage });
    expect(random).toHaveBeenCalledTimes(1);
    expect(ready).toMatchObject({ stage: rule.stage, score: 0, highestClearedStage: rule.stage,
      clearedStageThisRun: 0, checkpointEnteredAt: null });
    expect(ready).not.toHaveProperty("lives");
    expect(ready.obstacles.runs.every((run) => run.stageAtGeneration === rule.stage)).toBe(true);
    const started = startGame(ready, 100);
    expect(started.route).toBe(ready.route);
    expect(started.obstacles).toBe(ready.obstacles);
    expect(started.stageEndsAt).toBe(100 + rule.durationMs);
    expect(started.nextPursuerStepAt).toBe(100 + rule.pursuerStepIntervalMs);
    expect(getStageSecondsLeft(ready, 1e6)).toBe(rule.durationMs / 1000);
    expect(resetGame(() => 0, { stage: rule.stage, highestClearedStage: rule.stage })).toEqual(ready);
  });

  it.each([
    { stage: 0 }, { stage: 6 }, { stage: 2 }, { stage: 4, highestClearedStage: 2 },
    { highestClearedStage: -1 }, { highestClearedStage: 6 }, { stage: "1" },
    { stage: null }, { highestClearedStage: null }, null,
  ])("rejects invalid or locked start options %j before randomness", (options) => {
    const random = vi.fn(() => 0);
    expect(() => createGameState(random, options as Parameters<typeof createGameState>[1])).toThrow(RangeError);
    expect(random).not.toHaveBeenCalled();
  });

  it.each([[0,1],[1,2],[2,3],[3,4],[4,5],[5,5]] as const)("starts the highest unlocked stage after clear %s", (highest, stage) => {
    const random = vi.fn(() => 0);
    const ready = createGameState(random, { stage, highestClearedStage: highest });
    expect(ready).toMatchObject({ status: "ready", stage, highestClearedStage: highest, score: 0, clearedStageThisRun: 0 });
    expect(random).toHaveBeenCalledOnce();
    expect(ready).not.toHaveProperty("recordStage");
    expect(ready).not.toHaveProperty("stageStartScore");
  });

  it.each(STAGE_RULES)("completes the move at the stage-local goal in stage $stage", (rule) => {
    for (const bonus of [false, true]) {
      const before = playingState({ stage: rule.stage, score: rule.scoreRequired - 1,
        eventSteps: 12, eventEndsAt: bonus ? 40_000 : null }, 100);
      const snapshot = structuredClone(before);
      const after = applyInput(before, "forward", 100);
      expect(after).toMatchObject({ stage: rule.stage, score: rule.scoreRequired, stepsClimbed: 1,
        highestClearedStage: rule.stage, clearedStageThisRun: rule.stage, stageEndsAt: null,
        nextPursuerStepAt: null, lastPursuerMove: null, recoveryEndsAt: null, lastMistake: false,
        lastMove: { kind: "climb", fromIndex: 0, toIndex: 1, scoreGain: 1, isBonus: bonus },
        status: rule.stage === 5 ? "game-over" : "checkpoint", endReason: rule.stage === 5 ? "cleared" : null,
        checkpointEnteredAt: rule.stage === 5 ? null : 100,
      });
      expect(before).toEqual(snapshot);
      expect(applyInput(before, "forward", 100)).toEqual(after);
      expect(getStageSecondsLeft(after, 100)).toBe(0);
      expect(startGame(after, 100)).toBe(after);
      if (rule.stage === 5) {
        expect(continueGame(after, 1e6)).toBe(after);
        expect(tickGame(after, 1e6)).toBe(after);
      }
    }
  });

  it("freezes every logical clock for 95 seconds then resets only stage score on Continue", () => {
    const before = jumpState({ score: 148, eventEndsAt: 30_000 });
    const checkpoint = applyInput(before, "jump", 100);
    expect(checkpoint.score).toBe(150);
    expect(tickGame(checkpoint, 95_100)).toBe(checkpoint);
    expect(applyInput(checkpoint, "jump", 95_100)).toBe(checkpoint);
    expect(resumeGameAfterPause(checkpoint, 100, 95_100)).toBe(checkpoint);
    const resumed = continueGame(checkpoint, 95_100);
    expect(resumed).toMatchObject({ status: "playing", stage: 2, score: 0, lastMove: null,
      stageEndsAt: 170_100, nextPursuerStepAt: 95_100 + getStageRule(2).pursuerStepIntervalMs, pursuerDistance: 4,
      eventEndsAt: 125_000, highestClearedStage: 1, clearedStageThisRun: 1, checkpointEnteredAt: null });
    expect(getStageTargetScore(resumed.stage)).toBe(200);
    expect(resumed.route).toBe(checkpoint.route);
    expect(resumed.obstacles).toBe(checkpoint.obstacles);
    expect(resumed.eventSteps).toBe(checkpoint.eventSteps);
    expect(continueGame(resumed, 95_200)).toBe(resumed);
    expect(quitAtCheckpoint(resumed, 95_200)).toBe(resumed);
  });

  it("quits at the checkpoint with only cleared progress and the completed score", () => {
    const checkpoint = applyInput(playingState({ score: 149, eventSteps: 29 }), "forward", 100);
    expect(checkpoint).toMatchObject({ stage: 1, status: "checkpoint", eventEndsAt: 30_100, eventSteps: 0 });
    const quit = quitAtCheckpoint(checkpoint, 95_100);
    expect(quit).toMatchObject({ status: "game-over", endReason: "quit", score: 150, highestClearedStage: 1,
      clearedStageThisRun: 1, stepsClimbed: 1, checkpointEnteredAt: null, eventEndsAt: null,
      stageEndsAt: null, nextPursuerStepAt: null, lastMove: null });
    expect(quitAtCheckpoint(quit, 95_200)).toBe(quit);
    expect(tickGame(quit, 1e6)).toBe(quit);
  });

  it.each(STAGE_RULES)("expires stage $stage before a tied goal input or capture", (rule) => {
    const state = playingState({ stage: rule.stage, score: rule.scoreRequired - 1, stageEndsAt: 500,
      eventEndsAt: 500, eventSteps: 29 }, 0);
    const tied = { ...state, nextPursuerStepAt: 500, pursuerIndex: -1, pursuerDistance: 1 };
    expect(applyInput(tied, "forward", 500)).toMatchObject({ status: "game-over", endReason: "time-limit",
      score: rule.scoreRequired - 1, stepsClimbed: 0, highestClearedStage: state.highestClearedStage, captureCount: 0, eventEndsAt: null, eventSteps: 0 });
  });

  it("keeps prior progress on a replay failure and raises it only on an actual later clear", () => {
    const replay = startGame(createGameState(() => 0, { stage: 1, highestClearedStage: 3 }), 0);
    expect(tickGame(replay, 3200)).toMatchObject({ status: "game-over", highestClearedStage: 3, clearedStageThisRun: 0, score: 0 });
    const checkpoint2 = applyInput(playingState({ stage: 2, score: 199 }), "forward", 0);
    const firstAttempt3 = continueGame(checkpoint2, 0);
    expect(firstAttempt3).toMatchObject({ stage: 3, highestClearedStage: 2 });
    expect(tickGame(firstAttempt3, 2000).highestClearedStage).toBe(2);
    const checkpoint3 = applyInput({ ...firstAttempt3, score: 249 }, "forward", 0);
    const attempt4 = continueGame(checkpoint3, 0);
    expect(applyInput({ ...attempt4, score: 299 }, "forward", 0)).toMatchObject({ highestClearedStage: 4, clearedStageThisRun: 4 });
  });

  it("rejects inconsistent record ranges and checkpoint clocks", () => {
    const state = playingState();
    const checkpoint = applyInput({ ...state, score: 149 }, "forward", 0);
    for (const invalid of [
      { ...state, highestClearedStage: 6 }, { ...state, clearedStageThisRun: 1 },
      { ...state, checkpointEnteredAt: 0 }, { ...state, score: -1 }, { ...state, score: NaN },
      { ...state, score: 1.5 }, { ...state, score: getStageTargetScore(state.stage) },
      { ...state, score: getStageTargetScore(state.stage) + 1 }, { ...state, stage: 3 },
      { ...checkpoint, stage: 5 }, { ...checkpoint, checkpointEnteredAt: null },
      { ...checkpoint, stageEndsAt: 100 }, { ...checkpoint, nextPursuerStepAt: 100 },
    ]) expect(() => tickGame(invalid as GameState, 100)).toThrow(RangeError);
    for (const now of [-1, NaN, Infinity]) {
      expect(() => continueGame(checkpoint, now)).toThrow(RangeError);
      expect(() => quitAtCheckpoint(checkpoint, now)).toThrow(RangeError);
    }
  });

  it("plays all five stages with explicit checkpoints and real legal inputs", () => {
    let state = startGame(createGameState(() => 0), 0);
    const cleared: number[] = [];
    for (let action = 0; action < 2000 && state.status === "playing"; action++) {
      const direction = getRouteStep(state.route, state.stepsClimbed + 1).direction;
      state = applyInput(state, direction === state.direction ? "forward" : "turn", action * 10);
      if (state.status === "checkpoint") { cleared.push(state.stage); state = continueGame(state, action * 10); }
    }
    expect(cleared).toEqual([1, 2, 3, 4]);
    expect(state).toMatchObject({ status: "game-over", endReason: "cleared", stage: 5, highestClearedStage: 5 });
    expect(state.score).toBe(350);
  });
});

function playingState(overrides: Partial<GameState> = {}, nowMs = 0): GameState {
  const stage = overrides.stage ?? 1;
  return withPursuitAt({ ...startGame(createGameState(randomFiveSteps, { stage,
    highestClearedStage: (stage - 1) as GameState["highestClearedStage"] }), 0), ...overrides }, nowMs, overrides.pursuerDistance ?? 4);
}

describe("createGameState", () => {
  it("starts with no lives, a pursuer four steps away, and a right-facing route", () => {
    const state = createGameState(randomFiveSteps);
    expect(state).toMatchObject({
      status: "ready",
      stage: 1,
      stageEndsAt: null,
      endReason: null,
      score: 0,
      stepsClimbed: 0,
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
    [0, 5],
    [0.5, 7],
    [0.999, 9],
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

  it("makes a wrong input stop the player for500ms without an extra pursuit step", () => {
    const before = playingState({ eventSteps: 12 }, 1_000);
    const after = applyInput(before, "turn", 1_000);

    expect(after).toMatchObject({
      score: 0,
      stepsClimbed: 0,
      eventSteps: 12,
      pursuerDistance: 4,
      recoveryEndsAt: 1_500,
      lastMistake: true,
    });
    expect(after.route).toBe(before.route);
  });

  it("ignores inputs during recovery, then accepts input at the recovery boundary", () => {
    const fallen = applyInput(playingState({}, 1_000), "turn", 1_000);
    const blocked = applyInput(fallen, "forward", 1_499);
    const recovered = applyInput(blocked, "forward", 1_500);

    expect(blocked).toEqual(tickGame(fallen, 1_499));
    expect(blocked).toMatchObject({ score: 0, stepsClimbed: 0, recoveryEndsAt: 1_500, lastMistake: true });
    expect(blocked.route).toBe(fallen.route);
    expect(recovered).toMatchObject({
      score: 1,
      recoveryEndsAt: null,
      lastMistake: false,
    });
  });

  it("ends on the first catch and preserves the last safe stair", () => {
    const caught = tickGame(playingState({ pursuerDistance: 1 }), 1_000);

    expect(caught).toMatchObject({
      pursuerDistance: 1,
      status: "game-over",
    });
  });

  it("ends the game after the first capture and ignores later inputs", () => {
    const gameOver = tickGame(playingState({ pursuerDistance: 1 }), 1_000);
    const afterGameOver = applyInput(gameOver, "forward", 1_700);

    expect(gameOver).toMatchObject({ status: "game-over" });
    expect(afterGameOver).toMatchObject({
      score: gameOver.score,
      status: "game-over",
    });
  });

  it("starts the 30 second event on the 30th successful step", () => {
    const before = playingState({ eventSteps: 29 }, 2_000);
    const after = applyInput(before, "forward", 2_000);

    expect(after).toMatchObject({
      score: 1,
      stepsClimbed: 1,
      eventSteps: 0,
      eventEndsAt: 32_000,
    });
  });

  it("awards two points during the event without advancing its gauge", () => {
    const before = playingState({ eventSteps: 8, eventEndsAt: 30_000 }, 29_999);
    const after = applyInput(before, "forward", 29_999);

    expect(after).toMatchObject({
      score: 2,
      eventSteps: 8,
      eventEndsAt: 30_000,
    });
  });

  it("expires an event at its exact end time before scoring the next move", () => {
    const before = playingState({ eventSteps: 8, eventEndsAt: 30_000 }, 30_000);
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
      state = after;
    }
  });
});

describe("tickGame", () => {
  it("ends an event and clears its gauge at the expiry boundary", () => {
    const eventState = playingState({ eventSteps: 9, eventEndsAt: 10_000 }, 9_999);

    expect(tickGame(eventState, 9_999)).toBe(eventState);
    expect(tickGame(eventState, 10_000)).toMatchObject({
      eventSteps: 0,
      eventEndsAt: null,
    });
  });

  it("clears the fall animation at its recovery boundary", () => {
    const fallen = applyInput(playingState({}, 500), "turn", 500);

    expect(tickGame(fallen, 999)).toMatchObject({ recoveryEndsAt: 1_000, lastMistake: true });
    expect(tickGame(fallen, 1_000)).toMatchObject({
      recoveryEndsAt: null,
      lastMistake: false,
    });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid time %s", (nowMs) => {
    expect(() => tickGame(playingState(), nowMs)).toThrow(RangeError);
  });
});

describe("resumeGameAfterPause", () => {
  it("shifts both active deadlines exactly once and keeps the state immutable", () => {
    const state = withPursuitAt({ ...startGame(createGameState(randomFiveSteps), 1_000), eventEndsAt: 31_000 }, 10_999);
    const snapshot = structuredClone(state);
    const after = resumeGameAfterPause(state, 11_000, 46_000);
    expect(after).toMatchObject({ status: "playing", stageEndsAt: 126_000, eventEndsAt: 66_000 });
    expect(getStageSecondsLeft(after, 46_000)).toBe(80);
    expect(state).toEqual(snapshot);
    expect(resumeGameAfterPause(state, 11_000, 46_000)).toEqual(after);
    expect(resumeGameAfterPause(after, 46_000, 46_000)).toBe(after);
    expect(tickGame(withPursuitAt(after, 125_999), 126_000).endReason).toBe("time-limit");
  });

  it("does not revive stage or bonus deadlines already expired on open", () => {
    const state = playingState({ eventEndsAt: 10_000 });
    expect(resumeGameAfterPause(withPursuitAt(state, 89_999), 90_000, 200_000)).toMatchObject({
      status: "game-over", endReason: "time-limit", stageEndsAt: null, eventEndsAt: null,
    });
    expect(resumeGameAfterPause(withPursuitAt(state, 9_999), 10_000, 20_000)).toMatchObject({
      status: "playing", stageEndsAt: 100_000, eventEndsAt: null,
    });
  });

  it("keeps ready unarmed and final caught games ended while clearing recovery", () => {
    const ready = createGameState(randomFiveSteps);
    expect(resumeGameAfterPause(ready, 1_000, 200_000)).toBe(ready);
    const caught = tickGame(playingState({ pursuerDistance: 1 }), 1_000);
    expect(resumeGameAfterPause(caught, 1_100, 200_000)).toMatchObject({
      status: "game-over", endReason: "caught", stageEndsAt: null, recoveryEndsAt: null,
    });
  });

  it("allows recovery to elapse during pause without extending it", () => {
    const fallen = applyInput(playingState(), "turn", 1_000);
    expect(resumeGameAfterPause(fallen, 1_100, 10_000)).toMatchObject({
      status: "playing", stageEndsAt: 98_900, recoveryEndsAt: null, lastMistake: false,
    });
  });

  it("shifts stage two and its event and ignores negative pause duration", () => {
    const state = playingState({ stage: 2, stageEndsAt: 76_000, eventEndsAt: 31_000 }, 10_999);
    expect(resumeGameAfterPause(state, 11_000, 46_000)).toMatchObject({
      stage: 2, stageEndsAt: 111_000, eventEndsAt: 66_000,
    });
    const withoutEvent = { ...state, eventEndsAt: null };
    expect(resumeGameAfterPause(withoutEvent, 11_000, 200_000)).toMatchObject({ stage: 2, stageEndsAt: 265_000, eventEndsAt: null });
    expect(resumeGameAfterPause(state, 11_000, 10_000)).toBe(state);
  });
});

beforeEach(() => {
  vi.spyOn(stairObstacles, "createObstacleState").mockImplementation((route, stage) => makeObstacleFixture(route, 0, stage));
  vi.spyOn(stairObstacles, "revealObstacles").mockImplementation((state, route, index, stage) => makeObstacleFixture(route, index, stage, state));
});
afterEach(() => vi.restoreAllMocks());

function jumpState(overrides: Partial<GameState> = {}): GameState {
  return withObstacle({ ...applyInput(playingState({ stage: overrides.stage ?? 1 }), "forward", 0), ...overrides }, 2);
}

describe("obstacle jumps", () => {
  it("keeps ready preview on start, resets fresh metadata, and moves two real stairs without moving the NPC", () => {
    const ready = createGameState(() => 0);
    expect(ready.lastMove).toBeNull();
    expect(startGame(ready, 0).obstacles).toBe(ready.obstacles);
    const state = jumpState();
    const random = vi.spyOn(Math, "random");
    const moved = applyInput(state, "jump", 10);
    expect(moved).toMatchObject({ stepsClimbed: 3, score: 3, eventSteps: 3, direction: "right",
      pursuerIndex: state.pursuerIndex, nextPursuerStepAt: state.nextPursuerStepAt, pursuerDistance: state.pursuerDistance + 2,
      lastMove: { kind: "jump", fromIndex: 1, toIndex: 3, scoreGain: 2, isBonus: false } });
    expect(applyInput(state, "jump", 10)).toEqual(moved);
    expect(random).not.toHaveBeenCalled();
    expect(state.stepsClimbed).toBe(1);
    expect(resetGame(() => 0).lastMove).toBeNull();
    expect(resetGame(() => 0).obstacles).not.toBe(state.obstacles);
  });

  it.each([28, 29])("charges two physical stairs at gauge %s, without carrying or multiplying the triggering move", (eventSteps) => {
    const moved = applyInput(jumpState({ eventSteps }), "jump", 10);
    expect(moved).toMatchObject({ score: 3, eventSteps: 0, eventEndsAt: 30_010, lastMove: { scoreGain: 2, isBonus: false } });
  });

  it("gives four points during a bonus without charging the gauge and only two at exact expiry", () => {
    const state = jumpState({ eventSteps: 12, eventEndsAt: 100 });
    expect(applyInput(state, "jump", 99)).toMatchObject({ score: 5, eventSteps: 12, eventEndsAt: 100, lastMove: { scoreGain: 4, isBonus: true } });
    expect(applyInput(state, "jump", 100)).toMatchObject({ score: 3, eventSteps: 2, eventEndsAt: null, lastMove: { scoreGain: 2, isBonus: false } });
  });

  it.each(["forward", "turn"] as const)("treats %s into a box as one mistake, preserving all post-tick pursuit and obstacle data", (input) => {
    const state = jumpState();
    const reveal = vi.mocked(stairObstacles.revealObstacles);
    reveal.mockClear();
    const wrong = applyInput(state, input, 10);
    expect(wrong).toEqual({ ...state, lastMove: null, lastMistake: true, recoveryEndsAt: 510, nextPursuerStepAt: 260 });
    expect(wrong.obstacles).toBe(state.obstacles);
    expect(wrong.route).toBe(state.route);
    expect(reveal).not.toHaveBeenCalled();
    expect(applyInput(wrong, "jump", 20)).toBe(wrong);
  });

  it("rejects an empty jump, a corner jump and an occupied landing", () => {
    expect(applyInput(playingState(), "jump", 0)).toMatchObject({ score: 0, stepsClimbed: 0, recoveryEndsAt: 500, lastMove: null });
    let corner = playingState();
    for (let i = 0; i < 5; i += 1) corner = applyInput(corner, "forward", 0);
    expect(applyInput(corner, "jump", 0)).toMatchObject({ score: 5, stepsClimbed: 5, lastMistake: true });
    const state = jumpState();
    // Deliberately impossible decisions check the defensive landing guard only.
    const occupied = { ...state, obstacles: { ...state.obstacles, runs: [...state.obstacles.runs, { ...state.obstacles.runs[0], obstacleIndex: 3 }] } };
    expect(applyInput(occupied, "jump", 10)).toMatchObject({ stepsClimbed: 1, lastMistake: true, lastMove: null });
    const hasObstacle = stairObstacles.hasObstacle;
    vi.spyOn(stairObstacles, "hasObstacle").mockImplementation((obstacles, index) => index === 6 || hasObstacle(obstacles, index));
    expect(applyInput(corner, "jump", 0)).toMatchObject({ stepsClimbed: 5, lastMistake: true });
  });

  it("continues scheduled pursuit during recovery without restarting the fall", () => {
    const state = withPursuitAt(jumpState(), 0);
    const wrong = applyInput(state, "forward", 900);
    const blocked = applyInput(wrong, "jump", 1_000);
    expect(blocked).toMatchObject({ recoveryEndsAt: 1_400, stepsClimbed: 1, score: 1,
      pursuerIndex: state.pursuerIndex + 2, pursuerDistance: 2, nextPursuerStepAt: 1_250 });
  });

  it("resolves a due catch before Space and clears move metadata without revealing boxes", () => {
    const state = withPursuitAt(jumpState({ }), 0, 1);
    vi.mocked(stairObstacles.revealObstacles).mockClear();
    const ended = applyInput(state, "jump", 1_000);
    expect(ended).toMatchObject({ status: "game-over", endReason: "caught", score: 1, stepsClimbed: 1, lastMove: null });
    expect(stairObstacles.revealObstacles).not.toHaveBeenCalled();
    expect(applyInput(ended, "jump", 1_000)).toBe(ended);
    expect(ended.pursuerDistance).toBe(1);
    expect(ended.captureCount).toBe(1);
  });

  it.each(STAGE_RULES)("caps jump scoring at the exact goal and keeps full new budgets in stage $stage", (rule) => {
    const state = withPursuitAt(jumpState({ stage: rule.stage, score: rule.scoreRequired - 1,
      stageEndsAt: rule.durationMs }), 0);
    const moved = applyInput(state, "jump", 10);
    expect(moved).toMatchObject({ score: rule.scoreRequired, stepsClimbed: 3,
      stage: rule.stage, lastMove: { kind: "jump", scoreGain: 1 } });
    if (rule.stage === 5) {
      expect(moved).toMatchObject({ status: "game-over", endReason: "cleared", nextPursuerStepAt: null, });
      expect(applyInput(moved, "jump", 10)).toBe(moved);
    } else {
      const next = getStageRule((rule.stage + 1) as typeof rule.stage);
      expect(moved).toMatchObject({ status: "checkpoint", stageEndsAt: null, nextPursuerStepAt: null });
      const continued = continueGame(moved, 20);
      expect(continued).toMatchObject({ status: "playing", score: 0, lastMove: null, pursuerDistance: 4,
        stageEndsAt: 20 + next.durationMs, nextPursuerStepAt: 20 + next.pursuerStepIntervalMs });
    }
    expect(stairObstacles.revealObstacles).toHaveBeenLastCalledWith(expect.anything(), moved.route, 3, Math.min(5, moved.stage + 1));
  });

  it("expires before a goal-reaching jump and preserves a completed move across ordinary NPC/bonus ticks", () => {
    const state = jumpState({ score: 149, stageEndsAt: 100 });
    expect(applyInput(state, "jump", 100)).toMatchObject({ score: 149, stepsClimbed: 1, endReason: "time-limit", lastMove: null });
    const moved = applyInput(jumpState({ eventEndsAt: 100 }), "jump", 10);
    const ticked = tickGame(moved, 1_000);
    expect(ticked.lastMove).toBe(moved.lastMove);
    expect(ticked.eventEndsAt).toBeNull();
    expect(ticked.pursuerIndex).toBe(moved.pursuerIndex + 2);
  });

  it("reveals new runs with the promoted stage and keeps earlier decisions by reference", () => {
    let before = playingState();
    for (let index = 0; index < 8; index += 1) {
      before = applyInput(before, getRouteStep(before.route, before.stepsClimbed + 1).direction === before.direction ? "forward" : "turn", 0);
    }
    const state = withObstacle({ ...before, score: 149 }, 9);
    const old = state.obstacles.runs.find((run) => run.runStartIndex === 7)!;
    const moved = applyInput(state, "jump", 10);
    expect(moved.obstacles.runs.find((run) => run.runStartIndex === 7)).toBe(old);
    expect(moved.obstacles.runs.find((run) => run.runStartIndex === 16)?.stageAtGeneration).toBe(2);
  });

  it("plays a real seeded route through multiple promotions with shared, stable obstacle decisions", () => {
    vi.mocked(stairObstacles.createObstacleState).mockRestore();
    vi.mocked(stairObstacles.revealObstacles).mockRestore();
    const ready = createGameState(() => 0.5);
    let state = startGame(ready, 0);
    let jumps = 0;
    for (let action = 0; action < 500 && state.status === "playing"; action += 1) {
      const before = state;
      const blocked = stairObstacles.hasObstacle(before.obstacles, before.stepsClimbed + 1);
      const input = blocked ? "jump" : getRouteStep(before.route, before.stepsClimbed + 1).direction === before.direction ? "forward" : "turn";
      state = applyInput(before, input, 0);
      expect(state.lastMistake).toBe(false);
      expect(state.stepsClimbed - before.stepsClimbed).toBe(blocked ? 2 : 1);
      expect(state.lastMove?.scoreGain).toBe((blocked ? 2 : 1) * (before.eventEndsAt === null ? 1 : 2));
      for (const record of before.obstacles.runs) {
        const retained = state.obstacles.runs.find((entry) => entry.runStartIndex === record.runStartIndex);
        if (retained) expect(retained).toBe(record);
      }
      if (blocked) jumps += 1;
      if (state.status === "checkpoint") state = continueGame(state, 0);
    }
    expect(jumps).toBeGreaterThan(0);
    expect(state.stage).toBeGreaterThanOrEqual(3);
    expect(state.pursuerDistance).toBe(state.stepsClimbed - state.pursuerIndex);
  });
});
