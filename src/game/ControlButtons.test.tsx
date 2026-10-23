import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ControlButtons } from "./ControlButtons";

const OriginalPointerEvent = window.PointerEvent;
beforeEach(() => {
  // jsdom's MouseEvent fallback drops primary-pointer information.
  class TestPointerEvent extends MouseEvent {
    readonly isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.isPrimary = init.isPrimary ?? false;
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); expect(window.PointerEvent).toBe(OriginalPointerEvent); });

describe("ControlButtons immediate actions", () => {
  it.each([0, 1, 2])("runs action %s on primary down once, without a second pointer click/up action", (index) => {
    const actions = [vi.fn(), vi.fn(), vi.fn()];
    render(<ControlButtons onForward={actions[0]} onTurn={actions[1]} onJump={actions[2]} disabled={false} />);
    const button = screen.getAllByRole("button")[index];
    expect(fireEvent.pointerDown(button, { button: 0, isPrimary: true })).toBe(false);
    expect(actions[index]).toHaveBeenCalledOnce();
    fireEvent.pointerUp(button, { button: 0, isPrimary: true });
    fireEvent.click(button, { detail: 1 });
    fireEvent.pointerCancel(button);
    expect(actions[index]).toHaveBeenCalledOnce();
    fireEvent.click(button, { detail: 0 });
    expect(actions[index]).toHaveBeenCalledTimes(2);
    expect(actions.filter((_, i) => i !== index).every((action) => action.mock.calls.length === 0)).toBe(true);
  });

  it.each([false, true])("rejects nonprimary/right down and disabled activations (disabled=%s)", (disabled) => {
    const action = vi.fn();
    render(<ControlButtons onForward={action} onTurn={action} onJump={action} disabled={disabled} />);
    for (const button of screen.getAllByRole("button")) {
      fireEvent.pointerDown(button, { button: 0, isPrimary: false });
      fireEvent.pointerDown(button, { button: 2, isPrimary: true });
      if (disabled) {
        fireEvent.pointerDown(button, { button: 0, isPrimary: true });
        fireEvent.click(button, { detail: 0 });
      }
    }
    expect(action).not.toHaveBeenCalled();
  });

  it("places turn beside jump after forward with accessible names", () => {
    render(<ControlButtons onForward={vi.fn()} onTurn={vi.fn()} onJump={vi.fn()} disabled={false} />);
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label")))
      .toEqual(["앞으로 한 칸 오르기", "방향을 바꾸며 오르기", "장애물을 뛰어넘기"]);
    expect(screen.getByRole("button", { name: "장애물을 뛰어넘기" }).parentElement).toBe(screen.getByRole("button", { name: "방향을 바꾸며 오르기" }).parentElement);
    expect(screen.getByRole("button", { name: "앞으로 한 칸 오르기" }).parentElement).toHaveAccessibleName("게임 조작");
  });
});
