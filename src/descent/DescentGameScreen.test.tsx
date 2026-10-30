import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioController } from "../audio/audioController";
import { DEFAULT_AUDIO_PREFERENCES } from "../audio/audioPreferences";
import { hasObstacle } from "../game/stairObstacles";
import { getRouteStep } from "../game/stairRoute";
import type { GameInput, GameState } from "../game/types";
import { withObstacle } from "../test/obstacleFixtures";
import * as engine from "./descentEngine";
import { DescentGameScreen } from "./DescentGameScreen";

function audio() {
  return { startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(), setPreferences: vi.fn(),
    playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn() } satisfies AudioController;
}
function draw(strict = false) {
  const c = audio(), enable = vi.fn(), preferences = vi.fn();
  const game = <DescentGameScreen audioController={c} audioPreferences={{ ...DEFAULT_AUDIO_PREFERENCES }}
    autoplayBlocked={false} onAudioPreferencesChange={preferences} onEnableAudio={enable} />;
  return { ...render(strict ? <StrictMode>{game}</StrictMode> : game), c, enable, preferences };
}
const start = () => fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
const key = (key: string, repeat = false) => fireEvent.keyDown(window, { key, code: key === " " ? "Space" : `Key${key.toUpperCase()}`, repeat });
function seedStart(snapshot: (state: GameState, now: number) => GameState) {
  const original = engine.startDescent;
  vi.spyOn(engine, "startDescent").mockImplementation((state, now) => snapshot(original(state, now), now));
}
function legalKeys(untilSteps?: number): string[] {
  let s = engine.startDescent(engine.createDescentState(() => 0), 0);
  const keys: string[] = [];
  while (s.status === "playing" && (untilSteps === undefined || s.stepsClimbed < untilSteps)) {
    const input: GameInput = hasObstacle(s.obstacles, s.stepsClimbed + 1) ? "jump"
      : getRouteStep(s.route, s.stepsClimbed + 1).direction === s.direction ? "forward" : "turn";
    keys.push(input === "jump" ? " " : input === "turn" ? "j" : "d");
    s = engine.applyDescentInput(s, input, 0);
  }
  return keys;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); vi.spyOn(Math, "random").mockReturnValue(0); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("dedicated descending screen", () => {
  it("keeps 50ms polling and animates catch-up at100ms until gap6", () => {
    const tick = vi.spyOn(engine, "tickDescent");
    draw(true); start();
    act(() => { for (const value of legalKeys(11)) key(value); });
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByRole("img")).toHaveAttribute("data-pursuer-index", "-3");
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 14, isPursuerCatchingUp: true });
    act(() => { vi.advanceTimersByTime(700); });
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 7, isPursuerCatchingUp: true });
    expect(screen.getByTestId("descent-pursuer-motion").style.getPropertyValue("--pursuer-step-duration")).toBe("100ms");
    act(() => { vi.advanceTimersByTime(100); });
    expect(tick.mock.results.at(-1)!.value).toMatchObject({ pursuerDistance: 6, isPursuerCatchingUp: false, nextPursuerStepAt: 1400 });
    expect(screen.getByTestId("descent-pursuer-motion").style.getPropertyValue("--pursuer-step-duration")).toBe("240ms");
  });
  it("starts stopped, shows only the one-stage experiment, and arms once", () => {
    const { enable, c } = draw(true);
    expect(screen.getByTestId("descent-score")).toHaveTextContent("0");
    expect(screen.getByTestId("descent-time")).toHaveTextContent("01:30");
    expect(screen.getByTestId("descent-event")).toHaveTextContent("0/30칸");
    expect(screen.getByRole("button", { name: "게임 설정" })).toBeDisabled();
    expect(screen.queryByText(/랭킹|남은 기회|2단계|다음 단계/)).toBeNull();
    expect(c.playFootstep).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    key("d");
    const button = screen.getByRole("button", { name: "시작하기" });
    act(() => { button.click(); button.click(); });
    expect(enable).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "게임 설정" })).toBeEnabled();
    expect(screen.getByTestId("descent-score")).toHaveTextContent("0");
    expect(c.playFootstep).not.toHaveBeenCalled();
  });

  it("maps D/J, counts batched actions once each, and cancels cosmetics at their deadlines", () => {
    const { c } = draw(true); start();
    act(() => { for (let i = 0; i < 5; i++) key("D"); key("J"); });
    expect(screen.getByTestId("descent-score")).toHaveTextContent("6");
    expect(screen.getByTestId("descent-runner")).toHaveAttribute("data-direction", "left");
    expect(screen.getByTestId("descent-score-gain")).toHaveTextContent("+1");
    expect(c.playFootstep).toHaveBeenCalledTimes(6);
    expect(c.playFall).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByTestId("descent-runner-motion")).not.toHaveClass("is-stepping");
    expect(screen.getByTestId("descent-score-gain")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByTestId("descent-score-gain")).toBeNull();
  });

  it.each([false, true])("jumps exactly two stairs with gain2/4 and one footstep (bonus%s)", bonus => {
    // Coherent playing snapshot at takeoff; ready initialization remains fresh and validated.
    seedStart((s, now) => withObstacle({ ...engine.applyDescentInput(s, "forward", now), eventEndsAt: bonus ? now + 30000 : null }, 2));
    const { c } = draw(); start(); key(" ");
    expect(screen.getByTestId("descent-score")).toHaveTextContent(bonus ? "5" : "3");
    expect(screen.getByTestId("descent-runner")).toHaveAttribute("data-route-index", "3");
    expect(screen.getByTestId("descent-score-gain")).toHaveTextContent(bonus ? "+4" : "+2");
    expect(c.playFootstep).toHaveBeenCalledOnce();
    expect(c.playFall).not.toHaveBeenCalled();
    expect(document.querySelector(".descent-jump-overlay")).not.toBeNull();
    key(" ", true);
    expect(c.playFall).not.toHaveBeenCalled();
  });

  it("lets focused button Space activate the button without a second global jump", () => {
    seedStart((s, now) => withObstacle(engine.applyDescentInput(s, "forward", now), 2));
    const { c } = draw(); start();
    const button = screen.getByRole("button", { name: "장애물 점프" });
    button.focus();
    const event = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true });
    fireEvent(button, event);
    expect(event.defaultPrevented).toBe(false);
    // jsdom doesn't synthesize native keyboard click; model that browser click separately.
    fireEvent.click(button, { detail: 0 });
    expect(screen.getByTestId("descent-runner")).toHaveAttribute("data-route-index", "3");
    expect(c.playFootstep).toHaveBeenCalledOnce();
    expect(c.playFall).not.toHaveBeenCalled();
  });

  it("deduplicates primary touch pointerdown and its following detail1 click", () => {
    const { c } = draw(); start();
    const button = screen.getByRole("button", { name: "한 칸 내려가기" });
    const event = new Event("pointerdown", { bubbles: true, cancelable: true });
    Object.assign(event, { isPrimary: true, button: 0 });
    fireEvent(button, event);
    fireEvent.click(button, { detail: 1 });
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByTestId("descent-score")).toHaveTextContent("1");
    expect(c.playFootstep).toHaveBeenCalledOnce();
    for (const props of [{ isPrimary: false, button: 0 }, { isPrimary: true, button: 2 }]) {
      const ignored = new Event("pointerdown", { bubbles: true }); Object.assign(ignored, props); fireEvent(button, ignored);
    }
    expect(c.playFootstep).toHaveBeenCalledOnce();
  });

  it("ignores text entry/defaultPrevented and prevents page scrolling on global Space", () => {
    const { c } = draw(); start();
    const text = document.createElement("div"); text.setAttribute("contenteditable", "plaintext-only");
    const nested = document.createElement("span"); text.append(nested); document.body.append(text);
    fireEvent.keyDown(nested, { key: "d" });
    const canceled = new KeyboardEvent("keydown", { key: "d", cancelable: true }); canceled.preventDefault(); fireEvent(window, canceled);
    expect(c.playFootstep).not.toHaveBeenCalled();
    const space = new KeyboardEvent("keydown", { key: " ", code: "Space", cancelable: true });
    fireEvent(window, space);
    expect(space.defaultPrevented).toBe(true);
    expect(c.playFall).toHaveBeenCalledOnce();
    text.remove();
  });

  it("falls once on wrong input, disables controls and recovers after500ms", () => {
    const { c } = draw(true); start(); key("j"); key("j"); key(" ");
    expect(c.playFall).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "한 칸 내려가기" })).toBeDisabled();
    expect(screen.getByTestId("descent-runner")).toHaveAttribute("data-motion-kind", "fall");
    act(() => { vi.advanceTimersByTime(500); });
    key("d");
    expect(c.playFootstep).toHaveBeenCalledOnce();
    expect(c.playFall).toHaveBeenCalledOnce();
    expect(screen.getByTestId("descent-score")).toHaveTextContent("1");
  });

  it("blocks settings inputs, traps focus, and resumes frozen clocks95seconds later", () => {
    const { c, preferences } = draw(); start();
    const keys = legalKeys(30);
    act(() => { keys.forEach(k => key(k)); });
    expect(screen.getByTestId("descent-event")).toHaveTextContent("30초");
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "설정 닫기" });
    expect(close).toHaveFocus();
    const buttons = dialog.querySelectorAll<HTMLElement>("button,input");
    const last = buttons[buttons.length - 1];
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true }); expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" }); expect(close).toHaveFocus();
    const score = screen.getByTestId("descent-score").textContent;
    act(() => { vi.advanceTimersByTime(95000); });
    key("d"); key("j"); key(" ");
    expect(screen.getByTestId("descent-score")).toHaveTextContent(score!);
    fireEvent.change(screen.getByRole("slider", { name: "배경 음악 음량" }), { target: { value: "65" } });
    expect(preferences).toHaveBeenLastCalledWith({ ...DEFAULT_AUDIO_PREFERENCES, bgmVolume: .65 });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "게임 설정" })).toHaveFocus();
    expect(screen.getByTestId("descent-time")).toHaveTextContent("01:30");
    expect(screen.getByTestId("descent-event")).toHaveTextContent("30초");
    expect(c.setEventActive).toHaveBeenCalledTimes(1);
  });

  it("plays legal engine-derived inputs to final clear and counts every batched success", () => {
    const keys = legalKeys();
    const { c, enable } = draw(true); start();
    act(() => { keys.forEach(k => key(k)); });
    expect(screen.getByRole("heading", { name: "1단계 클리어!" })).toBeInTheDocument();
    const score = Number(screen.getByTestId("descent-score").textContent);
    expect(score).toBe(150);
    expect(c.playFootstep).toHaveBeenCalledTimes(keys.length);
    expect(c.playFall).not.toHaveBeenCalled(); expect(c.stopBgm).toHaveBeenCalledOnce();
    expect(document.querySelector(".descent-jump-overlay,.descent-step-overlay")).toBeNull();
    expect(screen.queryByTestId("descent-score-gain")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 시작" }));
    expect(screen.getByRole("button", { name: "시작하기" })).toBeInTheDocument();
    expect(screen.getByTestId("descent-score")).toHaveTextContent("0");
    expect(screen.getByTestId("descent-event")).toHaveTextContent("0/30칸");
    expect(enable).toHaveBeenCalledOnce();
    start(); expect(enable).toHaveBeenCalledTimes(2);
  });

  it("preserves final jump sound and clears the arc in a near-goal boundary snapshot", () => {
    seedStart((s, now) => withObstacle({ ...engine.applyDescentInput(s, "forward", now), score: 149, eventEndsAt: now + 30000 }, 2));
    const { c } = draw(); start(); key(" ");
    expect(screen.getByRole("heading", { name: "1단계 클리어!" })).toBeInTheDocument();
    expect(screen.getByTestId("descent-score")).toHaveTextContent("150");
    expect(c.playFootstep).toHaveBeenCalledOnce();
    expect(c.stopBgm).toHaveBeenCalledOnce();
    expect(document.querySelector(".descent-jump-overlay")).toBeNull();
    expect(c.setEventActive.mock.calls).toEqual([[true], [false]]);
  });

  it("settles a catch gate, stops once, and cleans all timers/listeners on unmount", () => {
    const { c, unmount } = draw(); start();
    act(() => { vi.advanceTimersByTime(2400); });
    expect(document.querySelector(".descent-game")).toHaveAttribute("data-capture", "true");
    expect(c.stopBgm).toHaveBeenCalledOnce();
    act(() => { vi.advanceTimersByTime(500); });
    expect(document.querySelector(".descent-game")).toHaveAttribute("data-capture", "false");
    expect(screen.getByRole("button", { name: "다시 시작" })).toHaveFocus();
    unmount(); key("d");
    expect(c.playFootstep).not.toHaveBeenCalled();
    expect(c.dispose).not.toHaveBeenCalled(); // Audio lifetime belongs to the app owner.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows time-limit reason from an explicit near-expiry playing snapshot", () => {
    seedStart((s, now) => ({ ...s, score: 149, stageEndsAt: now + 100, nextPursuerStepAt: now + 800 }));
    const { c } = draw(); start();
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByRole("heading", { name: "시간 초과" })).toBeInTheDocument();
    expect(c.playFootstep).not.toHaveBeenCalled();
  });
});
