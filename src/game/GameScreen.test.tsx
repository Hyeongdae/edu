import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import { GameScreen } from "./GameScreen";
import { StairScene } from "./StairScene";
import { createGameState } from "./gameEngine";
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

    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(35_000);
    });
    expect(eventStatus).toHaveTextContent(remainingBefore!);
    fireEvent.click(screen.getByRole("button", { name: "설정 닫기" }));
    expect(eventStatus).toHaveTextContent(remainingBefore!);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(eventStatus).not.toHaveTextContent("2배 점수");
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
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    const runner = () => screen.getByTestId("runner");
    expect(runner()).toHaveAttribute("data-step-count", "0");

    for (let step = 0; step < 4; step += 1) {
      fireEvent.keyDown(window, { key: "d" });
    }
    expect(runner()).toHaveClass("is-climbing");
    expect(runner()).toHaveAttribute("data-step-count", "4");
    expect(runner()).toHaveAttribute("data-motion-key", "4");
    expect(screen.getByTestId("runner-pose").querySelectorAll(".runner-arm, .runner-leg")).toHaveLength(4);

    fireEvent.keyDown(window, { key: "j" });
    expect(runner()).toHaveAttribute("data-step-count", "5");
    expect(runner()).toHaveAttribute("data-motion-key", "5");
    expect(runner()).toHaveClass("is-climbing");

    fireEvent.keyDown(window, { key: "j" });
    expect(runner()).toHaveClass("is-falling");
    expect(runner()).not.toHaveClass("is-climbing");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(runner()).not.toHaveClass("is-falling");
    expect(runner()).not.toHaveClass("is-climbing");
  });

  it("moves the pursuer along the real history by one stair for each mistake", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    let pursuer = screen.getByTestId("pursuer");
    expect(pursuer).toHaveAttribute("data-route-index", "-4");
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "0");
    expect(screen.getAllByTestId("stair-step").map((step) => step.getAttribute("data-route-index")))
      .toEqual(["6", "5", "4", "3", "2", "1", "0", "-1", "-2", "-3", "-4"]);

    fireEvent.keyDown(window, { key: "j" });
    pursuer = screen.getByTestId("pursuer");
    expect(pursuer).toHaveAttribute("data-route-index", "-3");
    expect(pursuer).toHaveClass("is-approaching");
    expect(pursuer).toHaveAttribute("data-motion-key", "1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.keyDown(window, { key: "j" });
    pursuer = screen.getByTestId("pursuer");

    expect(pursuer).toHaveAttribute("data-route-index", "-2");
    expect(pursuer).toHaveAttribute("data-motion-key", "2");
    expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "0");
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
    expect(screen.getByLabelText("남은 기회 3회")).toBeVisible();
  });

  it("advances both route indices on correct inputs and turns each actor at its own corner", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<GameScreen account={account} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    for (let index = 1; index <= 5; index += 1) {
      const nextStair = screen.getAllByTestId("stair-step").find((step) => step.getAttribute("data-route-index") === String(index))!;
      const direction = nextStair.getAttribute("data-direction");
      climbOneStep();
      expect(screen.getByTestId("runner")).toHaveAttribute("data-direction", direction);
      expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", String(index));
      expect(screen.getByTestId("runner")).toHaveAttribute("transform", "translate(260 216)");
      expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", String(index - 4));
      expect(screen.getByTestId("pursuer")).toHaveAttribute("data-motion-key", String(index));
      expect(screen.getByTestId("pursuer")).toHaveClass("is-following");
    }
    expect(screen.getByTestId("runner")).toHaveAttribute("data-direction", "left");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-direction", "right");
    // The first run is four stairs, the new run is five; J already consumed one.
    expect(screen.getByTestId("route-direction")).toHaveTextContent("4칸 더 올라가세요");
    for (let step = 0; step < 4; step += 1) climbOneStep();
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "5");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-direction", "left");
    expect(screen.getByTestId("route-direction")).toHaveTextContent("지금 방향을 바꾸세요");
  });

  it("replays every mistake at the recovery boundary even when lastMistake stays true", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const audio = {
      startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
      setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn(),
    } satisfies AudioController;
    render(<GameScreen account={account} audioController={audio} />);
    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    for (let step = 0; step < 6; step += 1) climbOneStep();
    for (let mistake = 1; mistake <= 4; mistake += 1) {
      // Do not run intervals: applyInput itself expires the previous recovery.
      const previousPose = screen.getByTestId("runner-pose");
      vi.setSystemTime(1_000 + mistake * 500);
      fireEvent.keyDown(window, { key: "j" });
      expect(screen.getByTestId("runner-pose")).not.toBe(previousPose);
      expect(audio.playFall).toHaveBeenCalledTimes(mistake);
      expect(screen.getByTestId("pursuer")).toHaveAttribute("data-motion-key", String(6 + mistake));
      expect(screen.getAllByTestId("pursuer")).toHaveLength(1);
      expect(screen.getAllByTestId("runner")).toHaveLength(1);
      expect(screen.getByTestId("runner")).toHaveAttribute("data-route-index", "6");
      expect(screen.getByTestId("score-value")).toHaveTextContent("6");
    }
    const pursuer = screen.getByTestId("pursuer");
    expect(pursuer).toHaveClass("is-caught");
    expect(pursuer).toHaveAttribute("data-route-index", "2");
    expect(pursuer.parentElement).toHaveClass("catch-overlay");
    expect(pursuer.style.getPropertyValue("--catch-x-1")).toBe("0%");
    expect(pursuer.style.getPropertyValue("--catch-x-4")).toBe(`${68 / 520 * 100}%`);
    expect(Number.parseFloat(pursuer.style.getPropertyValue("--catch-y-1"))).toBeCloseTo(-28);
    expect(pursuer.style.getPropertyValue("--catch-facing-1")).toBe("-1");
    expect(pursuer.style.getPropertyValue("--catch-facing-6")).toBe("1");
    expect(screen.getByLabelText("남은 기회 2회")).toBeVisible();
    expect(audio.playFootstep).toHaveBeenCalledTimes(6);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId("pursuer")).not.toHaveClass("is-caught");
    expect(screen.getByTestId("pursuer").parentElement).toHaveAttribute("data-route-index", "2");
  });

  it("clips only the foot area and keeps SVG definition IDs unique between scenes", () => {
    const state = createGameState(() => 0);
    const props = { state, climbAnimationKey: 0, isClimbing: false, pursuerAnimationKey: 0, isPursuerCaught: false };
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
    for (let mistake = 0; mistake < 12; mistake += 1) {
      fireEvent.keyDown(window, { key: "j" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
    }

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
    expect(window.localStorage.getItem("stair-climb:leaderboard:v1")).toContain("local-account");

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
    for (let mistake = 0; mistake < 11; mistake += 1) {
      fireEvent.keyDown(window, { key: "j" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
    }

    fireEvent.keyDown(window, { key: "j" });
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
    for (let mistake = 0; mistake < 12; mistake += 1) {
      fireEvent.keyDown(window, { key: "j" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
    }

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
    for (let mistake = 0; mistake < 12; mistake += 1) {
      vi.setSystemTime(1_000 + mistake * 500);
      fireEvent.keyDown(window, { key: "j" });
    }
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
    expect(screen.getByTestId("pursuer")).toHaveClass("is-approaching");
    expect(screen.getByTestId("pursuer")).toHaveAttribute("data-route-index", "-3");
  });
});
