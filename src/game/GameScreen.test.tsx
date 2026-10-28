import * as stairObstacles from "./stairObstacles";
import { makeObstacleFixture, withObstacle } from "../test/obstacleFixtures";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
import { DESCENT_LEADERBOARD_KEY, DESCENT_PROGRESS_KEY, DESCENT_RESET_KEY } from "./recordStorage";

const account = {
  homeAccountId: "local-account",
  environment: "login.microsoftonline.com",
  tenantId: "tenant-id",
  username: "player@example.com",
  localAccountId: "player",
  name: "홍길동",
} satisfies AccountInfo;

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

describe("GameScreen controls", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls catch-up every50ms, matches the animation and restores fall pursuit at gap7", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const tick = vi.spyOn(gameEngine, "tickGame"), input = vi.spyOn(gameEngine, "applyInput");
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    let preview = gameEngine.startGame(createGameState(() => 0), 0);
    const keys: string[] = [];
    for (let step = 0; step < 26; step++) {
      const turn = getRouteStep(preview.route, preview.stepsClimbed + 1).direction !== preview.direction;
      keys.push(turn ? "j" : "d");
      preview = gameEngine.applyInput(preview, turn ? "turn" : "forward", 0);
    }
    act(() => { for (const key of keys) fireEvent.keyDown(window, { key }); });
    expect(input.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 30, isPursuerCatchingUp: true, nextPursuerStepAt: 50 });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-index", "-3");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(tick.mock.results.at(-1)!.value.pursuerDistance).toBe(9);
    fireEvent.keyDown(window, { key: nextClimbKey() === "d" ? "j" : "d" });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 8, isPursuerCatchingUp: true, nextPursuerStepAt: 1150 });
    expect(screen.getByTestId("pursuer-motion").style.getPropertyValue("--pursuer-step-duration")).toBe("50ms");
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 7, isPursuerCatchingUp: false, nextPursuerStepAt: 1400 });
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

  it("freezes the bonus countdown while settings are open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(
      <GameScreen
        account={account}
        audioPreferences={DEFAULT_AUDIO_PREFERENCES}
        onAudioPreferencesChange={vi.fn()}
        onEnableAudio={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    // Keep this pause test focused on the frozen clocks, with one render per legal input batch.
    let preview = gameEngine.startGame(createGameState(() => 0), 1_000);
    const climbBatch = (count: number) => {
      const keys: string[] = [];
      for (let step = 0; step < count; step++) {
        const turn = getRouteStep(preview.route, preview.stepsClimbed + 1).direction !== preview.direction;
        keys.push(turn ? "j" : "d");
        preview = gameEngine.applyInput(preview, turn ? "turn" : "forward", 1_000);
      }
      act(() => { for (const key of keys) fireEvent.keyDown(window, { key }); });
    };
    climbBatch(30);
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

    // Keep playing while the real catch-up and base clocks run through bonus expiry.
    climbBatch(5);
    for (let elapsed = 3_000; elapsed <= 30_000; elapsed += 3_000) {
      vi.setSystemTime(96_100 + elapsed);
      fireEvent(document, new Event("visibilitychange"));
      climbBatch(5);
    }
    expect(eventStatus).not.toHaveTextContent("2배 점수");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
    vi.setSystemTime(186_100);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "game-over");
  });

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
    const { rerender } = render(<StairScene {...props} />);
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
    expect(screen.getByTestId("pursuer").parentElement).toHaveClass("pursuer-history-stair");
    for (let index = 0; index < 3; index += 1) climbOneStep();
    vi.setSystemTime(2_400);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "10");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "6");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-direction", "left");
    expect(screen.getAllByTestId("stair-step")).toHaveLength(11);
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
  });

  it("replays each actual mistake sound but never plays a fall for an autonomous capture", () => {
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
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "true");
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
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(screen.getByTestId("runner")).not.toHaveClass("is-climbing");
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(audio.playFall).not.toHaveBeenCalled();
  });

  it("lets a legitimate pursuer motion continue when the player falls", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    const key = screen.getByTestId("pursuer").getAttribute("data-motion-key");
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("runner")).toHaveClass("is-falling");
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
    seedReadyStage(5, { score: 1_200 });
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    const catchNode = screen.getByTestId("pursuer");
    expect(catchNode).toHaveClass("is-caught");
    expect(catchNode).toHaveAttribute("data-route-index", "-1");
    expect(screen.queryByText("남은 기회")).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByTestId("pursuer")).toBe(catchNode);
    expect(catchNode).toHaveAttribute("data-route-index", "-1");
    expect(screen.getByRole("img")).toHaveAccessibleName(/추격자와 1칸 거리/);
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "true");
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
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
    expect(screen.getByRole("img")).toHaveAccessibleName(/추격자와 24칸 거리/);
    expect(input.mock.results.at(-1)?.value.route.steps[0].index).toBe(-4);
    expect(screen.getAllByTestId("stair-step")).toHaveLength(11);
    expect(screen.getByTestId("runner")).toHaveClass("is-climbing");
    // A late callback must reconcile the first catch (24 stairs * 600ms) and stop permanently.
    vi.setSystemTime(32_000);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    expect(screen.getByTestId("runner")).not.toHaveClass("is-climbing");
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^20$/);
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
  });

  it("cancels pending pursuer animation when the stage expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    seedReadyStage(1, { score: 0 }, 900);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(screen.getByText("시간 초과")).toBeInTheDocument();
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
  });

  it("clips only the foot area and keeps SVG definition IDs unique between scenes", () => {
    const state = createGameState(() => 0);
    const props = { state, climbAnimationKey: 0, isClimbing: false, pursuerAnimationKey: 0, isPursuerCaught: false, isPursuerMoving: false };
    render(<><StairScene {...props} /><StairScene {...props} /></>);
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
    expect(screen.getByText("홍길동", { selector: ".leaderboard-name" }).closest("li")).toHaveClass("is-current-player");
    expect(saveSpy.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
    expect(audio.stopBgm).toHaveBeenCalledOnce();
    expect(JSON.parse(window.localStorage.getItem(DESCENT_LEADERBOARD_KEY)!)).toEqual([
      expect.objectContaining({ accountId: "local-account", bestStage: 1, bestScore: 0 }),
    ]);

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

  it("saves a final catch immediately and keeps its result panel hidden through recovery", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const saveSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(3_400);
    fireEvent(document, new Event("visibilitychange"));
    const gameFrame = document.querySelector(".game-frame");
    const resultPanel = document.querySelector(".game-over-panel");
    expect(gameFrame).toHaveAttribute("data-game-status", "game-over");
    expect(gameFrame).toHaveAttribute("data-pursuer-catching", "true");
    expect(resultPanel).toBeInTheDocument();
    expect(screen.getByTestId("pursuer")).toHaveClass("is-caught");
    expect(saveSpy.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(gameFrame).toHaveAttribute("data-pursuer-catching", "false");
    expect(resultPanel).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다시 시작/ })).toBeInTheDocument();
    expect(saveSpy.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
  });

  it("keeps the result and restart available when local storage fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    render(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(13_000);
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });

    expect(screen.getByText("기록을 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.")).toBeVisible();
    expect(screen.getByRole("button", { name: /다시 시작/ })).toBeEnabled();
    expect(screen.getByRole("region", { name: "게임 현황" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "계단 장면" })).toBeInTheDocument();
  });

  it("clears a catch immediately when restarting before recovery ends", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(3_400);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("pursuer")).toHaveClass("is-caught");
    // Reduced-motion CSS makes this restart button available immediately.
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
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(DESCENT_LEADERBOARD_KEY)!)).toEqual([
      expect.objectContaining({ accountId: account.homeAccountId, bestStage: 1, bestScore: 0 }),
    ]);
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
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
    vi.setSystemTime(101_599);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    vi.setSystemTime(101_600);
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

  it("resets all six legacy record keys once and preserves new records on StrictMode remount", () => {
    const records = [account.homeAccountId, "existing"].map((accountId) => ({ accountId, displayName: "기존 사용자", bestStage: 5, bestScore: 1501, achievedAt: "2026-01-01" }));
    const oldKeys = [...[1, 2, 3, 4, 5].map((version) => `stair-climb:leaderboard:v${version}`), "stair-climb:stage-progress:v1"];
    for (const key of oldKeys) localStorage.setItem(key, JSON.stringify(records));
    window.localStorage.setItem("stair-climb:audio:v1", "audio-sentinel");
    window.localStorage.setItem("msal.account.keys", "auth-sentinel");
    window.localStorage.setItem("session.token", "session-sentinel");
    window.localStorage.setItem("unrelated", "exact bytes\nkeep");
    const originalWrite = Storage.prototype.setItem;
    const clear = vi.spyOn(Storage.prototype, "clear");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    const save = vi.spyOn(Storage.prototype, "setItem");
    const first = render(<StrictMode><GameScreen account={account} /></StrictMode>);
    expect(screen.getByRole("button", { name: "1단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "2단계 잠김" })).toBeDisabled();
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.getByText("목표 150점")).toBeInTheDocument();
    expect(remove.mock.calls).toEqual(oldKeys.map((key) => [key]));
    for (const key of oldKeys) expect(localStorage.getItem(key)).toBeNull();
    expect(save.mock.calls).toEqual([[DESCENT_RESET_KEY, "1"]]);
    expect(localStorage.getItem(DESCENT_LEADERBOARD_KEY)).toBeNull();
    expect(localStorage.getItem(DESCENT_PROGRESS_KEY)).toBeNull();
    first.unmount();
    const newProgress = [{ accountId: account.homeAccountId, highestClearedStage: 1 }];
    const newRank = [{ ...records[0], bestStage: 1, bestScore: 150 }];
    originalWrite.call(localStorage, DESCENT_PROGRESS_KEY, JSON.stringify(newProgress));
    originalWrite.call(localStorage, DESCENT_LEADERBOARD_KEY, JSON.stringify(newRank));
    for (const key of oldKeys) originalWrite.call(localStorage, key, "reintroduced old record");
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    expect(screen.getByRole("button", { name: "2단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "3단계 잠김" })).toBeDisabled();
    expect(screen.getByText("목표 200점")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(JSON.parse(window.localStorage.getItem(DESCENT_LEADERBOARD_KEY)!)).toEqual(newRank);
    expect(window.localStorage.getItem("stair-climb:audio:v1")).toBe("audio-sentinel");
    expect(window.localStorage.getItem("msal.account.keys")).toBe("auth-sentinel");
    expect(window.localStorage.getItem("session.token")).toBe("session-sentinel");
    expect(window.localStorage.getItem("unrelated")).toBe("exact bytes\nkeep");
    expect(save.mock.calls).toEqual([[DESCENT_RESET_KEY, "1"]]);
    expect(remove.mock.calls).toEqual(oldKeys.map((key) => [key]));
    for (const key of oldKeys) expect(localStorage.getItem(key)).toBe("reintroduced old record");
    expect(JSON.parse(window.localStorage.getItem(DESCENT_PROGRESS_KEY)!)).toEqual(newProgress);
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(0);
    expect(clear).not.toHaveBeenCalled();
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
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(DESCENT_LEADERBOARD_KEY)!)).toEqual([
      expect.objectContaining({ bestStage: stage, bestScore: rule.scoreRequired - 1 }),
    ]);
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
    const finalScore = bonus ? 351 : 350;
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
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
    const records = JSON.parse(window.localStorage.getItem(DESCENT_LEADERBOARD_KEY)!);
    expect(records).toEqual([expect.objectContaining({ bestStage: 5, bestScore: finalScore })]);
    fireEvent.keyDown(window, { key: "d" });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
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
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(DESCENT_LEADERBOARD_KEY)!)).toEqual(records);
  });

  it.each(["stair-climb:leaderboard:v1", "stair-climb:leaderboard:v2", "stair-climb:leaderboard:v3"])("keeps play and restart available when %s cleanup fails", async (oldKey) => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    window.localStorage.setItem(oldKey, "old scores");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent("1");
    vi.setSystemTime(91_000);
    fireEvent.keyDown(window, { key: "d" });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByText("기록을 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.")).not.toBeInTheDocument();
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
    expect(window.localStorage.getItem(oldKey)).toBe("old scores");
    expect(JSON.parse(window.localStorage.getItem(DESCENT_LEADERBOARD_KEY)!)).toEqual([
      expect.objectContaining({ bestStage: 1, bestScore: 1 }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(screen.getByRole("region", { name: "단계 선택" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
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

describe("checkpoint session integration", () => {
  afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
  const rankKey = DESCENT_LEADERBOARD_KEY;
  const progressKey = DESCENT_PROGRESS_KEY;
  function audioFixture(): AudioController {
    return { startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn() };
  }

  it.each([false, true])("freezes checkpoints, persists progress immediately and ranks only after termination (bonus=%s)", async (bonus) => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    seedReadyStage(1, { eventEndsAt: bonus ? 31_000 : null, eventSteps: 12 });
    const audio = audioFixture();
    const input = vi.spyOn(gameEngine, "applyInput");
    const tick = vi.spyOn(gameEngine, "tickGame");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<StrictMode><GameScreen account={account} audioController={audio} /></StrictMode>);
    expect(screen.getByRole("button", { name: "게임 설정" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    climbOneStep();
    const checkpoint: GameState = input.mock.results.at(-1)!.value;
    expect(checkpoint).toMatchObject({ status: "checkpoint", stage: 1, highestClearedStage: 1, score: bonus ? 151 : 150 });
    expect(screen.getByRole("dialog", { name: "1단계 클리어!" })).toBeVisible();
    expect(screen.getByTestId("stage-time")).toHaveTextContent("클리어");
    expect(screen.getByRole("button", { name: "게임 설정" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "계속하기" })).toHaveFocus();
    expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(audio.stopBgm).not.toHaveBeenCalled();
    expect(localStorage.getItem(rankKey)).toBeNull();
    expect(JSON.parse(localStorage.getItem(progressKey)!)).toEqual([{ accountId: account.homeAccountId, highestClearedStage: 1 }]);
    input.mockClear(); tick.mockClear();
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.keyDown(screen.getByRole("button", { name: "계속하기" }), { key: " ", code: "Space" });
    expect(input).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(95_000); });
    expect(tick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    if (bonus) expect(screen.getByTestId("event-status")).toHaveTextContent("2배 점수 · 30초");
    const continued = vi.spyOn(gameEngine, "continueGame");
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    const resumed: GameState = continued.mock.results.at(-1)!.value;
    expect(resumed).toMatchObject({ status: "playing", stage: 2, score: 0, lastMove: null,
      stageEndsAt: 171_000, nextPursuerStepAt: 96_500, pursuerDistance: 4, highestClearedStage: 1 });
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.queryByTestId("score-gain")).not.toBeInTheDocument();
    expect(document.querySelector(".jump-overlay")).toBeNull();
    // StrictMode can evaluate an updater twice; compare references to the committed input to Continue.
    const committedCheckpoint = continued.mock.calls.at(-1)![0];
    expect(resumed.route).toBe(committedCheckpoint.route);
    expect(resumed.obstacles).toBe(committedCheckpoint.obstacles);
    expect(resumed.route).toEqual(checkpoint.route);
    expect(screen.getByText("목표 200점")).toBeVisible();
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:15");
    expect(localStorage.getItem(rankKey)).toBeNull();
    vi.setSystemTime(98_600);
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(501); });
    const rows = JSON.parse(localStorage.getItem(rankKey)!);
    expect(rows).toEqual([expect.objectContaining({ bestStage: 2, bestScore: 0 })]);
    expect(writes.mock.calls.filter(([key]) => key === progressKey)).toHaveLength(1);
    expect(writes.mock.calls.filter(([key]) => key === rankKey)).toHaveLength(1);
    expect(audio.playFootstep).toHaveBeenCalledOnce(); expect(audio.stopBgm).toHaveBeenCalledOnce();
    expect(screen.getByText("기록 단계 2단계")).toBeVisible();
  });

  it("quits once using the native checkpoint action and retains the record on restart", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(1);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ })); climbOneStep();
    const quit = screen.getByRole("button", { name: "그만두기" });
    fireEvent.keyDown(quit, { key: " ", code: "Space" });
    fireEvent.click(quit, { detail: 0 });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByText("체크포인트에서 종료했어요")).toBeVisible();
    expect(screen.getByText("기록 단계 1단계")).toBeVisible();
    expect(JSON.parse(localStorage.getItem(rankKey)!)).toEqual([expect.objectContaining({ bestStage: 1, bestScore: 150 })]);
    fireEvent(document, new Event("visibilitychange"));
    expect(writes.mock.calls.filter(([key]) => key === rankKey)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.getByTestId("stage-value")).toHaveTextContent("2단계");
    expect(screen.getByRole("button", { name: "2단계 선택" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "3단계 잠김" })).toBeDisabled();
    expect(JSON.parse(localStorage.getItem(progressKey)!)[0].highestClearedStage).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:15");
    expect(screen.getByText("목표 200점")).toBeVisible();
  });

  it.each([false,true])("resets score feedback on Continue and gives only the new-stage gain without extra sounds (bonus=%s)", (bonus) => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    seedReadyStage(1, { eventEndsAt: bonus ? 30_000 : null, eventSteps: 12 });
    const audio = audioFixture();
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    expect(screen.getByTestId("score-gain")).toHaveTextContent(bonus ? "+2" : "+1");
    const eventCalls = vi.mocked(audio.setEventActive).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.queryByTestId("score-gain")).not.toBeInTheDocument();
    expect(audio.playFootstep).toHaveBeenCalledOnce(); expect(audio.playFall).not.toHaveBeenCalled();
    expect(audio.startBgm).toHaveBeenCalledOnce(); expect(audio.stopBgm).not.toHaveBeenCalled();
    expect(audio.setEventActive).toHaveBeenCalledTimes(eventCalls);
    climbOneStep();
    expect(screen.getByTestId("score-value")).toHaveTextContent(bonus ? /^2$/ : /^1$/);
    expect(screen.getByTestId("score-gain")).toHaveTextContent(bonus ? "+2" : "+1");
    expect(audio.playFootstep).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(rankKey)).toBeNull();
  });

  it.each([[2,80],[3,150]] as const)("ranks attempted stage %s and its own %s points without granting a new clear", async (stage, score) => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    localStorage.setItem(progressKey, JSON.stringify([{ accountId: account.homeAccountId, highestClearedStage: stage - 1 }]));
    const start = vi.spyOn(gameEngine, "startGame"), input = vi.spyOn(gameEngine, "applyInput");
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    let simulated: GameState = start.mock.results.at(-1)!.value;
    const keys: string[] = [];
    while (simulated.score < score) {
      const turn = getRouteStep(simulated.route, simulated.stepsClimbed + 1).direction !== simulated.direction;
      keys.push(turn ? "j" : "d"); simulated = gameEngine.applyInput(simulated, turn ? "turn" : "forward", 0);
    }
    expect(simulated.score).toBe(score);
    act(() => { for (const key of keys) fireEvent.keyDown(window, { key }); });
    expect(input.mock.results.at(-1)!.value).toMatchObject({ stage, score, highestClearedStage: stage - 1, clearedStageThisRun: 0 });
    vi.setSystemTime(100_000); fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(JSON.parse(localStorage.getItem(rankKey)!)).toEqual([expect.objectContaining({ bestStage: stage, bestScore: score })]);
    expect(JSON.parse(localStorage.getItem(progressKey)!)[0].highestClearedStage).toBe(stage - 1);
    expect(screen.getByText(`기록 단계 ${stage}단계`)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(screen.getByRole("button", { name: `${stage}단계 선택` })).toHaveFocus();
    expect(screen.getByRole("button", { name: `${stage + 1}단계 잠김` })).toBeDisabled();
  });

  it("preserves a higher personal best when replaying a lower stage without inheriting its ranking stage", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    localStorage.setItem(progressKey, JSON.stringify([{ accountId: account.homeAccountId, highestClearedStage: 3 }]));
    const previous = [{ accountId: account.homeAccountId, displayName: "기존 이름", bestStage: 3, bestScore: 150, achievedAt: "2026-01-01" }];
    localStorage.setItem(rankKey, JSON.stringify(previous));
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "1단계 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    vi.setSystemTime(5000); fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByText("기록 단계 1단계")).toBeVisible();
    expect(JSON.parse(localStorage.getItem(rankKey)!)).toEqual(previous);
    expect(JSON.parse(localStorage.getItem(progressKey)!)[0].highestClearedStage).toBe(3);
  });

  it("never unlocks stages from a new ranking without a saved actual clear", () => {
    localStorage.setItem(rankKey, JSON.stringify([{ accountId: account.homeAccountId, displayName: "도전자", bestStage: 5, bestScore: 10, achievedAt: "2026-10-01" }]));
    render(<GameScreen account={account} />);
    expect(screen.getByRole("button", { name: "1단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "2단계 잠김" })).toBeDisabled();
    expect(localStorage.getItem(progressKey)).toBeNull();
  });

  it.each(["progress", "rank"])("loads unlocks only from descent progress, ignoring legacy %s", async (source) => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    if (source === "progress") localStorage.setItem(progressKey, JSON.stringify([
      { accountId: account.homeAccountId, highestClearedStage: 3 }, { accountId: "other", highestClearedStage: 5 },
    ]));
    else localStorage.setItem("stair-climb:leaderboard:v4", JSON.stringify([
      { accountId: account.homeAccountId, displayName: "기존", bestStage: 3, bestScore: 0, achievedAt: "2026-01-01" },
      { accountId: "other", displayName: "다른 사람", bestStage: 5, bestScore: 999, achievedAt: "2026-01-01" },
    ]));
    const start = vi.spyOn(gameEngine, "startGame");
    render(<GameScreen account={account} />);
    const highest = source === "progress" ? 3 : 0;
    expect(screen.getByRole("button", { name: `${highest + 1}단계 선택` })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: `${highest + 2}단계 잠김` })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "1단계 선택" }));
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    expect(start.mock.calls[0][0]).toMatchObject({ stage: 1, highestClearedStage: highest, clearedStageThisRun: 0, score: 0 });
    fireEvent.keyDown(window, { key: "d" });
    vi.setSystemTime(4000); fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(501); });
    expect(JSON.parse(localStorage.getItem(rankKey)!).find((entry: { accountId: string }) => entry.accountId === account.homeAccountId)).toMatchObject({ bestStage: 1, bestScore: 1 });
  });

  it("reports a progress write failure while allowing Continue and retaining in-memory progress", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(1);
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === progressKey) throw new DOMException("full", "QuotaExceededError");
      write.call(this, key, value);
    });
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ })); climbOneStep();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole("status")).toHaveTextContent("진행도를 저장하지 못했습니다.");
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    vi.setSystemTime(3000); fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(501); });
    expect(screen.getByText("기록 단계 2단계")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "최고 기록 랭킹" })).getByText("2단계")).toBeVisible();
    expect(JSON.parse(localStorage.getItem(rankKey)!)[0].bestStage).toBe(2);
  });
});

describe("unlocked stage selection", () => {
  const progressKey = DESCENT_PROGRESS_KEY, rankKey = DESCENT_LEADERBOARD_KEY;
  afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); vi.useRealTimers(); });
  function storeProgress(): void {
    localStorage.setItem(progressKey, JSON.stringify([
      { accountId: account.homeAccountId, highestClearedStage: 3 },
      { accountId: "other-account", highestClearedStage: 5 },
    ]));
  }
  function audioFixture(): AudioController {
    return { startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn() };
  }

  it.each([1, 3] as const)("starts selected stage %s once from the unchanged zero-score preview", (stage) => {
    vi.useFakeTimers(); vi.setSystemTime(1000); storeProgress();
    const audio = audioFixture(), random = vi.spyOn(Math, "random").mockReturnValue(0);
    const input = vi.spyOn(gameEngine, "applyInput"), reset = vi.spyOn(gameEngine, "resetGame"), start = vi.spyOn(gameEngine, "startGame");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<StrictMode><GameScreen account={account} audioController={audio} /></StrictMode>);
    expect(screen.getByRole("button", { name: "4단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "4단계 선택" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "4단계 선택" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "5단계 잠김" })).toBeDisabled();
    const initialRandomCalls = random.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "5단계 잠김" }));
    fireEvent.click(screen.getByRole("button", { name: "4단계 선택" }));
    for (const key of ["d", "j", " ", "Escape"]) fireEvent.keyDown(window, { key });
    expect(random).toHaveBeenCalledTimes(initialRandomCalls);
    expect(reset).not.toHaveBeenCalled(); expect(input).not.toHaveBeenCalled();
    expect(audio.startBgm).not.toHaveBeenCalled(); expect(writes.mock.calls).toEqual([[DESCENT_RESET_KEY, "1"]]);
    fireEvent.click(screen.getByRole("button", { name: "1단계 선택" }));
    const firstPreview = reset.mock.results.at(-1)!.value as GameState;
    expect(firstPreview).toMatchObject({ status: "ready", stage: 1, score: 0, highestClearedStage: 3, clearedStageThisRun: 0, stepsClimbed: 0, eventSteps: 0, eventEndsAt: null,
      pursuerIndex: -4, pursuerDistance: 4, nextPursuerStepAt: null, stageEndsAt: null, lastMove: null });
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:30");
    fireEvent.click(screen.getByRole("button", { name: "1단계 선택" }));
    expect(reset).toHaveBeenCalledOnce();
    if (stage === 3) fireEvent.click(screen.getByRole("button", { name: "3단계 선택" }));
    const preview = reset.mock.results.at(-1)!.value as GameState;
    expect(preview.obstacles.runs.every((run) => run.stageAtGeneration === stage)).toBe(true);
    expect(screen.getByText(`목표 ${getStageRule(stage).scoreRequired}점`)).toBeVisible();
    expect(writes.mock.calls).toEqual([[DESCENT_RESET_KEY, "1"]]);
    vi.setSystemTime(100_000); fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("stage-time")).toHaveTextContent(stage === 3 ? "01:05" : "01:30");
    const beforeStartRandomCalls = random.mock.calls.length;
    const button = screen.getByRole("button", { name: "시작하기" });
    expect(fireEvent.keyDown(button, { key: " ", code: "Space" })).toBe(true);
    expect(input).not.toHaveBeenCalled(); expect(start).not.toHaveBeenCalled();
    act(() => { fireEvent.click(button, { detail: 0 }); fireEvent.click(button, { detail: 0 }); });
    expect(start).toHaveBeenCalledExactlyOnceWith(preview, 100_000);
    expect(random).toHaveBeenCalledTimes(beforeStartRandomCalls);
    const started = start.mock.results[0].value as GameState;
    expect(started.route).toBe(preview.route); expect(started.obstacles).toBe(preview.obstacles);
    expect(started.stageEndsAt).toBe(100_000 + getStageRule(stage).durationMs);
    expect(started.nextPursuerStepAt).toBe(100_000 + getStageRule(stage).pursuerStepIntervalMs);
    expect(started).toMatchObject({ stage, score: 0, highestClearedStage: 3, clearedStageThisRun: 0 });
    expect(audio.startBgm).toHaveBeenCalledOnce(); expect(writes.mock.calls).toEqual([[DESCENT_RESET_KEY, "1"]]);
    expect(screen.queryByRole("region", { name: "단계 선택" })).not.toBeInTheDocument();
  });

  it("clears stage two, quits once, and returns to the next-stage selection without starting its clocks", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(2);
    const audio = audioFixture(), reset = vi.spyOn(gameEngine, "resetGame");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<StrictMode><GameScreen account={account} audioController={audio} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    expect(screen.getByRole("dialog", { name: "2단계 클리어!" })).toBeVisible();
    expect(localStorage.getItem(rankKey)).toBeNull();
    expect(JSON.parse(localStorage.getItem(progressKey)!)[0].highestClearedStage).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "그만두기" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(JSON.parse(localStorage.getItem(rankKey)!)[0]).toMatchObject({ bestStage: 2, bestScore: 200 });
    const restart = screen.getByRole("button", { name: /다시 시작/ });
    act(() => { fireEvent.click(restart); fireEvent.click(restart); });
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "3단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "4단계 잠김" })).toBeDisabled();
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:05");
    expect(screen.getByText("목표 250점")).toBeVisible();
    const preview = reset.mock.results[0].value as GameState;
    expect(preview).toMatchObject({ status: "ready", stage: 3, score: 0, highestClearedStage: 2, clearedStageThisRun: 0, stageEndsAt: null, nextPursuerStepAt: null,
      eventSteps: 0, eventEndsAt: null, captureCount: 0, captureEndsAt: null, pursuerIndex: -4 });
    expect(audio.startBgm).toHaveBeenCalledOnce();
    vi.setSystemTime(100_000); fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:05");
    expect(writes.mock.calls.filter(([key]) => key === rankKey)).toHaveLength(1);
    expect(writes.mock.calls.filter(([key]) => key === progressKey)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(audio.startBgm).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
  });

  it("isolates defaults and locks across keyed account changes", () => {
    vi.useFakeTimers(); storeProgress();
    const view = render(<GameScreen key={account.homeAccountId} account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "1단계 선택" }));
    const other = { ...account, homeAccountId: "other-account" };
    view.rerender(<GameScreen key={other.homeAccountId} account={other} />);
    expect(screen.getByRole("button", { name: "5단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "4단계 선택" })).toBeEnabled();
    view.rerender(<GameScreen key={account.homeAccountId} account={account} />);
    expect(screen.getByRole("button", { name: "4단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "5단계 잠김" })).toBeDisabled();
    expect(localStorage.getItem(rankKey)).toBeNull();
  });

  it("unlocks stage five after clearing four and defaults to five on return and reload", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); storeProgress(); seedReadyStage(3);
    const continued = vi.spyOn(gameEngine, "continueGame");
    const view = render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    expect(screen.getByRole("dialog", { name: "3단계 클리어!" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    expect(screen.getByTestId("stage-value")).toHaveTextContent("4단계");
    expect(JSON.parse(localStorage.getItem(progressKey)!)[0].highestClearedStage).toBe(3);
    // Compose real legal inputs in one React batch; do not spend this storage test rendering every intermediate stair.
    let simulated: GameState = continued.mock.results.at(-1)!.value;
    const keys: string[] = [];
    for (let action = 0; action < 250 && simulated.status === "playing"; action++) {
      const turn = getRouteStep(simulated.route, simulated.stepsClimbed + 1).direction !== simulated.direction;
      keys.push(turn ? "j" : "d");
      simulated = gameEngine.applyInput(simulated, turn ? "turn" : "forward", 0);
    }
    expect(simulated).toMatchObject({ status: "checkpoint", stage: 4, highestClearedStage: 4 });
    act(() => { for (const key of keys) fireEvent.keyDown(window, { key }); });
    expect(screen.getByRole("dialog", { name: "4단계 클리어!" })).toBeVisible();
    expect(JSON.parse(localStorage.getItem(progressKey)!).find((entry: { accountId: string }) => entry.accountId === account.homeAccountId).highestClearedStage).toBe(4);
    expect(localStorage.getItem(rankKey)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "그만두기" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(JSON.parse(localStorage.getItem(rankKey)!)[0].bestStage).toBe(4);
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(screen.getByRole("button", { name: "5단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "4단계 선택" })).toBeEnabled();
    expect(screen.getByTestId("stage-time")).toHaveTextContent("00:50");
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    view.unmount();
    vi.mocked(gameEngine.createGameState).mockRestore(); vi.mocked(gameEngine.startGame).mockRestore();
    render(<GameScreen account={account} />);
    expect(screen.getByRole("button", { name: "5단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "3단계 선택" })).toBeEnabled();
  });

  it("starts fresh at one with only legacy-v3 records, preserving unrelated keys", () => {
    localStorage.setItem("stair-climb:leaderboard:v3", JSON.stringify([
      { accountId: account.homeAccountId, displayName: "옛 기록", bestStage: 5, bestScore: 9999, achievedAt: "2026-01-01" },
    ]));
    localStorage.setItem("sentinel", "keep");
    render(<GameScreen account={account} />);
    expect(screen.getByRole("button", { name: "1단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "2단계 잠김" })).toBeDisabled();
    expect(localStorage.getItem("stair-climb:leaderboard:v3")).toBeNull();
    expect(localStorage.getItem(progressKey)).toBeNull(); expect(localStorage.getItem(rankKey)).toBeNull();
    expect(localStorage.getItem("sentinel")).toBe("keep");
  });

  it("keeps a usable first-stage entrance on new progress read failure without importing old v4 clears", () => {
    localStorage.setItem("stair-climb:leaderboard:v4", JSON.stringify([
      { accountId: account.homeAccountId, displayName: "기록", bestStage: 3, bestScore: 20, achievedAt: "2026-01-01" },
      { accountId: "other", displayName: "다른 사람", bestStage: 5, bestScore: 9999, achievedAt: "2026-01-01" },
    ]));
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
      if (key === progressKey) throw new DOMException("blocked", "SecurityError");
      return read.call(this, key);
    });
    render(<GameScreen account={account} />);
    expect(screen.getByRole("button", { name: "1단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "2단계 잠김" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("진행도를 읽지 못했습니다.");
    fireEvent.click(screen.getByRole("button", { name: "1단계 선택" }));
    expect(screen.getByRole("button", { name: "시작하기" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "3단계 잠김" })).toBeDisabled();
  });

  it("keeps a first-stage entrance and cleans up keyboard handling when storage access is blocked", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    const input = vi.spyOn(gameEngine, "applyInput");
    const view = render(<StrictMode><GameScreen account={account} /></StrictMode>);
    expect(screen.getByRole("button", { name: "1단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "2단계 잠김" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "시작하기" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("진행도를 읽지 못했습니다.");
    view.unmount();
    fireEvent.keyDown(window, { key: " ", code: "Space" }); fireEvent.keyDown(window, { key: "d" });
    expect(input).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("keeps unsaved unlocks in memory without inferring cleared progress from the new rank after reload", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(2);
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === progressKey) throw new DOMException("full", "QuotaExceededError");
      write.call(this, key, value);
    });
    const view = render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); climbOneStep();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole("status")).toHaveTextContent("진행도를 저장하지 못했습니다.");
    fireEvent.click(screen.getByRole("button", { name: "그만두기" }));
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(screen.getByRole("button", { name: "3단계 선택" })).toHaveAttribute("aria-pressed", "true");
    view.unmount();
    vi.mocked(gameEngine.createGameState).mockRestore();
    vi.mocked(gameEngine.startGame).mockRestore();
    render(<GameScreen account={account} />);
    expect(localStorage.getItem(progressKey)).toBeNull();
    expect(screen.getByRole("button", { name: "1단계 선택" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "2단계 잠김" })).toBeDisabled();
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
      pursuerIndex: -2, nextPursuerStepAt: 1100, lastPursuerMove: { atMs: 500 } });
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
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-motion-key", "1100");
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
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
    expect(audio.playFall).toHaveBeenCalledOnce(); expect(audio.playFootstep).not.toHaveBeenCalled();
    expect(audio.stopBgm).toHaveBeenCalledOnce();
    fireEvent(document, new Event("visibilitychange"));
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
  });

  it("preserves a paused fast-step remainder and resumes at normal speed after recovery elapses", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0); seedReadyStage(1, { score: 0, eventEndsAt: 30_000 });
    const resume = vi.spyOn(gameEngine, "resumeGameAfterPause"), tick = vi.spyOn(gameEngine, "tickGame");
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" })); fireEvent.keyDown(window, { key: "j" });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    expect(screen.getByText(/넘어진 동안 추격 간격은 0.25초지만, 가속 추격 중에는 0.05초/)).toBeVisible();
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
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerIndex: -3, nextPursuerStepAt: 10_850,
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
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-motion-key", "1100");
    vi.setSystemTime(2100); fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
    vi.setSystemTime(5000); fireEvent(document, new Event("visibilitychange"));
    expect(write.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1); expect(audio.playFall).toHaveBeenCalledOnce();
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
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
    expect(audio.playFootstep).toHaveBeenCalledTimes(2);
    expect(audio.playFall).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
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

  it("finishes a final jump without an arc while preserving the successful sound and one save", () => {
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
    expect(screen.getByText("최종 클리어!")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("351");
    expect(document.querySelector(".jump-overlay")).toBeNull();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-motion-kind", "idle");
    expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(save.mock.calls.filter(([key]) => key === DESCENT_LEADERBOARD_KEY)).toHaveLength(1);
    expect(save.mock.calls.filter(([key]) => key === DESCENT_PROGRESS_KEY)).toHaveLength(1);
  });
});
