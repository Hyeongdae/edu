import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createInfiniteGameState } from "./infiniteEngine";
import { InfiniteHud } from "./InfiniteHud";

afterEach(cleanup);

describe("InfiniteHud", () => {
  it("shows score, climbed stairs, pursuer distance, and the 50-step gauge", () => {
    const state = { ...createInfiniteGameState(() => 0), score: 49, stepsClimbed: 49, eventSteps: 49 };
    render(<InfiniteHud state={state} nowMs={0} />);
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("49");
    expect(screen.getByTestId("infinite-steps")).toHaveTextContent("49칸");
    expect(screen.getByTestId("infinite-distance")).toHaveTextContent("4칸");
    expect(screen.getByTestId("infinite-pursuer-speed")).toHaveTextContent("0.20초/칸");
    expect(screen.getByRole("progressbar", { name: "2배 이벤트 진행 게이지" })).toHaveAttribute("aria-valuenow", "49");
  });

  it.each([
    [50, false, "0.19초/칸"],
    [750, false, "0.10초/칸"],
    [0, true, "0.10초/칸"],
  ])("shows the effective pursuer interval at score %i and catch-up %s", (score, isPursuerCatchingUp, expected) => {
    const state = { ...createInfiniteGameState(() => 0), score, isPursuerCatchingUp };
    render(<InfiniteHud state={state} nowMs={0} />);
    expect(screen.getByTestId("infinite-pursuer-speed")).toHaveTextContent(expected);
    expect(screen.getByTestId("infinite-pursuer-speed")).toHaveAccessibleName(`추격 속도 ${expected}`);
  });

  it("shows the active bonus timer and a full gauge", () => {
    const state = { ...createInfiniteGameState(() => 0), status: "playing" as const, eventSteps: 0,
      eventEndsAt: 30_000, nextPursuerStepAt: 300 };
    render(<InfiniteHud state={state} nowMs={12_100} />);
    expect(screen.getByText("2배 점수 · 18초")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });
});
