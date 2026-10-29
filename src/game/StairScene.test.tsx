import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StairScene } from "./StairScene";
import { applyInput, createGameState, startGame, tickGame } from "./gameEngine";
import { getRouteStep } from "./stairRoute";
import { getStageRule } from "./stageRules";
import { buildDescentSceneModel } from "../descent/descentSceneModel";
import { makeObstacleFixture, withObstacle } from "../test/obstacleFixtures";
import { withPursuitAt } from "../test/gameFixtures";
import type { ClearedStage, GameStage, GameState } from "./types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const initial = (stage: GameStage = 1) => startGame(createGameState(() => 0, { stage, highestClearedStage: (stage - 1) as ClearedStage }), 0);
const props = (state: GameState, moving = false, npc = false, caught = false, key = 3) => ({
  state, climbAnimationKey: key, isClimbing: moving, pursuerAnimationKey: state.lastPursuerMove?.atMs ?? 0,
  isPursuerMoving: npc, isPursuerCaught: caught,
});
function atIndex(index: number, stage: GameStage = 1): GameState {
  let state = initial(stage);
  while (state.stepsClimbed < index) {
    state = { ...state, obstacles: makeObstacleFixture(state.route, state.stepsClimbed, state.stage) };
    state = applyInput(state, getRouteStep(state.route, state.stepsClimbed + 1).direction === state.direction ? "forward" : "turn", 0);
  }
  return state;
}

describe("main downward staircase scene", () => {
  it.each([1, 2, 3, 4, 5] as const)("uses downward geometry with upright pixel art in stage %s", (stage) => {
    const state = initial(stage);
    const random = vi.spyOn(Math, "random");
    render(<StairScene {...props(state)} />);
    const steps = screen.getAllByTestId("stair-step");
    expect(steps.map(step => Number(step.dataset.routeIndex))).toEqual([-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]);
    expect(screen.getByTestId("runner")).toHaveAttribute("transform", "translate(260 216)");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("transform", "translate(124 104)");
    expect(steps[5].querySelector(".stair-top")).toHaveAttribute("transform", "translate(294 244)");
    expect(steps[10].querySelector(".stair-top")).toHaveAttribute("transform", expect.stringMatching(/ 384\)$/));
    expect(screen.getByRole("img")).toHaveAttribute("viewBox", "0 0 520 400");
    expect(screen.getByRole("img")).toHaveAccessibleName(/아래로.*위쪽 추격자/);
    expect(document.querySelector('[transform*="scale(1 -1)"]')).toBeNull();
    expect(document.querySelector(".scene-distance-tag")).toBeNull();
    expect(document.querySelector(".scene-heading .scene-distance-note")).toBeNull();
    expect(screen.getByRole("img").getAttribute("aria-label")).not.toMatch(/\d+칸 거리/);
    expect(document.querySelector(".office-backdrop")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("route-direction")).toHaveTextContent("내려가세요");
    expect(random).not.toHaveBeenCalled();
  });

  it.each([[0, "-34px"], [5, "34px"], [6, "-34px"]] as const)("moves a single player from the real step/turn at %s with a nested clip", (index, x) => {
    const before = atIndex(index);
    const next = getRouteStep(before.route, index + 1);
    const state = applyInput(before, next.direction === before.direction ? "forward" : "turn", 0);
    render(<StairScene {...props(state, true)} />);
    const runner = screen.getByTestId("runner");
    const motion = screen.getByTestId("runner-motion");
    expect(screen.getAllByTestId("runner")).toHaveLength(1);
    expect(runner).toHaveAttribute("transform", "translate(260 216)");
    expect(motion).toHaveClass("is-stepping");
    expect(motion).toHaveStyle({ "--step-x": x, "--step-y": "-28px", "--step-mid-y": "-22px" });
    expect(motion.closest("[clip-path]")).toBeNull();
    const clip = motion.querySelector("[clip-path]")!;
    expect(clip).toContainElement(screen.getByTestId("runner-pose"));
    expect(document.querySelector("clipPath rect")).toHaveAttribute("x", "-34");
    expect(document.querySelector("clipPath rect")).toHaveAttribute("y", "-88");
    expect(document.querySelector("clipPath rect")).toHaveAttribute("width", "68");
    expect(document.querySelector("clipPath rect")).toHaveAttribute("height", "84");
    expect(runner.parentElement).toHaveClass("step-overlay");
    expect(runner.parentElement?.lastElementChild).toHaveClass("stair-front");
  });

  it.each([[1, "-68px"], [21, "68px"]] as const)("jumps over the actual box from %s with a downward landing and high arc", (index, x) => {
    const state = applyInput(withObstacle(atIndex(index), index + 1), "jump", 0);
    const view = render(<StairScene {...props(state, true)} />);
    const motion = screen.getByTestId("runner-motion");
    expect(motion).toHaveClass("is-jumping");
    expect(motion).toHaveStyle({ "--jump-x": x, "--jump-y": "-56px", "--jump-mid-y": "-84px" });
    expect(screen.getAllByTestId("runner")).toHaveLength(1);
    const box = screen.getByTestId("stair-obstacle");
    expect(box).toHaveAttribute("data-route-index", String(index + 1));
    const overlay = document.querySelector(".jump-overlay")!;
    expect(overlay.parentElement?.lastElementChild).toBe(overlay);
    expect(overlay.lastElementChild).toHaveClass("stair-front");
    expect(box.compareDocumentPosition(overlay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(motion.closest("[clip-path]")).toBeNull();
    view.rerender(<StairScene {...props(state, false)} />);
    expect(document.querySelector(`[data-testid="stair-obstacle"][data-route-index="${index + 1}"]`)).toBeNull();
    expect(document.querySelector(".jump-overlay")).toBeNull();
  });

  it("does not restart player travel for an NPC update, but replaces it for rapid new input", () => {
    const state = applyInput(initial(), "forward", 0);
    const view = render(<StairScene {...props(state, true)} />);
    const motion = screen.getByTestId("runner-motion");
    view.rerender(<StairScene {...props(tickGame(state, 800), true, true)} />);
    expect(screen.getByTestId("runner-motion")).toBe(motion);
    view.rerender(<StairScene {...props(applyInput(state, "forward", 0), true, false, false, 4)} />);
    expect(screen.getByTestId("runner-motion")).not.toBe(motion);
  });

  it.each(["ready", "checkpoint", "game-over", "fall", "caught"] as const)("suppresses retained jump travel and crossed-box overlays for %s", (mode) => {
    const jump = applyInput(withObstacle(atIndex(1), 2), "jump", 0);
    const state: GameState = mode === "fall" ? { ...jump, lastMistake: true, recoveryEndsAt: 500 }
      : mode === "caught" ? jump : { ...jump, status: mode };
    render(<StairScene {...props(state, true, true, mode === "caught")} />);
    expect(document.querySelector(".jump-overlay, .step-overlay")).toBeNull();
    expect(document.querySelector('[data-testid="stair-obstacle"][data-route-index="2"]')).toBeNull();
    expect(screen.getByTestId("runner-motion")).not.toHaveAttribute("style");
    expect(screen.getByTestId("runner")).toHaveAttribute("data-motion-kind", mode === "fall" ? "fall" : "idle");
    expect(screen.getAllByTestId("runner")).toHaveLength(1);
  });

  it.each([1, 2, 3, 4, 5] as const)("renders the final step/jump at a stage %s checkpoint or final result without replay", (stage) => {
    const before = withObstacle({ ...atIndex(1, stage), score: getStageRule(stage).scoreRequired - 1 }, 2);
    const state = applyInput(before, "jump", 0);
    expect(state.status).toBe(stage === 5 ? "game-over" : "checkpoint");
    render(<StairScene {...props(state, true)} />);
    expect(document.querySelector(".jump-overlay, .step-overlay")).toBeNull();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "3");
    expect(screen.getByTestId("runner")).toHaveAttribute("data-motion-kind", "idle");
    expect(document.querySelector('[data-testid="stair-obstacle"][data-route-index="2"]')).toBeNull();
  });

  it("uses the NPC's own facing and an independent inner step with pixel catch travel", () => {
    const moved = tickGame(withPursuitAt(atIndex(10), 0), 800);
    const view = render(<StairScene {...props(moved, false, true)} />);
    expect(screen.getAllByTestId("pursuer")).toHaveLength(1);
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-direction", getRouteStep(moved.route, moved.pursuerIndex).direction);
    expect(screen.getByTestId("pursuer-motion")).toHaveStyle({ "--pursuer-move-y": "-28px", "--pursuer-move-mid-y": "-22px" });
    const caught = tickGame(initial(), 3200);
    view.rerender(<StairScene {...props(caught, true, true, true)} />);
    const model = buildDescentSceneModel(caught);
    const motion = screen.getByTestId("pursuer-motion");
    expect(motion).toHaveClass("is-catching");
    expect(motion).not.toHaveClass("is-moving");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("transform", `translate(${model.pursuer.x} ${model.pursuer.y})`);
    expect(screen.getByTestId("pursuer")).not.toHaveAttribute("style");
    for (const [index, frame] of model.catchFrames.entries()) {
      expect(motion.style.getPropertyValue(`--catch-x-${index}`)).toBe(`${frame.x - model.pursuer.x}px`);
      expect(motion.style.getPropertyValue(`--catch-y-${index}`)).toBe(`${frame.y - model.pursuer.y}px`);
      expect(motion.style.getPropertyValue(`--catch-facing-${index}`)).toBe(getRouteStep(caught.route, frame.index).direction === "right" ? "1" : "-1");
    }
    expect(motion.style.getPropertyValue("--catch-base-facing")).toBe(model.pursuer.direction === "right" ? "1" : "-1");
    expect(motion.querySelector(".pursuer-facing > .pixel-officer")).toHaveAttribute("transform", "scale(1 1)");
    expect(screen.getAllByTestId("pursuer")).toHaveLength(1);
    expect(screen.getAllByTestId("runner")).toHaveLength(1);
  });

  it("merges real historical preview stairs once even while the NPC is offscreen", () => {
    const state = atIndex(10);
    const view = render(<StairScene {...props(withPursuitAt(state, 0, 5))} />);
    expect(screen.getByTestId("pursuer").parentElement).toHaveAttribute("data-route-index", "5");
    expect(screen.getAllByTestId("stair-step").map(step => Number(step.dataset.routeIndex))).toEqual([4, 5, ...Array.from({ length: 11 }, (_, i) => i + 6)]);
    view.rerender(<StairScene {...props(state)} />);
    expect(screen.queryByTestId("pursuer")).toBeNull();
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-index", "-4");
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-visible", "false");
    expect(screen.getAllByTestId("stair-step").map(step => Number(step.dataset.routeIndex))).toEqual([-4, -3, ...Array.from({ length: 11 }, (_, i) => i + 6)]);
  });

  it("keeps both real NPC movement endpoints rendered above the destination stair front", () => {
    const far = withPursuitAt(atIndex(20), 0, 15);
    const before = tickGame(far, 800);
    const moved = tickGame(before, 900);
    const model = buildDescentSceneModel(moved);
    expect(model.pursuerVisible).toBe(true);
    expect(model.pursuerMotion).not.toBeNull();
    const view = render(<StairScene {...props(moved, false, true)} />);
    const routeIndices = screen.getAllByTestId("stair-step").map(step => Number(step.dataset.routeIndex));
    expect(routeIndices).toEqual([...model.pursuerPreviewSteps.map(step => step.index), ...model.steps.map(step => step.index)]);
    expect(routeIndices.filter(index => index === moved.lastPursuerMove!.fromIndex)).toHaveLength(1);
    expect(routeIndices.filter(index => index === model.pursuer.index)).toHaveLength(1);
    expect(screen.getAllByTestId("pursuer")).toHaveLength(1);
    expect(screen.getByTestId("pursuer").parentElement).toHaveClass("pursuer-move-overlay");
    expect(document.querySelector(".pursuer-move-overlay")?.lastElementChild).toHaveClass("stair-front");
    view.rerender(<StairScene {...props(before)} />);
    expect(screen.getAllByTestId("stair-step").some(step => Number(step.dataset.routeIndex) === moved.lastPursuerMove!.fromIndex)).toBe(true);
  });
});
