import { applyInput, createGameState, resumeGameAfterPause, startGame, tickGame } from "../game/gameEngine";
import { revealObstacles } from "../game/stairObstacles";
import type { GameInput, GameState } from "../game/types";

function validateDescentSession(state: GameState): void {
  if (state.stage !== 1 ||
    (state.highestClearedStage !== 0 && state.highestClearedStage !== 1) ||
    (state.clearedStageThisRun !== 0 && state.clearedStageThisRun !== 1) ||
    state.status === "checkpoint" || state.checkpointEnteredAt !== null) {
    throw new RangeError("Descent supports only a single stage without checkpoints.");
  }
}

export function createDescentState(random: () => number = Math.random): GameState {
  return createGameState(random, { stage: 1, highestClearedStage: 0 });
}

export function resetDescent(random: () => number = Math.random): GameState {
  return createDescentState(random);
}

export function startDescent(state: GameState, nowMs: number): GameState {
  validateDescentSession(state);
  return startGame(state, nowMs);
}

export function tickDescent(state: GameState, nowMs: number): GameState {
  validateDescentSession(state);
  return tickGame(state, nowMs);
}

export function resumeDescentAfterPause(state: GameState, openedAtMs: number, closedAtMs: number): GameState {
  validateDescentSession(state);
  return resumeGameAfterPause(state, openedAtMs, closedAtMs);
}

export function applyDescentInput(state: GameState, input: GameInput, nowMs: number): GameState {
  validateDescentSession(state);
  const next = applyInput(state, input, nowMs);
  if (next.status !== "checkpoint") return next;

  return {
    ...next,
    status: "game-over",
    endReason: "cleared",
    checkpointEnteredAt: null,
    stageEndsAt: null,
    nextPursuerStepAt: null,
    eventEndsAt: null,
    recoveryEndsAt: null,
    captureEndsAt: null,
    lastMistake: false,
    lastPursuerMove: null,
    // The climbing engine reveals stage-two decisions at its checkpoint.
    // Reveal from the previous decisions instead, keeping this experiment at stage one.
    obstacles: revealObstacles(state.obstacles, next.route, next.stepsClimbed, 1),
  };
}
