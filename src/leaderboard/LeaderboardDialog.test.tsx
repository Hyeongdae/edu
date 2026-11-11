import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeaderboardEntry } from "./leaderboard";
import type { SharedInfiniteBest } from "../../shared/companyRecords";
import { LeaderboardDialog } from "./LeaderboardDialog";
import { handleDirectionalMenuNavigation } from "../game/directionalMenuNavigation";

afterEach(cleanup);

const entries: LeaderboardEntry[] = [
  { accountId: "runner", displayName: "계단왕", bestStage: 3, bestScore: 640, remainingTimeCs: 1234, achievedAt: "2026-10-30" },
];

function renderDialog(onClose = vi.fn(), onKeyDown = vi.fn(), infiniteV1Entries: SharedInfiniteBest[] = [], infiniteV2Entries: SharedInfiniteBest[] = []) {
  return render(<LeaderboardDialog entries={entries} infiniteV1Entries={infiniteV1Entries} infiniteV2Entries={infiniteV2Entries}
    currentAccountId="runner" scope="company" onClose={onClose}
    closeButtonRef={createRef<HTMLButtonElement>()} dialogRef={createRef<HTMLElement>()} onKeyDown={onKeyDown} />);
}

describe("LeaderboardDialog", () => {
  it("opens on v2 and shows an accessible company modal", () => {
    renderDialog(vi.fn(), vi.fn(), [], [{ accountId: "runner", displayName: "계단왕", bestScore: 80, achievedAt: "2026-10-30T00:00:00.000Z" }]);
    const dialog = screen.getByRole("dialog", { name: "최고 기록 랭킹" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("tab", { name: "무한모드 v2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "infinite-v2-ranking-tab");
    expect(screen.getByText("계단왕")).toBeVisible();
    expect(screen.getByText("80점")).toBeVisible();
    expect(screen.queryByText("640점")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "랭킹 닫기" })).toBeVisible();
  });

  it("switches among stage, historical v1, and current v2 without mixing rows", () => {
    renderDialog(vi.fn(), vi.fn(),
      [{ accountId: "runner", displayName: "계단왕", bestScore: 80, achievedAt: "2026-10-30T00:00:00.000Z" }],
      [{ accountId: "runner", displayName: "계단왕", bestScore: 450, achievedAt: "2026-10-31T00:00:00.000Z" }]);
    fireEvent.click(screen.getByRole("tab", { name: "단계 모드" }));
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "stage-ranking-tab");
    expect(screen.getByText("3단계")).toBeVisible();
    expect(screen.queryByText("80점")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "무한모드 v1" }));
    expect(screen.getByText("80점")).toBeVisible();
    expect(screen.queryByText("450점")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "무한모드 v2" }));
    expect(screen.getByText("450점")).toBeVisible();
    expect(screen.queryByText("80점")).not.toBeInTheDocument();
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

  it("navigates from the close action through all tabs with wraparound, Home, and End", () => {
    render(<main onKeyDown={handleDirectionalMenuNavigation}><LeaderboardDialog entries={entries} currentAccountId="runner"
      scope="company" onClose={vi.fn()} closeButtonRef={createRef<HTMLButtonElement>()}
      dialogRef={createRef<HTMLElement>()} onKeyDown={handleDirectionalMenuNavigation} /></main>);
    const close = screen.getByRole("button", { name: "랭킹 닫기" });
    const stageTab = screen.getByRole("tab", { name: "단계 모드" });
    const v1Tab = screen.getByRole("tab", { name: "무한모드 v1" });
    const v2Tab = screen.getByRole("tab", { name: "무한모드 v2" });
    close.focus();
    fireEvent.keyDown(close, { key: "ArrowDown" });
    expect(stageTab).toHaveFocus();
    fireEvent.keyDown(stageTab, { key: "ArrowRight" });
    expect(v1Tab).toHaveFocus();
    expect(v1Tab).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(v1Tab, { key: "ArrowRight" });
    expect(v2Tab).toHaveFocus();
    fireEvent.keyDown(v2Tab, { key: "ArrowRight" });
    expect(stageTab).toHaveFocus();
    fireEvent.keyDown(stageTab, { key: "ArrowLeft" });
    expect(v2Tab).toHaveFocus();
    fireEvent.keyDown(v2Tab, { key: "Home" });
    expect(stageTab).toHaveFocus();
    fireEvent.keyDown(stageTab, { key: "End" });
    expect(v2Tab).toHaveFocus();
    expect(v2Tab).toHaveAttribute("aria-selected", "true");
  });
});
