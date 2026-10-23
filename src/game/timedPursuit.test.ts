import { describe, expect, it } from "vitest";
import { applyInput, createGameState, resetGame, resumeGameAfterPause, startGame, tickGame } from "./gameEngine";
import { advanceStairRoute, countStraightSteps, getRouteStep } from "./stairRoute";
import { buildStairSceneModel } from "./stairSceneModel";
import { getStageRule, STAGE_RULES } from "./stageRules";
import { withPursuitAt } from "../test/gameFixtures";
import type { GameStage, GameState } from "./types";

function playing(stage: GameStage = 1): GameState {
  const rule = getStageRule(stage);
  return withPursuitAt({ ...startGame(createGameState(() => 0), 0), stage, stageEndsAt: rule.durationMs }, 0);
}

function farAhead(): GameState {
  let state = playing();
  for (let index = 1; index <= 100; index += 1) state = { ...state, route: advanceStairRoute(state.route, index, -4) };
  const direction = getRouteStep(state.route, 100).direction;
  return { ...state, stepsClimbed: 100, score: 299, pursuerDistance: 104, direction,
    straightStepsRemaining: countStraightSteps(state.route, 100, direction) };
}

describe("autonomous pursuit", () => {
  it.each(STAGE_RULES)("moves one real stair each $pursuerStepIntervalMs ms in stage $stage", (rule) => {
    const state = playing(rule.stage);
    expect(tickGame(state, rule.pursuerStepIntervalMs - 1)).toBe(state);
    const moved = tickGame(state, rule.pursuerStepIntervalMs);
    expect(moved).toMatchObject({ pursuerIndex: -3, pursuerDistance: 3, stepsClimbed: 0, score: 0,
      nextPursuerStepAt: rule.pursuerStepIntervalMs * 2,
      lastPursuerMove: { fromIndex: -4, toIndex: -3, atMs: rule.pursuerStepIntervalMs } });
    expect(tickGame(moved, rule.pursuerStepIntervalMs)).toBe(moved);
    expect(state.pursuerIndex).toBe(-4);
  });

  it("arms clocks only on start and resets a new ready game", () => {
    const ready = createGameState(() => 0);
    expect(ready).toMatchObject({ pursuerIndex: -4, pursuerDistance: 4, nextPursuerStepAt: null,
      lastPursuerMove: null, captureCount: 0, captureEndsAt: null });
    expect(tickGame(ready, 1_000_000)).toBe(ready);
    const state = startGame(ready, 550);
    expect(state.nextPursuerStepAt).toBe(1_550);
    expect(startGame(state, 1_000)).toBe(state);
    expect(resetGame(() => 0)).toEqual(ready);
  });

  it.each(STAGE_RULES)("reconciles late callbacks identically to small ticks in stage $stage", (rule) => {
    const initial = playing(rule.stage);
    let incremental = initial;
    for (let step = 1; step <= 15; step += 1) incremental = tickGame(incremental, rule.pursuerStepIntervalMs * step);
    const late = tickGame(initial, rule.pursuerStepIntervalMs * 15);
    expect(late).toEqual(incremental);
    expect(late).toMatchObject({ status: "game-over", lives: 0, endReason: "caught", captureCount: 3, nextPursuerStepAt: null });
  });

  it("captures idle players at four, eight and twelve seconds and stops permanently", () => {
    const state = playing();
    const first = tickGame(state, 4_000);
    expect(first).toMatchObject({ lives: 2, captureCount: 1, pursuerIndex: -4, pursuerDistance: 4,
      nextPursuerStepAt: 5_000, captureEndsAt: 4_500, recoveryEndsAt: 4_500, lastMistake: false });
    expect(tickGame(first, 8_000)).toMatchObject({ lives: 1, captureCount: 2 });
    const fatal = tickGame(first, 12_000);
    expect(fatal).toMatchObject({ lives: 0, captureCount: 3, endReason: "caught", captureEndsAt: 12_500, recoveryEndsAt: 12_500 });
    const ended = tickGame(fatal, 1_000_000);
    expect(ended).toMatchObject({ lives: 0, captureCount: 3, endReason: "caught", captureEndsAt: null, recoveryEndsAt: null });
    expect(tickGame(ended, 2_000_000)).toBe(ended);
    expect(applyInput(ended, "forward", 2_000_000)).toBe(ended);
  });

  it("continues a stage-five scheduled step during its five-hundred-ms catch recovery", () => {
    const caught = tickGame(playing(5), 1_600);
    expect(caught).toMatchObject({ captureCount: 1, captureEndsAt: 2_100, pursuerDistance: 4, nextPursuerStepAt: 2_000 });
    const moved = tickGame(caught, 2_000);
    expect(moved).toMatchObject({ captureEndsAt: 2_100, recoveryEndsAt: 2_100, pursuerIndex: -3, pursuerDistance: 3 });
    const model = buildStairSceneModel(moved);
    expect(model.catchFrames.at(-1)).toMatchObject({ index: -3, x: model.pursuer.x, y: model.pursuer.y });
    expect(tickGame(moved, 2_100)).toMatchObject({ captureEndsAt: null, recoveryEndsAt: null, pursuerDistance: 3 });
  });

  it("only stops the player after a mistake, while the original pursuit schedule continues", () => {
    const before = playing();
    const fallen = applyInput(before, "turn", 800);
    expect(fallen).toMatchObject({ lastMistake: true, recoveryEndsAt: 1_300, pursuerIndex: -4,
      pursuerDistance: 4, nextPursuerStepAt: 1_000, lives: 3, captureCount: 0 });
    const blocked = applyInput(fallen, "turn", 1_000);
    expect(blocked).toMatchObject({ lastMistake: true, recoveryEndsAt: 1_300, pursuerIndex: -3,
      pursuerDistance: 3, nextPursuerStepAt: 2_000, lives: 3, score: 0 });
    expect(applyInput(blocked, "forward", 1_299)).toBe(blocked);
    const recovered = applyInput(blocked, "forward", 1_300);
    expect(recovered).toMatchObject({ stepsClimbed: 1, score: 1, pursuerIndex: -3, pursuerDistance: 4,
      recoveryEndsAt: null, lastMistake: false, nextPursuerStepAt: 2_000 });
  });

  it("widens the gap on success without advancing the pursuer", () => {
    const state = applyInput(playing(), "forward", 100);
    expect(state).toMatchObject({ pursuerIndex: -4, pursuerDistance: 5, nextPursuerStepAt: 1_000, lastPursuerMove: null });
    expect(state.route.steps[0].index).toBe(-4);
    expect(buildStairSceneModel(state).pursuer.index).toBe(-4);
    expect(tickGame(state, 1_000)).toMatchObject({ pursuerIndex: -3, pursuerDistance: 4 });
  });

  it("processes a due capture before a potentially escaping input", () => {
    const state = withPursuitAt(playing(), 0, 1);
    expect(applyInput(state, "forward", 999)).toMatchObject({ score: 1, lives: 3, stepsClimbed: 1 });
    expect(applyInput(state, "forward", 1_000)).toMatchObject({ score: 0, stepsClimbed: 0, lives: 2,
      captureCount: 1, recoveryEndsAt: 1_500, lastMistake: false });
  });

  it("prioritizes an exactly tied stage deadline over a capture", () => {
    const state = withPursuitAt({ ...playing(), lives: 1, stageEndsAt: 1_000, score: 299 }, 0, 1);
    expect(applyInput(state, "forward", 1_000)).toMatchObject({ status: "game-over", endReason: "time-limit",
      lives: 1, score: 299, captureCount: 0, captureEndsAt: null, nextPursuerStepAt: null });
  });

  it("preserves an earlier fatal capture when a late callback is past the stage deadline", () => {
    const state = withPursuitAt({ ...playing(), lives: 1, stageEndsAt: 1_500 }, 0, 1);
    expect(tickGame(state, 2_000)).toMatchObject({ status: "game-over", endReason: "caught", lives: 0,
      captureCount: 1, captureEndsAt: null, recoveryEndsAt: null });
  });

  it("expires a bonus before a tied capture and preserves a still-active bonus on capture", () => {
    const expired = tickGame({ ...playing(), eventEndsAt: 4_000, eventSteps: 9 }, 4_000);
    expect(expired).toMatchObject({ lives: 2, captureCount: 1, captureEndsAt: 4_500,
      eventEndsAt: null, eventSteps: 0, score: 0, nextPursuerStepAt: 5_000 });
    const active = tickGame({ ...playing(), eventEndsAt: 6_000, eventSteps: 9 }, 4_000);
    expect(active).toMatchObject({ lives: 2, captureCount: 1, eventEndsAt: 6_000, eventSteps: 9 });
    expect(tickGame(active, 6_000)).toMatchObject({ lives: 2, captureCount: 1,
      eventEndsAt: null, eventSteps: 0, pursuerIndex: -2, pursuerDistance: 2 });
  });

  it("keeps an earlier nonfatal life loss when the stage later expires during recovery", () => {
    const state = withPursuitAt({ ...playing(), lives: 2, stageEndsAt: 1_200 }, 0, 1);
    expect(tickGame(state, 2_000)).toMatchObject({ endReason: "time-limit", lives: 1, captureCount: 1,
      captureEndsAt: null, recoveryEndsAt: null, nextPursuerStepAt: null });
  });

  it("retains a genuinely far pursuer and reaches a full ninety-second timeout", () => {
    const state = farAhead();
    expect(buildStairSceneModel(state)).toMatchObject({ pursuerVisible: false, pursuer: { index: -4 } });
    const after = tickGame(state, 90_000);
    expect(after).toMatchObject({ status: "game-over", endReason: "time-limit", captureCount: 0,
      pursuerIndex: 85, pursuerDistance: 15, lives: 3, score: 299 });
    expect(after.route.steps[0].index).toBe(85);
    expect(getRouteStep(after.route, 85).index).toBe(85);
    expect(state.route.steps[0].index).toBe(-4);
  });

  it("keeps the last adjacent motion endpoints while trimming old history", () => {
    const after = tickGame(farAhead(), 2_000);
    expect(after).toMatchObject({ pursuerIndex: -2, pursuerDistance: 102,
      lastPursuerMove: { fromIndex: -3, toIndex: -2, atMs: 2_000 } });
    expect(after.route.steps[0].index).toBe(-3);
    expect(buildStairSceneModel(after).pursuerMotion).toMatchObject({ atMs: 2_000 });
  });

  it.each(STAGE_RULES.slice(0, 4))("rearms stage $stage promotion from the promotion timestamp", (rule) => {
    const state = { ...playing(rule.stage), score: rule.targetScore - 1, lives: 1 };
    const after = applyInput(state, "forward", 100);
    const next = STAGE_RULES[rule.stage];
    expect(after).toMatchObject({ stage: next.stage, lives: 3, pursuerIndex: -3, pursuerDistance: 4,
      nextPursuerStepAt: 100 + next.pursuerStepIntervalMs, lastPursuerMove: null, captureEndsAt: null });
    const again = applyInput(after, "forward", 101);
    expect(again.nextPursuerStepAt).toBe(after.nextPursuerStepAt);
    expect(again.pursuerIndex).toBe(after.pursuerIndex);
  });

  it("stops pursuit on final clear and preserves the completed score", () => {
    const cleared = applyInput({ ...playing(5), score: 1_499 }, "forward", 100);
    expect(cleared).toMatchObject({ status: "game-over", endReason: "cleared", score: 1_500,
      nextPursuerStepAt: null, lastPursuerMove: null, captureEndsAt: null, pursuerDistance: 5 });
    expect(tickGame(cleared, 1_000_000)).toBe(cleared);
  });

  it("pauses all logical clocks once but lets cosmetic recovery expire", () => {
    const fallen = applyInput({ ...playing(), eventEndsAt: 30_000 }, "turn", 100);
    const after = resumeGameAfterPause(fallen, 200, 95_200);
    expect(after).toMatchObject({ stageEndsAt: 185_000, eventEndsAt: 125_000, nextPursuerStepAt: 96_000,
      pursuerIndex: -4, pursuerDistance: 4, lives: 3, lastMistake: false, recoveryEndsAt: null });
    expect(resumeGameAfterPause(after, 95_200, 95_200)).toBe(after);
    expect(tickGame(after, 95_999)).toBe(after);
    expect(tickGame(after, 96_000).pursuerIndex).toBe(-3);
  });

  it("reconciles before opening settings and cannot revive captured or expired games", () => {
    expect(resumeGameAfterPause(playing(), 12_000, 100_000)).toMatchObject({ endReason: "caught", lives: 0, nextPursuerStepAt: null });
    expect(resumeGameAfterPause({ ...playing(), stageEndsAt: 500 }, 500, 100_000)).toMatchObject({ endReason: "time-limit", stageEndsAt: 500 });
    expect(resumeGameAfterPause(createGameState(() => 0), 0, 100_000).nextPursuerStepAt).toBeNull();
  });

  it("is immutable and deterministic on replay", () => {
    const state = playing();
    const snapshot = structuredClone(state);
    Object.freeze(state);
    expect(tickGame(state, 5_500)).toEqual(tickGame(state, 5_500));
    expect(state).toEqual(snapshot);
  });

  it("rejects invalid clocks, cache mismatches, missing nodes and malformed motion", () => {
    const state = playing();
    for (const invalid of [
      { ...state, pursuerDistance: 5 }, { ...state, pursuerIndex: -5, pursuerDistance: 5 },
      { ...state, nextPursuerStepAt: null }, { ...state, nextPursuerStepAt: NaN },
      { ...state, stageEndsAt: null }, { ...state, captureCount: -1 },
      { ...state, lastPursuerMove: { fromIndex: -3, toIndex: -4, atMs: 0 } },
    ]) expect(() => tickGame(invalid, 0)).toThrow(RangeError);
    for (const time of [-1, NaN, Infinity]) expect(() => tickGame(state, time)).toThrow(RangeError);
    expect(() => withPursuitAt(state, 0, 5)).toThrow(RangeError);
    expect(() => withPursuitAt(state, NaN)).toThrow(RangeError);
    expect(() => withPursuitAt(state, 0, 0)).toThrow(RangeError);
  });
});
