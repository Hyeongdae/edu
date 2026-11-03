import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameAccount } from "../auth/gameAccount";
import type { AudioController } from "../audio/audioController";
import type { CompanyRecordBinding } from "../company/types";
import { companyProfile } from "../test/companyFixtures";
import { InfiniteModeScreen } from "./InfiniteModeScreen";

const account: GameAccount = { homeAccountId: "employee-a", username: "employee@example.com", name: "회사원 A" };
function records(): CompanyRecordBinding {
  return { profile: companyProfile(), entries: [], infiniteEntries: [], syncStatus: "idle", pendingCount: 0,
    errorMessage: null, submitResult: vi.fn(), submitInfiniteScore: vi.fn(), retry: vi.fn(), refresh: vi.fn() };
}
function audio(): AudioController {
  return { startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(), setPreferences: vi.fn(),
    playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn() };
}

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("InfiniteModeScreen", () => {
  it("starts on a 3-2-1 overlay, ignores countdown input, and omits the jump button", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T00:00:00.000Z"));
    const sound = audio();
    render(<InfiniteModeScreen account={account} audioController={sound} onReturnToTitle={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "무한 모드 준비 완료" })).toBeVisible();
    expect(screen.getByRole("button", { name: "게임 시작" })).toBeVisible();
    expect(screen.getByRole("button", { name: "랭킹 보기" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "랭킹 보기" }));
    expect(screen.getByRole("dialog", { name: "최고 기록 랭킹" })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "무한 모드" }));
    expect(screen.getByText("회사 계정으로 접속하면 무한 모드 랭킹이 기록됩니다.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "랭킹 닫기" }));
    expect(screen.getByRole("button", { name: "랭킹 보기" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    expect(sound.startBgm).toHaveBeenCalledOnce();
    expect(screen.getByText("무한 모드 시작").closest("section")).toHaveAttribute("aria-live", "assertive");
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("0");
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.queryByRole("button", { name: "장애물을 뛰어넘기" })).not.toBeInTheDocument();
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("0");
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("1");
    expect(sound.playFootstep).toHaveBeenCalledOnce();
  });

  it("shows the fall before result, saves once, and retries with another countdown", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T00:00:00.000Z"));
    const company = records();
    const onReturnToTitle = vi.fn();
    render(<InfiniteModeScreen account={account} companyRecords={company} onReturnToTitle={onReturnToTitle} />);
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    fireEvent.keyDown(window, { key: "j" });
    expect(company.submitInfiniteScore).toHaveBeenCalledExactlyOnceWith({ score: 0 });
    expect(screen.queryByRole("heading", { name: "계단에서 넘어졌어요" })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByRole("heading", { name: "계단에서 넘어졌어요" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다시하기" }));
    expect(screen.getByText("무한 모드 시작").closest("section")).toHaveAttribute("aria-live", "assertive");
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    fireEvent.keyDown(window, { key: "j" });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    fireEvent.click(screen.getByRole("button", { name: "메인 타이틀로" }));
    expect(onReturnToTitle).toHaveBeenCalledOnce();
  });
});
