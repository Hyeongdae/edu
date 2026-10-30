import { afterEach, describe, expect, it, vi } from "vitest";
import { applyInput, getStageSecondsLeft, startGame } from "../game/gameEngine";
import { chooseObstacleIndex, hasObstacle, revealObstacles } from "../game/stairObstacles";
import { getRouteStep } from "../game/stairRoute";
import type { GameInput, GameState } from "../game/types";
import { withPursuitAt } from "../test/gameFixtures";
import { withObstacle } from "../test/obstacleFixtures";
import {
  applyDescentInput, createDescentState, resetDescent,
  resumeDescentAfterPause, startDescent, tickDescent,
} from "./descentEngine";

afterEach(() => vi.restoreAllMocks());

function playing(seed = 0): GameState {
  return startDescent(createDescentState(() => seed), 0);
}

function nextInput(state: GameState): GameInput {
  if (hasObstacle(state.obstacles, state.stepsClimbed + 1)) return "jump";
  return getRouteStep(state.route, state.stepsClimbed + 1).direction === state.direction ? "forward" : "turn";
}

function jumpState(patch: Partial<GameState> = {}): GameState {
  return withObstacle({ ...applyDescentInput(playing(), "forward", 0), ...patch }, 2);
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe("single-stage descent sessions", () => {
  it("creates and resets a fresh stage-one preview with one seed and no clocks", () => {
    const random = vi.fn(() => 0.5);
    const ready = createDescentState(random);
    expect(random).toHaveBeenCalledOnce();
    expect(ready).toMatchObject({ status: "ready", stage: 1, score: 0, stepsClimbed: 0,
      highestClearedStage: 0, clearedStageThisRun: 0, checkpointEnteredAt: null,
      stageEndsAt: null, nextPursuerStepAt: null, eventEndsAt: null, eventSteps: 0,
      recoveryEndsAt: null, captureEndsAt: null, captureCount: 0, direction: "right",
      pursuerIndex: -4, pursuerDistance: 4, lastMove: null, lastPursuerMove: null });
    expect(ready.obstacles.runs.every(run => run.stageAtGeneration === 1)).toBe(true);
    expect(ready).not.toHaveProperty("lives");
    expect(getStageSecondsLeft(ready, 1e6)).toBe(90);
    const reset = resetDescent(() => 0.5);
    expect(reset).toEqual(ready);
    expect(reset.route).not.toBe(ready.route);
    expect(tickDescent(ready, 1e6)).toBe(ready);
    expect(applyDescentInput(ready, "forward", 1e6)).toBe(ready);
  });

  it("arms ninety seconds and the 500ms pursuit only once on start", () => {
    const ready = createDescentState(() => 0);
    const started = startDescent(ready, 123);
    expect(started).toMatchObject({ status: "playing", stageEndsAt: 90_123, nextPursuerStepAt: 623 });
    expect(started.route).toBe(ready.route);
    expect(started.obstacles).toBe(ready.obstacles);
    expect(startDescent(started, 500)).toBe(started);
    expect(tickDescent(started, 123)).toBe(started);
  });

  it.each([-1, 1, NaN, Infinity])("rejects the invalid generation seed %s", seed => {
    expect(() => createDescentState(() => seed)).toThrow(RangeError);
    expect(() => resetDescent(() => seed)).toThrow(RangeError);
  });

  it.each([-1, NaN, Infinity, -Infinity])("delegates invalid time %s to engine validation", time => {
    const state = playing();
    expect(() => startDescent(state, time)).toThrow(RangeError);
    expect(() => tickDescent(state, time)).toThrow(RangeError);
    expect(() => applyDescentInput(state, "forward", time)).toThrow(RangeError);
    expect(() => resumeDescentAfterPause(state, time, 100)).toThrow(RangeError);
    expect(() => resumeDescentAfterPause(state, 0, time)).toThrow(RangeError);
  });

  it.each([
    { stage: 2, highestClearedStage: 1 }, { highestClearedStage: 2 }, { highestClearedStage: -1 },
    { highestClearedStage: NaN }, { clearedStageThisRun: 2 }, { clearedStageThisRun: -1 },
    { clearedStageThisRun: NaN }, { checkpointEnteredAt: 0 }, { status: "checkpoint" },
  ])("rejects foreign stage/progress/checkpoint state %j", patch => {
    const state = { ...playing(), ...patch } as GameState;
    const before = structuredClone(state);
    const random = vi.spyOn(Math, "random");
    expect(() => startDescent(state, 0)).toThrow(RangeError);
    expect(() => tickDescent(state, 0)).toThrow(RangeError);
    expect(() => applyDescentInput(state, "forward", 0)).toThrow(RangeError);
    expect(() => resumeDescentAfterPause(state, 0, 100)).toThrow(RangeError);
    expect(state).toEqual(before);
    expect(random).not.toHaveBeenCalled();
  });

  it("rejects a genuine climbing checkpoint rather than continuing it", () => {
    const checkpoint = applyInput({ ...playing(), score: 149 }, "forward", 0);
    expect(checkpoint.status).toBe("checkpoint");
    expect(() => tickDescent(checkpoint, 100)).toThrow(RangeError);
    expect(() => startDescent(checkpoint, 100)).toThrow(RangeError);
  });

  it("keeps the core pursuit/session validators intact", () => {
    const state = playing();
    const invalid: Partial<GameState>[] = [{ score: -1 }, { pursuerDistance: 0 }, { pursuerIndex: -3 },
      { stageEndsAt: null }, { clearedStageThisRun: 1, highestClearedStage: 0 }];
    for (const patch of invalid) {
      expect(() => tickDescent({ ...state, ...patch }, 0)).toThrow(RangeError);
    }
  });

  it.each([0, 0.04, 0.12, 0.25, 0.5, 0.73, 0.99])("legally plays seeded route %s to one final clear", seed => {
    let state = playing(seed);
    let physicalSteps = 0;
    let moves = 0;
    const seenDirections = new Set<string>();
    const history = new Map<number, unknown>();
    while (state.status === "playing" && moves < 180) {
      for (const run of state.obstacles.runs) {
        if (history.has(run.runStartIndex)) expect(run).toEqual(history.get(run.runStartIndex));
        history.set(run.runStartIndex, structuredClone(run));
      }
      const input = nextInput(state);
      const before = freeze(state);
      const after = applyDescentInput(before, input, 0);
      expect(after).toEqual(applyDescentInput(before, input, 0));
      physicalSteps += input === "jump" ? 2 : 1;
      expect(after.stepsClimbed).toBe(physicalSteps);
      expect(after.lastMove?.scoreGain).toBe((input === "jump" ? 2 : 1) * (before.eventEndsAt === null ? 1 : 2));
      expect(after.lastMistake).toBe(false);
      expect(after.stage).toBe(1);
      expect(after.obstacles.runs.every(run => run.stageAtGeneration === 1)).toBe(true);
      seenDirections.add(after.direction);
      state = after;
      moves++;
    }
    expect([...seenDirections].sort()).toEqual(["left", "right"]);
    expect(state).toMatchObject({ status: "game-over", endReason: "cleared", stage: 1,
      highestClearedStage: 1, clearedStageThisRun: 1, checkpointEnteredAt: null,
      stageEndsAt: null, nextPursuerStepAt: null, eventEndsAt: null,
      recoveryEndsAt: null, captureEndsAt: null, lastPursuerMove: null });
    expect(state.score).toBe(150);
    expect(tickDescent(state, 1e6)).toBe(state);
    expect(startDescent(state, 1e6)).toBe(state);
    expect(applyDescentInput(state, "jump", 1e6)).toBe(state);
    expect(resumeDescentAfterPause(state, 0, 1e6)).toBe(state);
  });

  it.each([[149, false, 150, 1], [149, true, 150, 1], [148, true, 150, 2]] as const)(
    "caps the final jump from %s at 150 with bonus %s", (score, bonus, expected, credited) => {
      const before = freeze(jumpState({ score, eventEndsAt: bonus ? 30_000 : null }));
      const after = applyDescentInput(before, "jump", 100);
      expect(after).toMatchObject({ status: "game-over", endReason: "cleared", score: expected,
        checkpointEnteredAt: null, eventEndsAt: null, captureEndsAt: null, stepsClimbed: 3,
        lastMove: { kind: "jump", fromIndex: 1, toIndex: 3, scoreGain: credited, isBonus: bonus } });
      expect(after.obstacles).toEqual(revealObstacles(before.obstacles, after.route, 3, 1));
    },
  );

  it("reveals final new decisions with stage-one probability, not the core checkpoint's stage two", () => {
    let state = playing(0.5);
    let checked = false;
    for (let index = 0; index < 30; index++) {
      const before = freeze({ ...state, score: 149, eventEndsAt: null });
      const input = nextInput(before);
      const core = applyInput(before, input, 0);
      if (core.obstacles.runs.some(run => run.stageAtGeneration === 2)) {
        const actual = applyDescentInput(before, input, 0);
        expect(core.status).toBe("checkpoint");
        expect(actual.status).toBe("game-over");
        expect(actual.route).toEqual(core.route);
        expect(actual.obstacles).toEqual(revealObstacles(before.obstacles, core.route, core.stepsClimbed, 1));
        expect(actual.obstacles.runs.every(run => run.stageAtGeneration === 1)).toBe(true);
        for (const run of actual.obstacles.runs) {
          const existing = before.obstacles.runs.find(previous => previous.runStartIndex === run.runStartIndex);
          if (existing) expect(run).toBe(existing);
        }
        checked = true;
        break;
      }
      state = applyDescentInput(state, nextInput(state), 0);
    }
    expect(checked).toBe(true);
  });

  it("uses unchanged ten-percent long-run interior placement rules", () => {
    const state = createDescentState(() => 0.5);
    const long = state.route.runs.find(run => run.kind === "long")!;
    const short = state.route.runs.find(run => run.kind === "short")!;
    expect(chooseObstacleIndex(long, 1, 0.099, 0)).toBe(long.startIndex + 1);
    expect(chooseObstacleIndex(long, 1, 0.099, 0.999)).toBe(long.startIndex + long.length - 2);
    expect(chooseObstacleIndex(long, 1, 0.1, 0.5)).toBeNull();
    expect(chooseObstacleIndex(short, 1, 0, 0)).toBeNull();
  });

  it.each([0, 28, 29])("counts a two-stair jump toward the thirty-step gauge from %s", gauge => {
    const after = applyDescentInput(jumpState({ eventSteps: gauge }), "jump", 100);
    expect(after.lastMove?.scoreGain).toBe(2);
    expect(after.eventSteps).toBe(gauge >= 28 ? 0 : gauge + 2);
    expect(after.eventEndsAt).toBe(gauge >= 28 ? 30_100 : null);
  });

  it("scores four points during the bonus and resumes the gauge after its expiry", () => {
    const after = applyDescentInput(jumpState({ eventSteps: 12, eventEndsAt: 100 }), "jump", 0);
    expect(after).toMatchObject({ score: 5, eventSteps: 12, lastMove: { scoreGain: 4, isBonus: true } });
    const expired = tickDescent(after, 100);
    expect(expired).toMatchObject({ eventEndsAt: null, eventSteps: 0 });
    const next = applyDescentInput(expired, nextInput(expired), 100);
    expect(next.lastMove?.isBonus).toBe(false);
  });

  it("has no browser storage or RNG effects outside supplied run creation", () => {
    const initial = freeze(playing());
    const before = structuredClone(initial);
    const random = vi.spyOn(Math, "random");
    const local = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("blocked"); });
    const session = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw new Error("blocked"); });
    for (const action of ["forward", "turn", "jump"] as const) applyDescentInput(initial, action, 0);
    tickDescent(initial, 3200);
    resumeDescentAfterPause(initial, 100, 95_100);
    startDescent(createDescentState(() => 0), 0);
    resetDescent(() => 0);
    expect(local).not.toHaveBeenCalled();
    expect(session).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(initial).toEqual(before);
  });
});

describe("descent timing remains the original engine's timing", () => {
  it("walks the real NPC stairs at 500/1000/1500 then catches once at2000", () => {
    const initial = freeze(playing());
    for (const [at, index] of [[500, -3], [1000, -2], [1500, -1]]) {
      expect(tickDescent(initial, at)).toMatchObject({ status: "playing", pursuerIndex: index,
        lastPursuerMove: { toIndex: index, atMs: at }, nextPursuerStepAt: at + 500 });
    }
    const caught = tickDescent(initial, 2000);
    expect(caught).toMatchObject({ status: "game-over", endReason: "caught", score: 0,
      captureCount: 1, pursuerIndex: -1, pursuerDistance: 1, captureEndsAt: 2500, nextPursuerStepAt: null });
    expect(tickDescent(caught, 2499)).toBe(caught);
    const expired = tickDescent(caught, 2500);
    expect(expired.captureEndsAt).toBeNull();
    expect(applyDescentInput(expired, "forward", 1e6)).toBe(expired);
    expect(tickDescent(initial, 1e6)).toEqual(expired);
  });

  it.each(["turn", "jump"] as const)("falls without an immediate NPC move on wrong %s and ignores repeats", input => {
    const fallen = applyDescentInput(playing(), input, 0);
    expect(fallen).toMatchObject({ stepsClimbed: 0, pursuerIndex: -4,
      recoveryEndsAt: 500, nextPursuerStepAt: 250, lastMistake: true, lastMove: null });
    expect(applyDescentInput(fallen, input, 100)).toBe(fallen);
    const first = applyDescentInput(fallen, "forward", 250);
    expect(first).toMatchObject({ stepsClimbed: 0, pursuerIndex: -3, recoveryEndsAt: 500,
      lastPursuerMove: { atMs: 250 }, nextPursuerStepAt: 500 });
    const recovered = tickDescent(first, 500);
    expect(recovered).toMatchObject({ pursuerIndex: -2, recoveryEndsAt: null,
      lastMistake: false, lastPursuerMove: { atMs: 500 }, nextPursuerStepAt: 1000 });
    const moved = applyDescentInput(first, "forward", 500);
    expect(moved).toMatchObject({ stepsClimbed: 1, pursuerIndex: -2, nextPursuerStepAt: 1000 });
    expect(tickDescent(moved, 1000).lastPursuerMove?.atMs).toBe(1000);
  });

  it("falls when a normal step collides with a box", () => {
    expect(applyDescentInput(jumpState(), "forward", 0)).toMatchObject({ stepsClimbed: 1,
      score: 1, recoveryEndsAt: 500, lastMistake: true, nextPursuerStepAt: 250 });
  });

  it("preserves an earlier100ms deadline and restores the normal interval after350", () => {
    const fallen = applyDescentInput({ ...playing(), nextPursuerStepAt: 100 }, "turn", 0);
    expect(fallen.nextPursuerStepAt).toBe(100);
    expect(tickDescent(fallen, 100)).toMatchObject({ lastPursuerMove: { atMs: 100 }, nextPursuerStepAt: 350 });
    expect(tickDescent(fallen, 500)).toMatchObject({ lastPursuerMove: { atMs: 350 }, nextPursuerStepAt: 850 });
  });

  it.each([[1, 250], [2, 500]])("expiry wins at the fast catch boundary with gap%s at%s", (gap, at) => {
    const initial = withPursuitAt({ ...playing(), stageEndsAt: at }, 0, gap);
    const fallen = applyDescentInput(initial, "turn", 0);
    expect(applyDescentInput(fallen, "jump", at)).toMatchObject({ endReason: "time-limit", captureCount: 0, score: 0 });
    const catchFirst = applyDescentInput({ ...fallen, stageEndsAt: at + 1 }, "forward", at + 1);
    expect(catchFirst).toMatchObject({ endReason: "caught", captureCount: 1, score: 0, captureEndsAt: at + 500 });
  });

  it("processes recovery-end capture before an escape input", () => {
    const fallen = applyDescentInput(withPursuitAt(playing(), 0, 2), "turn", 0);
    expect(applyDescentInput(fallen, "forward", 500)).toMatchObject({ endReason: "caught", stepsClimbed: 0 });
  });

  it("expires the real90second budget before a tied successful goal input", () => {
    const initial = { ...playing(), score: 149, nextPursuerStepAt: 90_001 };
    expect(applyDescentInput(initial, "forward", 90_000)).toMatchObject({ status: "game-over",
      endReason: "time-limit", score: 149, highestClearedStage: 0, clearedStageThisRun: 0 });
  });

  it("freezes stage/event/pursuit remnants during a95second settings wait", () => {
    const state = freeze({ ...playing(), eventEndsAt: 30_000, eventSteps: 12 });
    const after = resumeDescentAfterPause(state, 100, 95_100);
    expect(after).toMatchObject({ stageEndsAt: 185_000, eventEndsAt: 125_000,
      nextPursuerStepAt: 95_500, eventSteps: 12, pursuerIndex: -4 });
    expect(after.route).toBe(state.route);
    expect(after.obstacles).toBe(state.obstacles);
    expect(resumeDescentAfterPause(state, 100, 100)).toBe(state);
  });

  it("keeps the pending150ms fall remainder across settings and uses the normal successor", () => {
    const fallen = applyDescentInput(playing(), "turn", 0);
    const after = resumeDescentAfterPause(fallen, 100, 10_100);
    expect(after).toMatchObject({ nextPursuerStepAt: 10_250, recoveryEndsAt: null,
      lastMistake: false, pursuerIndex: -4 });
    expect(tickDescent(after, 10_249)).toBe(after);
    expect(tickDescent(after, 10_250)).toMatchObject({ pursuerIndex: -3,
      lastPursuerMove: { atMs: 10_250 }, nextPursuerStepAt: 10_750 });
  });

  it("reconciles a catch that was already due before opening settings", () => {
    const after = resumeDescentAfterPause(playing(), 3200, 98_200);
    expect(after).toMatchObject({ status: "game-over", endReason: "caught", captureCount: 1, captureEndsAt: null });
  });

  it("matches the unchanged core for nonterminal moves, clocks and pauses", () => {
    const ready = createDescentState(() => 0.5);
    expect(startDescent(ready, 0)).toEqual(startGame(ready, 0));
    const state = playing(0.5);
    for (const input of ["forward", "turn", "jump"] as const) {
      expect(applyDescentInput(state, input, 100)).toEqual(applyInput(state, input, 100));
    }
  });
});
