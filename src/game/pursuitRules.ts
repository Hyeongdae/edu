import type { GameState } from "./types";

export const PURSUER_CATCH_UP_START_DISTANCE = 15;
export const PURSUER_CATCH_UP_END_DISTANCE = 6;
export const PURSUER_CATCH_UP_INTERVAL_MS = 100;
export const PURSUER_POLL_INTERVAL_MS = 50;

export function getPursuerCatchUpState(wasCatchingUp: boolean, distance: number): boolean {
  return wasCatchingUp ? distance > PURSUER_CATCH_UP_END_DISTANCE : distance >= PURSUER_CATCH_UP_START_DISTANCE;
}

export function getPursuerMotionDurationMs(state: Pick<GameState, "isPursuerCatchingUp">): number {
  return state.isPursuerCatchingUp ? PURSUER_CATCH_UP_INTERVAL_MS : 240;
}
