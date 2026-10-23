import { getRouteStep } from "../game/stairRoute";
import { getStageRule } from "../game/stageRules";
import type { GameState } from "../game/types";

export function withPursuitAt(state: GameState, nowMs: number, distance = 4): GameState {
  if (!Number.isFinite(nowMs) || nowMs < 0 || !Number.isSafeInteger(distance) || distance < 1) {
    throw new RangeError("Pursuit fixture requires valid time and distance.");
  }
  const pursuerIndex = state.stepsClimbed - distance;
  getRouteStep(state.route, pursuerIndex);
  return { ...state, pursuerIndex, pursuerDistance: distance,
    nextPursuerStepAt: state.status === "playing" ? nowMs + getStageRule(state.stage).pursuerStepIntervalMs : null,
    lastPursuerMove: null, captureEndsAt: null, recoveryEndsAt: null, lastMistake: false };
}
