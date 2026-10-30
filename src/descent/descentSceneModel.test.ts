import { afterEach, describe, expect, it, vi } from "vitest";
import { advanceStairRoute, countStraightSteps, getRouteStep } from "../game/stairRoute";
import { revealObstacles } from "../game/stairObstacles";
import { buildStairSceneModel } from "../game/stairSceneModel";
import type { GameState } from "../game/types";
import { withPursuitAt } from "../test/gameFixtures";
import { withObstacle } from "../test/obstacleFixtures";
import { applyDescentInput, createDescentState, startDescent, tickDescent } from "./descentEngine";
import { buildDescentSceneModel, projectDescentRouteStep } from "./descentSceneModel";

afterEach(() => vi.restoreAllMocks());

// Real route/obstacle metadata for scene geometry, independently of gameplay score/time.
function advanceGeometry(state: GameState): GameState {
  const index = state.stepsClimbed + 1;
  const route = advanceStairRoute(state.route, index, -4);
  const direction = getRouteStep(route, index).direction;
  return { ...state, stepsClimbed: index, route, direction,
    straightStepsRemaining: countStraightSteps(route, index, direction),
    obstacles: revealObstacles(state.obstacles, route, index, 1), lastMove: null, lastPursuerMove: null,
    pursuerDistance: index - state.pursuerIndex };
}

function geometryAt(seed: number, index: number): GameState {
  let state = startDescent(createDescentState(() => seed), 0);
  while (state.stepsClimbed < index) state = advanceGeometry(state);
  return state;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe("downward staircase coordinates", () => {
  it("puts the future below the anchor and the initial pursuer above it", () => {
    const state = createDescentState(() => 0.999);
    const original = buildStairSceneModel(state);
    const scene = buildDescentSceneModel(state);
    expect(scene.player).toEqual({ x: 260, y: 216, index: 0, direction: "right" });
    expect(scene.pursuer).toEqual({ x: 124, y: 104, index: -4, direction: "right" });
    expect(scene.pursuer.y - 88).toBe(16);
    expect(scene.pursuerVisible).toBe(true);
    expect(scene.steps.map(step => step.index)).toEqual([-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]);
    expect(scene.steps.find(step => step.index === 1)).toMatchObject({ x: 294, y: 244 });
    expect(scene.steps.at(-1)).toMatchObject({ x: 464, y: 384 });
    expect(scene.steps.at(-1)!.y + 16).toBe(400);
    expect(scene.playerMotion).toBeNull();
    expect(scene.playerJump).toBeNull();
    expect(scene.pursuerMotion).toBeNull();
    expect(original.pursuer.y).toBe(328);
    expect(original.steps.find(step => step.index === 1)?.y).toBe(188);
    expect(buildStairSceneModel(state)).toEqual(original);
  });

  it("reflects retained pursuer preview stairs without changing route indices", () => {
    const state = geometryAt(0.999, 20);
    const original = buildStairSceneModel(state);
    const scene = buildDescentSceneModel(state);
    expect(original.pursuerPreviewSteps.map(step => step.index)).toEqual([-4, -3]);
    expect(scene.pursuerPreviewSteps).toEqual(original.pursuerPreviewSteps.map(step => ({
      ...step, y: 432 - step.y,
    })));
  });

  it.each(["right", "left"] as const)("projects both vertical directions without flipping %s facing", direction => {
    const player = { index: 10, column: 3, direction };
    const sign = direction === "right" ? 1 : -1;
    expect(projectDescentRouteStep(player, player)).toEqual({ x: 260, y: 216 });
    expect(projectDescentRouteStep({ index: 11, column: 3 + sign, direction }, player))
      .toEqual({ x: 260 + sign * 34, y: 244 });
    expect(projectDescentRouteStep({ index: 9, column: 3 - sign, direction }, player))
      .toEqual({ x: 260 - sign * 34, y: 188 });
  });

  it.each([0, 0.5, 0.999])("keeps all eleven generated stairs inside the view for seed%s", seed => {
    let state = startDescent(createDescentState(() => seed), 0);
    const lengths = new Set<number>();
    const directions = new Set<string>();
    for (let index = 0; index < 160; index++) {
      const scene = buildDescentSceneModel(withPursuitAt(state, 0));
      const player = getRouteStep(state.route, state.stepsClimbed);
      expect(scene.steps).toHaveLength(11);
      for (const step of scene.steps) {
        expect(step).toMatchObject(projectDescentRouteStep(getRouteStep(state.route, step.index), player));
        expect(step.x - 34).toBeGreaterThanOrEqual(0);
        expect(step.x + 34).toBeLessThanOrEqual(520);
        expect(step.y - 24).toBeGreaterThanOrEqual(0);
        expect(step.y + 16).toBeLessThanOrEqual(400);
      }
      expect(scene.player.index - scene.pursuer.index).toBe(4);
      directions.add(scene.player.direction);
      state.route.runs.forEach(run => lengths.add(run.length));
      state = advanceGeometry(state);
    }
    expect([...lengths].sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 6, 7, 8, 9]);
    expect([...directions].sort()).toEqual(["left", "right"]);
  });

  it("shifts the world upward around a fixed player when progressing downward", () => {
    const before = geometryAt(0, 0);
    const after = applyDescentInput(before, "forward", 0);
    const sceneBefore = buildDescentSceneModel(before);
    const sceneAfter = buildDescentSceneModel(after);
    expect(sceneBefore.player).toMatchObject({ x: 260, y: 216 });
    expect(sceneAfter.player).toMatchObject({ x: 260, y: 216, index: 1 });
    for (const step of sceneBefore.steps.filter(step => step.index >= -3)) {
      const moved = sceneAfter.steps.find(next => next.index === step.index)!;
      expect(moved.y).toBe(step.y - 28);
      expect(moved.x).toBe(step.x - 34);
    }
  });

  it("keeps the NPC's own direction through a short corner without moving the player", () => {
    const state = withPursuitAt(geometryAt(0, 10), 0, 5);
    const originalObstacles = state.obstacles;
    const moves = [600, 1200, 1800].map(at => buildDescentSceneModel(tickDescent(state, at)));
    expect(moves.map(model => model.pursuer.index)).toEqual([6, 7, 8]);
    expect(new Set(moves.map(model => model.pursuer.direction)).size).toBe(2);
    for (const model of moves) {
      expect(model.player.index).toBe(10);
      expect(model.pursuer.direction).toBe(getRouteStep(state.route, model.pursuer.index).direction);
      expect(model.pursuer.y).toBeLessThan(model.player.y);
    }
    expect(state.obstacles).toBe(originalObstacles);
  });

  it("maps both endpoints and timing of an independent adjacent NPC step", () => {
    const state = tickDescent(geometryAt(0, 0), 800);
    expect(buildDescentSceneModel(state).pursuerMotion).toEqual({
      from: { x: 124, y: 104 }, to: { x: 158, y: 132 }, atMs: 500,
    });
  });

  it("maps every real catch/return point around a corner without changing indices or offsets", () => {
    const state = tickDescent(withPursuitAt(geometryAt(0, 6), 0, 1), 800);
    const original = buildStairSceneModel(state);
    const scene = buildDescentSceneModel(state);
    expect(scene.catchFrames.map(frame => frame.index)).toEqual([5, 6, 6, 5, 4, 3, 5]);
    expect(scene.catchFrames.map(frame => frame.offset)).toEqual([0, 0.2, 0.4, 0.55, 0.7, 0.85, 1]);
    scene.catchFrames.forEach((frame, index) => {
      expect(frame).toEqual({ ...original.catchFrames[index], y: 432 - original.catchFrames[index].y });
      expect(frame).toMatchObject(projectDescentRouteStep(
        getRouteStep(state.route, frame.index), getRouteStep(state.route, state.stepsClimbed),
      ));
    });
    expect(scene.catchFrames.at(-1)).toMatchObject({ x: scene.pursuer.x, y: scene.pursuer.y });
    expect(scene.playerMotion).toBeNull();
  });

  it("recomputes the visibility after reflection instead of copying the ascending flag", () => {
    const state = geometryAt(0, 4);
    const original = buildStairSceneModel(state);
    const scene = buildDescentSceneModel(state);
    expect(state.pursuerDistance).toBe(8);
    expect(original.pursuerVisible).toBe(true);
    expect(scene.pursuer).toMatchObject({ index: -4, x: -12, y: -8 });
    expect(scene.pursuerVisible).toBe(true); // Last eight pixels remain above the viewport edge.
    const further = buildDescentSceneModel(advanceGeometry(state));
    expect(further.pursuerVisible).toBe(false);
    expect(further.pursuer.index).toBe(-4);
    expect(further.steps).toHaveLength(11);
    const different = withPursuitAt(geometryAt(0, 9), 0, 9);
    expect(buildStairSceneModel(different).pursuerVisible).toBe(true);
    expect(buildDescentSceneModel(different).pursuerVisible).toBe(false);
  });

  it("retains a visible extra historical stair and far-behind metadata", () => {
    const state = geometryAt(0, 10);
    const near = buildDescentSceneModel(withPursuitAt(state, 0, 5));
    expect(near.pursuerVisible).toBe(true);
    expect(near.steps.some(step => step.index === near.pursuer.index)).toBe(false);
    expect(near.pursuer).toMatchObject(projectDescentRouteStep(
      getRouteStep(state.route, 5), getRouteStep(state.route, 10),
    ));
    const farState = geometryAt(0.5, 40);
    const far = buildDescentSceneModel(farState);
    expect(farState.pursuerDistance).toBe(44);
    expect(far.pursuerVisible).toBe(false);
    expect(far.pursuer.index).toBe(-4);
    expect(far.steps).toHaveLength(11);
  });

  it("uses real offscreen metadata on both horizontal sides", () => {
    const edges = new Set<string>();
    for (const seed of [0, 0.1, 0.25, 0.5, 0.75, 0.99]) {
      let state = geometryAt(seed, 0);
      for (let index = 0; index < 100; index++) {
        const scene = buildDescentSceneModel(state);
        if (scene.pursuer.x + 34 <= 0) edges.add("left");
        if (scene.pursuer.x - 34 >= 520) edges.add("right");
        expect(scene.pursuerVisible).toBe(scene.pursuer.x + 34 > 0 && scene.pursuer.x - 34 < 520 &&
          scene.pursuer.y + 16 > 0 && scene.pursuer.y - 88 < 400);
        state = advanceGeometry(state);
      }
    }
    expect([...edges].sort()).toEqual(["left", "right"]);
  });
});

describe("downward player motion", () => {
  it.each([[0, "forward", 226], [5, "turn", 294]] as const)(
    "projects one actual step from index%s, including a corner", (index, input, x) => {
      const moved = applyDescentInput(geometryAt(0, index), input, 0);
      expect(moved.stepsClimbed).toBe(index + 1);
      expect(buildDescentSceneModel(moved).playerMotion).toEqual({ kind: "climb",
        from: { x, y: 188 }, to: { x: 260, y: 216 } });
    },
  );

  it.each([[1, 192], [21, 328]])("projects a real two-stair jump from index%s in either direction", (index, x) => {
    const before = withObstacle(geometryAt(0, index), index + 1);
    const jumped = freeze(applyDescentInput(before, "jump", 0));
    const snapshot = structuredClone(jumped);
    const original = buildStairSceneModel(jumped);
    const scene = buildDescentSceneModel(jumped);
    expect(jumped.stepsClimbed).toBe(index + 2);
    expect(scene.playerJump).toEqual({ from: { x, y: 160 }, to: { x: 260, y: 216 } });
    expect(scene.playerMotion).toEqual({ kind: "jump", ...scene.playerJump });
    expect(original.playerJump?.from.y).toBe(272);
    expect(scene.playerJump!.from.y - scene.playerJump!.to.y).toBe(-56);
    expect(buildDescentSceneModel(jumped)).toEqual(scene);
    expect(jumped).toEqual(snapshot);
  });

  it("clears a previous jump on the next move, fall or capture and ignores an old landing", () => {
    const jumped = applyDescentInput(withObstacle(geometryAt(0, 1), 2), "jump", 0);
    const moved = buildDescentSceneModel(applyDescentInput(jumped, "forward", 0));
    expect(moved.playerJump).toBeNull();
    expect(moved.playerMotion?.kind).toBe("climb");
    const fallen = buildDescentSceneModel(applyDescentInput(jumped, "jump", 0));
    expect(fallen.playerJump).toBeNull();
    expect(fallen.playerMotion).toBeNull();
    const caught = buildDescentSceneModel(tickDescent(withPursuitAt(jumped, 0, 1), 800));
    expect(caught.playerMotion).toBeNull();
    expect(caught.playerJump).toBeNull();
    const old = buildDescentSceneModel({ ...jumped, lastMove: { ...jumped.lastMove!, toIndex: 4 } });
    expect(old.playerJump).toBeNull();
    expect(old.playerMotion).toBeNull();
  });

  it("keeps a terminal successful move as data for the renderer to suppress", () => {
    const final = applyDescentInput(withObstacle({ ...geometryAt(0, 1), score: 149 }, 2), "jump", 0);
    expect(final.endReason).toBe("cleared");
    expect(buildDescentSceneModel(final).playerMotion?.kind).toBe("jump");
  });

  it("is immutable and never consumes randomness or browser storage", () => {
    const state = freeze(applyDescentInput(geometryAt(0, 0), "forward", 0));
    const snapshot = structuredClone(state);
    const random = vi.spyOn(Math, "random");
    const local = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw Error("blocked"); });
    const session = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw Error("blocked"); });
    expect(buildDescentSceneModel(state)).toEqual(buildDescentSceneModel(state));
    expect(state).toEqual(snapshot);
    expect(random).not.toHaveBeenCalled();
    expect(local).not.toHaveBeenCalled();
    expect(session).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity])("retains the original invalid pursuit distance check for%s", pursuerDistance => {
    expect(() => buildDescentSceneModel({ ...createDescentState(() => 0), pursuerDistance })).toThrow(RangeError);
  });

  it("rejects missing history/future, fractional positions and malformed NPC motion", () => {
    const state = geometryAt(0, 0);
    expect(() => buildDescentSceneModel({ ...state, route: { ...state.route, steps: state.route.steps.slice(1) } })).toThrow(RangeError);
    expect(() => buildDescentSceneModel({ ...state, route: { ...state.route, steps: [] } })).toThrow(RangeError);
    expect(() => buildDescentSceneModel({ ...state, route: { ...state.route, steps: state.route.steps.slice(0, 10) } })).toThrow(RangeError);
    expect(() => buildDescentSceneModel({ ...state, stepsClimbed: 0.5 })).toThrow(RangeError);
    const moved = tickDescent(state, 800);
    expect(() => buildDescentSceneModel({ ...moved, lastPursuerMove: { fromIndex: -4, toIndex: -2, atMs: 800 } })).toThrow(RangeError);
    expect(() => buildDescentSceneModel({ ...moved, lastPursuerMove: { ...moved.lastPursuerMove!, atMs: NaN } })).toThrow(RangeError);
  });

  it("rejects malformed one-step/two-step endpoints and jumps crossing a corner", () => {
    const step = applyDescentInput(geometryAt(0, 0), "forward", 0);
    for (const fromIndex of [-1, 0.5, NaN]) {
      expect(() => buildDescentSceneModel({ ...step, lastMove: { ...step.lastMove!, fromIndex } })).toThrow(RangeError);
    }
    const jumped = applyDescentInput(withObstacle(geometryAt(0, 1), 2), "jump", 0);
    expect(() => buildDescentSceneModel({ ...jumped, lastMove: { ...jumped.lastMove!, fromIndex: 2 } })).toThrow(RangeError);
    const corner = geometryAt(0, 7);
    expect(() => buildDescentSceneModel({ ...corner,
      lastMove: { kind: "jump", fromIndex: 5, toIndex: 7, scoreGain: 2, isBonus: false } })).toThrow(RangeError);
  });
});
