export type Direction = "left" | "right";

export type GameInput = "forward" | "turn";

export type GameStatus = "ready" | "playing" | "game-over";

export type GameStage = 1 | 2;

export type GameEndReason = "caught" | "time-limit";

export type StairRunLength = 4 | 5 | 6;

export interface StairRouteStep {
  index: number;
  column: number;
  direction: Direction;
}

export interface StairRoute {
  steps: readonly StairRouteStep[];
  rngState: number;
  tailDirection: Direction;
  tailRunLength: StairRunLength;
  tailStepsRemaining: number;
}

export interface GameState {
  status: GameStatus;
  stage: GameStage;
  stageEndsAt: number | null;
  endReason: GameEndReason | null;
  score: number;
  stepsClimbed: number;
  lives: number;
  direction: Direction;
  straightStepsRemaining: number;
  pursuerDistance: number;
  eventSteps: number;
  eventEndsAt: number | null;
  recoveryEndsAt: number | null;
  lastMistake: boolean;
  route: StairRoute;
}
