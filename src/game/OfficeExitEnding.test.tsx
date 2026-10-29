import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfficeExitEnding } from "./OfficeExitEnding";
import { OFFICE_EXIT_DURATION_MS, useOfficeExitEnding } from "./useOfficeExitEnding";
import type { StageResult } from "./types";

const completed = (endedAtMs = 0): StageResult => ({ stage: 5, score: 350, remainingTimeCs: 4500, endedAtMs, outcome: "cleared" });
function Probe({ result }: { result: StageResult | null }) {
  const state = useOfficeExitEnding(result);
  return <output data-testid="ending-probe" data-active={state.isEnding} data-reduced={state.prefersReducedMotion} />;
}
const draw = (result: StageResult | null) => render(<StrictMode><Probe result={result} /></StrictMode>);
const active = () => screen.getByTestId("ending-probe").getAttribute("data-active") === "true";
function media(initial = false) {
  let matches = initial;
  const listeners = new Set<() => void>();
  const query = {
    get matches() { return matches; }, media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn((_type: string, handler: () => void) => listeners.add(handler)),
    removeEventListener: vi.fn((_type: string, handler: () => void) => listeners.delete(handler)),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => query));
  return { query, listeners, change(value: boolean) { matches = value; act(() => { for (const listener of [...listeners]) listener(); }); } };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("office exit lifecycle", () => {
  it("keeps a single StrictMode timer until3999ms then completes at4000ms", () => {
    const mock = media(); const view = draw(completed());
    expect(OFFICE_EXIT_DURATION_MS).toBe(4000); expect(active()).toBe(true);
    expect(vi.getTimerCount()).toBe(1); expect(mock.listeners.size).toBe(1);
    act(() => { vi.advanceTimersByTime(3999); }); expect(active()).toBe(true);
    act(() => { vi.advanceTimersByTime(1); }); expect(active()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    view.unmount(); expect(mock.listeners.size).toBe(0);
    expect(mock.query.addEventListener.mock.calls.length).toBe(mock.query.removeEventListener.mock.calls.length);
  });

  it("does not restart the deadline when its parent rerenders", () => {
    media(); const result = completed(), view = draw(result);
    act(() => { vi.advanceTimersByTime(1500); });
    view.rerender(<StrictMode><Probe result={result} /></StrictMode>);
    expect(vi.getTimerCount()).toBe(1);
    act(() => { vi.advanceTimersByTime(2499); }); expect(active()).toBe(true);
    act(() => { vi.advanceTimersByTime(1); }); expect(active()).toBe(false);
  });

  it("waits only the remaining time after a late mount", () => {
    media(); vi.setSystemTime(2500); draw(completed());
    act(() => { vi.advanceTimersByTime(1499); }); expect(active()).toBe(true);
    act(() => { vi.advanceTimersByTime(1); }); expect(active()).toBe(false);
  });

  it("immediately settles an already elapsed deadline", () => {
    media(); vi.setSystemTime(5000); draw(completed());
    act(() => { vi.advanceTimersByTime(0); });
    expect(active()).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels the old result timer and never completes a new result with the stale callback", () => {
    media(); const view = draw(completed());
    act(() => { vi.advanceTimersByTime(1000); });
    view.rerender(<StrictMode><Probe result={completed(1000)} /></StrictMode>);
    expect(vi.getTimerCount()).toBe(1);
    act(() => { vi.advanceTimersByTime(3000); }); expect(active()).toBe(true);
    act(() => { vi.advanceTimersByTime(1000); }); expect(active()).toBe(false);
  });

  it("cancels on reset and unmount, and plays a later run again", () => {
    const mock = media(), view = draw(completed());
    view.rerender(<StrictMode><Probe result={null} /></StrictMode>);
    expect(active()).toBe(false); expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(1000); view.rerender(<StrictMode><Probe result={completed(1000)} /></StrictMode>);
    expect(active()).toBe(true); expect(vi.getTimerCount()).toBe(1);
    view.unmount(); expect(vi.getTimerCount()).toBe(0); expect(mock.listeners.size).toBe(0);
  });

  it.each([1,2,3,4] as const)("does not play at a stage%s clear or checkpoint quit snapshot", stage => {
    media(); draw({ ...completed(), stage });
    expect(active()).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["caught", "time-limit"] as const)("does not play for stage-five%s", outcome => {
    media(); draw({ ...completed(), outcome, remainingTimeCs: 0 });
    expect(active()).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });

  it("shows an initially reduced-motion result immediately and never replays it on enabling motion", () => {
    const mock = media(true); draw(completed());
    expect(active()).toBe(false); expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByTestId("ending-probe")).toHaveAttribute("data-reduced", "true");
    mock.change(false); expect(active()).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });

  it("also consumes a result arriving while reduced motion is already on", () => {
    const mock = media(true), view = draw(null);
    view.rerender(<StrictMode><Probe result={completed()} /></StrictMode>);
    expect(active()).toBe(false); expect(vi.getTimerCount()).toBe(0);
    mock.change(false); expect(active()).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });

  it("finishes immediately when reduce is enabled mid-animation and replays only a fresh run", () => {
    const mock = media(), view = draw(completed());
    act(() => { vi.advanceTimersByTime(1500); }); mock.change(true);
    expect(active()).toBe(false); expect(vi.getTimerCount()).toBe(0);
    mock.change(false); expect(active()).toBe(false);
    view.rerender(<StrictMode><Probe result={null} /></StrictMode>);
    view.rerender(<StrictMode><Probe result={completed(1500)} /></StrictMode>);
    expect(active()).toBe(true); expect(vi.getTimerCount()).toBe(1);
  });

  it.each(["missing", "throws"])("supports a matchMedia API that%s", mode => {
    vi.stubGlobal("matchMedia", mode === "missing" ? undefined : vi.fn(() => { throw Error("unavailable"); }));
    const view = draw(completed()); expect(active()).toBe(true);
    view.unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});

describe("office lobby scene", () => {
  it("labels and focuses the automatic dialog and keeps Tab on its title", () => {
    render(<div className="stair-game pixel-theme"><OfficeExitEnding variant="animated" /></div>);
    const dialog = screen.getByRole("dialog", { name: "오늘도 수고했어요!" });
    const heading = screen.getByRole("heading", { name: "오늘도 수고했어요!" });
    expect(dialog).toHaveAttribute("aria-modal", "true"); expect(heading).toHaveFocus();
    expect(fireEvent.keyDown(heading, { key: "Tab" })).toBe(false);
    expect(fireEvent.keyDown(heading, { key: "Tab", shiftKey: true })).toBe(false);
    expect(heading).toHaveFocus();
    expect(screen.getByRole("img")).toHaveAttribute("viewBox", "0 0 520 400");
    expect(screen.getByRole("img")).toHaveAccessibleName(/1층.*젊은 회사원.*밖으로/);
    expect(screen.getByText("1F")).toBeInTheDocument(); expect(screen.queryByText("02F")).toBeNull();
    expect(screen.getByText("EXIT →")).toBeInTheDocument();
    expect(screen.getByTestId("office-exit-runner")).toHaveAttribute("transform", "translate(145 320)");
    expect(document.querySelectorAll(".pixel-officer")).toHaveLength(1);
    expect(document.querySelector(".pixel-officer")).toHaveAttribute("data-officer-variant", "young");
    expect(document.querySelector('[transform*="scale(1 -1)"]')).toBeNull();
    expect(screen.getByTestId("office-exit-door-left").parentElement).toHaveAttribute("clip-path");
  });

  it("provides a static final scene without a modal or focus theft", () => {
    render(<div className="stair-game pixel-theme"><button autoFocus>결과 버튼</button><OfficeExitEnding variant="complete" /></div>);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "퇴근 완료!" })).toBeVisible();
    expect(screen.getByRole("button", { name: "결과 버튼" })).toHaveFocus();
    expect(document.querySelector(".pixel-officer")).toHaveAttribute("data-officer-pose", "idle");
    expect(document.querySelector(".office-exit-messages")).toBeNull();
  });

  it("uses unique door clips and aligns late-mount CSS progress without resetting it on rerender", () => {
    vi.setSystemTime(2500);
    const view = render(<><OfficeExitEnding variant="animated" startedAtMs={0} /><OfficeExitEnding variant="complete" /></>);
    const clips = Array.from(document.querySelectorAll("clipPath"));
    expect(new Set(clips.map(clip => clip.id)).size).toBe(2);
    const animated = document.querySelector('[data-variant="animated"]') as HTMLElement;
    expect(animated.style.getPropertyValue("--office-exit-offset")).toBe("-2500ms");
    vi.setSystemTime(3000);
    view.rerender(<><OfficeExitEnding variant="animated" startedAtMs={0} /><OfficeExitEnding variant="complete" /></>);
    expect(animated.style.getPropertyValue("--office-exit-offset")).toBe("-2500ms");
  });
});
