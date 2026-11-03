import type { Direction, PursuerMove, StairRoute } from "../game/types";

export type InfiniteGameStatus = "ready" | "playing" | "game-over";
export type InfiniteEndReason = "fall" | "caught";
export type InfiniteInput = "forward" | "turn";

export interface InfiniteMove {
  fromIndex: number;
  toIndex: number;
  scoreGain: 1 | 2;
  isBonus: boolean;
}

export interface InfiniteGameState {
  status: InfiniteGameStatus;
  endReason: InfiniteEndReason | null;
  score: number;
  stepsClimbed: number;
  direction: Direction;
  straightStepsRemaining: number;
  pursuerDistance: number;
  pursuerIndex: number;
  isPursuerCatchingUp: boolean;
  nextPursuerStepAt: number | null;
  lastPursuerMove: PursuerMove | null;
  captureCount: number;
  captureEndsAt: number | null;
  fallEndsAt: number | null;
  eventSteps: number;
  eventEndsAt: number | null;
  lastMistake: boolean;
  route: StairRoute;
  lastMove: InfiniteMove | null;
}
