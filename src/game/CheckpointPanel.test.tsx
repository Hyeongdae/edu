import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckpointPanel } from "./CheckpointPanel";

afterEach(cleanup);
describe("CheckpointPanel", () => {
  it.each([[0,"0.00초"],[1,"0.01초"],[1234,"12.34초"],[9000,"90.00초"]] as const)("shows the frozen time%s as%s", (remainingTimeCs, label) => {
    render(<CheckpointPanel stage={1} score={150} remainingTimeCs={remainingTimeCs} onContinue={vi.fn()} onQuit={vi.fn()} disabled={false} />);
    expect(screen.getByText(`남은 시간 ${label}`)).toBeVisible();
  });

  it("reports ranking failure separately from unlock failure and leaves both choices available", () => {
    const onContinue = vi.fn(), onQuit = vi.fn();
    render(<CheckpointPanel stage={1} score={150} remainingTimeCs={1234} onContinue={onContinue} onQuit={onQuit} disabled={false} progressError rankingError />);
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getByText(/기록을 저장하지 못했습니다/)).toBeVisible();
    expect(screen.getByText(/진행도를 저장하지 못했습니다/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    fireEvent.click(screen.getByRole("button", { name: "그만두기" }));
    expect(onContinue).toHaveBeenCalledOnce(); expect(onQuit).toHaveBeenCalledOnce();
  });
  it("labels a modal, focuses Continue and traps Tab without treating Escape as a choice", () => {
    const onContinue = vi.fn(), onQuit = vi.fn();
    render(<CheckpointPanel stage={1} score={152} remainingTimeCs={1234} onContinue={onContinue} onQuit={onQuit} disabled={false} />);
    const panel = screen.getByRole("dialog", { name: "1단계 클리어!" });
    expect(panel).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(/이번 단계 점수 152점/)).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "계속하기" }), quit = screen.getByRole("button", { name: "그만두기" });
    expect(next).toHaveFocus();
    fireEvent.keyDown(next, { key: "Tab", shiftKey: true }); expect(quit).toHaveFocus();
    fireEvent.keyDown(quit, { key: "Tab" }); expect(next).toHaveFocus();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(onContinue).not.toHaveBeenCalled(); expect(onQuit).not.toHaveBeenCalled();
    fireEvent.click(next); expect(onContinue).toHaveBeenCalledOnce();
    fireEvent.click(quit); expect(onQuit).toHaveBeenCalledOnce();
  });
  it("uses native disabled buttons without callbacks", () => {
    const onContinue = vi.fn(), onQuit = vi.fn();
    render(<CheckpointPanel stage={4} score={301} remainingTimeCs={1} onContinue={onContinue} onQuit={onQuit} disabled />);
    for (const button of screen.getAllByRole("button")) { expect(button).toBeDisabled(); fireEvent.click(button); }
    expect(onContinue).not.toHaveBeenCalled(); expect(onQuit).not.toHaveBeenCalled();
  });
  it("keeps a save error inside the scrollable dialog with both choices available", () => {
    const onContinue = vi.fn(), onQuit = vi.fn();
    render(<CheckpointPanel stage={1} score={150} remainingTimeCs={9000} onContinue={onContinue} onQuit={onQuit} disabled={false} progressError />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(screen.getByRole("status"));
    expect(screen.getByRole("status")).toHaveTextContent("진행도를 저장하지 못했습니다");
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    fireEvent.click(screen.getByRole("button", { name: "그만두기" }));
    expect(onContinue).toHaveBeenCalledOnce(); expect(onQuit).toHaveBeenCalledOnce();
  });
});
