import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as audio from "../audio/audioController";
import { DEFAULT_AUDIO_PREFERENCES } from "../audio/audioPreferences";
import { DescentTestApp } from "./DescentTestApp";

function controller() {
  return { startBgm: vi.fn().mockResolvedValue(true), stopBgm: vi.fn(), setEventActive: vi.fn(),
    setPreferences: vi.fn(), playFootstep: vi.fn(), playFall: vi.fn(), dispose: vi.fn() } satisfies audio.AudioController;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); vi.spyOn(Math, "random").mockReturnValue(0); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("independent descent app ownership", () => {
  it("mounts no controller or game when disabled", () => {
    const factory = vi.spyOn(audio, "createAudioController");
    render(<DescentTestApp enabled={false} />);
    expect(screen.getByRole("heading")).toHaveTextContent("로컬 개발 전용 테스트입니다");
    expect(factory).not.toHaveBeenCalled();
    expect(screen.queryByTestId("descent-runner")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts only on explicit click even in StrictMode and disposes its own controller", async () => {
    const c = controller(); vi.spyOn(audio, "createAudioController").mockReturnValue(c);
    const app = render(<StrictMode><DescentTestApp enabled /></StrictMode>);
    expect(c.startBgm).not.toHaveBeenCalled();
    expect(c.setPreferences).toHaveBeenLastCalledWith(DEFAULT_AUDIO_PREFERENCES);
    const button = screen.getByRole("button", { name: "시작하기" });
    await act(async () => { button.click(); button.click(); });
    expect(c.startBgm).toHaveBeenCalledOnce();
    expect(screen.getByTestId("descent-score")).toHaveTextContent("0");
    fireEvent.keyDown(window, { key: "d" });
    expect(c.playFootstep).toHaveBeenCalledOnce();
    app.unmount();
    expect(c.dispose).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries blocked playback without stopping input and keeps preferences in memory", async () => {
    const c = controller(); c.startBgm.mockResolvedValueOnce(false).mockResolvedValue(true);
    vi.spyOn(audio, "createAudioController").mockReturnValue(c);
    const defaults = { ...DEFAULT_AUDIO_PREFERENCES };
    render(<DescentTestApp enabled />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "시작하기" })); });
    fireEvent.keyDown(window, { key: "d" });
    expect(screen.getByTestId("descent-score")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "음악 켜기" })); });
    expect(c.startBgm).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "음악 켜기" })).toBeNull();
    fireEvent.change(screen.getByRole("slider", { name: "배경 음악 음량" }), { target: { value: "37" } });
    fireEvent.click(screen.getByRole("button", { name: "효과음 음소거" }));
    expect(c.setPreferences).toHaveBeenLastCalledWith({ ...defaults, bgmVolume: .37, effectsMuted: true });
    expect(DEFAULT_AUDIO_PREFERENCES).toEqual(defaults);
  });

  it("treats a rejected audio promise as blocked without an unhandled error", async () => {
    const c = controller(); c.startBgm.mockRejectedValueOnce(new Error("blocked"));
    vi.spyOn(audio, "createAudioController").mockReturnValue(c);
    render(<DescentTestApp enabled />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "시작하기" })); });
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    expect(screen.getByRole("button", { name: "음악 켜기" })).toBeInTheDocument();
  });

  it("ignores audio completion after unmount", async () => {
    let resolve!: (value: boolean) => void;
    const c = controller(); c.startBgm.mockReturnValue(new Promise<boolean>(r => { resolve = r; }));
    vi.spyOn(audio, "createAudioController").mockReturnValue(c);
    const app = render(<DescentTestApp enabled />);
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    app.unmount();
    await act(async () => { resolve(false); });
    expect(c.dispose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "음악 켜기" })).toBeNull();
  });

  it("uses no saved data getters or methods across play, settings, failure and restart", async () => {
    const c = controller(); vi.spyOn(audio, "createAudioController").mockReturnValue(c);
    const local = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("blocked"); });
    const session = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw new Error("blocked"); });
    const methods = ["getItem", "setItem", "removeItem", "clear"] as const;
    const spies = methods.map(name => vi.spyOn(Storage.prototype, name));
    const app = render(<DescentTestApp enabled />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "시작하기" })); });
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    fireEvent.change(screen.getByRole("slider", { name: "효과음 음량" }), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "배경 음악 음소거" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    act(() => { vi.advanceTimersByTime(5000); });
    fireEvent.click(screen.getByRole("button", { name: "다시 시작" }));
    expect(screen.getByRole("button", { name: "시작하기" })).toBeInTheDocument();
    app.unmount();
    expect(local).not.toHaveBeenCalled(); expect(session).not.toHaveBeenCalled();
    spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  });
});
