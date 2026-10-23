export type Direction = "left" | "right";

export type GameInput = "forward" | "turn";

export type GameStatus = "ready" | "playing" | "game-over";

export type GameStage = 1 | 2 | 3 | 4 | 5;

export type GameEndReason = "caught" | "time-limit" | "cleared";

export type StairRunLength = 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;

export type StairRunKind = "long" | "short";

export interface StairRouteStep {
  index: number;
  column: number;
  direction: Direction;
}

export interface StairRoute {
  steps: readonly StairRouteStep[];
  runs: readonly StairRouteRun[];
  rngState: number;
  tailDirection: Direction;
  tailRunLength: StairRunLength;
  tailRunKind: StairRunKind;
  tailStepsRemaining: number;
  tailShortRunsRemaining: 0 | 1;
}

export interface StairRouteRun {
  startIndex: number;
  length: StairRunLength;
  direction: Direction;
  kind: StairRunKind;
}

export interface StairObstacleRun {
  runStartIndex: number;
  runLength: StairRunLength;
  kind: StairRunKind;
  direction: Direction;
  stageAtGeneration: GameStage;
  obstacleIndex: number | null;
}

export interface StairObstacleState {
  rngState: number;
  runs: readonly StairObstacleRun[];
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
