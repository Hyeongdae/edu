import { describe, expect, it } from "vitest";
import { advanceStairRoute, countStraightSteps, getRouteStep } from "../game/stairRoute";
import { applyInfiniteInput, createInfiniteGameState, startInfiniteGame, tickInfiniteGame } from "./infiniteEngine";
import { buildInfiniteSceneModel } from "./infiniteSceneModel";
import type { InfiniteGameState } from "./types";

function inputForNextStep(state: InfiniteGameState): "forward" | "turn" {
  return getRouteStep(state.route, state.stepsClimbed + 1).direction === state.direction ? "forward" : "turn";
}

function afterSteps(count: number): InfiniteGameState {
  let state = startInfiniteGame(createInfiniteGameState(() => 0), 0);
  for (let index = 0; index < count; index += 1) state = applyInfiniteInput(state, inputForNextStep(state), 0);
  return state;
}

describe("buildInfiniteSceneModel", () => {
  it("projects higher route indices above the player and keeps an 11-stair viewport", () => {
    const model = buildInfiniteSceneModel(createInfiniteGameState(() => 0));
    const next = model.steps.find((step) => step.index === 1)!;
    expect(model.steps).toHaveLength(11);
    expect(next.y).toBeLessThan(model.player.y);
    expect(model.player.index).toBe(0);
    expect(model.pursuer.index).toBe(-4);
    expect(model.pursuerVisible).toBe(true);
  });

  it("projects player turning motion on the real adjacent stair and preserves route direction", () => {
    const beforeCorner = afterSteps(5);
    const turned = applyInfiniteInput(beforeCorner, "turn", 1);
    const model = buildInfiniteSceneModel(turned);
    expect(model.playerMotion).not.toBeNull();
    expect(model.playerMotion!.from.y).toBeGreaterThan(model.playerMotion!.to.y);
    expect(model.playerMotion!.from.x).not.toBe(model.playerMotion!.to.x);
    expect(model.player.direction).toBe("left");
    expect(model.steps.find((step) => step.index === 6)?.direction).toBe("left");
  });

  it("projects the pursuer move between its actual route stairs and supplies catch frames", () => {
    const started = startInfiniteGame(createInfiniteGameState(() => 0), 0);
    const moved = tickInfiniteGame(started, 300);
    const model = buildInfiniteSceneModel(moved);
    expect(model.pursuerMotion).toMatchObject({
      from: { y: 328 }, to: { y: 300 }, atMs: 300,
    });
    expect(model.catchFrames).toHaveLength(7);
    expect(model.catchFrames[0].index).toBe(-1);
    expect(model.catchFrames.at(-1)?.index).toBe(-3);
  });

  it("retains future stairs and follows the player after route history advances", () => {
    const initial = createInfiniteGameState(() => 0);
    let route = initial.route;
    for (let index = 18; index < 100; index += 18) {
      route = advanceStairRoute(route, index, -4);
    }
    route = advanceStairRoute(route, 100, -4);
    const step = getRouteStep(route, 100);
    const state: InfiniteGameState = {
      ...initial,
      stepsClimbed: 100,
      direction: step.direction,
      straightStepsRemaining: countStraightSteps(route, 100, step.direction),
      pursuerDistance: 104,
      route,
    };
    const model = buildInfiniteSceneModel(state);
    expect(model.steps[0].index).toBe(96);
    expect(model.steps.at(-1)?.index).toBe(106);
    expect(model.pursuerVisible).toBe(false);
    expect(model.pursuerPreviewSteps.length).toBeGreaterThan(0);
  });

  it("rejects inconsistent pursuit distance", () => {
    const state = createInfiniteGameState(() => 0);
    expect(() => buildInfiniteSceneModel({ ...state, pursuerDistance: 3 })).toThrow(RangeError);
  });
});
