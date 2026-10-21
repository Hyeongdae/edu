import type { Direction, GameInput, GameState } from "./types";

const INITIAL_LIVES = 3;
const INITIAL_PURSUER_DISTANCE = 4;
const MIN_STRAIGHT_STEPS = 4;
const STRAIGHT_STEP_VARIANTS = 3;
const EVENT_STEP_TARGET = 30;
const EVENT_DURATION_MS = 30_000;
const RECOVERY_DURATION_MS = 500;

function validateTime(nowMs: number): void {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new RangeError("nowMs must be a finite, non-negative number.");
  }
}

function nextStraightSteps(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("random must return a number greater than or equal to 0 and less than 1.");
  }

  return Math.floor(value * STRAIGHT_STEP_VARIANTS) + MIN_STRAIGHT_STEPS;
}

function reverseDirection(direction: Direction): Direction {
  return direction === "left" ? "right" : "left";
}

export function createGameState(random: () => number = Math.random): GameState {
  return {
    status: "ready",
    score: 0,
    stepsClimbed: 0,
    lives: INITIAL_LIVES,
    direction: "right",
    straightStepsRemaining: nextStraightSteps(random),
    pursuerDistance: INITIAL_PURSUER_DISTANCE,
    eventSteps: 0,
    eventEndsAt: null,
    recoveryEndsAt: null,
    lastMistake: false,
  };
}

export function startGame(state: GameState): GameState {
  if (state.status !== "ready") {
    return state;
  }

  return { ...state, status: "playing" };
}

export function tickGame(state: GameState, nowMs: number): GameState {
  validateTime(nowMs);

  const eventExpired = state.eventEndsAt !== null && nowMs >= state.eventEndsAt;
  const recoveryExpired = state.recoveryEndsAt !== null && nowMs >= state.recoveryEndsAt;
  if (!eventExpired && !recoveryExpired) {
    return state;
  }

  return {
    ...state,
    ...(eventExpired ? { eventEndsAt: null, eventSteps: 0 } : {}),
    ...(recoveryExpired ? { recoveryEndsAt: null, lastMistake: false } : {}),
  };
}

export function applyInput(
  state: GameState,
  input: GameInput,
  nowMs: number,
  random: () => number = Math.random,
): GameState {
  validateTime(nowMs);
  const currentState = tickGame(state, nowMs);

  if (currentState.status !== "playing" || currentState.recoveryEndsAt !== null) {
    return currentState;
  }

  const isAtCorner = currentState.straightStepsRemaining === 0;
  const inputIsCorrect = isAtCorner ? input === "turn" : input === "forward";

  if (!inputIsCorrect) {
    const nextPursuerDistance = currentState.pursuerDistance - 1;
    const wasCaught = nextPursuerDistance <= 0;
    const nextLives = Math.max(0, currentState.lives - Number(wasCaught));

    return {
      ...currentState,
      lives: nextLives,
      pursuerDistance: wasCaught ? INITIAL_PURSUER_DISTANCE : nextPursuerDistance,
      status: nextLives === 0 ? "game-over" : currentState.status,
      recoveryEndsAt: nowMs + RECOVERY_DURATION_MS,
      lastMistake: true,
    };
  }

  const isTurning = isAtCorner;
  const eventIsActive = currentState.eventEndsAt !== null;
  let nextEventSteps = currentState.eventSteps;
  let nextEventEndsAt = currentState.eventEndsAt;

  if (!eventIsActive) {
    nextEventSteps += 1;
    if (nextEventSteps >= EVENT_STEP_TARGET) {
      nextEventSteps = 0;
      nextEventEndsAt = nowMs + EVENT_DURATION_MS;
    }
  }

  return {
    ...currentState,
    score: currentState.score + (eventIsActive ? 2 : 1),
    stepsClimbed: currentState.stepsClimbed + 1,
    direction: isTurning ? reverseDirection(currentState.direction) : currentState.direction,
    straightStepsRemaining: isTurning
      ? nextStraightSteps(random)
      : currentState.straightStepsRemaining - 1,
    eventSteps: nextEventSteps,
    eventEndsAt: nextEventEndsAt,
    recoveryEndsAt: null,
    lastMistake: false,
  };
}

export function resetGame(random: () => number = Math.random): GameState {
  return createGameState(random);
}
