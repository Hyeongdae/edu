import * as stairObstacles from "./stairObstacles";
import { makeObstacleFixture, withObstacle } from "../test/obstacleFixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyInput, createGameState, startGame, tickGame } from "./gameEngine";
import { withPursuitAt } from "../test/gameFixtures";
import { buildStairSceneModel, projectRouteStep } from "./stairSceneModel";
import { advanceStairRoute, countStraightSteps, getRouteRun, getRouteStep } from "./stairRoute";
import type { GameState } from "./types";

function climb(state: GameState): GameState {
  const next = getRouteStep(state.route, state.stepsClimbed + 1);
  return applyInput(state, next.direction === state.direction ? "forward" : "turn", 1_000);
}

describe("stair scene projection", () => {
  it("projects the initial history and six future stairs around the centered player", () => {
    const state = createGameState(() => 0.999);
    const scene = buildStairSceneModel(state);
    expect(scene.player).toEqual({ index: 0, direction: "right", x: 260, y: 216 });
    expect(scene.pursuer).toEqual({ index: -4, direction: "right", x: 124, y: 328 });
    expect(scene.steps.map((step) => step.index)).toEqual([-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]);
    expect(scene.steps[10]).toMatchObject({ x: 464, y: 48 });
  });

  it("uses each actor's own route direction on opposite sides of a corner", () => {
    let state = startGame(createGameState(() => 0), 0);
    for (let index = 0; index < 6; index += 1) state = climb(state);
    state = withPursuitAt(state, 1_000);
    let scene = buildStairSceneModel(state);
    expect(scene.player.direction).toBe("left");
    expect(scene.pursuer).toMatchObject({ index: 2, direction: "right" });
    const previousPlayerIndex = scene.player.index;
    const previousPursuerIndex = scene.pursuer.index;
    state = climb(state);
    scene = buildStairSceneModel(state);
    expect(scene.player.index).toBe(previousPlayerIndex + 1);
    expect(scene.pursuer.index).toBe(previousPursuerIndex);
    expect(scene.player.index - scene.pursuer.index).toBe(5);

    state = applyInput(state, "turn", 1_001);
    scene = buildStairSceneModel(state);
    expect(scene.player.index).toBe(7);
    expect(scene.pursuer.index).toBe(2);
    expect(scene.player.index - scene.pursuer.index).toBe(5);
    expect(state.score).toBe(7);
    // Fast fall steps reach this corner sooner; inspect the actual adjacent move before the first catch.
    state = tickGame(state, 3_101);
    expect(state.status).toBe("playing");
    scene = buildStairSceneModel(state);
    expect(scene.player).toMatchObject({ index: 7, direction: "right" });
    expect(scene.pursuer).toMatchObject({ index: 6, direction: "left" });
  });

  it("follows the real corner in catch and return frames", () => {
    let state = startGame(createGameState(() => 0), 0);
    for (let index = 0; index < 6; index += 1) state = climb(state);
    state = tickGame(withPursuitAt(state, 1_000, 1), 2_000);
    const scene = buildStairSceneModel(state);
    expect(scene.catchFrames.map((frame) => frame.index)).toEqual([5, 6, 6, 5, 4, 3, 5]);
    expect(scene.catchFrames.map((frame) => frame.offset)).toEqual([0, 0.2, 0.4, 0.55, 0.7, 0.85, 1]);
    for (const frame of scene.catchFrames) {
      expect(frame).toMatchObject(projectRouteStep(
        getRouteStep(state.route, frame.index), getRouteStep(state.route, state.stepsClimbed),
      ));
    }
    expect(scene.catchFrames[0].x).toBeGreaterThan(scene.catchFrames[3 + 1].x);
    expect(scene.catchFrames[6]).toMatchObject({ x: scene.pursuer.x, y: scene.pursuer.y });
  });

  it.each([0, 0.5, 0.999])("keeps both directions and all run lengths inside the view for seed %s", (seed) => {
    let state = startGame(createGameState(() => seed), 0);
    const lengths = new Set<number>();
    const directions = new Set<string>();
    for (let index = 0; index < 1_000; index += 1) {
      const scene = buildStairSceneModel(state);
      expect(scene.steps).toHaveLength(11);
      expect(scene.player).toMatchObject({ x: 260, y: 216 });
      for (const step of scene.steps) {
        expect(step).toMatchObject(projectRouteStep(
          getRouteStep(state.route, step.index), getRouteStep(state.route, state.stepsClimbed),
        ));
        expect(Number.isInteger(step.x) && Number.isInteger(step.y)).toBe(true);
        expect(step.x - 34).toBeGreaterThanOrEqual(0);
        expect(step.x + 34).toBeLessThanOrEqual(520);
        expect(step.y - 24).toBeGreaterThanOrEqual(0);
        expect(step.y + 16).toBeLessThanOrEqual(400);
      }
      expect(scene.player.index - scene.pursuer.index).toBe(state.pursuerDistance);
      directions.add(scene.player.direction);
      const nextIndex = state.stepsClimbed + 1;
      lengths.add(getRouteRun(state.route, nextIndex)!.length);
      const route = advanceStairRoute(state.route, nextIndex);
      const direction = getRouteStep(route, nextIndex).direction;
      // Exercise geometry independently of score limits and bonus clocks.
      state = { ...state, route, stepsClimbed: nextIndex, direction,
        pursuerIndex: nextIndex - 4, pursuerDistance: 4, lastPursuerMove: null,
        straightStepsRemaining: countStraightSteps(route, nextIndex, direction) };
    }
    expect([...lengths].sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 6, 7, 8, 9]);
    expect([...directions].sort()).toEqual(["left", "right"]);
  });

  it("does not mutate state or consume randomness when repeatedly building a scene", () => {
    const state = createGameState(() => 0.5);
    const before = structuredClone(state);
    for (const step of state.route.steps) Object.freeze(step);
    Object.freeze(state.route.steps);
    Object.freeze(state.route);
    Object.freeze(state);
    const random = vi.spyOn(Math, "random");
    try {
      expect(buildStairSceneModel(state)).toEqual(buildStairSceneModel(state));
      expect(state).toEqual(before);
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects an invalid pursuer distance %s", (pursuerDistance) => {
    expect(() => buildStairSceneModel({ ...createGameState(() => 0), pursuerDistance })).toThrow(RangeError);
  });

  it("allows real distances beyond four and distinguishes offscreen actors", () => {
    let state = startGame(createGameState(() => 0), 0);
    state = applyInput(state, "forward", 100);
    expect(buildStairSceneModel(state)).toMatchObject({ pursuerVisible: true, pursuer: { index: -4 } });
    expect(state.pursuerDistance).toBe(5);
    for (let index = 1; index < 10; index += 1) {
      const next = getRouteStep(state.route, state.stepsClimbed + 1);
      state = applyInput(state, next.direction === state.direction ? "forward" : "turn", 100);
    }
    const model = buildStairSceneModel(state);
    expect(model.pursuerVisible).toBe(false);
    expect(model.pursuer.index).toBe(-4);
    expect(model.steps).toHaveLength(11);
    expect(() => buildStairSceneModel({ ...state, pursuerDistance: 4 })).toThrow(RangeError);
  });

  it("projects the last real adjacent pursuer step with motion outside the clip", () => {
    const state = tickGame(startGame(createGameState(() => 0), 0), 1_000);
    expect(buildStairSceneModel(state).pursuerMotion).toEqual({
      from: { x: 124, y: 328 }, to: { x: 158, y: 300 }, atMs: 800,
    });
    expect(() => buildStairSceneModel({ ...state, lastPursuerMove: { fromIndex: -4, toIndex: -2, atMs: 1_000 } })).toThrow(RangeError);
  });

  it("rejects missing history, missing future stairs and non-integer player indices", () => {
    const state = createGameState(() => 0);
    expect(() => buildStairSceneModel({ ...state, route: { ...state.route, steps: state.route.steps.slice(1) } })).toThrow(RangeError);
    expect(() => buildStairSceneModel({ ...state, route: { ...state.route, steps: [] } })).toThrow(RangeError);
    const route = { ...state.route, steps: state.route.steps.slice(0, 10), tailDirection: state.route.steps[9].direction };
    expect(() => buildStairSceneModel({ ...state, route })).toThrow(RangeError);
    expect(() => buildStairSceneModel({ ...state, stepsClimbed: 0.5 })).toThrow(RangeError);
  });
});

beforeEach(() => {
  vi.spyOn(stairObstacles, "createObstacleState").mockImplementation((route, stage) => makeObstacleFixture(route, 0, stage));
  vi.spyOn(stairObstacles, "revealObstacles").mockImplementation((state, route, index, stage) => makeObstacleFixture(route, index, stage, state));
});
afterEach(() => vi.restoreAllMocks());

describe("two-stair jump projection", () => {
  function jumpFrom(index: number): GameState {
    let state = startGame(createGameState(() => 0), 0);
    while (state.stepsClimbed < index) state = climb(state);
    return applyInput(withObstacle(state, index + 1), "jump", 1_000);
  }

  it.each([[1, 192], [21, 328]])("projects jump from index %s in the landing-centered view", (index, x) => {
    const state = jumpFrom(index);
    const before = structuredClone(state);
    const freeze = (value: unknown): void => {
      if (value && typeof value === "object") {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
      }
    };
    freeze(state);
    const scene = buildStairSceneModel(state);
    expect(scene.playerJump).toEqual({ from: { x, y: 272 }, to: { x: 260, y: 216 } });
    expect(scene.player.index).toBe(index + 2);
    expect(scene.steps).toHaveLength(11);
    expect(buildStairSceneModel(state)).toEqual(scene);
    expect(state).toEqual(before);
    expect(buildStairSceneModel(tickGame(state, 2_000)).playerJump).toEqual(scene.playerJump);
  });

  it("removes the arc after a normal move, mistake or capture and ignores a mismatched old target", () => {
    const jumped = jumpFrom(1);
    expect(buildStairSceneModel(applyInput(jumped, "forward", 1_000)).playerJump).toBeNull();
    expect(buildStairSceneModel(applyInput(jumped, "jump", 1_000)).playerJump).toBeNull();
    expect(buildStairSceneModel(tickGame(withPursuitAt(jumped, 1_000, 1), 2_000)).playerJump).toBeNull();
    expect(buildStairSceneModel({ ...jumped, lastMove: { ...jumped.lastMove!, toIndex: 4 } }).playerJump).toBeNull();
  });

  it("rejects malformed two-step endpoints, missing history and corner-crossing metadata", () => {
    const state = jumpFrom(1);
    expect(() => buildStairSceneModel({ ...state, lastMove: { ...state.lastMove!, fromIndex: 2 } })).toThrow(RangeError);
    expect(() => buildStairSceneModel({ ...state, route: { ...state.route, steps: state.route.steps.filter((step) => step.index !== 1) } })).toThrow(RangeError);
    let corner = startGame(createGameState(() => 0), 0);
    for (let index = 0; index < 7; index += 1) corner = climb(corner);
    expect(() => buildStairSceneModel({ ...corner, lastMove: { kind: "jump", fromIndex: 5, toIndex: 7, scoreGain: 2, isBonus: false } })).toThrow(RangeError);
  });
});
