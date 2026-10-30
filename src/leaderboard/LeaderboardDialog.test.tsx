import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeaderboardEntry } from "./leaderboard";
import { LeaderboardDialog } from "./LeaderboardDialog";

afterEach(cleanup);

const entries: LeaderboardEntry[] = [
  { accountId: "runner", displayName: "계단왕", bestStage: 3, bestScore: 640, remainingTimeCs: 1234, achievedAt: "2026-10-30" },
];

function renderDialog(onClose = vi.fn(), onKeyDown = vi.fn()) {
  return render(<LeaderboardDialog entries={entries} currentAccountId="runner" scope="company" onClose={onClose}
    closeButtonRef={createRef<HTMLButtonElement>()} dialogRef={createRef<HTMLElement>()} onKeyDown={onKeyDown} />);
}

describe("LeaderboardDialog", () => {
  it("shows the existing ranking panel in an accessible company modal", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "최고 기록 랭킹" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("계단왕")).toBeVisible();
    expect(screen.getByText("3단계")).toBeVisible();
    expect(screen.getByText("640점")).toBeVisible();
    expect(screen.getByRole("button", { name: "랭킹 닫기" })).toBeVisible();
  });

  it("delegates keyboard handling and closes from the close button", () => {
    const onClose = vi.fn();
    const onKeyDown = vi.fn();
    renderDialog(onClose, onKeyDown);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onKeyDown).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "랭킹 닫기" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes only when the backdrop itself is clicked", () => {
    const onClose = vi.fn();
    const { container } = renderDialog(onClose);
    const backdrop = container.querySelector(".leaderboard-dialog-backdrop")!;
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
