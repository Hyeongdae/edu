import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { describe, expect, it } from "vitest";
import { StageTransitionCountdown } from "./StageTransitionCountdown";

describe("StageTransitionCountdown", () => {
  afterEach(cleanup);
  it.each([3, 2, 1] as const)("announces %i and the next stage", (secondsRemaining) => {
    render(<StageTransitionCountdown nextStage={2} secondsRemaining={secondsRemaining} />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByText("2단계 시작")).toBeVisible();
    expect(screen.getByLabelText(`${secondsRemaining}초`)).toHaveTextContent(String(secondsRemaining));
  });
});
