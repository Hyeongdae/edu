import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { applyInfiniteInput, createInfiniteGameState, startInfiniteGame } from "./infiniteEngine";
import { InfiniteStairScene } from "./InfiniteStairScene";

afterEach(cleanup);

describe("InfiniteStairScene", () => {
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
