import { describe, expect, it, vi } from "vitest";
import { advanceStairRoute, chooseRunLength, countStraightSteps, createStairRoute, getRouteRun, getRouteStep } from "./stairRoute";
import type { StairRoute, StairRunKind, StairRunLength } from "./types";

function freezeRoute(route: StairRoute): StairRoute {
  route.steps.forEach(Object.freeze);
  route.runs.forEach(Object.freeze);
  Object.freeze(route.steps);
  Object.freeze(route.runs);
  return Object.freeze(route);
}

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
}

describe("chooseRunLength", () => {
  it.each([
    [0, "long", null, 5], [0.5, "long", null, 7], [0.999, "long", null, 9],
    [0, "short", null, 1], [0.5, "short", null, 2], [0.999, "short", null, 3],
    [0, "short", 1, 2], [0.999, "short", 1, 3],
    [0, "short", 2, 1], [0.999, "short", 2, 3],
    [0, "short", 3, 1], [0.999, "short", 3, 2],
    [0, "long", 3, 5], [0.999, "long", 3, 9],
  ] as const)("selects unit %s kind %s previous %s as %s", (unit, kind, previous, expected) => {
    expect(chooseRunLength(unit, kind, previous)).toBe(expected);
  });

  it.each([-0.01, 1, NaN, Infinity])("rejects invalid unit %s", (unit) => {
    expect(() => chooseRunLength(unit, "long", null)).toThrow(RangeError);
    expect(() => createStairRoute(() => unit)).toThrow(RangeError);
  });

  it("rejects unsupported kinds and previous lengths", () => {
    expect(() => chooseRunLength(0.5, "invalid" as StairRunKind, null)).toThrow(RangeError);
    expect(() => chooseRunLength(0.5, "short", 4 as StairRunLength)).toThrow(RangeError);
  });

  it.each(["long", "short"] as const)("covers every %s candidate and excludes the immediate previous length", (kind) => {
    const candidates = kind === "long" ? [5, 6, 7, 8, 9] : [1, 2, 3];
    for (const previous of candidates) {
      const selected = new Set(Array.from({ length: 100 }, (_, index) => chooseRunLength(index / 100, kind, previous as StairRunLength)));
      expect([...selected]).toEqual(candidates.filter((length) => length !== previous));
    }
  });
});

describe("stair route", () => {
  it("starts with history and eighteen future nodes, with a right-facing long run at one", () => {
    const route = createStairRoute(() => 0);
    expect(route.steps).toHaveLength(23);
    expect(route.steps[0]).toEqual({ index: -4, column: -4, direction: "right" });
    expect(getRouteStep(route, 0)).toEqual({ index: 0, column: 0, direction: "right" });
    expect(route.steps.at(-1)?.index).toBe(18);
    expect(countStraightSteps(route, 0, "right")).toBe(5);
    expect(getRouteStep(route, 5).direction).toBe("right");
    expect(getRouteStep(route, 6).direction).toBe("left");
    expect(getRouteRun(route, -4)).toBeNull();
    expect(getRouteRun(route, 0)).toBeNull();
    expect(getRouteRun(route, 1)).toEqual({ startIndex: 1, length: 5, kind: "long", direction: "right" });
  });

  it("uses one seed and the specified draw schedule for the two mixed patterns", () => {
    const random = vi.fn(() => 0);
    const route = freezeRoute(createStairRoute(random));
    expect(route.runs).toEqual([
      { startIndex: 1, length: 5, kind: "long", direction: "right" },
      { startIndex: 6, length: 1, kind: "short", direction: "left" },
      { startIndex: 7, length: 9, kind: "long", direction: "right" },
      { startIndex: 16, length: 2, kind: "short", direction: "left" },
      { startIndex: 18, length: 3, kind: "short", direction: "right" },
    ]);
    let seed = 0;
    for (let draw = 0; draw < 6; draw += 1) seed = nextSeed(seed);
    expect(route.rngState).toBe(seed);
    expect(route).toMatchObject({ tailRunKind: "short", tailRunLength: 3, tailStepsRemaining: 2, tailShortRunsRemaining: 0 });
    expect(advanceStairRoute(route, 1).rngState).toBe(seed);
    expect(advanceStairRoute(route, 2).rngState).toBe(seed);
    const extended = advanceStairRoute(route, 3);
    expect(extended.runs.at(-1)).toEqual({ startIndex: 21, length: 6, kind: "long", direction: "left" });
    expect(extended.rngState).toBe(nextSeed(seed));
    expect(random).toHaveBeenCalledOnce();
  });

  it("keeps lookup, replay and refill immutable without consuming new global random", () => {
    const random = vi.fn(() => 0.5);
    const route = freezeRoute(createStairRoute(random));
    const saved = structuredClone(route);
    const future = getRouteStep(route, 1);
    const advanced = advanceStairRoute(route, 1);
    expect(route).toEqual(saved);
    expect(advanced).not.toBe(route);
    expect(advanced.steps).not.toBe(route.steps);
    expect(advanced.runs).not.toBe(route.runs);
    expect(getRouteStep(advanced, 1)).toBe(future);
    expect(advanced.steps.slice(0, -1)).toEqual(route.steps.slice(1));
    expect(advanceStairRoute(route, 1)).toEqual(advanced);
    expect(createStairRoute(() => 0.5)).toEqual(route);
    expect(random).toHaveBeenCalledOnce();
  });

  it.each([0, 0.5, 0.999])("keeps all lengths and both patterns connected through1000 steps with seed%s", (unit) => {
    let route = createStairRoute(() => unit);
    const seen = new Map(route.runs.map((run) => [run.startIndex, run]));
    for (let index = 1; index <= 1_000; index += 1) {
      const previous = getRouteStep(route, index - 1);
      const step = getRouteStep(route, index);
      expect(step.column - previous.column).toBe(step.direction === "right" ? 1 : -1);
      route = advanceStairRoute(route, index);
      expect(route.steps).toHaveLength(23);
      expect(route.steps[0].index).toBe(index - 4);
      expect(route.steps.at(-1)?.index).toBe(index + 18);
      for (const run of route.runs) seen.set(run.startIndex, run);
    }
    const runs = [...seen.values()];
    expect([...new Set(runs.map((run) => run.length))].sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 6, 7, 8, 9]);
    const shortCounts = new Set<number>();
    let shortCount = 0;
    for (let index = 1; index < runs.length; index += 1) {
      const previous = runs[index - 1];
      const run = runs[index];
      expect(run.startIndex).toBe(previous.startIndex + previous.length);
      expect(run.direction).not.toBe(previous.direction);
      expect(run.length).not.toBe(previous.length);
      if (run.kind === "short") shortCount += 1;
      else {
        expect([1, 2]).toContain(shortCount);
        shortCounts.add(shortCount);
        shortCount = 0;
      }
      expect(run.length >= 5 ? "long" : "short").toBe(run.kind);
    }
    expect([...shortCounts].sort()).toEqual([1, 2]);
  });

  it("retains requested old stairs and prunes only a permitted prefix", () => {
    let route = createStairRoute(() => 0);
    const origin = getRouteStep(route, -4);
    for (let index = 1; index <= 20; index += 1) route = advanceStairRoute(route, index, -4);
    expect(route.steps).toHaveLength(43);
    expect(getRouteStep(route, -4)).toBe(origin);
    expect(route.steps.at(-1)?.index).toBe(38);
    route = advanceStairRoute(route, 21, 5);
    expect(route.steps[0].index).toBe(5);
    expect(getRouteRun(route, 5)).toMatchObject({ startIndex: 1, length: 5 });
    expect(() => advanceStairRoute(route, 22, 0)).toThrow(RangeError);
    route = advanceStairRoute(route, 22);
    expect(route.steps).toHaveLength(23);
    expect(route.steps[0].index).toBe(18);
  });

  it("keeps original metadata when a run's prefix is pruned", () => {
    let route = createStairRoute(() => 0);
    const original = getRouteRun(route, 7);
    for (let index = 1; index <= 15; index += 1) route = advanceStairRoute(route, index);
    expect(route.steps[0].index).toBe(11);
    expect(getRouteRun(route, 11)).toBe(original);
    expect(original).toMatchObject({ startIndex: 7, length: 9 });
    expect(route.runs.every((run) => run.startIndex + run.length - 1 >= 11)).toBe(true);
  });

  it("counts a one-stair short turn as complete immediately after turning", () => {
    let route = createStairRoute(() => 0);
    for (let index = 1; index <= 5; index += 1) route = advanceStairRoute(route, index);
    expect(countStraightSteps(route, 5, "right")).toBe(0);
    expect(countStraightSteps(route, 5, "left")).toBe(1);
    route = advanceStairRoute(route, 6);
    expect(countStraightSteps(route, 6, "left")).toBe(0);
    expect(countStraightSteps(route, 6, "right")).toBe(9);
  });

  it("rejects missing nodes, invalid retention, malformed runs and inconsistent tail state", () => {
    const route = createStairRoute(() => 0);
    expect(() => getRouteStep(route, 999)).toThrow(RangeError);
    expect(() => getRouteRun(route, 999)).toThrow(RangeError);
    expect(() => getRouteStep(route, 0.5)).toThrow(RangeError);
    expect(() => advanceStairRoute(route, -1)).toThrow(RangeError);
    expect(() => advanceStairRoute(route, 0.5)).toThrow(RangeError);
    expect(() => advanceStairRoute(route, 1, -2)).toThrow(RangeError);
    expect(() => advanceStairRoute(route, 1, -4.5)).toThrow(RangeError);
    expect(() => advanceStairRoute(advanceStairRoute(route, 1), 0)).toThrow(RangeError);
    const invalid: StairRoute[] = [
      { ...route, steps: route.steps.filter((step) => step.index !== 1) },
      { ...route, runs: route.runs.slice(1) },
      { ...route, runs: [{ ...route.runs[0], kind: "short" }, ...route.runs.slice(1)] },
      { ...route, runs: [route.runs[0], { ...route.runs[1], startIndex: 7 }, ...route.runs.slice(2)] },
      { ...route, tailStepsRemaining: 7 }, { ...route, tailStepsRemaining: 0 },
      { ...route, tailShortRunsRemaining: 1 }, { ...route, rngState: NaN },
    ];
    for (const broken of invalid) expect(() => getRouteStep(broken, 0)).toThrow(RangeError);
    expect(() => countStraightSteps({ ...route, steps: route.steps.slice(0, -1), tailStepsRemaining: 3 }, 0, "right")).toThrow(RangeError);
  });
});
