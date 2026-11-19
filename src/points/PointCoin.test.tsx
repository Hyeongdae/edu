import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PointCoin, PlayerStepEffect } from "./PointCoin";

describe("pixel point pickups", () => {
  it("exposes the coin and the stair it belongs to", () => {
    render(<svg><PointCoin stairIndex={8} /></svg>);
    expect(screen.getByLabelText("포인트 코인")).toHaveAttribute("data-stair-index", "8");
  });
  it.each(["fire", "sparkle", "smoke"] as const)("renders the %s footstep effect variant", (effect) => {
    const { getByTestId } = render(<svg><PlayerStepEffect effect={effect} animationKey={1} /></svg>);
    expect(getByTestId("player-step-effect")).toHaveAttribute("data-effect", effect);
    if (effect === "fire") {
      expect(getByTestId("player-step-effect").querySelector(".step-fire-flames")).not.toBeNull();
      expect(getByTestId("player-step-effect").querySelector(".step-fire-flames")).toHaveAttribute("transform", "scale(1.4)");
      expect(getByTestId("player-step-effect").querySelector(".step-fire-flame--right")).toHaveClass("step-fire-flame--right");
      expect(getByTestId("player-step-effect")).toHaveStyle({ transformBox: "fill-box", transformOrigin: "center bottom" });
    }
  });
});
afterEach(cleanup);

