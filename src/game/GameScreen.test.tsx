import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import { GameScreen } from "./GameScreen";
import type { AudioController } from "../audio/audioController";

const account = {
  homeAccountId: "local-account",
  environment: "login.microsoftonline.com",
  tenantId: "tenant-id",
  username: "player@example.com",
  localAccountId: "player",
  name: "홍길동",
} satisfies AccountInfo;

describe("GameScreen controls", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts the game and maps D/J keys to the same engine inputs", () => {
    render(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("score-value")).toHaveTextContent("1");

    fireEvent.keyDown(window, { key: "j" });
    expect(screen.getByLabelText("남은 기회 3회")).toBeVisible();
    expect(screen.getByRole("button", { name: "앞으로 한 칸 오르기" })).toBeDisabled();
    expect(screen.getByText(/발을 헛디뎠어요/)).toBeVisible();
  });

  it("provides labeled touch controls that call the game rules", () => {
    render(<GameScreen account={account} />);

    fireEvent.click(screen.getByRole("button", { name: /시작하기/ }));
    const forwardButton = screen.getByRole("button", { name: "앞으로 한 칸 오르기" });
    const turnButton = screen.getByRole("button", { name: "방향을 바꾸며 오르기" });

    fireEvent.click(forwardButton);
    expect(screen.getByTestId("score-value")).toHaveTextContent("1");

    fireEvent.click(turnButton);
    expect(forwardButton).toBeDisabled();
    expect(turnButton).toBeDisabled();
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
    for (let segment = 0; segment < 6; segment += 1) {
      for (let step = 0; step < 4; step += 1) fireEvent.keyDown(window, { key: "d" });
      fireEvent.keyDown(window, { key: "j" });
    }

    expect(audio.startBgm).toHaveBeenCalledOnce();
    expect(audio.playFootstep).toHaveBeenCalledTimes(30);
    expect(audio.setEventActive).toHaveBeenCalledWith(true);

    fireEvent.keyDown(window, { key: "j" });
    expect(audio.playFall).toHaveBeenCalledOnce();
    expect(audio.stopBgm).not.toHaveBeenCalled();
  });

  it("saves the final score once, shows the ranking, and restarts a fresh game", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
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
    expect(screen.getByRole("heading", { name: "0점" })).toBeVisible();
    expect(screen.getByText("홍길동", { selector: ".leaderboard-name" }).closest("li")).toHaveClass("is-current-player");
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(audio.stopBgm).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("stair-climb:leaderboard:v1")).toContain("local-account");

    fireEvent.click(screen.getByRole("button", { name: /다시 시작/ }));
    expect(audio.startBgm).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "앞으로 한 칸 오르기" })).toBeEnabled();
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
    expect(screen.queryByText(/게임 종료/)).not.toBeInTheDocument();
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
  });
});
