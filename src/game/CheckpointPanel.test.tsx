import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckpointPanel } from "./CheckpointPanel";

afterEach(cleanup);
describe("CheckpointPanel", () => {
  it("labels a modal, focuses Continue and traps Tab without treating Escape as a choice", () => {
    const onContinue = vi.fn(), onQuit = vi.fn();
    render(<CheckpointPanel stage={1} score={402} recordStage={3} onContinue={onContinue} onQuit={onQuit} disabled={false} />);
    const panel = screen.getByRole("dialog", { name: "1단계 클리어!" });
    expect(panel).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(/402점 · 기록 단계 3단계/)).toBeInTheDocument();
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
    render(<CheckpointPanel stage={4} score={1601} recordStage={4} onContinue={onContinue} onQuit={onQuit} disabled />);
    for (const button of screen.getAllByRole("button")) { expect(button).toBeDisabled(); fireEvent.click(button); }
    expect(onContinue).not.toHaveBeenCalled(); expect(onQuit).not.toHaveBeenCalled();
  });
  it("keeps a save error inside the scrollable dialog with both choices available", () => {
    const onContinue = vi.fn(), onQuit = vi.fn();
    render(<CheckpointPanel stage={1} score={400} recordStage={1} onContinue={onContinue} onQuit={onQuit} disabled={false} progressError />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(screen.getByRole("status"));
    expect(screen.getByRole("status")).toHaveTextContent("진행도를 저장하지 못했습니다");
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    fireEvent.click(screen.getByRole("button", { name: "그만두기" }));
    expect(onContinue).toHaveBeenCalledOnce(); expect(onQuit).toHaveBeenCalledOnce();
  });
});
