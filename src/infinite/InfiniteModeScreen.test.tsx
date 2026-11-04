import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameAccount } from "../auth/gameAccount";
import type { AudioController } from "../audio/audioController";
import type { CompanyRecordBinding } from "../company/types";
import { companyProfile } from "../test/companyFixtures";
import { InfiniteModeScreen } from "./InfiniteModeScreen";
import { getDefaultCharacterAppearance } from "../../shared/characterAppearance";

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
  it("updates current scene looks from props without resetting an ongoing score", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const appearance = getDefaultCharacterAppearance(); appearance.runner.hat = "cap";
    const view = render(<InfiniteModeScreen account={account} appearance={appearance} onReturnToTitle={vi.fn()} />);
    expect(screen.getByTestId("infinite-player").querySelector(".officer-cap-hat")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("1");
    const next = { ...appearance,
      runner: { ...appearance.runner, eyeStyle: "smile" as const, bag: "crossbody" as const, bagColor: "beige" as const },
      pursuer: { ...appearance.pursuer, glasses: "round" as const, eyeStyle: "sharp" as const, bag: "briefcase" as const, bagColor: "navy" as const } };
    view.rerender(<InfiniteModeScreen account={account} appearance={next} onReturnToTitle={vi.fn()} />);
    expect(screen.getByTestId("infinite-pursuer").querySelector(".officer-glasses--round")).not.toBeNull();
    expect(screen.getByTestId("infinite-player").querySelector('[data-bag-kind="crossbody"] .officer-bag-fill')).toHaveAttribute("fill", "#c8b38b");
    expect(screen.getByTestId("infinite-player").querySelector(".officer-eyes")).toHaveAttribute("data-eye-style", "smile");
    expect(screen.getByTestId("infinite-pursuer").querySelector('[data-bag-kind="briefcase"] .officer-bag-fill')).toHaveAttribute("fill", "#30466d");
    expect(screen.getByTestId("infinite-pursuer").querySelector(".officer-eyes")).toHaveAttribute("data-eye-style", "sharp");
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("1");
    const actors = [screen.getByTestId("infinite-player"), screen.getByTestId("infinite-pursuer")];
    const before = actors.map(actor => [actor.querySelector(".officer-face-outline")!.getAttribute("d"), actor.querySelector(".officer-torso-outline")!.getAttribute("d")]);
    view.rerender(<InfiniteModeScreen account={account} appearance={{ ...next,
      runner: { ...next.runner, gender: "female" }, pursuer: { ...next.pursuer, gender: "female" } }} onReturnToTitle={vi.fn()} />);
    actors.forEach((actor, index) => {
      expect(actor.querySelector(".officer-face-outline")!.getAttribute("d")).not.toBe(before[index][0]);
      expect(actor.querySelector(".officer-torso-outline")!.getAttribute("d")).not.toBe(before[index][1]);
    });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("1");
  });
  it("shows pause only after starting and resumes an interrupted start countdown after three seconds", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T00:00:00.000Z"));
    const sound = audio();
    render(<InfiniteModeScreen account={account} audioController={sound} onReturnToTitle={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "일시정지" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    expect(screen.getByRole("button", { name: "일시정지" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    expect(sound.stopBgm).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: "무한 모드 일시정지" })).toBeVisible();
    vi.mocked(sound.startBgm).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "게임 재개" }));
    expect(screen.getByText("게임 재개").closest("section")).toHaveTextContent("3");
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("0");
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("0");
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(sound.startBgm).toHaveBeenCalledOnce();
    expect(screen.getByTestId("infinite-distance")).toHaveTextContent("4칸");
    expect(screen.queryByRole("dialog", { name: "무한 모드 일시정지" })).not.toBeInTheDocument();
  });

  it("freezes infinite score, event clock, pursuit, and input through pause and resume countdown", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T00:00:00.000Z"));
    const company = records();
    const sound = audio();
    render(<InfiniteModeScreen account={account} companyRecords={company} audioController={sound} onReturnToTitle={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("1");
    const distance = screen.getByTestId("infinite-distance").textContent;
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    fireEvent.keyDown(window, { key: "d" });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("1");
    expect(screen.getByTestId("infinite-distance")).toHaveTextContent(distance!);
    expect(screen.getByTestId("infinite-steps")).toHaveTextContent("계단 1칸 올라옴");
    expect(company.submitInfiniteScore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "게임 재개" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("1");
    expect(screen.getByTestId("infinite-distance")).toHaveTextContent(distance!);
    expect(company.submitInfiniteScore).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("1");
    expect(screen.getByTestId("infinite-distance")).toHaveTextContent(distance!);
  });

  it("confirms restart, returns No to pause actions, and only submits a result after actual game over", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T00:00:00.000Z"));
    const company = records();
    render(<InfiniteModeScreen account={account} companyRecords={company} onReturnToTitle={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    fireEvent.click(document.querySelector<HTMLButtonElement>(".pause-menu-actions button:nth-child(2)")!);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".pause-menu-confirmation-actions button:nth-child(2)")!);
    expect(screen.getByRole("dialog", { name: "무한 모드 일시정지" })).toBeVisible();
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("1");
    fireEvent.click(document.querySelector<HTMLButtonElement>(".pause-menu-actions button:nth-child(2)")!);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".pause-menu-confirmation-actions button:nth-child(1)")!);
    expect(screen.getByText("게임 재개").closest("section")).toHaveTextContent("3");
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("0");
    expect(company.submitInfiniteScore).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByTestId("infinite-score")).toHaveTextContent("0");
    expect(company.submitInfiniteScore).not.toHaveBeenCalled();
  });

  it("requires title confirmation and invokes the title callback only for Yes", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-03T00:00:00.000Z"));
    const onReturnToTitle = vi.fn();
    render(<InfiniteModeScreen account={account} onReturnToTitle={onReturnToTitle} />);
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    fireEvent.click(document.querySelector<HTMLButtonElement>(".pause-menu-actions button:nth-child(3)")!);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".pause-menu-confirmation-actions button:nth-child(2)")!);
    expect(onReturnToTitle).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "무한 모드 일시정지" })).toBeVisible();
    fireEvent.click(document.querySelector<HTMLButtonElement>(".pause-menu-actions button:nth-child(3)")!);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".pause-menu-confirmation-actions button:nth-child(1)")!);
    expect(onReturnToTitle).toHaveBeenCalledOnce();
  });

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
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    expect(screen.getByRole("heading", { name: "무한 모드" })).toBeVisible();
    expect(screen.getByRole("region", { name: "무한 모드 기록" })).toBeVisible();
    expect(screen.getByRole("region", { name: "위로 올라가는 계단 장면" })).toBeVisible();
    expect(screen.getByTestId("infinite-distance")).toHaveTextContent("3칸");
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
