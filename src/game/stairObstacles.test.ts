import { describe, expect, it, vi } from "vitest";
import { chooseObstacleIndex, createObstacleState, hasObstacle, revealObstacles } from "./stairObstacles";
import { advanceStairRoute, createStairRoute, getRouteRun, getRouteStep } from "./stairRoute";
import { STAGE_RULES } from "./stageRules";
import type { GameStage, StairObstacleState, StairRoute, StairRouteRun, StairRunLength } from "./types";

function longRun(length: StairRunLength = 5): StairRouteRun {
  return { startIndex: 10, length, kind: "long", direction: "left" };
}

function freezeState(state: StairObstacleState): StairObstacleState {
  state.runs.forEach(Object.freeze);
  Object.freeze(state.runs);
  return Object.freeze(state);
}

function freezeRoute(route: StairRoute): StairRoute {
  route.steps.forEach(Object.freeze);
  route.runs.forEach(Object.freeze);
  Object.freeze(route.steps);
  Object.freeze(route.runs);
  return Object.freeze(route);
}

function drawSeed(seed: number, count: number): number {
  for (let index = 0; index < count; index += 1) seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
  return seed;
}

describe("obstacle placement", () => {
  it.each(STAGE_RULES)("uses the exact probability boundary in stage $stage", (rule) => {
    expect(chooseObstacleIndex(longRun(), rule.stage, rule.obstacleProbability - Number.EPSILON, 0)).toBe(11);
    expect(chooseObstacleIndex(longRun(), rule.stage, rule.obstacleProbability, 0)).toBeNull();
    expect(chooseObstacleIndex(longRun(), rule.stage, 0.15, 0)).toBe(rule.stage === 1 ? null : 11);
  });

  it.each([5, 6, 7, 8, 9] as const)("uses only interior nodes of a long run of length %s", (length) => {
    expect(chooseObstacleIndex(longRun(length), 5, 0, 0)).toBe(11);
    expect(chooseObstacleIndex(longRun(length), 5, 0, 0.999)).toBe(10 + length - 2);
    for (let unit = 0; unit < 100; unit += 1) {
      const index = chooseObstacleIndex(longRun(length), 5, 0, unit / 100)!;
      expect(index).toBeGreaterThan(10);
      expect(index).toBeLessThan(10 + length - 1);
    }
  });

  it.each([1, 2, 3] as const)("always leaves short run length %s empty", (length) => {
    const run: StairRouteRun = { startIndex: 10, length, kind: "short", direction: "right" };
    for (const rule of STAGE_RULES) expect(chooseObstacleIndex(run, rule.stage, 0, 0.5)).toBeNull();
  });

  it.each([-0.01, 1, NaN, Infinity])("validates both units even for short runs: %s", (unit) => {
    const short: StairRouteRun = { ...longRun(1), kind: "short" };
    expect(() => chooseObstacleIndex(longRun(), 1, unit, 0)).toThrow(RangeError);
    expect(() => chooseObstacleIndex(short, 1, 0, unit)).toThrow(RangeError);
  });

  it("rejects invalid run metadata and stages", () => {
    for (const invalid of [
      { ...longRun(), startIndex: 0 }, { ...longRun(), startIndex: 1.5 },
      { ...longRun(), length: 4 }, { ...longRun(), kind: "short" },
      { ...longRun(), direction: "up" },
    ]) expect(() => chooseObstacleIndex(invalid as StairRouteRun, 1, 0, 0)).toThrow(RangeError);
    expect(() => chooseObstacleIndex(longRun(), 6 as GameStage, 0, 0)).toThrow(RangeError);
  });
});

describe("stable obstacle decisions", () => {
  it("starts at real run one and consumes two independent draws even for short/empty runs", () => {
    const route = createStairRoute(() => 0);
    const state = revealObstacles({ rngState: 0, runs: [] }, route, 0, 1);
    expect(state.rngState).toBe(drawSeed(0, 4));
    expect(state.runs).toEqual([
      { runStartIndex: 1, runLength: 5, kind: "long", direction: "right", stageAtGeneration: 1, obstacleIndex: null },
      { runStartIndex: 6, runLength: 1, kind: "short", direction: "left", stageAtGeneration: 1, obstacleIndex: null },
    ]);
    const created = createObstacleState(route, 1);
    expect(created.rngState).toBe(drawSeed((route.rngState ^ 0xa5a5a5a5) >>> 0, 4));
    expect(created.runs.every((record) => record.runStartIndex > 0)).toBe(true);
    expect(hasObstacle(created, -4)).toBe(false);
    expect(hasObstacle(created, 0)).toBe(false);
  });

  it("preserves empty and occupied decisions after repeated reveal, stage changes and replay", () => {
    const route = freezeRoute(createStairRoute(() => 0));
    const generated = createObstacleState(route, 1);
    const state = freezeState({ ...generated, runs: generated.runs.map((run) => run.kind === "long" ? { ...run, obstacleIndex: 2 } : run) });
    const snapshot = structuredClone(state);
    const random = vi.spyOn(Math, "random");
    try {
      expect(revealObstacles(state, route, 0, 5)).toBe(state);
      expect(revealObstacles(state, route, 0, 1)).toBe(state);
      expect(hasObstacle(state, 2)).toBe(true);
      const advanced = freezeRoute(advanceStairRoute(route, 1));
      const after = revealObstacles(state, advanced, 1, 3);
      expect(after.runs.slice(0, 2)).toEqual(state.runs);
      expect(after.runs[0]).toBe(state.runs[0]);
      expect(after.runs.at(-1)).toMatchObject({ runStartIndex: 7, stageAtGeneration: 3, kind: "long" });
      expect(after.rngState).toBe(drawSeed(state.rngState, 2));
      expect(revealObstacles(state, advanced, 1, 3)).toEqual(after);
      expect(state).toEqual(snapshot);
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

  it("keeps the original run boundary when its first nodes are pruned", () => {
    let route = createStairRoute(() => 0);
    let state = createObstacleState(route, 1);
    let original: StairObstacleState["runs"][number] | undefined;
    for (let index = 1; index <= 12; index += 1) {
      route = advanceStairRoute(route, index);
      state = revealObstacles(state, route, index, 1);
      if (index === 1) original = state.runs.find((record) => record.runStartIndex === 7);
    }
    expect(route.steps[0].index).toBe(8);
    expect(state.runs.find((record) => record.runStartIndex === 7)).toBe(original);
    expect(original).toMatchObject({ runStartIndex: 7, runLength: 9 });
  });

  it("fills undecided runs in order while preserving existing decision objects", () => {
    const route = createStairRoute(() => 0);
    const initial = createObstacleState(route, 1);
    const short = initial.runs[1];
    const partial = freezeState({ ...initial, runs: [short] });
    const filled = revealObstacles(partial, route, 0, 5);
    expect(filled.runs.map((record) => record.runStartIndex)).toEqual([1, 6]);
    expect(filled.runs[0].stageAtGeneration).toBe(5);
    expect(filled.runs[1]).toBe(short);
    expect(revealObstacles(filled, route, 0, 5)).toBe(filled);
  });

  it.each([0, 0.5, 0.999])("keeps safe decisions bounded with retained NPC history from seed%s", (seed) => {
    let route = createStairRoute(() => seed);
    let state = createObstacleState(route, 1);
    for (let player = 1; player <= 250; player += 1) {
      route = advanceStairRoute(route, player, -4);
      const stage = (Math.floor(player / 50) % 5 + 1) as GameStage;
      const before = new Map(state.runs.map((record) => [record.runStartIndex, record]));
      state = revealObstacles(state, route, player, stage);
      expect(state.runs.length).toBeLessThanOrEqual(12);
      expect(route.steps[0].index).toBe(-4);
      for (const run of route.runs.filter((run) => run.startIndex <= player + 6 && run.startIndex + run.length - 1 >= player - 4)) {
        const record = state.runs.find((record) => record.runStartIndex === run.startIndex)!;
        expect(record).toBeDefined();
        if (before.has(run.startIndex)) expect(record).toBe(before.get(run.startIndex));
        else expect(record.stageAtGeneration).toBe(stage);
      }
      for (const record of state.runs) {
        if (record.kind === "short") expect(record.obstacleIndex).toBeNull();
        if (record.obstacleIndex === null) continue;
        const index = record.obstacleIndex;
        expect(getRouteRun(route, index)).toMatchObject({ startIndex: record.runStartIndex, kind: "long" });
        expect(getRouteStep(route, index - 1).direction).toBe(record.direction);
        expect(getRouteStep(route, index + 1).direction).toBe(record.direction);
        expect(hasObstacle(state, index)).toBe(true);
        expect(hasObstacle(state, index + 1)).toBe(false);
      }
    }
    expect(route.steps.length).toBeGreaterThan(250);
  });

  it("reproduces a complete route/obstacle traversal from its seed", () => {
    const traverse = () => {
      let route = createStairRoute(() => 0.75);
      let state = createObstacleState(route, 1);
      for (let player = 1; player <= 150; player += 1) {
        route = advanceStairRoute(route, player);
        state = revealObstacles(state, route, player, 5);
      }
      return { route, state };
    };
    expect(traverse()).toEqual(traverse());
  });

  it("rejects invalid states, duplicate records, wrong route metadata and bad indices", () => {
    const route = createStairRoute(() => 0);
    const state = createObstacleState(route, 1);
    const first = state.runs[0];
    const invalid: StairObstacleState[] = [
      { ...state, rngState: -1 }, { ...state, rngState: 4_294_967_296 },
      { ...state, rngState: NaN }, { ...state, runs: [first, first] },
      { ...state, runs: [{ ...first, obstacleIndex: 1 }] },
      { ...state, runs: [{ ...first, obstacleIndex: 5 }] },
      { ...state, runs: [{ ...first, runLength: 6 }] },
      { ...state, runs: [{ ...first, direction: "left" }] },
      { ...state, runs: [{ ...state.runs[1], obstacleIndex: 6 }] },
    ];
    for (const broken of invalid) expect(() => revealObstacles(broken, route, 0, 1)).toThrow(RangeError);
    expect(() => revealObstacles(state, route, -1, 1)).toThrow(RangeError);
    expect(() => revealObstacles(state, route, 0.5, 1)).toThrow(RangeError);
    expect(() => revealObstacles(state, route, 0, 6 as GameStage)).toThrow(RangeError);
    for (const index of [0.5, NaN, Infinity]) expect(() => hasObstacle(state, index)).toThrow(RangeError);
    expect(() => revealObstacles(state, { ...route, steps: route.steps.slice(0, -1) }, 0, 1)).toThrow(RangeError);
  });
});
