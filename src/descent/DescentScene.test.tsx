import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { withObstacle } from "../test/obstacleFixtures";
import { withPursuitAt } from "../test/gameFixtures";
import { applyDescentInput, createDescentState, startDescent, tickDescent } from "./descentEngine";
import { DescentScene } from "./DescentScene";
import type { GameState } from "../game/types";
import { getRouteStep } from "../game/stairRoute";
import { hasObstacle } from "../game/stairObstacles";

afterEach(cleanup);
const initial = () => startDescent(createDescentState(() => 0), 0);
const draw = (state: GameState, moving = false, npc = false, caught = false) => render(
  <DescentScene state={state} playerMotionKey={3} isPlayerMoving={moving} isPursuerMoving={npc} isCaught={caught} />,
);

describe("descent scene rendering", () => {
  it("keeps art upright, ascending DOM depth and future coordinates below the player", () => {
    draw(initial());
    const steps = screen.getAllByTestId("descent-stair-step");
    expect(steps.map(step => Number(step.dataset.routeIndex))).toEqual([-4,-3,-2,-1,0,1,2,3,4,5,6]);
    expect(screen.getByTestId("descent-runner")).toHaveAttribute("transform", "translate(260 216)");
    expect(screen.getByTestId("descent-pursuer")).toHaveAttribute("transform", "translate(124 104)");
    expect(steps[5].querySelector(".descent-stair-top")).toHaveAttribute("transform", "translate(294 244)");
    expect(document.querySelector('[transform*="scale(1 -1)"]')).toBeNull();
    expect(screen.getByRole("img")).toHaveAccessibleName(/아래로.*위쪽 추격자/);
    expect(screen.getByTestId("descent-route-direction")).toHaveTextContent("내려가세요");
  });

  it("puts a single moving player above base stairs while keeping only its pose clipped", () => {
    draw(applyDescentInput(initial(), "forward", 0), true);
    expect(screen.getAllByTestId("descent-runner")).toHaveLength(1);
    const motion = screen.getByTestId("descent-runner-motion");
    expect(motion).toHaveClass("is-stepping");
    expect(motion.closest("[clip-path]")).toBeNull();
    expect(motion.querySelector("[clip-path]")).not.toBeNull();
    expect(motion.style.getPropertyValue("--descent-from-y")).toBe("-28px");
    expect(motion.style.getPropertyValue("--descent-mid-y")).toBe("-22px");
    expect(motion.closest(".descent-step-overlay")?.lastElementChild).toHaveClass("descent-stair-front");
  });

  it("renders the crossed box during a jump with a downward landing and higher arc", () => {
    const before = withObstacle(applyDescentInput(initial(), "forward", 0), 2);
    expect(before.stepsClimbed).toBe(1);
    draw(applyDescentInput(before, "jump", 0), true);
    expect(screen.getAllByTestId("descent-runner")).toHaveLength(1);
    expect(screen.getByTestId("descent-stair-obstacle")).toHaveAttribute("data-route-index", "2");
    const motion = screen.getByTestId("descent-runner-motion");
    expect(motion).toHaveClass("is-jumping");
    expect(motion.style.getPropertyValue("--descent-from-x")).toBe("-68px");
    expect(motion.style.getPropertyValue("--descent-from-y")).toBe("-56px");
    expect(motion.style.getPropertyValue("--descent-mid-y")).toBe("-84px");
    const overlay = document.querySelector(".descent-jump-overlay")!;
    expect(overlay.parentElement?.lastElementChild).toBe(overlay);
    expect(overlay.contains(motion)).toBe(true);
  });

  it("suppresses retained terminal jump data even if a parent requests animation", () => {
    const before = withObstacle({ ...applyDescentInput(initial(), "forward", 0), score: 149 }, 2);
    draw(applyDescentInput(before, "jump", 0), true);
    expect(document.querySelector(".descent-jump-overlay")).toBeNull();
    expect(screen.getByTestId("descent-runner")).toHaveAttribute("data-motion-kind", "idle");
    expect(screen.getByTestId("descent-runner-motion").getAttribute("style")).toBeNull();
  });

  it("renders independent NPC motion once and uses real catch frames", () => {
    const moved = tickDescent(initial(), 800);
    const result = draw(moved, false, true);
    expect(screen.getAllByTestId("descent-pursuer")).toHaveLength(1);
    expect(screen.getByTestId("descent-pursuer-motion")).toHaveClass("is-moving");
    expect(screen.getByTestId("descent-pursuer-motion").style.getPropertyValue("--descent-from-y")).toBe("-28px");
    result.rerender(<DescentScene state={tickDescent(initial(), 3200)} playerMotionKey={4} isPlayerMoving isPursuerMoving isCaught />);
    expect(screen.getAllByTestId("descent-pursuer")).toHaveLength(1);
    expect(screen.getAllByTestId("descent-runner")).toHaveLength(1);
    const catchMotion = screen.getByTestId("descent-pursuer-motion");
    expect(catchMotion).toHaveClass("descent-catch-motion");
    expect(catchMotion.style.getPropertyValue("--descent-catch-y-1")).toBe("28px");
    expect(catchMotion.style.getPropertyValue("--descent-catch-y-6")).toBe("0px");
  });

  it("retains history and offscreen metadata without fabricating NPC stairs", () => {
    let state = initial();
    while (state.stepsClimbed < 40) {
      const input = hasObstacle(state.obstacles, state.stepsClimbed + 1) ? "jump"
        : getRouteStep(state.route, state.stepsClimbed + 1).direction === state.direction ? "forward" : "turn";
      state = applyDescentInput(state, input, 0);
    }
    const result = draw(withPursuitAt(state, 0, 5));
    expect(document.querySelector(".descent-history-stair")).not.toBeNull();
    expect(screen.getAllByTestId("descent-stair-step")).toHaveLength(11);
    result.rerender(<DescentScene state={state} playerMotionKey={0} isPlayerMoving={false} isPursuerMoving={false} isCaught={false} />);
    expect(screen.queryByTestId("descent-pursuer")).toBeNull();
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-index", "-4");
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-visible", "false");
  });

  it("exposes the real obstacle cue and cancels previous motion on a fall", () => {
    const before = withObstacle(applyDescentInput(initial(), "forward", 0), 2);
    const result = draw(before);
    expect(screen.getByTestId("descent-route-direction")).toHaveTextContent("장애물! 점프하세요");
    const fallen = applyDescentInput(before, "forward", 0);
    result.rerender(<DescentScene state={fallen} playerMotionKey={2} isPlayerMoving isPursuerMoving={false} isCaught={false} />);
    expect(screen.getByTestId("descent-runner")).toHaveAttribute("data-motion-kind", "fall");
    expect(document.querySelector(".descent-step-overlay")).toBeNull();
    expect(document.querySelector(".descent-jump-overlay")).toBeNull();
  });
});
