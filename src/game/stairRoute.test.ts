import { describe, expect, it, vi } from "vitest";
import {
  advanceStairRoute,
  chooseRunLength,
  countStraightSteps,
  createStairRoute,
  getRouteStep,
} from "./stairRoute";
import type { Direction, StairRoute, StairRunLength } from "./types";

function freezeRoute(route: StairRoute): StairRoute {
  route.steps.forEach(Object.freeze);
  Object.freeze(route.steps);
  return Object.freeze(route);
}

describe("chooseRunLength", () => {
  it.each([
    [0, null, 4], [0.5, null, 5], [0.999, null, 6],
    [0, 4, 5], [0.999, 4, 6],
    [0, 5, 4], [0.999, 5, 6],
    [0, 6, 4], [0.999, 6, 5],
  ] as const)("selects %s with previous %s as %s", (unit, previous, expected) => {
    expect(chooseRunLength(unit, previous)).toBe(expected);
  });

  it.each([-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid unit %s", (unit) => {
    expect(() => chooseRunLength(unit, null)).toThrow(RangeError);
    expect(() => createStairRoute(() => unit)).toThrow(RangeError);
  });

  it("rejects an unsupported previous length", () => {
    expect(() => chooseRunLength(0.5, 3 as StairRunLength)).toThrow(RangeError);
  });
});

describe("stair route", () => {
  it("starts with four connected stairs behind the player and eighteen ahead", () => {
    const route = createStairRoute(() => 0);

    expect(route.steps).toHaveLength(23);
    expect(route.steps[0]).toEqual({ index: -4, column: -4, direction: "right" });
    expect(getRouteStep(route, 0)).toEqual({ index: 0, column: 0, direction: "right" });
    expect(route.steps.at(-1)?.index).toBe(18);
    expect(countStraightSteps(route, 0, "right")).toBe(4);
    expect(getRouteStep(route, 4).direction).toBe("right");
    expect(getRouteStep(route, 5).direction).toBe("left");
  });

  it("samples randomness once and keeps the generated preview stable during lookup and refill", () => {
    const random = vi.fn(() => 0.5);
    const route = freezeRoute(createStairRoute(random));
    const saved = structuredClone(route);
    const future = getRouteStep(route, 1);
    const advanced = advanceStairRoute(route, 1);

    expect(route).toEqual(saved);
    expect(advanced).not.toBe(route);
    expect(advanced.steps).not.toBe(route.steps);
    expect(getRouteStep(advanced, 1)).toBe(future);
    expect(advanced.steps.slice(0, -1)).toEqual(route.steps.slice(1));
    expect(advanceStairRoute(route, 1)).toEqual(advanced);
    expect(createStairRoute(() => 0.5)).toEqual(route);
    expect(random).toHaveBeenCalledOnce();
  });

  it.each([0, 0.5, 0.999])(
    "keeps connected non-repeating runs and bounded history through 1000 climbs from seed %s",
    (unit) => {
      let route = createStairRoute(() => unit);
      let direction: Direction = "right";
      let length = 0;
      let previousLength: number | null = null;
      let completedRuns = 0;

      for (let index = 1; index <= 1_000; index += 1) {
        const previousStep = getRouteStep(route, index - 1);
        const step = getRouteStep(route, index);
        expect(step.column - previousStep.column).toBe(step.direction === "right" ? 1 : -1);

        if (step.direction !== direction) {
          expect([4, 5, 6]).toContain(length);
          expect(length).not.toBe(previousLength);
          previousLength = length;
          completedRuns += 1;
          direction = step.direction;
          length = 0;
        }
        length += 1;

        route = advanceStairRoute(route, index);
        expect(route.steps).toHaveLength(23);
        expect(route.steps[0].index).toBe(index - 4);
        expect(route.steps.at(-1)?.index).toBe(index + 18);
      }
      expect(completedRuns).toBeGreaterThan(150);
    },
  );

  it("counts zero at a real corner and subtracts the first turning stair from the new run", () => {
    let route = createStairRoute(() => 0);
    for (let index = 1; index <= 4; index += 1) route = advanceStairRoute(route, index);

    expect(countStraightSteps(route, 4, "right")).toBe(0);
    const newRunLength = countStraightSteps(route, 4, "left");
    expect([5, 6]).toContain(newRunLength);
    route = advanceStairRoute(route, 5);
    expect(countStraightSteps(route, 5, "left")).toBe(newRunLength - 1);
  });

  it("rejects missing nodes, discontinuous routes, and incomplete previews", () => {
    const route = createStairRoute(() => 0);
    expect(() => getRouteStep(route, 999)).toThrow(RangeError);
    expect(() => getRouteStep(route, 0.5)).toThrow(RangeError);
    expect(() => advanceStairRoute(route, -1)).toThrow(RangeError);
    expect(() => advanceStairRoute(route, 0.5)).toThrow(RangeError);
    expect(() => advanceStairRoute(advanceStairRoute(route, 1), 0)).toThrow(RangeError);

    const broken = { ...route, steps: route.steps.filter((step) => step.index !== 1) };
    expect(() => getRouteStep(broken, 0)).toThrow(RangeError);
    expect(() => countStraightSteps({ ...route, steps: route.steps.slice(0, -1) }, 0, "right"))
      .toThrow(RangeError);
    expect(() => getRouteStep({ ...route, tailStepsRemaining: 7 }, 0)).toThrow(RangeError);
  });
});
