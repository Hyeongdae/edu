import { useEffect, useState } from "react";
import type { StageResult } from "./types";

// The engine's existing staircase catch lasts 500 ms; this does not extend it.
export const OVERTIME_STAIR_CAPTURE_MS = 500;
export const OVERTIME_CAPTURE_DURATION_MS = 2_000;

export type OvertimeCapturePhase = "none" | "capture" | "overtime" | "complete";

export interface OvertimeCaptureEndingState {
  phase: OvertimeCapturePhase;
  sceneStartedAtMs: number | null;
  prefersReducedMotion: boolean;
}

function motionQuery(): MediaQueryList | null {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  } catch {
    return null;
  }
}

export function useOvertimeCaptureEnding(
  result: StageResult | null,
  nowMs: number,
): OvertimeCaptureEndingState {
  const [media] = useState(motionQuery);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => media?.matches ?? false);
  const [consumedResult, setConsumedResult] = useState<StageResult | null>(() => media?.matches ? result : null);
  const [boundaryNowMs, setBoundaryNowMs] = useState(() => Date.now());
  const sceneStartedAtMs = result?.outcome === "caught"
    ? result.endedAtMs + OVERTIME_STAIR_CAPTURE_MS : null;
  const sceneEndsAtMs = sceneStartedAtMs === null ? null : sceneStartedAtMs + OVERTIME_CAPTURE_DURATION_MS;
  const presentationNowMs = Math.max(nowMs, boundaryNowMs);
  let phase: OvertimeCapturePhase = "none";

  if (sceneStartedAtMs !== null && sceneEndsAtMs !== null) {
    phase = prefersReducedMotion || consumedResult === result || presentationNowMs >= sceneEndsAtMs
      ? "complete" : presentationNowMs < sceneStartedAtMs ? "capture" : "overtime";
  }

  useEffect(() => {
    if (!media || typeof media.addEventListener !== "function") return;
    let wasReduced = media.matches;
    const onChange = () => {
      const reduced = media.matches;
      // Consume also on leaving reduced mode: a result received in that mode
      // must not suddenly start moving when the preference is switched back.
      if (reduced || wasReduced) setConsumedResult(result);
      wasReduced = reduced;
      setPrefersReducedMotion(reduced);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, [media, result]);

  useEffect(() => {
    if ((phase !== "capture" && phase !== "overtime") || sceneStartedAtMs === null || sceneEndsAtMs === null) return;
    let timeout: number | undefined;
    const scheduleBoundary = () => {
      const wallTime = Date.now();
      const boundary = wallTime < sceneStartedAtMs ? sceneStartedAtMs : sceneEndsAtMs;
      timeout = window.setTimeout(() => {
        const reachedAt = Date.now();
        setBoundaryNowMs(previous => Math.max(previous, reachedAt));
        // Queue the next absolute boundary even when React batches both clock
        // updates. There is still only one outstanding timeout at a time.
        if (reachedAt < sceneEndsAtMs) scheduleBoundary();
      }, Math.max(0, boundary - wallTime));
    };
    scheduleBoundary();
    return () => window.clearTimeout(timeout);
  }, [result, phase, sceneStartedAtMs, sceneEndsAtMs]);

  return { phase, sceneStartedAtMs, prefersReducedMotion };
}
