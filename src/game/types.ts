export type Direction = "left" | "right";

export type GameInput = "forward" | "turn";

export type GameStatus = "ready" | "playing" | "game-over";

export interface GameState {
  status: GameStatus;
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
}
