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
    ...withPursuitAt({ ...originalFactory(() => 0), stage, score: getStageRule(stage).targetScore - 1, ...overrides }, 0, overrides.pursuerDistance ?? 4),
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
    expect(screen.getByLabelText("남은 기회 3회")).toBeVisible();
    expect(screen.queryByTestId("score-gain")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "앞으로 한 칸 오르기" })).toBeDisabled();
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
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    expect(screen.getByRole("region", { name: "오디오 설정" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "설정 닫기" }));

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    expect(document.querySelector(".stair-game")).toHaveAttribute("data-game-status", "playing");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
    const forwardButton = screen.getByRole("button", { name: "앞으로 한 칸 오르기" });
    const turnButton = screen.getByRole("button", { name: "방향을 바꾸며 오르기" });

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
    expect(screen.getByRole("button", { name: "앞으로 한 칸 오르기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "방향을 바꾸며 오르기" })).toBeDisabled();
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
    for (let step = 0; step < 30; step += 1) climbOneStep();
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

    vi.setSystemTime(126_100);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
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
    expect(screen.queryByTestId("pursuer")).not.toBeInTheDocument();
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

  it("moves the pursuer on its own schedule while a mistake only stops the player", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByTestId("runner")).toHaveClass("is-falling");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-approaching");
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(screen.getByTestId("runner")).not.toHaveClass("is-falling");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-3");
    expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    expect(screen.getByTestId("pursuer-motion")).toHaveClass("is-moving");
    expect(screen.getByTestId("pursuer-motion")).toHaveStyle({ "--pursuer-move-x": "-34px", "--pursuer-move-y": "28px" });
    expect(screen.getByTestId("pursuer-motion").querySelector("[clip-path]")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    await act(async () => { await vi.advanceTimersByTimeAsync(240); });
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
    vi.setSystemTime(4_000);
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
      fireEvent.keyDown(window, { key: "j" });
      expect(screen.getByTestId("runner-pose")).not.toBe(previousPose);
      expect(audio.playFall).toHaveBeenCalledTimes(mistake);
      expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "0");
    }
    vi.setSystemTime(12_000);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "true");
    expect(audio.playFall).toHaveBeenCalledTimes(4);
    expect(audio.playFootstep).not.toHaveBeenCalled();
    expect(screen.getByLabelText("남은 기회 0회")).toBeInTheDocument();
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
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
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
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
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
    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    const catchNode = screen.getByTestId("pursuer");
    expect(catchNode).toHaveClass("is-caught");
    expect(catchNode).toHaveAttribute("data-route-index", "-4");
    expect(screen.getByLabelText("남은 기회 2회")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByTestId("pursuer")).toBe(catchNode);
    expect(catchNode).toHaveAttribute("data-route-index", "-3");
    expect(screen.getByRole("img")).toHaveAccessibleName(/추격자와 3칸 거리/);
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "true");
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-3");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-following");
    expect(screen.getByRole("button", { name: "앞으로 한 칸 오르기" })).toBeEnabled();
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
    // The first catch is at24s, then two more four-stair catches at28/32s.
    vi.setSystemTime(32_000);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    expect(screen.getByTestId("runner")).not.toHaveClass("is-climbing");
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^20$/);
    expect(save).toHaveBeenCalledOnce();
  });

  it("cancels pending pursuer animation when the stage expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    seedReadyStage(1, { score: 0 }, 1_100);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
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
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(audio.stopBgm).toHaveBeenCalledOnce();
    expect(JSON.parse(window.localStorage.getItem("stair-climb:leaderboard:v3")!)).toEqual([
      expect.objectContaining({ accountId: "local-account", bestStage: 1, bestScore: 0 }),
    ]);

    const randomCallsBeforeRestart = randomSpy.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(randomSpy).toHaveBeenCalledTimes(randomCallsBeforeRestart + 1);
    expect(audio.startBgm).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
    expect(screen.getByRole("region", { name: "게임 현황" })).toBeVisible();
    expect(screen.getByRole("button", { name: "앞으로 한 칸 오르기" })).toBeEnabled();
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
    vi.setSystemTime(13_000);
    fireEvent(document, new Event("visibilitychange"));
    const gameFrame = document.querySelector(".game-frame");
    const resultPanel = document.querySelector(".game-over-panel");
    expect(gameFrame).toHaveAttribute("data-game-status", "game-over");
    expect(gameFrame).toHaveAttribute("data-pursuer-catching", "true");
    expect(resultPanel).toBeInTheDocument();
    expect(screen.getByTestId("pursuer")).toHaveClass("is-caught");
    expect(saveSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(gameFrame).toHaveAttribute("data-pursuer-catching", "false");
    expect(resultPanel).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다시 시작/ })).toBeInTheDocument();
    expect(saveSpy).toHaveBeenCalledTimes(1);
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
    vi.setSystemTime(13_000);
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
      fireEvent.click(screen.getByRole("button", { name: "설정 닫기" }));
    }
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "game-over");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByRole("heading", { name: "0점" })).toBeInTheDocument();
    expect(screen.getByTestId("stage-time")).toHaveTextContent("00:00");
    expect(screen.getByText("시간 초과")).toBeInTheDocument();
    expect(screen.getByText("도달 단계 1단계")).toBeInTheDocument();
    expect(screen.getByLabelText("남은 기회 3회")).toBeInTheDocument();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "0");
    expect(audio.playFall).not.toHaveBeenCalled();
    expect(audio.playFootstep).not.toHaveBeenCalled();
    expect(audio.stopBgm).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
    expect(JSON.parse(window.localStorage.getItem("stair-climb:leaderboard:v3")!)).toEqual([
      expect.objectContaining({ accountId: account.homeAccountId, bestStage: 1, bestScore: 0 }),
    ]);
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
    expect(save).toHaveBeenCalledOnce();
  });

  it.each([false, true])("promotes with one real move and preserves its bonus/audio (bonus=%s)", async (bonus) => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const ready = createGameState(() => 0);
    vi.spyOn(gameEngine, "createGameState").mockReturnValue({
      ...ready, score: 299, lives: 1, pursuerDistance: 1, pursuerIndex: -1,
      eventSteps: 12, eventEndsAt: bonus ? 31_000 : null,
    });
    const input = vi.spyOn(gameEngine, "applyInput");
    const audio = {
      startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn(),
    } satisfies AudioController;
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    expect(input.mock.results.at(-1)?.value).toMatchObject({
      stage: 2, stageEndsAt: 76_000, lives: 3, pursuerDistance: 4,
      score: bonus ? 301 : 300, eventSteps: bonus ? 12 : 13, eventEndsAt: bonus ? 31_000 : null,
    });
    expect(screen.getByLabelText("남은 기회 3회")).toBeVisible();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "1");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-stage", "2");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:15");
    expect(screen.getByTestId("stage-value")).toHaveTextContent("2단계");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-3");
    expect(screen.getByTestId("score-gain")).toHaveTextContent(bonus ? "+2" : "+1");
    expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(audio.playFall).not.toHaveBeenCalled();
    expect(audio.startBgm).toHaveBeenCalledOnce();
    expect(audio.setEventActive).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    vi.setSystemTime(1_000_000);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    fireEvent.keyDown(window, { key: "d" });
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "game-over");
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "1");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("00:00");
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    expect(save).toHaveBeenCalledOnce();
    expect(JSON.parse(window.localStorage.getItem("stair-climb:leaderboard:v3")!)).toEqual([
      expect.objectContaining({ bestStage: 2, bestScore: bonus ? 301 : 300 }),
    ]);
    expect(audio.playFootstep).toHaveBeenCalledOnce();
  });

  it("cancels a pending nonfatal capture on time expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    seedReadyStage(1, { score: 0, pursuerDistance: 1 }, 1_300);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    vi.setSystemTime(2_000);
    fireEvent(document, new Event("visibilitychange"));
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "true");
    expect(screen.getByLabelText("남은 기회 2회")).toBeInTheDocument();
    vi.setSystemTime(2_300);
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByText("시간 초과")).toBeInTheDocument();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-caught");
    expect(screen.getByRole("button", { name: /다시 시작/ })).toBeInTheDocument();
    expect(screen.getByLabelText("남은 기회 2회")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "앞으로 한 칸 오르기" }));
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(screen.getByTestId("stage-time")).toHaveTextContent(remaining!);
    vi.setSystemTime(101_999);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-4");
    vi.setSystemTime(102_000);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-3");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:29");
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

  it("cleans only legacy rankings in StrictMode and preserves new records on remount", () => {
    const records = [{ accountId: "existing", displayName: "기존 사용자", bestStage: 5, bestScore: 1501, achievedAt: "2026-01-01" }];
    window.localStorage.setItem("stair-climb:leaderboard:v1", "old scores");
    window.localStorage.setItem("stair-climb:leaderboard:v2", "old stage-two scores");
    window.localStorage.setItem("stair-climb:leaderboard:v3", JSON.stringify(records));
    window.localStorage.setItem("stair-climb:audio:v1", "audio-sentinel");
    window.localStorage.setItem("msal.account.keys", "auth-sentinel");
    const clear = vi.spyOn(Storage.prototype, "clear");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    const save = vi.spyOn(Storage.prototype, "setItem");
    const first = render(<StrictMode><GameScreen account={account} /></StrictMode>);
    expect(window.localStorage.getItem("stair-climb:leaderboard:v1")).toBeNull();
    expect(window.localStorage.getItem("stair-climb:leaderboard:v2")).toBeNull();
    expect(remove.mock.calls).toEqual([["stair-climb:leaderboard:v1"], ["stair-climb:leaderboard:v2"]]);
    first.unmount();
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    expect(JSON.parse(window.localStorage.getItem("stair-climb:leaderboard:v3")!)).toEqual(records);
    expect(window.localStorage.getItem("stair-climb:audio:v1")).toBe("audio-sentinel");
    expect(window.localStorage.getItem("msal.account.keys")).toBe("auth-sentinel");
    expect(save).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it("saves reached stage two only at game-over and retains that record through restart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const originalFactory = gameEngine.createGameState;
    vi.spyOn(gameEngine, "createGameState").mockImplementation(() => ({ ...originalFactory(() => 0), score: 299 }));
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<StrictMode><GameScreen account={account} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    climbOneStep();
    expect(screen.getByTestId("score-value")).toHaveTextContent("300");
    expect(save).not.toHaveBeenCalled();
    vi.setSystemTime(1_000 + 12 * getStageRule(2).pursuerStepIntervalMs);
    fireEvent(document, new Event("visibilitychange"));
    expect(save).toHaveBeenCalledOnce();
    const records = JSON.parse(window.localStorage.getItem("stair-climb:leaderboard:v3")!);
    expect(records).toEqual([
      expect.objectContaining({ accountId: account.homeAccountId, bestStage: 2, bestScore: 300 }),
    ]);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const row = screen.getByText(account.name!, { selector: ".leaderboard-name" }).closest("li")!;
    expect(within(row).getByText("2단계")).toBeVisible();
    expect(within(row).getByText("300점")).toBeVisible();
    expect(screen.getByText("도달 단계 2단계")).toBeInTheDocument();
    expect(screen.getByText("추격자에게 잡혔어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(JSON.parse(window.localStorage.getItem("stair-climb:leaderboard:v3")!)).toEqual(records);
    expect(save).toHaveBeenCalledOnce();
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
  });

  it.each([2, 3, 4] as const)("promotes from stage %s with its next budget and target", (stage) => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    seedReadyStage(stage, { lives: 1, pursuerDistance: 1, eventEndsAt: 31_000, eventSteps: 12 });
    const input = vi.spyOn(gameEngine, "applyInput");
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    const previousRule = getStageRule(stage);
    expect(screen.getByText(`목표 ${previousRule.targetScore}점`)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "d" });
    const nextStage = (stage + 1) as GameStage;
    const nextRule = getStageRule(nextStage);
    expect(input.mock.results.at(-1)?.value).toMatchObject({
      stage: nextStage, stageEndsAt: 1_000 + nextRule.durationMs,
      score: previousRule.targetScore + 1, lives: 3, pursuerDistance: 4,
      eventEndsAt: 31_000, eventSteps: 12,
    });
    expect(screen.getByTestId("stage-value")).toHaveTextContent(`${nextStage}단계`);
    expect(screen.getByText(`목표 ${nextRule.targetScore}점`)).toBeInTheDocument();
    expect(screen.getByTestId("stage-time")).toHaveTextContent(
      nextStage === 3 ? "01:05" : nextStage === 4 ? "01:00" : "00:50",
    );
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "1");
    expect(screen.getByTestId("event-status")).toHaveTextContent("2배 점수");
    expect(save).not.toHaveBeenCalled();
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
    expect(screen.getByText(`도달 단계 ${stage}단계`)).toBeInTheDocument();
    expect(screen.getByTestId("stage-time")).toHaveTextContent("00:00");
    expect(screen.getByTestId("score-value")).toHaveTextContent(String(rule.targetScore - 1));
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "0");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(save).toHaveBeenCalledOnce();
    expect(JSON.parse(window.localStorage.getItem("stair-climb:leaderboard:v3")!)).toEqual([
      expect.objectContaining({ bestStage: stage, bestScore: rule.targetScore - 1 }),
    ]);
  });

  it.each([false, true])("clears stage five and saves once without catch delay, then restarts stage one (bonus=%s)", async (bonus) => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    seedReadyStage(5, { lives: 1, pursuerDistance: 1, eventEndsAt: bonus ? 31_000 : null });
    const audio = {
      startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn(),
    } satisfies AudioController;
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<StrictMode><GameScreen account={account} audioController={audio} /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    const finalScore = bonus ? 1_501 : 1_500;
    expect(screen.getByRole("heading", { name: `${finalScore}점` })).toBeVisible();
    expect(screen.getByText("최종 클리어!")).toBeVisible();
    expect(screen.getByText(`최종 클리어 · 최종 점수 ${finalScore}점`)).toBeInTheDocument();
    expect(screen.getByText("도달 단계 5단계")).toBeInTheDocument();
    expect(screen.getByTestId("stage-time")).toHaveTextContent("클리어");
    expect(screen.getByText("모든 단계 클리어")).toBeInTheDocument();
    expect(screen.getByLabelText("남은 기회 1회")).toBeInTheDocument();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "1");
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-pursuer-catching", "false");
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-caught");
    expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(audio.playFall).not.toHaveBeenCalled();
    expect(audio.stopBgm).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
    const records = JSON.parse(window.localStorage.getItem("stair-climb:leaderboard:v3")!);
    expect(records).toEqual([expect.objectContaining({ bestStage: 5, bestScore: finalScore })]);
    fireEvent.keyDown(window, { key: "d" });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(save).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: `${finalScore}점` })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(screen.getByTestId("stage-value")).toHaveTextContent("1단계");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:30");
    expect(screen.getByText("목표 300점")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent(/^0$/);
    expect(screen.getByLabelText("남은 기회 3회")).toBeInTheDocument();
    expect(save).toHaveBeenCalledOnce();
    expect(JSON.parse(window.localStorage.getItem("stair-climb:leaderboard:v3")!)).toEqual(records);
  });

  it.each(["stair-climb:leaderboard:v1", "stair-climb:leaderboard:v2"])("keeps play and restart available when %s cleanup fails", async (oldKey) => {
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
    expect(screen.getByText("기록을 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.")).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(oldKey)).toBe("old scores");
    expect(window.localStorage.getItem("stair-climb:leaderboard:v3")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(document.querySelector(".game-frame")).toHaveAttribute("data-game-status", "playing");
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
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
    fireEvent.keyDown(screen.getByRole("button", { name: "앞으로 한 칸 오르기" }), { key: " ", code: "Space" });
    expect(input).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "앞으로 한 칸 오르기" }), { detail: 0 });
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
    vi.useFakeTimers(); vi.setSystemTime(0); seedBox({ lives: 1 });
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
    expect(save).toHaveBeenCalledOnce();
    expect(audio.playFootstep).toHaveBeenCalledTimes(2);
    expect(audio.playFall).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(save).toHaveBeenCalledOnce();
  });
});

describe("dedicated jump animation lifecycle", () => {
  afterEach(() => { cleanup(); window.localStorage.clear(); vi.useRealTimers(); });
  function readyAt(index = 1, overrides: Partial<GameState> = {}): GameState {
    let state = gameEngine.startGame(createGameState(() => 0), 0);
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
    expect(motion.style.getPropertyValue("--jump-y")).toBe("56px");
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
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
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
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "0");
    expect(document.querySelector(".jump-overlay")).toBeNull();
    expect(screen.getAllByTestId("runner")).toHaveLength(1);
  });

  it("finishes a final jump without an arc while preserving the successful sound and one save", () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const originalStart = gameEngine.startGame;
    vi.spyOn(gameEngine, "startGame").mockImplementation((state, now) => withPursuitAt({ ...originalStart(state, now), stage: 5, stageEndsAt: now + 50_000 }, now));
    const ready = readyAt(1, { stage: 5, score: 1499 });
    const audio = { startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn() } satisfies AudioController;
    vi.spyOn(gameEngine, "createGameState").mockReturnValue(ready);
    const save = vi.spyOn(Storage.prototype, "setItem");
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("최종 클리어!")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("1501");
    expect(document.querySelector(".jump-overlay")).toBeNull();
    expect(screen.getByTestId("runner")).toHaveAttribute("data-motion-kind", "idle");
    expect(audio.playFootstep).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
  });
});
