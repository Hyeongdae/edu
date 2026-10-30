import * as stairObstacles from "./stairObstacles";
import { makeObstacleFixture, withObstacle } from "../test/obstacleFixtures";
import { act, cleanup, fireEvent, render as renderBase, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import { GameScreen } from "./GameScreen";
import { StairScene } from "./StairScene";
import { createGameState } from "./gameEngine";
import * as gameEngine from "./gameEngine";
import { getStageRule } from "./stageRules";
import type { GameStage, GameState } from "./types";
import { withPursuitAt } from "../test/gameFixtures";
import { getRouteStep } from "./stairRoute";
import type { AudioController } from "../audio/audioController";
import { DEFAULT_AUDIO_PREFERENCES } from "../audio/audioPreferences";
import { DESCENT_LEADERBOARD_KEY, DESCENT_PROGRESS_KEY } from "./recordStorage";
import type { CompanyRecordBinding } from "../company/types";
import { companyProfile } from "../test/companyFixtures";

function companyBinding(highestClearedStage: CompanyRecordBinding["profile"]["highestClearedStage"] = 0): CompanyRecordBinding {
  return { profile: companyProfile({ accountId: account.homeAccountId, highestClearedStage }), entries: [],
    syncStatus: "idle", pendingCount: 0, errorMessage: null, submitResult: vi.fn(), retry: vi.fn(), refresh: vi.fn() };
}

const account = {
  homeAccountId: "local-account",
  environment: "login.microsoftonline.com",
  tenantId: "tenant-id",
  username: "player@example.com",
  localAccountId: "player",
  name: "홍길동",
} satisfies AccountInfo;

function render(ui: Parameters<typeof renderBase>[0]) {
  const view = renderBase(ui);
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: true }),
  });
  fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
  if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
  else Reflect.deleteProperty(window, "matchMedia");
  return view;
}

function nextClimbKey(): "d" | "j" {
  return screen.getByTestId("route-direction").textContent === "지금 방향을 바꾸세요" ? "j" : "d";
}

function climbOneStep(): void {
  fireEvent.keyDown(window, { key: nextClimbKey() });
}

function seedReadyStage(stage: GameStage, overrides: Partial<GameState> = {}, durationMs?: number): void {
  const originalFactory = gameEngine.createGameState;
  const originalStart = gameEngine.startGame;
  vi.spyOn(gameEngine, "createGameState").mockImplementation(() => ({
    ...withPursuitAt({ ...originalFactory(() => 0, { stage, highestClearedStage: stage === 1 ? 0 : stage }), stage, score: getStageRule(stage).scoreRequired - 1, ...overrides }, 0, overrides.pursuerDistance ?? 4),
  }));
  vi.spyOn(gameEngine, "startGame").mockImplementation((state, now) => {
    const started = originalStart(state, now);
    return state.status === "ready"
      ? withPursuitAt({ ...started, stage: state.stage, stageEndsAt: now + (durationMs ?? getStageRule(state.stage).durationMs) }, now, state.pursuerDistance)
      : started;
  });
}

function mockMotionPreference(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return matches; },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  })));
  return { listeners, change(value: boolean) {
    matches = value;
    act(() => { for (const listener of [...listeners]) listener(); });
  } };
}

describe("company record persistence", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("uses confirmed server unlocks and never reads or migrates local score/progress data", () => {
    const records = companyBinding(2);
    const read = vi.spyOn(Storage.prototype, "getItem");
    const write = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    render(<GameScreen account={account} companyRecords={records} />);
    expect(screen.getByRole("button", { name: "3단계 선택" })).toHaveAttribute("aria-pressed", "true");
    expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  });

  it("opens newly restored stages without resetting an intentionally selected lower stage", () => {
    const records = companyBinding(2);
    const view = render(<GameScreen account={account} companyRecords={records} />);
    fireEvent.click(screen.getByRole("button", { name: "1단계 선택" }));
    view.rerender(<GameScreen account={account} companyRecords={{ ...records, profile: { ...records.profile, highestClearedStage: 4 } }} />);
    expect(screen.getByRole("button", { name: "1단계 선택" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "5단계 선택" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "5단계 선택" }));
    expect(screen.getByRole("button", { name: "5단계 선택" })).toHaveAttribute("aria-pressed", "true");
  });

  it("submits the clear once and continues immediately while its cloud save is pending or failed", () => {
    seedReadyStage(1);
    const records = companyBinding();
    const write = vi.spyOn(Storage.prototype, "setItem");
    const view = render(<GameScreen account={account} companyRecords={records} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    expect(records.submitResult).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ stage: 1, score: 150, outcome: "cleared" }));
    view.rerender(<GameScreen account={account} companyRecords={{ ...records, syncStatus: "error", pendingCount: 1, errorMessage: "사내 저장 실패" }} />);
    expect(screen.getByText("사내 저장 실패")).toBeVisible();
    expect(screen.getByRole("button", { name: "그만두기" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    expect(screen.getByTestId("stage-value")).toHaveTextContent("2단계");
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
    expect(records.submitResult).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
  });

  it("does not pause or restart the active clock on cloud status rerenders", async () => {
    seedReadyStage(1, { score: 0 });
    const records = companyBinding();
    const view = render(<GameScreen account={account} companyRecords={records} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:29");
    view.rerender(<GameScreen account={account} companyRecords={{ ...records, syncStatus: "error", pendingCount: 1 }} />);
    climbOneStep();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:28");
    expect(records.submitResult).not.toHaveBeenCalled();
  });

  it("queues a captured snapshot before the office scene and does not resubmit after status changes", async () => {
    seedReadyStage(1, { score: 80, pursuerDistance: 1 }); mockMotionPreference(false);
    const records = companyBinding();
    const view = render(<GameScreen account={account} companyRecords={records} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(records.submitResult).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ score: 80, outcome: "caught", endedAtMs: 500 }));
    expect(screen.queryByTestId("overtime-capture-ending")).not.toBeInTheDocument();
    view.rerender(<GameScreen account={account} companyRecords={{ ...records, syncStatus: "saving", pendingCount: 1 }} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByRole("dialog", { name: "야근 사무실" })).toBeVisible();
    expect(records.submitResult).toHaveBeenCalledTimes(1);
  });

  it("saves a final clear before the exit scene and preserves its four-second duration during retries", async () => {
    seedReadyStage(5); mockMotionPreference(false);
    const records = companyBinding(4);
    const view = render(<GameScreen account={account} companyRecords={records} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    expect(records.submitResult).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ stage: 5, outcome: "cleared" }));
    expect(screen.getByRole("dialog", { name: "오늘도 수고했어요!" })).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    view.rerender(<GameScreen account={account} companyRecords={{ ...records, syncStatus: "error", errorMessage: "공유 저장 오류" }} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(screen.getByRole("heading", { name: "퇴근 완료!" })).toBeVisible();
    expect(screen.getByText("COMPANY RANKING")).toBeVisible();
    expect(screen.queryByText("THIS BROWSER")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "기록 저장 다시 시도" }));
    expect(records.retry).toHaveBeenCalledOnce(); expect(records.submitResult).toHaveBeenCalledOnce();
  });
});

describe("local record policy", () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it("ignores stored local ranking and progress keys", async () => {
    vi.useFakeTimers();
    localStorage.setItem(DESCENT_LEADERBOARD_KEY, "[]"); localStorage.setItem(DESCENT_PROGRESS_KEY, "[]");
    const read=vi.spyOn(Storage.prototype,"getItem"), write=vi.spyOn(Storage.prototype,"setItem");
    renderBase(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(screen.getByTestId("stage-value")).toHaveTextContent("1");
    expect(read.mock.calls.filter(([k])=>k===DESCENT_LEADERBOARD_KEY||k===DESCENT_PROGRESS_KEY)).toEqual([]);
    expect(write.mock.calls.filter(([k])=>k===DESCENT_LEADERBOARD_KEY||k===DESCENT_PROGRESS_KEY)).toEqual([]);
  });
  it("keeps an unlock for this session and returns to stage one after remount", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(1);
    const write=vi.spyOn(Storage.prototype,"setItem");
    const first=renderBase(<GameScreen account={account} />);
    fireEvent.click(screen.getAllByRole("button")[0]); await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
    fireEvent.click(document.querySelector<HTMLButtonElement>(".stage-select-start")!); climbOneStep();
    fireEvent.click(document.querySelector<HTMLButtonElement>(".checkpoint-actions button")!);
    expect(screen.getByTestId("stage-value")).toHaveTextContent("2");
    expect(write.mock.calls.filter(([k])=>k===DESCENT_LEADERBOARD_KEY||k===DESCENT_PROGRESS_KEY)).toEqual([]);
    first.unmount(); renderBase(<GameScreen account={account} />);
    fireEvent.click(screen.getAllByRole("button")[0]); await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
    expect(screen.getByTestId("stage-value")).toHaveTextContent("1");
  });
});

describe("title screen entry", () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("shows the game title and three actions, then opens stage selection without starting play", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const start = vi.spyOn(gameEngine, "startGame");
    renderBase(<GameScreen account={account} />);

    expect(screen.getByRole("heading", { level: 1, name: "덱스 탈출 넘버원" })).toBeVisible();
    expect(screen.getByText("계단을 내려가 1층까지 도착해 퇴근하세요!")).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "게임 시작" })).toBeVisible();
    expect(screen.getByRole("button", { name: "게임 설명" })).toBeVisible();
    expect(screen.getByRole("button", { name: "랭킹 보기" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "단계 선택" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "게임 설정" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "?" })).not.toBeInTheDocument();
    const scene = document.querySelector(".stair-scene");
    expect(scene).toBeInTheDocument();
    expect(document.querySelector(".office-backdrop")).toBeInTheDocument();
    expect(screen.getByTestId("runner")).toBeInTheDocument();
    expect(screen.getByTestId("pursuer")).toBeInTheDocument();
    expect(document.querySelector(".game-stage")).toHaveClass("is-title-background");
    expect(document.querySelector(".game-stage .scene-heading")).toBeInTheDocument();
    expect(document.querySelector(".game-stage .scene-hint")).toBeInTheDocument();
    expect(screen.queryByTestId("stage-time")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    expect(screen.getByRole("region", { name: "단계 선택" })).toBeVisible();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-title-transitioning", "true");
    expect(document.querySelector(".stair-scene")).toBe(scene);
    expect(screen.queryByRole("button", { name: "게임 설명" })).not.toBeInTheDocument();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "ready");
    expect(start).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(document.querySelector(".game-frame")).not.toHaveAttribute("data-title-transitioning");
    expect(document.querySelector(".stair-scene")).toBe(scene);
    expect(screen.getByTestId("stage-value")).toHaveTextContent("1단계");
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:30");

    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(start).toHaveBeenCalledOnce();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
    expect(screen.queryByRole("button", { name: "게임 설명" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "?" })).not.toBeInTheDocument();
  });

  it("opens the same company ranking from title and stage selection, then restores focus and stage", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const records = companyBinding(2);
    records.entries = [{ accountId: "company-runner", displayName: "서버 플레이어", bestStage: 2, bestScore: 430,
      remainingTimeCs: 2150, achievedAt: "2026-10-30T12:00:00.000Z" }];
    const start = vi.spyOn(gameEngine, "startGame");
    renderBase(<GameScreen account={account} companyRecords={records} />);

    const titleTrigger = screen.getByRole("button", { name: "랭킹 보기" });
    fireEvent.click(titleTrigger);
    let dialog = screen.getByRole("dialog", { name: "최고 기록 랭킹" });
    expect(within(dialog).getByText("COMPANY RANKING")).toBeVisible();
    expect(within(dialog).getByText("서버 플레이어")).toBeVisible();
    const closeButton = screen.getByRole("button", { name: "랭킹 닫기" });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(titleTrigger).toHaveFocus();
    expect(screen.queryByRole("region", { name: "단계 선택" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    const stageTwo = screen.getByRole("button", { name: "2단계 선택" });
    fireEvent.click(stageTwo);
    expect(stageTwo).toHaveAttribute("aria-pressed", "true");

    const stageTrigger = screen.getByRole("button", { name: "랭킹 보기" });
    fireEvent.click(stageTrigger);
    dialog = screen.getByRole("dialog", { name: "최고 기록 랭킹" });
    expect(within(dialog).getByText("서버 플레이어")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "랭킹 닫기" }));
    expect(stageTrigger).toHaveFocus();
    expect(screen.getByRole("button", { name: "2단계 선택" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "ready");
    expect(start).not.toHaveBeenCalled();
  });

  it("shows the local no-save explanation instead of browser ranking entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    localStorage.setItem(DESCENT_LEADERBOARD_KEY, JSON.stringify([
      { accountId: account.homeAccountId, displayName: "로컬 기록", bestStage: 1, bestScore: 275,
        remainingTimeCs: 5100, achievedAt: "2026-10-30T11:00:00.000Z" },
    ]));
    renderBase(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: "랭킹 보기" }));
    const dialog = screen.getByRole("dialog", { name: "최고 기록 랭킹" });
    expect(within(dialog).getByText("LOCAL PLAY")).toBeVisible();
    expect(within(dialog).getByText("로컬 플레이 기록은 저장되지 않아요. 회사 게임에 로그인하면 랭킹에 기록됩니다.")).toBeVisible();
    expect(within(dialog).queryByText("로컬 기록")).not.toBeInTheDocument();
  });

  it("skips the title transition when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    renderBase(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));

    expect(screen.getByRole("region", { name: "단계 선택" })).toBeVisible();
    expect(document.querySelector(".game-frame")).not.toHaveAttribute("data-title-transitioning");
    expect(document.querySelector(".game-title-screen")).not.toBeInTheDocument();
  });
});

describe("caught overtime integration", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const wait = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
  const audioFixture = (): AudioController => ({
    startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
    setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn(),
  });
  async function openGame(audioController?: AudioController) {
    const view = renderBase(<StrictMode><GameScreen account={account} audioController={audioController} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    if (document.querySelector(".game-title-screen")) await wait(200);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    return view;
  }

  it("saves on capture, shows the office at 500ms and restores the unchanged result at 2500ms", async () => {
    seedReadyStage(1, { score: 80, pursuerDistance: 1 });
    mockMotionPreference(false);
    const audio = audioFixture(), input = vi.spyOn(gameEngine, "applyInput"), write = vi.spyOn(Storage.prototype, "setItem");
    const view = await openGame(audio);
    await wait(500);
    const frame = document.querySelector(".game-frame");
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    expect(frame).toHaveAttribute("data-game-status", "game-over");
    expect(frame).toHaveAttribute("data-pursuer-catching", "true");
    expect(screen.getByTestId("pursuer")).toHaveClass("is-caught");
    expect(screen.queryByTestId("overtime-capture-ending")).toBeNull();
    expect(document.querySelector(".game-over-panel")).toBeNull();
    expect(screen.getByRole("button", { name: "게임 설정" })).toBeDisabled();
    for (const key of ["d", "j", " "]) fireEvent.keyDown(window, { key });
    expect(input).not.toHaveBeenCalled();

    await wait(499);
    expect(screen.queryByTestId("overtime-capture-ending")).toBeNull();
    await wait(1);
    expect(frame).toHaveAttribute("data-pursuer-catching", "false");
    expect(frame).toHaveAttribute("data-overtime-ending", "true");
    expect(screen.getByRole("dialog", { name: "야근 사무실" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "야근 사무실" })).toHaveFocus();
    expect(document.querySelector(".game-stage")).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelector(".game-stage")).toHaveAttribute("inert");
    expect(document.querySelector(".game-footer")).toHaveAttribute("inert");
    expect(document.querySelector(".game-settings-button")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /다시 시작/ })).toBeNull();
    expect(screen.queryByTestId("office-exit-ending")).toBeNull();
    await wait(1999);
    expect(screen.getByRole("dialog", { name: "야근 사무실" })).toBeInTheDocument();
    await wait(1);
    expect(screen.queryByTestId("overtime-capture-ending")).toBeNull();
    expect(screen.getByRole("heading", { name: "80점" })).toBeVisible();
    expect(screen.getByRole("button", { name: /다시 시작/ })).toHaveFocus();
    expect(document.querySelector(".game-stage")).not.toHaveAttribute("inert");
    expect(document.querySelector(".game-over-time")).toHaveTextContent("남은 시간 89.50초");
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    expect(input).not.toHaveBeenCalled();
    expect(audio.startBgm).toHaveBeenCalledOnce(); expect(audio.stopBgm).toHaveBeenCalledOnce();
    expect(audio.playFootstep).not.toHaveBeenCalled(); expect(audio.playFall).not.toHaveBeenCalled();
    view.unmount(); await wait(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([1, 2, 3, 4, 5] as const)("plays the caught-only office scene at stage %s", async stage => {
    seedReadyStage(stage, { score: 80, pursuerDistance: 1 });
    mockMotionPreference(false);
    await openGame();
    await wait(getStageRule(stage).pursuerStepIntervalMs + 550);
    expect(screen.getByRole("dialog", { name: "야근 사무실" })).toBeVisible();
    expect(screen.queryByTestId("office-exit-ending")).toBeNull();
  });

  it("shows reduced-motion results and the static office before the staircase capture window ends", async () => {
    seedReadyStage(1, { score: 80, pursuerDistance: 1 });
    const motion = mockMotionPreference(true);
    const tick = vi.spyOn(gameEngine, "tickGame"), write = vi.spyOn(Storage.prototype, "setItem");
    await openGame(); await wait(500);
    expect(tick.mock.results.at(-1)!.value.captureEndsAt).toBe(1000);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("overtime-capture-ending")).toHaveAttribute("data-variant", "complete");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByRole("button", { name: /다시 시작/ })).toHaveFocus();
    motion.change(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    await wait(3000);
    expect(screen.getByRole("button", { name: /다시 시작/ })).toBeVisible();
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
  });

  it.each([200, 800])("finishes immediately when reduction is enabled %sms after capture without replaying", async elapsed => {
    seedReadyStage(1, { score: 80, pursuerDistance: 1 });
    const motion = mockMotionPreference(false), write = vi.spyOn(Storage.prototype, "setItem");
    await openGame(); await wait(500 + elapsed);
    expect(document.querySelector(".game-over-panel")).toBeNull();
    motion.change(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("overtime-capture-ending")).toHaveAttribute("data-variant", "complete");
    expect(screen.getByRole("button", { name: /다시 시작/ })).toHaveFocus();
    motion.change(false); await wait(3000);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
  });

  it("starts a fresh office scene after retry with a zero-score stage preview", async () => {
    seedReadyStage(1, { score: 80, pursuerDistance: 1 }); mockMotionPreference(false);
    await openGame(); await wait(3000);
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(screen.getByRole("region", { name: "단계 선택" })).toBeVisible();
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.getByRole("button", { name: "1단계 선택" })).toHaveFocus();
    expect(screen.queryByTestId("overtime-capture-ending")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    await wait(2500); // Fresh game starts four stairs from the pursuer.
    expect(screen.getByRole("dialog", { name: "야근 사무실" })).toBeVisible();
  });

  it("aligns a late visibility entry to the office start rather than replaying its first frame", async () => {
    seedReadyStage(1, { score: 80, pursuerDistance: 1 }); mockMotionPreference(false);
    await openGame(); const startedAt = Date.now();
    vi.setSystemTime(startedAt + 1600); fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("overtime-capture-ending").style.getPropertyValue("--overtime-capture-offset")).toBe("-600ms");
    await wait(1400);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /다시 시작/ })).toHaveFocus();
  });

  it("goes straight to results when returning after the complete presentation deadline", async () => {
    seedReadyStage(1, { score: 80, pursuerDistance: 1 }); mockMotionPreference(false);
    await openGame();
    vi.setSystemTime(Date.now() + 3100); fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByTestId("overtime-capture-ending")).toBeNull();
    expect(screen.getByRole("button", { name: /다시 시작/ })).toHaveFocus();
  });

  it("cleans up pending scenes on unmount and does not let an old deadline finish a remounted run", async () => {
    seedReadyStage(1, { score: 80, pursuerDistance: 1 });
    const motion = mockMotionPreference(false);
    const view = await openGame(); await wait(1000);
    expect(screen.getByRole("dialog", { name: "야근 사무실" })).toBeVisible();
    view.unmount(); await wait(0); expect(vi.getTimerCount()).toBe(0); expect(motion.listeners.size).toBe(0);
    const next = await openGame(); await wait(1800);
    expect(screen.getByRole("dialog", { name: "야근 사무실" })).toBeVisible();
    await wait(1200);
    expect(screen.getByRole("button", { name: /다시 시작/ })).toHaveFocus();
    next.unmount(); await wait(0); expect(vi.getTimerCount()).toBe(0); expect(motion.listeners.size).toBe(0);
  });
});

describe("fifth-stage office exit integration", () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const audioFixture = (): AudioController => ({ startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
    setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn() });
  function mockMotion(initial: boolean) {
    let matches = initial;
    const listeners = new Set<() => void>();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ get matches() { return matches; },
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener) })));
    return { listeners, change(value: boolean) { matches = value; act(() => { for (const listener of [...listeners]) listener(); }); } };
  }

  it("saves before the animation, blocks play and restores result focus at4000ms without saving again", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(5); mockMotion(false);
    const audio = audioFixture(), input = vi.spyOn(gameEngine, "applyInput"), write = vi.spyOn(Storage.prototype, "setItem");
    const view = render(<StrictMode><GameScreen account={account} audioController={audio} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    const calls = input.mock.calls.length;
    expect(screen.getByRole("dialog", { name: "오늘도 수고했어요!" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "오늘도 수고했어요!" })).toHaveFocus();
    expect(document.querySelector(".game-stage")).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelector(".game-stage")).toHaveAttribute("inert");
    expect(document.querySelector(".game-footer")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "게임 설정" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /다시 시작/ })).toBeNull();
    expect(document.querySelector(".game-over-panel")).toBeNull();
    for (const key of ["d", "j", " "]) fireEvent.keyDown(window, { key, code: key === " " ? "Space" : undefined });
    expect(input.mock.calls.length).toBe(calls);
    await act(async () => { await vi.advanceTimersByTimeAsync(3999); });
    expect(screen.getByRole("dialog", { name: "오늘도 수고했어요!" })).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "퇴근 완료!" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "350점" })).toBeVisible();
    const restart = screen.getByRole("button", { name: /다시 시작/ }); expect(restart).toHaveFocus();
    expect(document.querySelector(".game-stage")).not.toHaveAttribute("inert");
    expect(document.querySelector(".game-over-time")).toHaveTextContent("남은 시간 50.00초");
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    expect(audio.playFootstep).toHaveBeenCalledOnce(); expect(audio.playFall).not.toHaveBeenCalled(); expect(audio.stopBgm).toHaveBeenCalledOnce();
    // Browser-native Space activation consists of its key event and the button's click.
    fireEvent.keyDown(restart, { key: " ", code: "Space" }); fireEvent.click(restart);
    expect(screen.getByRole("region", { name: "단계 선택" })).toBeVisible();
    expect(screen.queryByTestId("office-exit-ending")).toBeNull(); expect(input.mock.calls.length).toBe(calls);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    view.unmount(); vi.runAllTicks(); expect(vi.getTimerCount()).toBe(0);
  });

  it("shows a static complete scene and focuses the result immediately with reduced motion", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(5); const motion = mockMotion(true);
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("office-exit-ending")).toHaveAttribute("data-variant", "complete");
    expect(screen.getByRole("button", { name: /다시 시작/ })).toHaveFocus();
    motion.change(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    // Existing score feedback lasts700ms; it is separate from the ending's timer.
    await act(async () => { await vi.advanceTimersByTimeAsync(701); });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("finishes on a live reduce preference change and never resumes that same ending", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(5); const motion = mockMotion(false);
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); motion.change(true);
    expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.getByRole("button", { name: /다시 시작/ })).toHaveFocus();
    motion.change(false); expect(screen.queryByRole("dialog")).toBeNull();
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(screen.queryByTestId("office-exit-ending")).toBeNull();
  });

  it.each(["checkpoint", "quit", "caught", "time-limit"])("keeps the ordinary%s flow without an office exit", async mode => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    if (mode === "checkpoint" || mode === "quit") seedReadyStage(1);
    else seedReadyStage(5, { score: 0, pursuerDistance: 1 }, mode === "time-limit" ? 100 : undefined);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    if (mode === "checkpoint" || mode === "quit") {
      climbOneStep();
      if (mode === "quit") fireEvent.click(screen.getByRole("button", { name: "그만두기" }));
    } else {
      vi.setSystemTime(mode === "time-limit" ? 100 : getStageRule(5).pursuerStepIntervalMs); fireEvent(document, new Event("visibilitychange"));
      await act(async () => { await vi.advanceTimersByTimeAsync(mode === "caught" ? 2501 : 501); });
    }
    expect(screen.queryByTestId("office-exit-ending")).toBeNull();
    if (mode === "checkpoint") expect(screen.getByRole("dialog", { name: "1단계 클리어!" })).toBeVisible();
    else expect(screen.getByRole("button", { name: /다시 시작/ })).toBeEnabled();
  });

  it("removes the pending ending timer and media subscription on unmount", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(5); const motion = mockMotion(false);
    const view = render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    view.unmount(); expect(vi.getTimerCount()).toBe(0); expect(motion.listeners.size).toBe(0);
  });
});

describe("GameScreen controls", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("polls every50ms, animates100ms catch-up and releases at gap6", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const tick = vi.spyOn(gameEngine, "tickGame"), input = vi.spyOn(gameEngine, "applyInput");
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    let preview = gameEngine.startGame(createGameState(() => 0), 0);
    const keys: string[] = [];
    for (let step = 0; step < 11; step++) {
      const turn = getRouteStep(preview.route, preview.stepsClimbed + 1).direction !== preview.direction;
      keys.push(turn ? "j" : "d");
      preview = gameEngine.applyInput(preview, turn ? "turn" : "forward", 0);
    }
    act(() => { for (const key of keys) fireEvent.keyDown(window, { key }); });
    expect(input.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 15, isPursuerCatchingUp: true, nextPursuerStepAt: 100 });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-index", "-4");
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 14, isPursuerCatchingUp: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 7, isPursuerCatchingUp: true });
    expect(screen.getByTestId("pursuer-motion").style.getPropertyValue("--pursuer-step-duration")).toBe("100ms");
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 6, isPursuerCatchingUp: false });
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 6, isPursuerCatchingUp: false });
    expect(screen.getByTestId("pursuer-motion").style.getPropertyValue("--pursuer-step-duration")).toBe("240ms");
  });

  it("starts the game and maps D/J keys to the same engine inputs", () => {
    vi.useFakeTimers();
    render(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent("1");
    expect(screen.getByTestId("score-gain")).toHaveTextContent("+1");
    act(() => {
      vi.advanceTimersByTime(700);
    });

    fireEvent.keyDown(window, { key: "j" });
    expect(screen.queryByText("남은 기회")).not.toBeInTheDocument();
    expect(screen.queryByTestId("score-gain")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "한 칸 내려가기" })).toBeDisabled();
    expect(screen.getByText(/발을 헛디뎠어요/)).toBeVisible();
  });

  it("provides labeled touch controls that call the game rules", () => {
    render(
      <GameScreen
        account={account}
        audioPreferences={DEFAULT_AUDIO_PREFERENCES}
        onAudioPreferencesChange={vi.fn()}
        onEnableAudio={vi.fn()}
      />,
    );

    expect(document.querySelector(".stair-game")).toHaveAttribute("data-game-status", "ready");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "ready");
    expect(screen.getByRole("region", { name: "게임 현황" }).closest(".game-stage")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "계단 장면" }).closest(".game-stage")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "오디오 설정" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    expect(screen.getByRole("region", { name: "오디오 설정" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "설정 닫기" }));

    expect(document.querySelector(".stair-game")).toHaveAttribute("data-game-status", "playing");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
    const forwardButton = screen.getByRole("button", { name: "한 칸 내려가기" });
    const turnButton = screen.getByRole("button", { name: "방향을 바꾸며 내려가기" });

    fireEvent.click(forwardButton);
    expect(screen.getByTestId("score-value")).toHaveTextContent("1");

    fireEvent.click(turnButton);
    expect(forwardButton).toBeDisabled();
    expect(turnButton).toBeDisabled();
  });

  it("opens accessible settings, blocks play input, and resumes after closing without audio props", () => {
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    const trigger = screen.getByRole("button", { name: "게임 설정" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "게임 설정" });
    expect(dialog).toBeVisible();
    expect(screen.getByText("조작 방법")).toBeVisible();
    expect(screen.getByText("뒤쫓아오는 추격자")).toBeVisible();
    expect(screen.getByText(account.name!)).toBeVisible();
    expect(screen.queryByRole("region", { name: "오디오 설정" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "설정 닫기" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: "한 칸 내려가기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "방향을 바꾸며 내려가기" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "설정 닫기" }));
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent("1");

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("조작 방법"));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.mouseDown(document.querySelector(".settings-backdrop")!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the guide before starting without starting the timer and restores focus after Escape", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    renderBase(<GameScreen account={account} />);
    const trigger = screen.getByRole("button", { name: "게임 설명" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "게임 설명" });
    const close = screen.getByRole("button", { name: "게임 설명 닫기" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "게임 설명" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "ready");
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:30");
  });

  it("pauses the stage and bonus clocks, pursuer, and inputs while settings are open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    seedReadyStage(1, { score: 0, eventSteps: 29 });
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    climbOneStep();
    const stageTime = screen.getByTestId("stage-time").textContent;
    const eventStatus = screen.getByTestId("event-status").textContent;
    const pursuerIndex = screen.getByTestId("pursuer").getAttribute("data-route-index");
    const score = screen.getByTestId("score-value").textContent;
    const trigger = screen.getByRole("button", { name: "게임 설정" });
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "설정 닫기" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(window, { key: "j" });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(screen.getByTestId("stage-time")).toHaveTextContent(stageTime!);
    expect(screen.getByTestId("event-status")).toHaveTextContent(eventStatus!);
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", pursuerIndex);
    expect(screen.getByTestId("score-value")).toHaveTextContent(score!);

    fireEvent.mouseDown(document.querySelector(".settings-backdrop")!);
    expect(trigger).toHaveFocus();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:29");
    expect(screen.getByTestId("event-status")).toHaveTextContent("29초");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-2");
  });

  it("freezes the bonus countdown while settings are open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    vi.spyOn(Math, "random").mockReturnValue(0);
    seedReadyStage(1, { score: 0, eventSteps: 29 });
    render(
      <GameScreen
        account={account}
        audioPreferences={DEFAULT_AUDIO_PREFERENCES}
        onAudioPreferencesChange={vi.fn()}
        onEnableAudio={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    // Start the bonus one stair before its threshold so the test can focus on clock pausing.
    climbOneStep();
    const eventStatus = screen.getByTestId("event-status");
    expect(eventStatus).toHaveTextContent("2배 점수");
    const remainingBefore = eventStatus.textContent;
    const stageTimeBefore = screen.getByTestId("stage-time").textContent;
    const pursuerBefore = screen.getByRole("img").getAttribute("data-pursuer-index");

    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    vi.setSystemTime(96_000);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(eventStatus).toHaveTextContent(remainingBefore!);
    expect(screen.getByTestId("stage-time")).toHaveTextContent(stageTimeBefore!);
    fireEvent.click(screen.getByRole("button", { name: "설정 닫기" }));
    expect(eventStatus).toHaveTextContent(remainingBefore!);
    expect(screen.getByTestId("stage-time")).toHaveTextContent(stageTimeBefore!);
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-index", pursuerBefore);

    // One player step per 500ms keeps pace with stage-one pursuit without entering catch-up mode.
    for (let elapsed = 500; elapsed <= 30_500; elapsed += 500) {
      vi.setSystemTime(96_000 + elapsed);
      fireEvent(document, new Event("visibilitychange"));
      climbOneStep();
    }
    expect(eventStatus).not.toHaveTextContent("2배 점수");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
    vi.setSystemTime(186_100);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "game-over");
  }, 15_000);

  it("shows and replays score feedback for regular and event climbs, then clears it", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent("1");
    expect(screen.getByTestId("score-gain")).toHaveTextContent("+1");
    const firstScoreNode = screen.getByTestId("score-value");

    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).not.toBe(firstScoreNode);
    expect(screen.getByTestId("score-gain")).toHaveTextContent("+1");

    for (let step = 2; step < 30; step += 1) climbOneStep();

    expect(screen.getByTestId("score-value")).toHaveTextContent("30");
    expect(screen.getByTestId("event-status")).toHaveTextContent("2배 점수");
    climbOneStep();
    expect(screen.getByTestId("score-value")).toHaveTextContent("32");
    expect(screen.getByTestId("score-gain")).toHaveTextContent("+2");
    expect(screen.getByTestId("score-gain")).toHaveAttribute("aria-label", "2점 획득");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(screen.queryByTestId("score-gain")).not.toBeInTheDocument();
  });

  it("animates successful D/J climbs without replaying the climb after a fall", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    expect(screen.getByTestId("pursuer").querySelector("[data-officer-variant='older']")).toHaveAttribute("data-officer-pose", "idle");
    for (let step = 0; step < 5; step += 1) fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("runner")).toHaveClass("is-climbing");
    expect(screen.getByTestId("runner")).toHaveAttribute("data-step-count", "5");
    expect(screen.queryByTestId("pursuer")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-index", "-4");
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("runner")).toHaveAttribute("data-step-count", "6");
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("runner")).toHaveAttribute("data-step-count", "7");
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("runner")).toHaveClass("is-falling");
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-index", "-4");
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByTestId("runner")).not.toHaveClass("is-falling");
    expect(screen.getByTestId("runner")).not.toHaveClass("is-climbing");
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-index", "-2");
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-visible", "false");
    expect(screen.queryByTestId("pursuer")).toBeNull();
  });

  it("layers a static pixel office behind the full route without consuming randomness", () => {
    const state = createGameState(() => 0);
    const random = vi.spyOn(Math, "random");
    const props = { state, climbAnimationKey: 0, isClimbing: false, pursuerAnimationKey: 0, isPursuerCaught: false, isPursuerMoving: false };
    const { rerender } = renderBase(<StairScene {...props} />);
    const backdrop = document.querySelector(".office-backdrop");
    const gameplay = screen.getByRole("img");
    expect(backdrop?.parentElement).toBe(gameplay.parentElement);
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop).toHaveAttribute("preserveAspectRatio", "xMidYMid slice");
    expect(gameplay).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
    expect(backdrop?.querySelector(".office-city")).toBeInTheDocument();
    expect(backdrop?.querySelector(".office-desk")).toBeInTheDocument();
    expect(backdrop?.querySelector(".office-copier")).toBeInTheDocument();
    expect(backdrop?.querySelector(".office-floor-sign")).toHaveTextContent("02F");
    expect(document.querySelectorAll(".pixel-officer")).toHaveLength(2);
    expect(document.querySelector(".pixel-officer circle, .pixel-officer ellipse")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("stair-step")).toHaveLength(11);
    rerender(<StairScene {...props} isClimbing climbAnimationKey={1} pursuerAnimationKey={1} />);
    expect(random).not.toHaveBeenCalled();
    expect(document.querySelectorAll(".pixel-officer")).toHaveLength(2);
  });

  it("animates a scheduled fast step without instantly moving the pursuer on a mistake", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("runner")).toHaveClass("is-falling");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-approaching");
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByTestId("runner")).toHaveClass("is-falling");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-3");
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    expect(screen.getByTestId("pursuer-motion")).toHaveClass("is-moving");
    expect(screen.getByTestId("pursuer-motion")).toHaveStyle({ "--pursuer-move-x": "-34px", "--pursuer-move-y": "-28px" });
    expect(screen.getByTestId("pursuer-motion").querySelector("[clip-path]")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    await act(async () => { await vi.advanceTimersByTimeAsync(190); });
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    expect(screen.getByTestId("pursuer").querySelector("[data-officer-variant='older']")).toHaveAttribute("data-officer-pose", "idle");
  });

  it("keeps the pursuer stationary on player success and turns it at its own real corner", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let state = gameEngine.startGame(createGameState(() => 0), 0);
    for (let index = 0; index < 6; index += 1) {
      const next = getRouteStep(state.route, state.stepsClimbed + 1);
      state = gameEngine.applyInput(state, next.direction === state.direction ? "forward" : "turn", 0);
    }
    const ready = withPursuitAt({ ...state, status: "ready", stageEndsAt: null }, 0);
    vi.spyOn(gameEngine, "createGameState").mockReturnValue(ready);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "2");
    climbOneStep();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "7");
    expect(screen.getByTestId("runner")).toHaveAttribute("data-direction", "right");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "2");
    expect(screen.getByTestId("pursuer").parentElement).toHaveAttribute("data-testid", "stair-step");
    expect(screen.getByTestId("pursuer").parentElement).toHaveAttribute("data-route-index", "2");
    for (let index = 0; index < 3; index += 1) climbOneStep();
    vi.setSystemTime(2_200);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "10");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "6");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-direction", "left");
    expect(screen.getAllByTestId("stair-step")).toHaveLength(12);
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
  });

  it("replays each actual mistake sound but never plays a fall for an autonomous capture", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const audio = {
      startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn(),
    } satisfies AudioController;
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    for (let mistake = 1; mistake <= 4; mistake += 1) {
      const previousPose = screen.getByTestId("runner-pose");
      vi.setSystemTime(100 + (mistake - 1) * 500);
      fireEvent.keyDown(window, { key: nextClimbKey() === "d" ? "j" : "d" });
      expect(screen.getByTestId("runner-pose")).not.toBe(previousPose);
      expect(audio.playFall).toHaveBeenCalledTimes(mistake);
      expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", String(2 * (mistake - 1)));
      if (mistake < 4) {
        vi.setSystemTime(100 + mistake * 500);
        climbOneStep(); climbOneStep();
      }
    }
    expect(audio.playFootstep).toHaveBeenCalledTimes(6);
    vi.setSystemTime(3_700);
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(audio.playFall).toHaveBeenCalledTimes(4);
    expect(audio.playFootstep).toHaveBeenCalledTimes(6);
    expect(screen.queryByText("남은 기회")).not.toBeInTheDocument();
  });

  it("keeps player and pursuer motion independent across their timer updates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const audio = {
      startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn(),
    } satisfies AudioController;
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    fireEvent.keyDown(window, { key: "d" });
    const playerKey = screen.getByTestId("runner").getAttribute("data-motion-key");
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByTestId("runner")).toHaveClass("is-climbing");
    expect(screen.getByTestId("runner")).toHaveAttribute("data-motion-key", playerKey);
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByTestId("runner")).toHaveClass("is-climbing");
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    expect(screen.getByTestId("runner")).toHaveClass("is-climbing");
    await act(async () => { await vi.advanceTimersByTimeAsync(60); });
    expect(screen.getByTestId("runner")).not.toHaveClass("is-climbing");
    expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(audio.playFall).not.toHaveBeenCalled();
  });

  it("lets a legitimate pursuer motion continue when the player falls", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("runner")).toHaveClass("is-falling");
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    const key = screen.getByTestId("pursuer").getAttribute("data-motion-key");
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-motion-key", key);
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-3");
    await act(async () => { await vi.advanceTimersByTimeAsync(240); });
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    expect(screen.getByTestId("runner")).toHaveClass("is-falling");
  });

  it("shows the current stage-five pursuer position while its catch is still visible", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    seedReadyStage(5, { score: 349 });
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_400); });
    const catchNode = screen.getByTestId("pursuer");
    expect(catchNode).toHaveClass("is-caught");
    expect(catchNode).toHaveAttribute("data-route-index", "-1");
    expect(screen.queryByText("남은 기회")).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(screen.getByTestId("pursuer")).toBe(catchNode);
    expect(catchNode).toHaveAttribute("data-route-index", "-1");
    expect(screen.getByRole("img")).toHaveAccessibleName(/위쪽 추격자가 따라옵니다/);
    expect(screen.getByRole("img").getAttribute("aria-label")).not.toMatch(/\d+칸 거리/);
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "true");
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-1");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    expect(screen.queryByRole("button", { name: "한 칸 내려가기" })).not.toBeInTheDocument();
  });

  it("retains true offscreen history and cancels stale player motion on a late capture", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const input = vi.spyOn(gameEngine, "applyInput");
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    for (let step = 0; step < 20; step += 1) climbOneStep();
    expect(screen.queryByTestId("pursuer")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-index", "-4");
    expect(screen.getByRole("img")).toHaveAccessibleName(/위쪽 추격자가 따라옵니다/);
    expect(screen.getByRole("img").getAttribute("aria-label")).not.toMatch(/\d+칸 거리/);
    expect(input.mock.results.at(-1)?.value.route.steps[0].index).toBe(-4);
    expect(screen.getAllByTestId("stair-step")).toHaveLength(13);
    expect(screen.getByTestId("runner")).toHaveClass("is-climbing");
    // A late callback must reconcile the first catch (24 stairs * 500ms) and stop permanently.
    vi.setSystemTime(32_000);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    expect(screen.getByTestId("runner")).not.toHaveClass("is-climbing");
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^20$/);
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
  });

  it("cancels pending pursuer animation when the stage expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    seedReadyStage(1, { score: 0 }, 900);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByText("시간 초과")).toBeInTheDocument();
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
  });

  it("clips only the foot area and keeps SVG definition IDs unique between scenes", () => {
    const state = createGameState(() => 0);
    const props = { state, climbAnimationKey: 0, isClimbing: false, pursuerAnimationKey: 0, isPursuerCaught: false, isPursuerMoving: false };
    renderBase(<><StairScene {...props} /><StairScene {...props} /></>);
    const clipPaths = [...document.querySelectorAll("clipPath")];
    expect(clipPaths).toHaveLength(2);
    expect(new Set(clipPaths.map((clip) => clip.id)).size).toBe(2);
    for (const clip of clipPaths) {
      expect(clip.firstElementChild).toHaveAttribute("y", "-88");
      expect(clip.firstElementChild).toHaveAttribute("height", "84");
    }
    for (const actor of [...screen.getAllByTestId("runner"), ...screen.getAllByTestId("pursuer")]) {
      const stair = actor.parentElement!;
      expect(stair.firstElementChild).toHaveClass("stair-top");
      expect(stair.lastElementChild).toHaveClass("stair-front");
      const clip = actor.querySelector("[clip-path]")!;
      expect(clipPaths.some((path) => clip.getAttribute("clip-path") === `url(#${path.id})`)).toBe(true);
    }
  });

  it("does not capture D/J keystrokes from text entry fields", () => {
    render(
      <>
        <input aria-label="메모 입력" />
        <GameScreen account={account} />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "메모 입력" }), { key: "d" });

    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
  });

  it("plays one footstep for each successful move, a fall for a mistake, and speeds up the event BGM", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const audio = {
      startBgm: vi.fn().mockResolvedValue(true),
      stopBgm: vi.fn(),
      setEventActive: vi.fn(),
      setPreferences: vi.fn(),
      playFootstep: vi.fn(),
      playFall: vi.fn(),
      dispose: vi.fn(),
    } satisfies AudioController;
    render(<GameScreen account={account} audioController={audio} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    for (let step = 0; step < 30; step += 1) climbOneStep();

    expect(audio.startBgm).toHaveBeenCalledOnce();
    expect(audio.playFootstep).toHaveBeenCalledTimes(30);
    expect(audio.setEventActive).toHaveBeenCalledWith(true);

    fireEvent.keyDown(window, { key: nextClimbKey() === "d" ? "j" : "d" });
    expect(audio.playFall).toHaveBeenCalledOnce();
    expect(audio.stopBgm).not.toHaveBeenCalled();
  });

  it("saves the final score once, shows the ranking, and restarts a fresh game", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const saveSpy = vi.spyOn(Storage.prototype, "setItem");
    const audio = {
      startBgm: vi.fn().mockResolvedValue(true),
      stopBgm: vi.fn(),
      setEventActive: vi.fn(),
      setPreferences: vi.fn(),
      playFootstep: vi.fn(),
      playFall: vi.fn(),
      dispose: vi.fn(),
    } satisfies AudioController;
    render(<StrictMode><GameScreen account={account} audioController={audio} /></StrictMode>);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(13_000);
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });

    expect(screen.getByText(/게임 종료/)).toBeVisible();
    expect(document.querySelector(".stair-game")).toHaveAttribute("data-game-status", "game-over");
    expect(screen.getByRole("heading", { name: "0점" })).toBeVisible();
    const gameFrame = document.querySelector(".game-frame");
    expect(screen.getByRole("region", { name: "게임 현황" }).closest(".game-stage")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "계단 장면" }).closest(".game-stage")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "0점" }).closest(".game-over-panel")?.parentElement).toBe(gameFrame);
    expect(screen.getByRole("region", { name: "최고 기록 랭킹" }).parentElement).toHaveClass("game-over-panel");
    expect(screen.getByText("LOCAL PLAY")).toBeVisible();
    expect(screen.getByText(/로컬 플레이 기록은 저장되지 않아요/)).toBeVisible();
    expect(saveSpy.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    expect(audio.stopBgm).toHaveBeenCalledOnce();

    const randomCallsBeforeRestart = randomSpy.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(randomSpy).toHaveBeenCalledTimes(randomCallsBeforeRestart + 1);
    expect(screen.getByRole("region", { name: "단계 선택" })).toBeVisible();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "ready");
    expect(audio.startBgm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(randomSpy).toHaveBeenCalledTimes(randomCallsBeforeRestart + 1);
    expect(audio.startBgm).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
    expect(screen.getByRole("region", { name: "게임 현황" })).toBeVisible();
    expect(screen.getByRole("button", { name: "한 칸 내려가기" })).toBeEnabled();
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
    expect(screen.queryByText(/게임 종료/)).not.toBeInTheDocument();
  });

  it("saves a final catch immediately and defers results until the office scene finishes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const saveSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(3_400);
    fireEvent(document, new Event("visibilitychange"));
    const gameFrame = document.querySelector(".game-frame");
    expect(gameFrame).toHaveAttribute("data-game-status", "game-over");
    expect(gameFrame).toHaveAttribute("data-pursuer-catching", "true");
    expect(document.querySelector(".game-over-panel")).toBeNull();
    expect(screen.getByTestId("pursuer")).toHaveClass("is-caught");
    expect(saveSpy.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(gameFrame).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByRole("dialog", { name: "야근 사무실" })).toBeVisible();
    expect(document.querySelector(".game-over-panel")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(document.querySelector(".game-over-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다시 시작/ })).toBeInTheDocument();
    expect(saveSpy.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
  });

  it("shows the local no-save message without a false storage error", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(13_000);
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });

    expect(screen.getByText(/로컬 플레이 기록은 저장되지 않아요/)).toBeVisible();
    expect(screen.queryByText("기록을 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다시 시작/ })).toBeEnabled();
    expect(screen.getByRole("region", { name: "게임 현황" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "계단 장면" })).toBeInTheDocument();
  });

  it("clears a catch immediately when restarting before recovery ends", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    mockMotionPreference(true);
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(3_400);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("pursuer")).toHaveClass("is-caught");
    // The reduced-motion lifecycle exposes results before captureEndsAt elapses.
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-caught");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "0");
    expect(screen.getByTestId("pursuer").parentElement).not.toHaveClass("catch-overlay");
    expect(screen.queryByText(/게임 종료/)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "단계 선택" })).toBeVisible();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "ready");
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-approaching");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
  });

  it("does not start the stage clock until play starts and rearms it on restart", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    seedReadyStage(1, { score: 0 }, 100);
    render(<GameScreen account={account} />);
    vi.setSystemTime(100_000);
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:30");
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(100_099);
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^1$/);
    vi.setSystemTime(100_100);
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByText("시간 초과")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "ready");
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
    vi.setSystemTime(100_199);
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^1$/);
    vi.setSystemTime(100_200);
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByText("시간 초과")).toBeInTheDocument();
  });

  it.each(["interval", "input", "visibility", "settings"])("expires idle play through %s without a false capture", async (trigger) => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    // A short fixture isolates expiry before any real scheduled capture.
    seedReadyStage(1, { score: 0 }, 100);
    const audio = {
      startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn(),
    } satisfies AudioController;
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<StrictMode><GameScreen account={account} audioController={audio} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(1_100);
    if (trigger === "interval") {
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    } else if (trigger === "input") {
      fireEvent.keyDown(window, { key: "d" });
    } else if (trigger === "visibility") {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      fireEvent(document, new Event("visibilitychange"));
    } else {
      fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
      vi.setSystemTime(200_000);
    }
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "game-over");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByRole("heading", { name: "0점" })).toBeInTheDocument();
    expect(screen.getByTestId("stage-time")).toHaveTextContent("00:00");
    expect(screen.getByText("시간 초과")).toBeInTheDocument();
    expect(screen.getByText("기록 단계 1단계")).toBeInTheDocument();
    expect(screen.queryByText("남은 기회")).not.toBeInTheDocument();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "0");
    expect(audio.playFall).not.toHaveBeenCalled();
    expect(audio.playFootstep).not.toHaveBeenCalled();
    expect(audio.stopBgm).toHaveBeenCalledOnce();
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
  });

  it("resumes the stage and pursuit remainder once after settings without accepting hidden input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(1_100);
    const trigger = screen.getByRole("button", { name: "게임 설정" });
    fireEvent.click(trigger);
    const remaining = screen.getByTestId("stage-time").textContent;
    vi.setSystemTime(101_100);
    fireEvent(document, new Event("visibilitychange"));
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.click(screen.getByRole("button", { name: "한 칸 내려가기" }));
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(screen.getByTestId("stage-time")).toHaveTextContent(remaining!);
    vi.setSystemTime(101_499);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    vi.setSystemTime(101_500);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-3");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:30");
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^1$/);
  });

  it("updates displayed clock seconds relative to a fractional start rather than wall-clock seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(550);
    const ready = createGameState(() => 0);
    vi.spyOn(gameEngine, "createGameState").mockReturnValue({ ...ready, eventEndsAt: 30_550 });
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    expect(screen.getByTestId("event-status")).toHaveTextContent("2배 점수 · 30초");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:30");
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId("event-status")).toHaveTextContent("2배 점수 · 30초");
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId("event-status")).toHaveTextContent("2배 점수 · 29초");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:29");
  });

  it("leaves old browser record keys untouched", () => {
    const oldKey="stair-climb:leaderboard:v1"; localStorage.setItem(oldKey,"old");
    const remove=vi.spyOn(Storage.prototype,"removeItem"),write=vi.spyOn(Storage.prototype,"setItem");
    render(<GameScreen account={account}/>);
    expect(localStorage.getItem(oldKey)).toBe("old"); expect(remove).not.toHaveBeenCalled();
    expect(write.mock.calls.filter(([key])=>key===DESCENT_LEADERBOARD_KEY||key===DESCENT_PROGRESS_KEY)).toEqual([]);
  });

  it.each([3, 4, 5] as const)("ends stage %s at its exact deadline before accepting a goal-reaching move", (stage) => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    seedReadyStage(stage, {}, 100);
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    const rule = getStageRule(stage);
    vi.setSystemTime(1_100);
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByText("시간 초과")).toBeInTheDocument();
    expect(screen.getByText(`기록 단계 ${stage}단계`)).toBeInTheDocument();
    expect(screen.getByTestId("stage-time")).toHaveTextContent("00:00");
    expect(screen.getByTestId("score-value")).toHaveTextContent(String(rule.scoreRequired - 1));
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "0");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
  });

  it.each([false, true])("clears stage five and saves once, then selects a zero-score replay (bonus=%s)", async (bonus) => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    seedReadyStage(5, { pursuerDistance: 1, eventEndsAt: bonus ? 31_000 : null });
    const audio = {
      startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn(),
    } satisfies AudioController;
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<StrictMode><GameScreen account={account} audioController={audio} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    const finalScore = 350;
    expect(screen.getByRole("dialog", { name: "오늘도 수고했어요!" })).toBeVisible();
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(screen.getByRole("heading", { name: `${finalScore}점` })).toBeVisible();
    expect(screen.getByText("최종 클리어!")).toBeVisible();
    expect(screen.getByText(`최종 클리어 · 최종 점수 ${finalScore}점`)).toBeInTheDocument();
    expect(screen.getByText("기록 단계 5단계")).toBeInTheDocument();
    expect(screen.getByTestId("stage-time")).toHaveTextContent("클리어");
    expect(screen.getByText("모든 단계 클리어")).toBeInTheDocument();
    expect(screen.queryByText("남은 기회")).not.toBeInTheDocument();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "1");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-caught");
    expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(audio.playFall).not.toHaveBeenCalled();
    expect(audio.stopBgm).toHaveBeenCalledOnce();
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    fireEvent.keyDown(window, { key: "d" });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    expect(screen.getByRole("heading", { name: `${finalScore}점` })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(screen.getByRole("button", { name: "5단계 선택" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("00:50");
    expect(audio.startBgm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "1단계 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(screen.getByTestId("stage-value")).toHaveTextContent("1단계");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:30");
    expect(screen.getByText("목표 150점")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.queryByText("남은 기회")).not.toBeInTheDocument();
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
  });

});

describe("settings focus after audio retry", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it.each([false, true])("restores close after the focused retry disappears and returns to the trigger (StrictMode=%s)", async (strict) => {
    const enable = vi.fn();
    const draw = (blocked: boolean) => {
      const game = <GameScreen account={account} autoplayBlocked={blocked} audioPreferences={DEFAULT_AUDIO_PREFERENCES}
        onAudioPreferencesChange={vi.fn()} onEnableAudio={enable} />;
      return strict ? <StrictMode>{game}</StrictMode> : game;
    };
    const view = render(draw(true));
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    const trigger = screen.getByRole("button", { name: "게임 설정" });
    fireEvent.click(trigger);
    const retry = screen.getByRole("button", { name: "음악 켜기" });
    retry.focus();
    fireEvent.click(retry);
    expect(enable).toHaveBeenCalledOnce();
    view.rerender(draw(false));
    expect(screen.queryByRole("button", { name: "음악 켜기" })).toBeNull();
    const close = screen.getByRole("button", { name: "설정 닫기" });
    expect(close).toHaveFocus();
    for (const key of ["d", "j", " "]) fireEvent.keyDown(document.activeElement!, { key });
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.getByTestId("runner")).toHaveAttribute("data-motion-kind", "idle");
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    const last = screen.getByRole("button", { name: "효과음 음소거" });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^1$/);
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["slider", "button"])("keeps valid internal %s focus during the audio result and subsequent timer renders", (control) => {
    const change = vi.fn();
    const draw = (blocked: boolean) => <GameScreen account={account} autoplayBlocked={blocked}
      audioPreferences={DEFAULT_AUDIO_PREFERENCES} onAudioPreferencesChange={change} onEnableAudio={vi.fn()} />;
    const view = render(draw(true));
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    const focused = screen.getByRole(control, { name: control === "slider" ? "배경 음악 음량" : "배경 음악 음소거" });
    focused.focus();
    view.rerender(draw(false));
    expect(focused).toHaveFocus();
    if (control === "slider") {
      fireEvent.keyDown(focused, { key: "ArrowRight" });
      fireEvent.change(focused, { target: { value: "70" } });
      expect(change).toHaveBeenCalledWith({ ...DEFAULT_AUDIO_PREFERENCES, bgmVolume: 0.7 });
    }
    act(() => { vi.advanceTimersByTime(1000); });
    expect(focused).toHaveFocus();
    fireEvent.keyDown(focused, { key: "Escape" });
    expect(screen.getByRole("button", { name: "게임 설정" })).toHaveFocus();
  });

  it("does not steal outside focus or reopen settings on a late result after close", async () => {
    const draw = (blocked: boolean) => <StrictMode><GameScreen account={account} autoplayBlocked={blocked}
      audioPreferences={DEFAULT_AUDIO_PREFERENCES} onAudioPreferencesChange={vi.fn()} onEnableAudio={vi.fn()} />
      <input aria-label="outside focus" /></StrictMode>;
    const view = render(draw(true));
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    const retry = screen.getByRole("button", { name: "음악 켜기" });
    retry.focus(); fireEvent.click(retry);
    fireEvent.keyDown(retry, { key: "Escape" });
    expect(screen.getByRole("button", { name: "게임 설정" })).toHaveFocus();
    const outside = screen.getByRole("textbox", { name: "outside focus" });
    outside.focus();
    view.rerender(draw(false));
    expect(outside).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("session checkpoints", () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it("continues to the next stage without saving browser records", () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(1);
    const write=vi.spyOn(Storage.prototype,"setItem"); render(<GameScreen account={account}/>);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".stage-select-start")!); climbOneStep();
    fireEvent.click(document.querySelector<HTMLButtonElement>(".checkpoint-actions button")!);
    expect(screen.getByTestId("stage-value")).toHaveTextContent("2");
    expect(write.mock.calls.filter(([k])=>k===DESCENT_LEADERBOARD_KEY||k===DESCENT_PROGRESS_KEY)).toEqual([]);
  });
  it("still submits authenticated company results", () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(1);
    const records=companyBinding(), write=vi.spyOn(Storage.prototype,"setItem"); render(<GameScreen account={account} companyRecords={records}/>);
    fireEvent.click(document.querySelector<HTMLButtonElement>(".stage-select-start")!); climbOneStep();
    expect(records.submitResult).toHaveBeenCalledOnce();
    expect(write.mock.calls.filter(([k])=>k===DESCENT_LEADERBOARD_KEY||k===DESCENT_PROGRESS_KEY)).toEqual([]);
  });
});

describe("local stage selection", () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it("does not import old progress when choosing a starting stage", () => {
    localStorage.setItem(DESCENT_PROGRESS_KEY, JSON.stringify([{accountId:account.homeAccountId,highestClearedStage:4}]));
    const read=vi.spyOn(Storage.prototype,"getItem"); render(<GameScreen account={account}/>);
    expect(screen.getByTestId("stage-value")).toHaveTextContent("1");
    expect(read.mock.calls.filter(([k])=>k===DESCENT_PROGRESS_KEY)).toEqual([]);
  });
});

describe("fall pursuit presentation", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); vi.useRealTimers(); });
  function audioFixture(): AudioController {
    return { startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn() };
  }

  it("shows logical250/500ms steps through50ms polling and keeps player and NPC motion independent", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const audio = audioFixture(), input = vi.spyOn(gameEngine, "applyInput"), tick = vi.spyOn(gameEngine, "tickGame");
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    fireEvent.keyDown(window, { key: "j" });
    expect(input.mock.results.at(-1)!.value).toMatchObject({ recoveryEndsAt: 500, nextPursuerStepAt: 250, pursuerIndex: -4 });
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    expect(audio.playFall).toHaveBeenCalledOnce(); expect(audio.playFootstep).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(249); });
    for (const key of ["d", "j", " "]) fireEvent.keyDown(window, { key });
    expect(input.mock.results.at(-1)!.value).toMatchObject({ recoveryEndsAt: 500, nextPursuerStepAt: 250 });
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    await act(async () => { await vi.advanceTimersByTimeAsync(51); });
    expect(tick.mock.results.at(-1)!.value.lastPursuerMove.atMs).toBe(250);
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-motion-key", "250");
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    expect(screen.getByTestId("runner")).toHaveClass("is-falling");
    expect(screen.getAllByTestId("pursuer")).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(190); });
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ recoveryEndsAt: null, lastMistake: false,
      pursuerIndex: -2, nextPursuerStepAt: 1000, lastPursuerMove: { atMs: 500 } });
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-motion-key", "500");
    fireEvent.keyDown(window, { key: "d" });
    const playerKey = screen.getByTestId("runner").getAttribute("data-motion-key");
    expect(screen.getByTestId("runner")).toHaveClass("is-climbing");
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-2");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    expect(screen.getByTestId("runner")).toHaveClass("is-climbing");
    expect(screen.getByTestId("runner")).toHaveAttribute("data-motion-key", playerKey);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(screen.getByTestId("runner")).not.toHaveClass("is-climbing");
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-motion-key", "1000");
    expect(screen.getAllByTestId("runner")).toHaveLength(1); expect(screen.getAllByTestId("pursuer")).toHaveLength(1);
    expect(audio.playFall).toHaveBeenCalledOnce(); expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(audio.stopBgm).not.toHaveBeenCalled();
  });

  it("ends at the500ms fast catch, gates the result and saves once without extra sounds", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(1, { score: 0, pursuerDistance: 2 });
    const audio = audioFixture(), write = vi.spyOn(Storage.prototype, "setItem");
    render(<StrictMode><GameScreen account={account} audioController={audio} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); fireEvent.keyDown(window, { key: "j" });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "game-over");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "true");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-1");
    expect(screen.getByTestId("runner")).not.toHaveClass("is-falling");
    expect(screen.getByTestId("pursuer")).toHaveClass("is-caught");
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    expect(document.querySelector(".jump-overlay")).toBeNull();
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    expect(audio.playFall).toHaveBeenCalledOnce(); expect(audio.playFootstep).not.toHaveBeenCalled();
    expect(audio.stopBgm).toHaveBeenCalledOnce();
    fireEvent(document, new Event("visibilitychange"));
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
  });

  it("preserves a paused fast-step remainder and resumes at normal speed after recovery elapses", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(1, { score: 0, eventEndsAt: 30_000 });
    const resume = vi.spyOn(gameEngine, "resumeGameAfterPause"), tick = vi.spyOn(gameEngine, "tickGame");
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); fireEvent.keyDown(window, { key: "j" });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    expect(screen.getByText(/15칸 이상 멀어지면 0.1초마다 추격하고, 6칸까지 좁혀지면/)).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    expect(screen.getByTestId("event-status")).toHaveTextContent("2배 점수 · 30초");
    const close = screen.getByRole("button", { name: "설정 닫기" });
    act(() => { fireEvent.click(close); fireEvent.click(close); });
    expect(resume).toHaveBeenCalledOnce();
    expect(resume.mock.results.at(-1)!.value).toMatchObject({ recoveryEndsAt: null, lastMistake: false,
      stageEndsAt: 100_000, eventEndsAt: 40_000, nextPursuerStepAt: 10_250 });
    await act(async () => { await vi.advanceTimersByTimeAsync(149); });
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    await act(async () => { await vi.advanceTimersByTimeAsync(51); });
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerIndex: -3, nextPursuerStepAt: 10_750,
      lastPursuerMove: { atMs: 10_250 } });
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-motion-key", "10250");
  });

  it("reconciles late visibility at actual deadlines and then stops permanently on contact", () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const tick = vi.spyOn(gameEngine, "tickGame"), input = vi.spyOn(gameEngine, "applyInput"), audio = audioFixture();
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); fireEvent.keyDown(window, { key: "j" });
    const fallen: GameState = input.mock.results.at(-1)!.value;
    vi.setSystemTime(1300); fireEvent(document, new Event("visibilitychange"));
    expect(tick.mock.results.at(-1)!.value).toEqual(gameEngine.tickGame(fallen, 1300));
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-1");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-motion-key", "1000");
    vi.setSystemTime(2100); fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("dialog", { name: "야근 사무실" })).toBeInTheDocument();
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    vi.setSystemTime(5000); fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0); expect(audio.playFall).toHaveBeenCalledOnce();
    expect(audio.playFootstep).not.toHaveBeenCalled(); expect(audio.stopBgm).toHaveBeenCalledOnce();
  });

  it("shows time expiry instead of a simultaneous250ms catch", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(1, { pursuerDistance: 1 }, 250);
    const audio = audioFixture();
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); fireEvent.keyDown(window, { key: "j" });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByText("시간 초과")).toBeVisible();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-caught");
    expect(audio.playFall).toHaveBeenCalledOnce(); expect(audio.playFootstep).not.toHaveBeenCalled();
  });
});

beforeEach(() => {
  vi.spyOn(stairObstacles, "createObstacleState").mockImplementation((route, stage) => makeObstacleFixture(route, 0, stage));
  vi.spyOn(stairObstacles, "revealObstacles").mockImplementation((state, route, index, stage) => makeObstacleFixture(route, index, stage, state));
});
afterEach(() => vi.restoreAllMocks());

describe("GameScreen obstacle gameplay", () => {
  afterEach(() => { cleanup(); window.localStorage.clear(); vi.useRealTimers(); });

  function seedBox(overrides: Partial<GameState> = {}): void {
    const ready = withObstacle({ ...createGameState(() => 0), ...overrides }, 2);
    vi.spyOn(gameEngine, "createGameState").mockReturnValue(ready);
  }

  function audioFixture(): AudioController {
    return { startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn() };
  }

  it.each([false, true])("shows the shared box, jumps two stairs once and labels the bonus correctly (bonus=%s)", async (bonus) => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    seedBox({ eventEndsAt: bonus ? 30_000 : null });
    const input = vi.spyOn(gameEngine, "applyInput");
    const audio = audioFixture();
    render(<GameScreen account={account} audioController={audio} />);
    expect(screen.getAllByTestId("stair-step")).toHaveLength(11);
    expect(screen.getByTestId("stair-obstacle")).toHaveAttribute("data-route-index", "2");
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("route-direction")).toHaveTextContent("장애물! 점프하세요");
    expect(screen.getByRole("img", { name: /다음 계단에 장애물/ })).toBeInTheDocument();
    expect(screen.getByText(/Space 또는 점프 버튼으로/)).toBeInTheDocument();
    audio.playFootstep = vi.fn();
    const npcBefore = input.mock.results.at(-1)!.value.pursuerIndex;
    expect(fireEvent.keyDown(window, { key: " ", code: "Space" })).toBe(false);
    const jumped: GameState = input.mock.results.at(-1)!.value;
    expect(jumped).toMatchObject({ stepsClimbed: 3, pursuerIndex: npcBefore, pursuerDistance: 7 });
    expect(screen.getByTestId("score-gain")).toHaveTextContent(bonus ? "+4" : "+2");
    expect(screen.getByTestId("score-gain").classList.contains("is-bonus")).toBe(bonus);
    expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(audio.playFall).not.toHaveBeenCalled();
    expect(screen.getByTestId("stair-obstacle")).toBeInTheDocument();
    expect(screen.getByTestId("runner")).toHaveClass("is-jumping");
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.queryByTestId("stair-obstacle")).not.toBeInTheDocument();
    expect(screen.getByTestId("runner")).not.toHaveClass("is-climbing");
    expect(screen.getByTestId("runner")).not.toHaveClass("is-jumping");
    expect(document.querySelector(".jump-overlay")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.queryByTestId("score-gain")).not.toBeInTheDocument();
  });

  it("accepts an immediate climb after jumping and keeps NPC updates from freezing feedback", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedBox();
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    const firstKey = screen.getByTestId("runner").getAttribute("data-motion-key");
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "4");
    expect(screen.getByTestId("runner").getAttribute("data-motion-key")).not.toBe(firstKey);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByTestId("runner")).toHaveClass("is-climbing");
    expect(screen.getByTestId("score-gain")).toHaveTextContent("+1");
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(screen.getByTestId("runner")).not.toHaveClass("is-climbing");
    expect(screen.queryByTestId("score-gain")).not.toBeInTheDocument();
  });

  it("invokes one fall for an empty Space, ignores repeat and does not restart recovery", () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const audio = audioFixture();
    const input = vi.spyOn(gameEngine, "applyInput");
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { code: "Space", key: " ", repeat: true });
    expect(input).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { code: "Space", key: " " });
    expect(audio.playFall).toHaveBeenCalledOnce();
    expect(input.mock.results.at(-1)!.value.recoveryEndsAt).toBe(500);
    vi.setSystemTime(100);
    fireEvent.keyDown(window, { code: "Space", key: " " });
    expect(input.mock.results.at(-1)!.value.recoveryEndsAt).toBe(500);
    expect(audio.playFall).toHaveBeenCalledOnce();
    expect(audio.playFootstep).not.toHaveBeenCalled();
  });

  it("protects text, native buttons, role buttons, default-prevented events and settings from Space", () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedBox();
    const input = vi.spyOn(gameEngine, "applyInput");
    const view = render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    for (const tag of ["input", "textarea", "select", "button", "div"]) {
      const element = document.createElement(tag);
      if (tag === "div") element.setAttribute("role", "button");
      view.container.append(element);
      expect(fireEvent.keyDown(element, { key: " ", code: "Space" })).toBe(true);
      element.remove();
    }
    const prevented = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true });
    prevented.preventDefault(); fireEvent(window, prevented);
    fireEvent.keyDown(screen.getByRole("button", { name: "한 칸 내려가기" }), { key: " ", code: "Space" });
    expect(input).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "한 칸 내려가기" }), { detail: 0 });
    expect(input).toHaveBeenCalledOnce();
    expect(input.mock.calls[0][1]).toBe("forward");
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(input).toHaveBeenCalledOnce();
  });

  it("clears a bonus popup on a mistake without leaving its cancelled timer stuck", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedBox({ eventEndsAt: 30_000 });
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-gain")).toHaveClass("is-bonus");
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("runner")).toHaveClass("is-falling");
    expect(screen.queryByTestId("score-gain")).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(screen.queryByTestId("score-gain")).not.toBeInTheDocument();
  });

  it("interrupts jump feedback on a delayed fatal capture and saves exactly once", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedBox({ });
    const save = vi.spyOn(Storage.prototype, "setItem");
    const audio = audioFixture();
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(screen.getByTestId("runner")).toHaveClass("is-jumping");
    vi.setSystemTime(7_000);
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    expect(screen.getByTestId("runner")).not.toHaveClass("is-climbing");
    expect(screen.queryByTestId("stair-obstacle")).not.toBeInTheDocument();
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    expect(audio.playFootstep).toHaveBeenCalledTimes(2);
    expect(audio.playFall).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
  });
});

describe("dedicated jump animation lifecycle", () => {
  afterEach(() => { cleanup(); window.localStorage.clear(); vi.useRealTimers(); });
  function readyAt(index = 1, overrides: Partial<GameState> = {}): GameState {
    const stage = overrides.stage ?? 1;
    let state = gameEngine.startGame(createGameState(() => 0, { stage,
      highestClearedStage: overrides.highestClearedStage ?? (stage - 1) as GameState["highestClearedStage"] }), 0);
    while (state.stepsClimbed < index) {
      state = gameEngine.applyInput(state, getRouteStep(state.route, state.stepsClimbed + 1).direction === state.direction ? "forward" : "turn", 0);
    }
    return withObstacle(withPursuitAt({ ...state, ...overrides, status: "ready", stageEndsAt: null }, 0), index + 1);
  }
  function startAt(state: GameState): void {
    vi.spyOn(gameEngine, "createGameState").mockReturnValue(state);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: " ", code: "Space" });
  }

  it.each([[1, "-68px"], [21, "68px"]])("moves the outer wrapper from the real takeoff %s outside its clip and above boxes", (index, x) => {
    vi.useFakeTimers(); vi.setSystemTime(0); startAt(readyAt(index));
    const runner = screen.getByTestId("runner");
    const motion = screen.getByTestId("runner-motion");
    expect(runner).toHaveClass("is-jumping");
    expect(runner).not.toHaveClass("is-climbing");
    expect(runner).toHaveAttribute("transform", "translate(260 216)");
    expect(runner).toHaveAttribute("data-motion-kind", "jump");
    expect(runner.parentElement).toHaveClass("jump-overlay");
    expect(motion.style.getPropertyValue("--jump-x")).toBe(x);
    expect(motion.style.getPropertyValue("--jump-y")).toBe("-56px");
    expect(motion.querySelector('[clip-path]')).toBeInTheDocument();
    expect(motion.closest('[clip-path]')).toBeNull();
    expect(motion.querySelector('[data-officer-pose="jump"]')).toBeInTheDocument();
    expect(screen.getAllByTestId("runner")).toHaveLength(1);
    expect(screen.queryAllByTestId("pursuer").length).toBeLessThanOrEqual(1);
    expect(runner.parentElement?.lastElementChild).toHaveClass("stair-front");
  });

  it("replaces jump with immediate climb, turn and a later jump using new wrappers and keys", () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    startAt(withObstacle(readyAt(), 9));
    const firstMotion = screen.getByTestId("runner-motion");
    const firstKey = screen.getByTestId("runner").dataset.motionKey;
    for (const key of ["d", "d", "j"]) fireEvent.keyDown(window, { key });
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "6");
    expect(document.querySelector(".jump-overlay")).toBeNull();
    expect(screen.getByTestId("runner-motion")).not.toBe(firstMotion);
    for (const key of ["j", "d", " "]) fireEvent.keyDown(window, { key });
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "10");
    expect(screen.getByTestId("runner")).toHaveClass("is-jumping");
    expect(screen.getByTestId("runner").dataset.motionKey).not.toBe(firstKey);
    expect(screen.getAllByTestId("runner")).toHaveLength(1);
  });

  it("keeps a jump alive across an NPC tick and lets its cosmetic timer finish while settings are paused", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const state = readyAt();
    vi.spyOn(gameEngine, "createGameState").mockReturnValue(state);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_100); });
    fireEvent.keyDown(window, { key: " ", code: "Space" });
    const motion = screen.getByTestId("runner-motion");
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByTestId("runner")).toHaveClass("is-jumping");
    expect(screen.getByTestId("runner-motion")).toBe(motion);
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(95_000); });
    expect(document.querySelector(".jump-overlay")).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(document.querySelector(".jump-overlay")).toBeNull();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "3");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:29");
  });

  it("cancels a pending arc on fall and on timeout, then restarts without stale overlays", () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const originalStart = gameEngine.startGame;
    vi.spyOn(gameEngine, "startGame").mockImplementation((state, time) => ({ ...originalStart(state, time), stageEndsAt: time + 200 }));
    startAt(readyAt());
    expect(document.querySelector(".jump-overlay")).not.toBeNull();
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("runner")).toHaveClass("is-falling");
    expect(document.querySelector(".jump-overlay")).toBeNull();
    vi.setSystemTime(200);
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("시간 초과")).toBeInTheDocument();
    expect(document.querySelector(".jump-overlay")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(screen.getByRole("region", { name: "단계 선택" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "0");
    expect(document.querySelector(".jump-overlay")).toBeNull();
    expect(screen.getAllByTestId("runner")).toHaveLength(1);
  });

  it("finishes a final jump without an arc while preserving the successful sound and one save", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const originalStart = gameEngine.startGame;
    vi.spyOn(gameEngine, "startGame").mockImplementation((state, now) => withPursuitAt({ ...originalStart(state, now), stage: 5, stageEndsAt: now + 50_000 }, now));
    const ready = readyAt(1, { stage: 5, highestClearedStage: 4, score: 349 });
    const audio = { startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn() } satisfies AudioController;
    vi.spyOn(gameEngine, "createGameState").mockReturnValue(ready);
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("dialog", { name: "오늘도 수고했어요!" })).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("350");
    expect(document.querySelector(".jump-overlay")).toBeNull();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-motion-kind", "idle");
    expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    expect(save.mock.calls.filter(([key]) => key === DESCENT_PROGRESS_KEY)).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(screen.getByText("최종 클리어!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다시 시작/ })).toHaveFocus();
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
  });
});
