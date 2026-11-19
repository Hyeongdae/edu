import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PointGainFeedback } from "./PointGainFeedback";

afterEach(() => vi.useRealTimers());

describe("confirmed point feedback", () => {
  it("announces only confirmed revision changes and queues rapid gains", () => {
    vi.useFakeTimers();
    const { rerender } = render(<PointGainFeedback revision={0} />);
    expect(screen.queryByTestId("point-gain-feedback")).toBeNull();
    rerender(<PointGainFeedback revision={2} />);
    expect(screen.getByRole("status")).toHaveTextContent("+1");
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByRole("status")).toHaveTextContent("+1");
    act(() => vi.advanceTimersByTime(700));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
