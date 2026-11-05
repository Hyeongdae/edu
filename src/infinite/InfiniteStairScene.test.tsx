import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { applyInfiniteInput, createInfiniteGameState, startInfiniteGame } from "./infiniteEngine";
import { InfiniteStairScene } from "./InfiniteStairScene";
import { getDefaultCharacterAppearance } from "../../shared/characterAppearance";

afterEach(cleanup);

describe("InfiniteStairScene", () => {
  it("shows independent custom looks above the stairs while preserving the original feet anchors", () => {
    const appearance = getDefaultCharacterAppearance(); appearance.runner.hat = "cap";
    appearance.pursuer.glasses = "round"; appearance.pursuer.outfitColor = "teal";
    appearance.runner.bag = "backpack"; appearance.runner.bagColor = "navy"; appearance.runner.eyeStyle = "round";
    appearance.pursuer.bag = "laptop"; appearance.pursuer.bagColor = "black"; appearance.pursuer.eyeStyle = "sharp";
    appearance.runner.bottoms = "skirt"; appearance.runner.bottomsColor = "beige";
    appearance.pursuer.bottoms = "shorts"; appearance.pursuer.bottomsColor = "white";
    const state = createInfiniteGameState(() => 0);
    const { container, rerender } = render(<InfiniteStairScene state={state} isMoving={false} appearance={appearance} />);
    const player = screen.getByTestId("infinite-player"), pursuer = screen.getByTestId("infinite-pursuer");
    expect(player.querySelector(".officer-cap-hat")).not.toBeNull();
    expect(pursuer.querySelector(".officer-glasses--round")).not.toBeNull();
    expect(pursuer.querySelector(".officer-cloth")).toHaveAttribute("fill", "#397f82");
    expect(player.querySelector('[data-bag-kind="backpack"] .officer-bag-fill')).toHaveAttribute("fill", "#30466d");
    expect(player.querySelector(".officer-eyes")).toHaveAttribute("data-eye-style", "round");
    expect(player.querySelector(".officer-skirt-fabric")).toHaveAttribute("fill", "#c8b38b");
    expect(pursuer.querySelector(".officer-bottoms--shorts .officer-bottom-leg--front .officer-bottoms-fabric")).toHaveAttribute("fill", "#e6edf2");
    expect(pursuer.querySelector('[data-bag-kind="laptop"] .officer-bag-fill')).toHaveAttribute("fill", "#263247");
    expect(pursuer.querySelector(".officer-eyes")).toHaveAttribute("data-eye-style", "sharp");
    const lastStair = container.querySelectorAll('[data-testid="infinite-stair-step"]');
    expect(lastStair[lastStair.length - 1].compareDocumentPosition(player) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(player).toHaveAttribute("transform", "translate(260 204)");
    const actors = [player, pursuer];
    const before = actors.map(actor => [actor.querySelector(".officer-face-outline")!.getAttribute("d"), actor.querySelector(".officer-torso-outline")!.getAttribute("d")]);
    const changed = { ...appearance, runner: { ...appearance.runner, gender: "female" as const }, pursuer: { ...appearance.pursuer, gender: "female" as const } };
    rerender(<InfiniteStairScene state={state} isMoving={false} appearance={changed} />);
    actors.forEach((actor, index) => {
      expect(actor.querySelector(".officer-face-outline")!.getAttribute("d")).not.toBe(before[index][0]);
      expect(actor.querySelector(".officer-torso-outline")!.getAttribute("d")).not.toBe(before[index][1]);
    });
    expect(player).toHaveAttribute("transform", "translate(260 204)");
    expect(lastStair[lastStair.length - 1].compareDocumentPosition(player) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("renders pixel stairs ascending upward with both office characters and no obstacles", () => {
    let state = startInfiniteGame(createInfiniteGameState(() => 0), 0);
    state = applyInfiniteInput(state, "forward", 0);
    const { container } = render(<InfiniteStairScene state={state} isMoving={false} />);
    expect(screen.getByTestId("infinite-stair-scene")).toBeVisible();
    expect(screen.getByTestId("infinite-player")).toHaveAttribute("data-route-index", "1");
    expect(screen.getByTestId("infinite-pursuer")).toBeInTheDocument();
    const stairs = [...container.querySelectorAll<SVGGElement>("[data-testid='infinite-stair-step']")];
    expect(stairs.length).toBeGreaterThan(4);
    const byIndex = new Map(stairs.map((step) => [Number(step.dataset.routeIndex), Number(step.querySelector(".stair-top")?.getAttribute("transform")?.split(" ")[1]?.replace(")", ""))]));
    expect(byIndex.get(1)).toBeGreaterThan(byIndex.get(2)!);
    expect(container.querySelector("[data-testid='stair-obstacle']")).toBeNull();
    expect(container.querySelector("[data-testid='infinite-jump-control']")).toBeNull();
  });
});
