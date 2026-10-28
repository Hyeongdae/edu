import { getRouteStep } from "../game/stairRoute";
import { getStageRule } from "../game/stageRules";
import { getPursuerCatchUpState, PURSUER_CATCH_UP_INTERVAL_MS } from "../game/pursuitRules";
import type { GameState } from "../game/types";

export function withPursuitAt(state: GameState, nowMs: number, distance = 4): GameState {
  if (!Number.isFinite(nowMs) || nowMs < 0 || !Number.isSafeInteger(distance) || distance < 1) {
    throw new RangeError("Pursuit fixture requires valid time and distance.");
  }
  const pursuerIndex = state.stepsClimbed - distance;
  getRouteStep(state.route, pursuerIndex);
  const isPursuerCatchingUp = state.status === "playing" && getPursuerCatchUpState(false, distance);
  return { ...state, pursuerIndex, pursuerDistance: distance,
    isPursuerCatchingUp,
    nextPursuerStepAt: state.status === "playing"
      ? nowMs + (isPursuerCatchingUp ? PURSUER_CATCH_UP_INTERVAL_MS : getStageRule(state.stage).pursuerStepIntervalMs) : null,
    lastPursuerMove: null, captureEndsAt: null, recoveryEndsAt: null, lastMistake: false };
}
