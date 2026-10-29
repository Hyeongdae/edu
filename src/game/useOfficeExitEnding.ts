import { useEffect, useState } from "react";
import type { StageResult } from "./types";

export const OFFICE_EXIT_DURATION_MS = 4_000;

export interface OfficeExitEndingState {
  isEnding: boolean;
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

export function useOfficeExitEnding(result: StageResult | null): OfficeExitEndingState {
  const [media] = useState(motionQuery);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => media?.matches ?? false);
  const [completedResult, setCompletedResult] = useState<StageResult | null>(() => media?.matches ? result : null);
  const eligible = result?.stage === 5 && result.outcome === "cleared";

  useEffect(() => {
    if (media === null) return;
    let wasReduced = media.matches;
    const onChange = () => {
      const reduced = media.matches;
      // A result shown without motion stays complete when motion is enabled again.
      if (reduced || wasReduced) setCompletedResult(result);
      wasReduced = reduced;
      setPrefersReducedMotion(reduced);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [media, result]);

  useEffect(() => {
    if (!eligible || result === null || prefersReducedMotion || completedResult === result) return;
    const timeout = window.setTimeout(() => setCompletedResult(result),
      Math.max(0, result.endedAtMs + OFFICE_EXIT_DURATION_MS - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [eligible, result, prefersReducedMotion, completedResult]);

  return { isEnding: eligible && completedResult !== result && !prefersReducedMotion, prefersReducedMotion };
}
