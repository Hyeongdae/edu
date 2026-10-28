import { afterEach, describe, expect, it, vi } from "vitest";
import { withObstacle } from "../test/obstacleFixtures";
import { withPursuitAt } from "../test/gameFixtures";
import type { GameState } from "../game/types";
import { createDescentState, startDescent, applyDescentInput } from "./descentEngine";
import { createDescentViewState, descentViewReducer as reduce, type DescentViewState } from "./descentViewState";

afterEach(() => vi.restoreAllMocks());
const ready = () => createDescentViewState(createDescentState(() => 0), 0);
const start = () => reduce(ready(), { type: "start", nowMs: 0 });
const input = (view: DescentViewState, key: "forward" | "turn" | "jump", at = 0) => reduce(view, { type: "input", input: key, nowMs: at });
const fixture = (game: GameState): DescentViewState => ({ ...ready(), game });

describe("descent view transitions", () => {
  it("initializes a stopped preview and arms only once", () => {
    const view = ready();
    expect(view).toMatchObject({ nowMs: 0, settingsOpenedAt: null, playerMoveAt: null,
      scoreGain: null, scoreGainUntil: null, successfulActionCount: 0, mistakeCount: 0 });
    const playing = reduce(view, { type: "start", nowMs: 100 });
    expect(playing.game.stageEndsAt).toBe(90_100);
    expect(reduce(playing, { type: "start", nowMs: 200 })).toBe(playing);
    expect(reduce(view, { type: "open-settings", nowMs: 100 })).toBe(view);
    expect(reduce(view, { type: "close-settings", nowMs: 100 })).toBe(view);
    expect(reduce(view, { type: "restart", readyState: createDescentState(() => 0), nowMs: 100 })).toBe(view);
  });

  it.each([-1, NaN, Infinity])("rejects initial invalid time%s", now => {
    expect(() => createDescentViewState(createDescentState(() => 0), now)).toThrow(RangeError);
  });
  it("rejects nonfresh previews and foreign stages", () => {
    const state = createDescentState(() => 0);
    for (const patch of [{ score: 1 }, { stepsClimbed: 1 }, { highestClearedStage: 1 }, { eventSteps: 1 },
      { recoveryEndsAt: 500 }, { captureEndsAt: 500 }, { stageEndsAt: 90000 }, { captureCount: 1 },
      { lastMistake: true }, { stage: 2 }, { endReason: "quit" }]) {
      expect(() => createDescentViewState({ ...state, ...patch } as GameState, 0)).toThrow(RangeError);
    }
    expect(() => createDescentViewState(startDescent(state, 0), 0)).toThrow(RangeError);
  });

  it("counts batched successes as actions and separates300/600ms cosmetic expiry", () => {
    const first = input(start(), "forward");
    const second = input(first, "forward", 1);
    expect(second).toMatchObject({ successfulActionCount: 2, mistakeCount: 0,
      playerMotionKey: 2, playerMoveAt: 1, scoreGain: 1, scoreGainUntil: 601 });
    expect(second.game.stepsClimbed).toBe(2);
    const before = reduce(second, { type: "tick", nowMs: 300 });
    expect(before.playerMoveAt).toBe(1);
    const arcDone = reduce(before, { type: "tick", nowMs: 301 });
    expect(arcDone).toMatchObject({ playerMoveAt: null, scoreGain: 1 });
    expect(reduce(arcDone, { type: "tick", nowMs: 601 })).toMatchObject({ scoreGain: null, scoreGainUntil: null });
  });

  it.each([false, true])("counts a two-stair jump once and displays gain2/4 with bonus%s", bonus => {
    const game = withObstacle({ ...applyDescentInput(start().game, "forward", 0), eventEndsAt: bonus ? 30000 : null }, 2);
    const after = input(fixture(game), "jump");
    expect(after.game.stepsClimbed).toBe(3);
    expect(after).toMatchObject({ successfulActionCount: 1, mistakeCount: 0,
      scoreGain: bonus ? 4 : 2, scoreGainIsBonus: bonus, playerMoveAt: 0 });
  });

  it("counts a fall once, blocks repeats and cancels old gain/arc", () => {
    const moved = input(start(), "forward");
    const fallen = input(moved, "turn", 10);
    expect(fallen).toMatchObject({ successfulActionCount: 1, mistakeCount: 1,
      playerMoveAt: null, scoreGain: null, scoreGainUntil: null });
    expect(input(fallen, "jump", 100).mistakeCount).toBe(1);
    const after = input(fallen, "forward", 510);
    expect(after).toMatchObject({ successfulActionCount: 2, mistakeCount: 1 });
  });

  it("finishes the successful final input without retaining cosmetics or a checkpoint", () => {
    const before = fixture({ ...start().game, score: 149 });
    const after = input(before, "forward");
    expect(after).toMatchObject({ successfulActionCount: 1, playerMoveAt: null, scoreGain: null,
      game: { status: "game-over", endReason: "cleared", score: 150, stage: 1, checkpointEnteredAt: null } });
    expect(after.game.lastMove).not.toBeNull();
    expect(reduce(after, { type: "tick", nowMs: 100000 }).game.status).toBe("game-over");
  });

  it("does not turn an expired final input into a success", () => {
    const before = fixture({ ...start().game, score: 149, stageEndsAt: 250 });
    expect(input(before, "forward", 250)).toMatchObject({ successfulActionCount: 0,
      game: { endReason: "time-limit", score: 149, clearedStageThisRun: 0 } });
  });

  it("reconciles an early catch once and clears its gate after500ms", () => {
    const before = fixture({ ...withPursuitAt(start().game, 0, 1), stageEndsAt: 801 });
    const caught = reduce(before, { type: "tick", nowMs: 900 });
    expect(caught).toMatchObject({ playerMoveAt: null, scoreGain: null,
      game: { endReason: "caught", captureCount: 1, captureEndsAt: 1300 } });
    const after = reduce(caught, { type: "tick", nowMs: 1400 });
    expect(after.game).toMatchObject({ captureCount: 1, captureEndsAt: null, endReason: "caught" });
  });

  it("pauses all three clocks95seconds and blocks every play action", () => {
    const before = fixture({ ...start().game, eventEndsAt: 30000, eventSteps: 12 });
    const open = reduce(before, { type: "open-settings", nowMs: 100 });
    for (const action of [{ type: "input", input: "jump", nowMs: 95100 }, { type: "tick", nowMs: 95100 },
      { type: "start", nowMs: 95100 }, { type: "open-settings", nowMs: 95100 },
      { type: "restart", readyState: createDescentState(() => 0), nowMs: 95100 }] as const) {
      expect(reduce(open, action)).toBe(open);
    }
    const closed = reduce(open, { type: "close-settings", nowMs: 95100 });
    expect(closed).toMatchObject({ settingsOpenedAt: null, playerMoveAt: null, scoreGain: null,
      game: { stageEndsAt: 185000, eventEndsAt: 125000, nextPursuerStepAt: 95800 } });
    expect(closed.game.route).toBe(before.game.route);
    expect(closed.game.obstacles).toBe(before.game.obstacles);
    expect(reduce(closed, { type: "close-settings", nowMs: 96000 })).toBe(closed);
  });

  it("does not replay either actor's old movement after a brief settings visit", () => {
    const moved = input(start(), "forward", 800);
    expect(moved.game.lastPursuerMove?.atMs).toBe(800);
    const open = reduce(moved, { type: "open-settings", nowMs: 801 });
    const closed = reduce(open, { type: "close-settings", nowMs: 802 });
    expect(closed).toMatchObject({ playerMoveAt: null, scoreGain: null, game: { lastPursuerMove: null } });
    expect(closed.game.pursuerIndex).toBe(moved.game.pursuerIndex);
  });

  it("reconciles a fatal catch before opening settings", () => {
    expect(reduce(start(), { type: "open-settings", nowMs: 3200 })).toMatchObject({ settingsOpenedAt: null,
      game: { endReason: "caught", captureCount: 1 } });
  });

  it("preserves the150ms fall deadline across a long settings pause", () => {
    const fallen = input(start(), "turn");
    const open = reduce(fallen, { type: "open-settings", nowMs: 100 });
    const closed = reduce(open, { type: "close-settings", nowMs: 10100 });
    expect(closed.game).toMatchObject({ recoveryEndsAt: null, nextPursuerStepAt: 10250 });
    expect(reduce(closed, { type: "tick", nowMs: 10250 }).game).toMatchObject({ nextPursuerStepAt: 11050 });
  });

  it("restarts with supplied fresh state, preserves counters and consumes no RNG", () => {
    const failed = reduce(input(input(start(), "forward"), "turn"), { type: "tick", nowMs: 100000 });
    const preview = createDescentState(() => 0.5);
    const random = vi.spyOn(Math, "random");
    const action = { type: "restart", readyState: preview, nowMs: 100000 } as const;
    const snapshot = structuredClone(failed);
    Object.freeze(failed);
    const after = reduce(failed, action);
    expect(after).toMatchObject({ game: { status: "ready", score: 0, eventSteps: 0, stageEndsAt: null },
      successfulActionCount: 1, mistakeCount: 1, playerMoveAt: null, scoreGain: null });
    expect(after.game).toBe(preview);
    expect(reduce(failed, action)).toEqual(after);
    expect(failed).toEqual(snapshot);
    expect(random).not.toHaveBeenCalled();
  });
});
