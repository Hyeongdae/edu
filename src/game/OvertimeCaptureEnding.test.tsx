import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OvertimeCaptureEnding } from "./OvertimeCaptureEnding";
import { OVERTIME_CAPTURE_DURATION_MS, OVERTIME_STAIR_CAPTURE_MS, useOvertimeCaptureEnding } from "./useOvertimeCaptureEnding";
import type { GameStage, StageResult } from "./types";

const caught = (endedAtMs = 0, stage: GameStage = 1): StageResult => Object.freeze({
  stage, score: 80, remainingTimeCs: 7_123, endedAtMs, outcome: "caught",
});

function Probe({ result, nowMs = 0 }: { result: StageResult | null; nowMs?: number }) {
  const state = useOvertimeCaptureEnding(result, nowMs);
  return <output data-testid="overtime-probe" data-phase={state.phase}
    data-start={state.sceneStartedAtMs ?? "none"} data-reduced={state.prefersReducedMotion} />;
}

function draw(result: StageResult | null, nowMs = Date.now()) {
  return render(<StrictMode><Probe result={result} nowMs={nowMs} /></StrictMode>);
}

const phase = () => screen.getByTestId("overtime-probe").getAttribute("data-phase");
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

function media(initial = false) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const query = {
    get matches() { return matches; },
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => query));
  return {
    query, listeners,
    change(reduced: boolean) {
      matches = reduced;
      act(() => { for (const listener of [...listeners]) listener(); });
    },
  };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("overtime capture lifecycle", () => {
  it("keeps one boundary timer under StrictMode and switches at exactly 500 and 2500 ms", () => {
    const motion = media();
    const view = draw(caught());
    expect(OVERTIME_STAIR_CAPTURE_MS).toBe(500);
    expect(OVERTIME_CAPTURE_DURATION_MS).toBe(2000);
    expect(phase()).toBe("capture");
    expect(screen.getByTestId("overtime-probe")).toHaveAttribute("data-start", "500");
    expect(vi.getTimerCount()).toBe(1);
    expect(motion.listeners.size).toBe(1);
    advance(499); expect(phase()).toBe("capture");
    advance(1); expect(phase()).toBe("overtime");
    expect(vi.getTimerCount()).toBe(1);
    advance(1999); expect(phase()).toBe("overtime");
    advance(1); expect(phase()).toBe("complete");
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
    expect(motion.listeners.size).toBe(0);
    expect(motion.query.addEventListener.mock.calls.length).toBe(motion.query.removeEventListener.mock.calls.length);
  });

  it.each([1, 2, 3, 4, 5] as const)("plays a caught result from stage %s", stage => {
    media(); draw(caught(0, stage));
    expect(phase()).toBe("capture");
    advance(500); expect(phase()).toBe("overtime");
  });

  it.each([
    ["absent", null],
    ["cleared", { ...caught(), outcome: "cleared" as const }],
    ["time-limit", { ...caught(), outcome: "time-limit" as const }],
  ])("does not schedule an office sequence for an %s result", (_label, result) => {
    media(); draw(result as StageResult | null);
    expect(phase()).toBe("none");
    expect(screen.getByTestId("overtime-probe")).toHaveAttribute("data-start", "none");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reaches completion even when React batches both timer boundaries", () => {
    media(); draw(caught());
    advance(2500);
    expect(phase()).toBe("complete");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never extends the deadline on parent rerenders", () => {
    media(); const result = caught(), view = draw(result);
    advance(750);
    view.rerender(<StrictMode><Probe result={result} nowMs={750} /></StrictMode>);
    expect(phase()).toBe("overtime");
    expect(vi.getTimerCount()).toBe(1);
    advance(1749); expect(phase()).toBe("overtime");
    advance(1); expect(phase()).toBe("complete");
  });

  it.each([
    { at: 200, expected: "capture", next: 300, after: "overtime" },
    { at: 1200, expected: "overtime", next: 1300, after: "complete" },
    { at: 3000, expected: "complete", next: 0, after: "complete" },
  ])("starts a late mount at $at ms without replaying elapsed phases", ({ at, expected, next, after }) => {
    media(); vi.setSystemTime(at); draw(caught(), at);
    expect(phase()).toBe(expected);
    if (next) { advance(next - 1); expect(phase()).toBe(expected); advance(1); }
    expect(phase()).toBe(after);
    expect(vi.getTimerCount()).toBe(after === "complete" ? 0 : 1);
  });

  it("settles a caller visibility-time jump without waiting for a background timer", () => {
    media(); const result = caught(), view = draw(result);
    vi.setSystemTime(4000);
    view.rerender(<StrictMode><Probe result={result} nowMs={4000} /></StrictMode>);
    expect(phase()).toBe("complete");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("skips the office window when a timer itself arrives after the entire deadline", () => {
    media(); draw(caught());
    vi.setSystemTime(3000);
    act(() => { vi.advanceTimersToNextTimer(); });
    expect(phase()).toBe("complete");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels an old boundary when a fresh result replaces it", () => {
    media(); const view = draw(caught());
    advance(200);
    const next = caught(200);
    view.rerender(<StrictMode><Probe result={next} nowMs={200} /></StrictMode>);
    expect(vi.getTimerCount()).toBe(1);
    advance(300); expect(phase()).toBe("capture");
    advance(200); expect(phase()).toBe("overtime");
    advance(1999); expect(phase()).toBe("overtime");
    advance(1); expect(phase()).toBe("complete");
  });

  it("cleans up on reset/unmount and permits another captured run", () => {
    const motion = media(), view = draw(caught());
    advance(600);
    view.rerender(<StrictMode><Probe result={null} nowMs={600} /></StrictMode>);
    expect(phase()).toBe("none"); expect(vi.getTimerCount()).toBe(0);
    advance(3000);
    view.rerender(<StrictMode><Probe result={caught(3600)} nowMs={3600} /></StrictMode>);
    expect(phase()).toBe("capture"); expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0); expect(motion.listeners.size).toBe(0);
  });

  it("immediately consumes an initially reduced result and permits a later fresh result", () => {
    const motion = media(true), view = draw(caught());
    expect(phase()).toBe("complete"); expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByTestId("overtime-probe")).toHaveAttribute("data-reduced", "true");
    motion.change(false);
    expect(phase()).toBe("complete"); expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(1000);
    view.rerender(<StrictMode><Probe result={caught(1000)} nowMs={1000} /></StrictMode>);
    expect(phase()).toBe("capture"); expect(vi.getTimerCount()).toBe(1);
  });

  it("also consumes a result arriving while reduction is already enabled", () => {
    const motion = media(true), view = draw(null);
    expect(phase()).toBe("none");
    view.rerender(<StrictMode><Probe result={caught()} /></StrictMode>);
    expect(phase()).toBe("complete");
    motion.change(false);
    expect(phase()).toBe("complete"); expect(vi.getTimerCount()).toBe(0);
  });

  it.each([200, 1200])("finishes immediately on reduction at %s ms and does not replay", at => {
    const motion = media(), view = draw(caught());
    advance(at); expect(phase()).toBe(at < 500 ? "capture" : "overtime");
    motion.change(true);
    expect(phase()).toBe("complete"); expect(vi.getTimerCount()).toBe(0);
    motion.change(false); expect(phase()).toBe("complete");
    view.rerender(<StrictMode><Probe result={null} nowMs={at} /></StrictMode>);
    view.rerender(<StrictMode><Probe result={caught(at)} nowMs={at} /></StrictMode>);
    expect(phase()).toBe("capture");
  });

  it.each(["missing", "throws", "no-events"])("tolerates matchMedia that is %s", mode => {
    vi.stubGlobal("matchMedia", mode === "missing" ? undefined : mode === "throws"
      ? vi.fn(() => { throw Error("unavailable"); }) : vi.fn(() => ({ matches: false })));
    const view = draw(caught());
    expect(phase()).toBe("capture");
    advance(2500); expect(phase()).toBe("complete");
    view.unmount(); expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves the frozen captured result and storage untouched throughout presentation", () => {
    media(); const result = caught(), snapshot = JSON.stringify(result);
    const write = vi.spyOn(Storage.prototype, "setItem");
    draw(result); advance(2500);
    expect(phase()).toBe("complete");
    expect(JSON.stringify(result)).toBe(snapshot);
    expect(write).not.toHaveBeenCalled();
  });
});

describe("overtime office scene", () => {
  it("labels and focuses the automatic dialog, traps both Tab directions and offers no skip action", () => {
    render(<div className="stair-game pixel-theme"><OvertimeCaptureEnding variant="animated" /></div>);
    const dialog = screen.getByRole("dialog", { name: "야근 사무실" });
    const heading = screen.getByRole("heading", { name: "야근 사무실" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(heading).toHaveFocus();
    expect(fireEvent.keyDown(heading, { key: "Tab" })).toBe(false);
    expect(fireEvent.keyDown(heading, { key: "Tab", shiftKey: true })).toBe(false);
    expect(heading).toHaveFocus();
    expect(fireEvent.keyDown(heading, { key: "Escape" })).toBe(true);
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("img")).toHaveAccessibleName(/네온.*팔을 붙잡아.*책상.*의자.*고개를 숙입니다/);
    expect(screen.getByRole("img")).toHaveAttribute("viewBox", "0 0 520 400");
  });

  it("provides office context and separate young/older grab, drag and seated artwork", () => {
    render(<div className="stair-game pixel-theme"><OvertimeCaptureEnding variant="animated" /></div>);
    for (const part of ["city-window", "desk", "computer", "documents", "chair"]) {
      expect(document.querySelector(`[data-scene-part="${part}"]`)).toBeInTheDocument();
    }
    const young = screen.getByTestId("overtime-capture-protagonist");
    const older = screen.getByTestId("overtime-capture-pursuer");
    expect(young.querySelector('[data-officer-variant="young"][data-overtime-pose="dragged"]')).toBeInTheDocument();
    expect(young.querySelector('[data-overtime-pose="seated"] .overtime-officer-seated-legs')).toBeInTheDocument();
    expect(older.querySelector('[data-officer-variant="older"][data-overtime-pose="grabbing"] .overtime-officer-grip')).toBeInTheDocument();
    expect(older.querySelector('[data-overtime-pose="standing"]')).toBeInTheDocument();
    // Scene-specific artwork avoids the shared gameplay frame/pose selectors.
    expect(document.querySelector(".pixel-officer, .officer-frame")).toBeNull();
  });

  it("renders a static final illustration without a dialog or stealing result focus", () => {
    render(<div className="stair-game pixel-theme"><button autoFocus>결과 버튼</button><OvertimeCaptureEnding variant="complete" /></div>);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "결과 버튼" })).toHaveFocus();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByTestId("overtime-capture-ending")).toHaveAttribute("data-variant", "complete");
    expect(document.querySelector('[data-overtime-pose="seated"] .overtime-officer-head')).toHaveAttribute("transform", "translate(3 4)");
  });

  it("uses unique clip IDs and preserves a late-mount animation offset on rerender", () => {
    vi.setSystemTime(1700);
    const view = render(<><OvertimeCaptureEnding variant="animated" startedAtMs={500} /><OvertimeCaptureEnding variant="complete" /></>);
    const animated = document.querySelector('[data-variant="animated"]') as HTMLElement;
    expect(animated.style.getPropertyValue("--overtime-capture-offset")).toBe("-1200ms");
    const clips = [...document.querySelectorAll("clipPath")];
    expect(clips).toHaveLength(2);
    expect(new Set(clips.map(clip => clip.id)).size).toBe(2);
    for (const clipped of document.querySelectorAll("[clip-path]")) {
      expect(clips.some(clip => clipped.getAttribute("clip-path") === `url(#${clip.id})`)).toBe(true);
    }
    vi.setSystemTime(2200);
    view.rerender(<><OvertimeCaptureEnding variant="animated" startedAtMs={500} /><OvertimeCaptureEnding variant="complete" /></>);
    expect(animated.style.getPropertyValue("--overtime-capture-offset")).toBe("-1200ms");
  });

  it.each([
    { start: undefined, expected: "0ms" },
    { start: 4000, expected: "0ms" },
    { start: 0, expected: "-2000ms" },
  ])("bounds the initial offset for start $start", ({ start, expected }) => {
    vi.setSystemTime(3000);
    // A future timestamp must be clamped to zero instead of delaying playback.
    render(<OvertimeCaptureEnding variant="animated" startedAtMs={start} />);
    expect(screen.getByTestId("overtime-capture-ending").style.getPropertyValue("--overtime-capture-offset")).toBe(expected);
  });
});
