import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StageSelectPanel } from "./StageSelectPanel";

afterEach(cleanup);
describe("StageSelectPanel", () => {
  it.each([0, 1, 2, 3, 4, 5] as const)("unlocks the next stage with highest=%s and focuses the default", (highest) => {
    const selected = Math.min(5, highest + 1) as 1|2|3|4|5;
    const onSelect = vi.fn(), onStart = vi.fn(), onOpenLeaderboard = vi.fn();
    render(<StageSelectPanel selectedStage={selected} highestClearedStage={highest} onSelect={onSelect}
      onStart={onStart} onOpenLeaderboard={onOpenLeaderboard} disabled={false} progressUnavailable={false} />);
    const panel = screen.getByRole("region", { name: "단계 선택" });
    expect(within(panel).getByRole("heading", { name: "시작 단계를 선택하세요" })).toBeVisible();
    const buttons = within(panel).getAllByRole("button");
    expect(buttons).toHaveLength(7);
    for (let stage = 1; stage <= 5; stage++) {
      const locked = stage > Math.min(5, highest + 1);
      expect(buttons[stage - 1]).toHaveAccessibleName(`${stage}단계 ${locked ? "잠김" : "선택"}`);
      expect(buttons[stage - 1]).toHaveAttribute("aria-pressed", String(stage === selected));
      if (locked) { expect(buttons[stage - 1]).toBeDisabled(); fireEvent.click(buttons[stage - 1]); }
      else expect(buttons[stage - 1]).toBeEnabled();
    }
    expect(screen.queryByRole("button", { name: /0단계/ })).not.toBeInTheDocument();
    expect(buttons[selected - 1]).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText(`이번 단계 0점부터 · 목표 ${100+50*selected}점`)).toBeVisible();
    expect(within(panel).getByRole("button", { name: "랭킹 보기" })).toBeEnabled();
    if (highest > 0) expect(screen.getByText(`최고 클리어 ${highest}단계`)).toBeVisible();
    else expect(screen.queryByText(/최고 클리어/)).not.toBeInTheDocument();
  });

  it("uses one native click per selection or Start and leaves Escape/Space/Enter to native behavior", () => {
    const onSelect = vi.fn(), onStart = vi.fn(), onOpenLeaderboard = vi.fn();
    render(<StageSelectPanel selectedStage={2} highestClearedStage={3} onSelect={onSelect}
      onStart={onStart} onOpenLeaderboard={onOpenLeaderboard} disabled={false} progressUnavailable={false} />);
    expect(screen.getByText("선택: 2단계 · 제한시간 01:15")).toBeVisible();
    const first = screen.getByRole("button", { name: "1단계 선택" });
    fireEvent.pointerDown(first); expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(first); expect(onSelect).toHaveBeenCalledExactlyOnceWith(1);
    const start = screen.getByRole("button", { name: "시작하기" });
    for (const key of ["Escape", "Enter", " "]) fireEvent.keyDown(start, { key });
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(start, { detail: 0 }); expect(onStart).toHaveBeenCalledOnce();
    const leaderboard = screen.getByRole("button", { name: "랭킹 보기" });
    fireEvent.click(leaderboard);
    expect(onOpenLeaderboard).toHaveBeenCalledExactlyOnceWith(leaderboard);
  });

  it("disables all actions while keeping unavailable-progress guidance visible", () => {
    const onSelect = vi.fn(), onStart = vi.fn(), onOpenLeaderboard = vi.fn();
    render(<StageSelectPanel selectedStage={1} highestClearedStage={5} onSelect={onSelect}
      onStart={onStart} onOpenLeaderboard={onOpenLeaderboard} disabled progressUnavailable />);
    for (const button of screen.getAllByRole("button")) { expect(button).toBeDisabled(); fireEvent.click(button); }
    expect(onSelect).not.toHaveBeenCalled(); expect(onStart).not.toHaveBeenCalled(); expect(onOpenLeaderboard).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("진행도를 읽지 못했습니다. 확인된 클리어 이력과 이번 플레이 진행도를 사용합니다.");
  });
});
