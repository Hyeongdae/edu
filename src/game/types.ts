export type Direction = "left" | "right";

export type GameInput = "forward" | "turn" | "jump";

export type GameStatus = "ready" | "playing" | "checkpoint" | "game-over";

export type GameStage = 1 | 2 | 3 | 4 | 5;
export type ClearedStage = 0 | GameStage;
export interface GameStartOptions { stage?: GameStage; highestClearedStage?: ClearedStage; }

export type GameEndReason = "caught" | "time-limit" | "cleared" | "quit";

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

export interface PursuerMove {
  fromIndex: number;
  toIndex: number;
  atMs: number;
}

export interface GameMove {
  kind: "climb" | "jump";
  fromIndex: number;
  toIndex: number;
  scoreGain: 1 | 2 | 4;
  isBonus: boolean;
}

export interface StageResult {
  readonly stage: GameStage;
  readonly score: number;
  readonly remainingTimeCs: number;
  readonly endedAtMs: number;
  readonly outcome: "cleared" | "caught" | "time-limit";
}

export interface GameState {
  status: GameStatus;
  stage: GameStage;
  stageEndsAt: number | null;
  stageResult: StageResult | null;
  endReason: GameEndReason | null;
  score: number;
  stepsClimbed: number;
  highestClearedStage: ClearedStage;
  clearedStageThisRun: ClearedStage;
  checkpointEnteredAt: number | null;
  direction: Direction;
  straightStepsRemaining: number;
  pursuerDistance: number;
  isPursuerCatchingUp: boolean;
  pursuerIndex: number;
  nextPursuerStepAt: number | null;
  lastPursuerMove: PursuerMove | null;
  captureCount: number;
  captureEndsAt: number | null;
  eventSteps: number;
  eventEndsAt: number | null;
  recoveryEndsAt: number | null;
  lastMistake: boolean;
  route: StairRoute;
  obstacles: StairObstacleState;
  lastMove: GameMove | null;
}
