import { afterEach, describe, expect, it, vi } from "vitest";
import { applyInput, continueGame, createGameState, getStageSecondsLeft, quitAtCheckpoint, resetGame, resumeGameAfterPause, startGame, tickGame } from "./gameEngine";
import { captureStageResult, formatRemainingTimeCs, isStageResult } from "./stageResult";
import { getStageRule, STAGE_RULES } from "./stageRules";
import { getRouteStep } from "./stairRoute";
import { hasObstacle } from "./stairObstacles";
import { withPursuitAt } from "../test/gameFixtures";
import { withObstacle } from "../test/obstacleFixtures";
import { applyDescentInput, createDescentState, startDescent, tickDescent } from "../descent/descentEngine";
import { createDescentViewState } from "../descent/descentViewState";
import type { GameStage, GameState, StageResult } from "./types";

afterEach(() => vi.restoreAllMocks());

const result = (): StageResult => ({ stage: 1, score: 150, remainingTimeCs: 7765, endedAtMs: 12345, outcome: "cleared" });
const clockState = () => ({ stage: 1 as const, score: 150, stageEndsAt: 90_000 });
function playing(stage: GameStage = 1): GameState {
  return startGame(createGameState(() => 0, { stage, highestClearedStage: stage }), 0);
}
function nextInput(state: GameState) {
  return hasObstacle(state.obstacles, state.stepsClimbed + 1) ? "jump" as const
    : getRouteStep(state.route, state.stepsClimbed + 1).direction === state.direction ? "forward" as const : "turn" as const;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe("stage result helpers", () => {
  it.each([[12345,7765],[12349,7765],[12350,7765],[12351,7764],[89980,2],[89990,1],[89999,0],[90000,0],[90001,0]])(
    "floors remaining milliseconds at%s to%s centiseconds", (endedAtMs, remainingTimeCs) => {
      const source = freeze(clockState());
      expect(captureStageResult(source, "cleared", endedAtMs)).toEqual({ ...result(), endedAtMs, remainingTimeCs });
      expect(source.stageEndsAt).toBe(90000);
    },
  );

  it.each([[0,"0.00초"],[1,"0.01초"],[9,"0.09초"],[10,"0.10초"],[99,"0.99초"],[100,"1.00초"],
    [1234,"12.34초"],[7765,"77.65초"],[9000,"90.00초"],[Number.MAX_SAFE_INTEGER,"90071992547409.91초"]] as const)(
    "formats%s as%s without hidden precision", (value, expected) => expect(formatRemainingTimeCs(value)).toBe(expected),
  );

  it.each([-1,NaN,Infinity,-Infinity,0.01,1.5,Number.MAX_SAFE_INTEGER+1,undefined,null,"1",{},true])(
    "rejects invalid display time%j", value => expect(() => formatRemainingTimeCs(value as number)).toThrow(RangeError),
  );

  it.each(STAGE_RULES)("accepts the exact stage$stage time limit and rejects the next centisecond", rule => {
    expect(isStageResult({ ...result(), stage: rule.stage, remainingTimeCs: rule.durationMs / 10 })).toBe(true);
    expect(isStageResult({ ...result(), stage: rule.stage, remainingTimeCs: rule.durationMs / 10 + 1 })).toBe(false);
    expect(captureStageResult({ stage: rule.stage, score: rule.scoreRequired, stageEndsAt: rule.durationMs }, "cleared", 0))
      .toMatchObject({ stage: rule.stage, remainingTimeCs: rule.durationMs / 10 });
  });

  it.each(STAGE_RULES)("accepts scores at or below the stage$stage target only", rule => {
    const remainingTimeCs = Math.min(result().remainingTimeCs, rule.durationMs / 10);
    expect(isStageResult({ ...result(), stage: rule.stage, score: rule.scoreRequired, remainingTimeCs, outcome: "cleared" })).toBe(true);
    expect(isStageResult({ ...result(), stage: rule.stage, score: rule.scoreRequired + 1, remainingTimeCs, outcome: "cleared" })).toBe(false);
  });

  it.each([null,undefined,false,[],{}])("rejects a non-result%j", value => {
    expect(isStageResult(value)).toBe(false);
  });

  it.each([
    { stage: 0 },{ stage: 6 },{ stage: "1" },{ stage: 1.5 },
    { score: -1 },{ score: NaN },{ score: Infinity },{ score: 1.5 },{ score: "150" },{ score: undefined },
    { remainingTimeCs: -1 },{ remainingTimeCs: 9001 },{ remainingTimeCs: NaN },{ remainingTimeCs: Infinity },
    { remainingTimeCs: 1.5 },{ remainingTimeCs: "1" },{ remainingTimeCs: null },{ remainingTimeCs: undefined },
    { endedAtMs: -1 },{ endedAtMs: NaN },{ endedAtMs: Infinity },{ endedAtMs: "1" },{ endedAtMs: undefined },
    { outcome: "quit" },{ outcome: "time-limit" },{ outcome: "playing" },{ outcome: null },{ outcome: undefined }])(
    "rejects malformed result%j", patch => expect(isStageResult({ ...result(), ...patch })).toBe(false),
  );

  it("accepts all result outcomes including zero-time capture and timeout", () => {
    expect(isStageResult(result())).toBe(true);
    expect(isStageResult({ ...result(), outcome: "caught" })).toBe(true);
    expect(isStageResult({ ...result(), outcome: "time-limit", remainingTimeCs: 0 })).toBe(true);
    expect(captureStageResult(clockState(), "time-limit", 90000)).toMatchObject({ remainingTimeCs: 0, endedAtMs: 90000 });
    expect(captureStageResult(clockState(), "caught", 90001).remainingTimeCs).toBe(0);
  });

  it.each([-1,NaN,Infinity,-Infinity,"1",undefined,null])("rejects invalid end time%j", at => {
    expect(() => captureStageResult(clockState(), "cleared", at as number)).toThrow(RangeError);
  });

  it.each([null,undefined,{ stage: 0 },{ score: -1 },{ score: 1.5 },{ stageEndsAt: null },{ stageEndsAt: undefined },
    { stageEndsAt: NaN },{ stageEndsAt: Infinity },{ stageEndsAt: -1 },{ stageEndsAt: "90000" },{ stageEndsAt: 90010 }])(
    "rejects invalid capture source%j", patch => {
      const source = patch === null || patch === undefined ? patch : { ...clockState(), ...patch };
      expect(() => captureStageResult(source as Parameters<typeof captureStageResult>[0], "cleared", 0)).toThrow(RangeError);
    },
  );

  it.each(["quit",undefined,null,0,"playing"])("rejects invalid outcome%j", outcome => {
    expect(() => captureStageResult(clockState(), outcome as StageResult["outcome"], 12345)).toThrow(RangeError);
  });
});

describe("actual stage result boundaries", () => {
  it("starts and resets with a null snapshot and creates no result for ordinary moves", () => {
    const ready = createGameState(() => 0), active = startGame(ready, 100);
    expect(ready.stageResult).toBeNull();
    expect(active.stageResult).toBeNull();
    expect(applyInput(active, "forward", 110).stageResult).toBeNull();
    expect(applyInput(active, "turn", 110).stageResult).toBeNull();
    expect(resetGame(() => 0)).toEqual(ready);
  });
  it.each(STAGE_RULES)("captures the new score before clearing the stage$stage deadline", rule => {
    const before = freeze(withPursuitAt({ ...playing(rule.stage), score: rule.scoreRequired - 1 }, 12344));
    const snapshot = structuredClone(before);
    const after = applyInput(before, "forward", 12345);
    expect(after.stageResult).toEqual({ stage: rule.stage, score: rule.scoreRequired,
      remainingTimeCs: Math.floor((rule.durationMs - 12345) / 10), endedAtMs: 12345, outcome: "cleared" });
    expect(after.stageEndsAt).toBeNull();
    expect(after.status).toBe(rule.stage === 5 ? "game-over" : "checkpoint");
    expect(getStageSecondsLeft(after, 12345)).toBe(0);
    expect(tickGame(after, 1e6).stageResult).toBe(after.stageResult);
    expect(before).toEqual(snapshot);
  });

  it("caps bonus-jump gain at the exact clear target", () => {
    const before = freeze(withObstacle({ ...applyInput(playing(), "forward", 0), score: 149, eventEndsAt: 30000 }, 2));
    const after = applyInput(before, "jump", 100);
    expect(after.stageResult).toEqual({ stage: 1, score: 150, remainingTimeCs: 8990, endedAtMs: 100, outcome: "cleared" });
    expect(after.lastMove).toMatchObject({ fromIndex: 1, toIndex: 3, scoreGain: 1 });
    expect(after.score).toBe(150);
  });

  it("uses the actual contact deadline even when the callback arrives much later", () => {
    const initial = freeze(playing()), after = tickGame(initial, 100000);
    const contact = 4 * getStageRule(1).pursuerStepIntervalMs;
    expect(after.stageResult).toEqual({ stage: 1, score: 0, remainingTimeCs: (90000 - contact) / 10, endedAtMs: contact, outcome: "caught" });
    expect(after.captureEndsAt).toBeNull();
    let incremental = initial;
    for (const now of [499,500,1000,1500,2000,2499,2500,100000]) incremental = tickGame(incremental, now);
    expect(after).toEqual(incremental);
    expect(initial.stageResult).toBeNull();
  });

  it.each([[1,250],[2,500]] as const)("captures falling gap%s at the fast deadline%s", (gap, at) => {
    const initial = withPursuitAt(playing(), 0, gap);
    const fallen = applyInput(initial, "turn", 0);
    const caught = applyInput(fallen, "forward", at);
    expect(caught.stageResult).toEqual({ stage: 1, score: 0, remainingTimeCs: (90000 - at) / 10, endedAtMs: at, outcome: "caught" });
    expect(tickGame(caught, at + 500).stageResult).toBe(caught.stageResult);
    const tied = applyInput({ ...initial, stageEndsAt: at }, "turn", 0);
    expect(applyInput(tied, "forward", at).stageResult).toEqual({ stage: 1, score: 0, remainingTimeCs: 0, endedAtMs: at, outcome: "time-limit" });
  });

  it("keeps catch-up transient until gap6 and records the later base-speed contact", () => {
    let state = playing();
    while (state.pursuerDistance < 15) state = applyInput(state, nextInput(state), 0);
    expect(state.stageResult).toBeNull();
    const exited = tickGame(state, 900);
    const baseInterval = getStageRule(1).pursuerStepIntervalMs;
    expect(exited).toMatchObject({ isPursuerCatchingUp: false, pursuerDistance: 6, stageResult: null, nextPursuerStepAt: 900 + baseInterval });
    const after = tickGame(exited, 100000);
    const contact = 900 + 6 * baseInterval;
    expect(after.stageResult).toEqual({ stage: 1, score: state.score, remainingTimeCs: (90000 - contact) / 10, endedAtMs: contact, outcome: "caught" });
    expect(tickGame(state, 100000)).toEqual(after);
  });

  it("preserves stage expiry over a tied catch or successful final input", () => {
    const deadline = getStageRule(1).pursuerStepIntervalMs;
    const before = withPursuitAt({ ...playing(), score: 149, stageEndsAt: deadline }, 0, 1);
    const after = applyInput(before, "forward", deadline);
    expect(after.stageResult).toEqual({ stage: 1, score: 149, remainingTimeCs: 0, endedAtMs: deadline, outcome: "time-limit" });
    expect(after.captureCount).toBe(0);
    expect(after.clearedStageThisRun).toBe(0);
  });

  it("preserves the clear snapshot through checkpoint wait and Quit, then resets it on Continue", () => {
    const clear = applyInput({ ...playing(), score: 149 }, "forward", 100);
    const snapshot = clear.stageResult;
    expect(tickGame(clear, 95100)).toBe(clear);
    expect(applyInput(clear, "forward", 95100)).toBe(clear);
    expect(resumeGameAfterPause(clear, 100, 95100)).toBe(clear);
    const quit = quitAtCheckpoint(clear, 95100);
    expect(quit.stageResult).toBe(snapshot);
    expect(quit).toMatchObject({ endReason: "quit", stageResult: { outcome: "cleared", remainingTimeCs: 8990 } });
    expect(tickGame(quit, 1e6).stageResult).toBe(snapshot);
    const continued = continueGame(clear, 95100);
    expect(continued).toMatchObject({ stage: 2, score: 0, stageResult: null, stageEndsAt: 170100 });
    const contact = 95100 + 4 * getStageRule(2).pursuerStepIntervalMs;
    expect(tickGame(continued, 200000).stageResult).toEqual({ stage: 2, score: 0, remainingTimeCs: (170100 - contact) / 10, endedAtMs: contact, outcome: "caught" });
    expect(resetGame(() => 0).stageResult).toBeNull();
  });

  it("uses pause-shifted deadlines without counting the settings wait against the result", () => {
    const paused = resumeGameAfterPause(playing(), 100, 95100);
    expect(paused.stageResult).toBeNull();
    const caught = tickGame(paused, 200000);
    const activeContact = 4 * getStageRule(1).pursuerStepIntervalMs;
    expect(caught.stageResult).toEqual({ stage: 1, score: 0, remainingTimeCs: (90000 - activeContact) / 10, endedAtMs: 95000 + activeContact, outcome: "caught" });
    expect(resumeGameAfterPause(caught, 200000, 300000).stageResult).toBe(caught.stageResult);
  });

  it("retains the shared clear snapshot in the single-stage adapter without storage access", () => {
    const before = freeze({ ...startDescent(createDescentState(() => 0), 0), score: 149 });
    const local = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw Error("blocked"); });
    const session = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw Error("blocked"); });
    const random = vi.spyOn(Math, "random");
    const core = applyInput(before, "forward", 100), after = applyDescentInput(before, "forward", 100);
    expect(after.stageResult).toEqual(core.stageResult);
    expect(after.stageResult).toMatchObject({ stage: 1, score: 150, endedAtMs: 100, remainingTimeCs: 8990, outcome: "cleared" });
    expect(after).toMatchObject({ status: "game-over", endReason: "cleared", checkpointEnteredAt: null });
    expect(tickDescent(after, 1e6).stageResult).toBe(after.stageResult);
    expect(local).not.toHaveBeenCalled(); expect(session).not.toHaveBeenCalled(); expect(random).not.toHaveBeenCalled();
  });

  it("rejects snapshots on active/ready states and mismatched or missing terminal snapshots", () => {
    const clear = applyInput({ ...playing(), score: 149 }, "forward", 100);
    const caught = tickGame(playing(), 2400);
    for (const state of [
      { ...createGameState(() => 0), stageResult: result() }, { ...playing(), stageResult: result() },
      { ...clear, stageResult: null }, { ...clear, stageResult: undefined },
      { ...clear, stageResult: { ...clear.stageResult!, stage: 2 } },
      { ...clear, stageResult: { ...clear.stageResult!, score: 151 } },
      { ...clear, stageResult: { ...clear.stageResult!, outcome: "caught" } },
      { ...caught, stageResult: { ...caught.stageResult!, outcome: "cleared" } },
    ]) expect(() => tickGame(state as GameState, 100000)).toThrow(RangeError);
    expect(() => createDescentViewState({ ...createDescentState(() => 0), stageResult: result() }, 0)).toThrow(RangeError);
    expect(createDescentViewState(createDescentState(() => 0), 0).game.stageResult).toBeNull();
  });
});
