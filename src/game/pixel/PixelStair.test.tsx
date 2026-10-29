import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PixelStair } from "./PixelStair";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const TOP_OUTLINE = "M-4-24H4V-22H10V-20H16V-18H22V-16H28V-14H34V-10H28V-8H22V-6H16V-4H10V-2H4V0H-4V-2H-10V-4H-16V-6H-22V-8H-28V-10H-34V-14H-28V-16H-22V-18H-16V-20H-10V-22H-4Z";
const FRONT_OUTLINE = "M-34-12H-28V-10H-22V-8H-16V-6H-10V-4H-4V-2H4V-4H10V-6H16V-8H22V-10H28V-12H34V4H28V6H22V8H16V10H10V12H4V16H-4V12H-10V10H-16V8H-22V6H-28V4H-34Z";

describe("concrete emergency stair art", () => {
  it.each(["left", "right"] as const)("keeps the original top footprint and a contrasting%s direction mark", direction => {
    const { container } = render(<svg><PixelStair face="top" direction={direction} /></svg>);
    const stair = container.querySelector(".pixel-stair--top")!;
    expect(stair).toHaveAttribute("aria-hidden", "true"); expect(stair).toHaveAttribute("shape-rendering", "crispEdges");
    expect(stair.firstElementChild).toHaveAttribute("d", TOP_OUTLINE);
    expect(stair.firstElementChild).toHaveAttribute("fill", "#aeb7bf");
    expect(stair.querySelector('[fill="#d9dee2"]')).not.toBeNull();
    expect(stair.querySelectorAll('[fill="#8c98a3"]')).toHaveLength(3);
    expect(stair.querySelector('g[fill="#223043"]')).toHaveAttribute("transform", `translate(${direction === "right" ? 7 : -7} -14) scale(${direction === "right" ? 1 : -1} 1)`);
    expect(stair.querySelector('[transform*="scale(1 -1)"]')).toBeNull();
  });

  it.each(["left", "right"] as const)("keeps the original front and yellow safety edge facing%s", direction => {
    const { container } = render(<svg><PixelStair face="front" direction={direction} /></svg>);
    const stair = container.querySelector(".pixel-stair--front")!;
    expect(stair.firstElementChild).toHaveAttribute("d", FRONT_OUTLINE);
    expect(stair.firstElementChild).toHaveAttribute("fill", "#172333");
    for (const fill of ["#64717d", "#46535f", "#f3ca58", "#b98e30"]) expect(stair.querySelector(`[fill="${fill}"]`)).not.toBeNull();
    expect(stair.querySelector('[fill="#61e8e1"]')).toBeNull();
    expect(stair).not.toHaveAttribute("transform");
  });

  it("uses fixed in-bounds surface marks and consumes no randomness when rerendering", () => {
    const random = vi.spyOn(Math, "random");
    const draw = <svg><PixelStair face="top" direction="right" /><PixelStair face="front" direction="right" /></svg>;
    const view = render(draw), html = view.container.innerHTML;
    for (const rect of view.container.querySelectorAll("rect")) {
      const x = Number(rect.getAttribute("x")), y = Number(rect.getAttribute("y"));
      expect(x).toBeGreaterThanOrEqual(-34); expect(y).toBeGreaterThanOrEqual(-24);
      expect(x + Number(rect.getAttribute("width"))).toBeLessThanOrEqual(34);
      expect(y + Number(rect.getAttribute("height"))).toBeLessThanOrEqual(16);
    }
    view.rerender(<svg><PixelStair face="top" direction="right" /><PixelStair face="front" direction="right" /></svg>);
    expect(view.container.innerHTML).toBe(html); expect(random).not.toHaveBeenCalled();
    expect(view.container.querySelectorAll(".pixel-stair--top")).toHaveLength(1);
    expect(view.container.querySelectorAll(".pixel-stair--front")).toHaveLength(1);
  });
});
