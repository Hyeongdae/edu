import type { GameInput, GameStage, GameState } from "./types";
import { advanceStairRoute, countStraightSteps, createStairRoute, getRouteStep } from "./stairRoute";
import { getStageRule } from "./stageRules";

const INITIAL_LIVES = 3;
const INITIAL_PURSUER_DISTANCE = 4;
const EVENT_STEP_TARGET = 30;
const EVENT_DURATION_MS = 30_000;
const RECOVERY_DURATION_MS = 500;
export const STAGE_ONE_DURATION_MS = getStageRule(1).durationMs;
export const STAGE_ONE_TARGET_SCORE = getStageRule(1).targetScore;

function validateTime(nowMs: number): void {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new RangeError("nowMs must be a finite, non-negative number.");
  }
}

export function createGameState(random: () => number = Math.random): GameState {
  const route = createStairRoute(random);
  return {
    status: "ready",
    stage: 1,
    stageEndsAt: null,
    endReason: null,
    score: 0,
    stepsClimbed: 0,
    lives: INITIAL_LIVES,
    direction: "right",
    straightStepsRemaining: countStraightSteps(route, 0, "right"),
    pursuerDistance: INITIAL_PURSUER_DISTANCE,
    eventSteps: 0,
    eventEndsAt: null,
    recoveryEndsAt: null,
    lastMistake: false,
    route,
  };
}

export function startGame(state: GameState, nowMs: number): GameState {
  validateTime(nowMs);
  if (state.status !== "ready") {
    return state;
  }

  return {
    ...state,
    status: "playing",
    stage: 1,
    stageEndsAt: nowMs + STAGE_ONE_DURATION_MS,
    endReason: null,
  };
}

export function tickGame(state: GameState, nowMs: number): GameState {
  validateTime(nowMs);

  const eventExpired = state.eventEndsAt !== null && nowMs >= state.eventEndsAt;
  const recoveryExpired = state.recoveryEndsAt !== null && nowMs >= state.recoveryEndsAt;
  const stageExpired = state.status === "playing" &&
    state.stageEndsAt !== null && nowMs >= state.stageEndsAt;
  if (!eventExpired && !recoveryExpired && !stageExpired) {
    return state;
  }

  return {
    ...state,
    ...(eventExpired ? { eventEndsAt: null, eventSteps: 0 } : {}),
    ...(recoveryExpired ? { recoveryEndsAt: null, lastMistake: false } : {}),
    ...(stageExpired ? {
      status: "game-over" as const,
      endReason: "time-limit" as const,
      recoveryEndsAt: null,
      lastMistake: false,
    } : {}),
  };
}

export function resumeGameAfterPause(
  state: GameState,
  openedAtMs: number,
  closedAtMs: number,
): GameState {
  validateTime(openedAtMs);
  validateTime(closedAtMs);
  const atOpen = tickGame(state, openedAtMs);
  if (atOpen.status !== "playing") return tickGame(atOpen, closedAtMs);

  const pausedMs = Math.max(0, closedAtMs - openedAtMs);
  const hasDeadline = atOpen.stageEndsAt !== null || atOpen.eventEndsAt !== null;
  const resumed = pausedMs === 0 || !hasDeadline ? atOpen : {
    ...atOpen,
    stageEndsAt: atOpen.stageEndsAt === null ? null : atOpen.stageEndsAt + pausedMs,
    eventEndsAt: atOpen.eventEndsAt === null ? null : atOpen.eventEndsAt + pausedMs,
  };
  return tickGame(resumed, closedAtMs);
}

export function getStageSecondsLeft(state: GameState, nowMs: number): number {
  validateTime(nowMs);
  const rule = getStageRule(state.stage);
  if (state.endReason === "time-limit" || state.endReason === "cleared") return 0;
  if (state.stageEndsAt === null) return rule.durationMs / 1000;
  return Math.max(0, Math.ceil((state.stageEndsAt - nowMs) / 1000));
}

export function applyInput(
  state: GameState,
  input: GameInput,
  nowMs: number,
): GameState {
  validateTime(nowMs);
  const currentState = tickGame(state, nowMs);

  if (currentState.status !== "playing" || currentState.recoveryEndsAt !== null) {
    return currentState;
  }

  const nextStep = getRouteStep(currentState.route, currentState.stepsClimbed + 1);
  const isAtCorner = nextStep.direction !== currentState.direction;
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
      endReason: nextLives === 0 ? "caught" : null,
      recoveryEndsAt: nowMs + RECOVERY_DURATION_MS,
      lastMistake: true,
    };
  }

  const nextStepsClimbed = currentState.stepsClimbed + 1;
  const route = advanceStairRoute(currentState.route, nextStepsClimbed);
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

  const nextScore = currentState.score + (eventIsActive ? 2 : 1);
  const movedState: GameState = {
    ...currentState,
    score: nextScore,
    stepsClimbed: nextStepsClimbed,
    direction: nextStep.direction,
    straightStepsRemaining: countStraightSteps(route, nextStepsClimbed, nextStep.direction),
    eventSteps: nextEventSteps,
    eventEndsAt: nextEventEndsAt,
    recoveryEndsAt: null,
    lastMistake: false,
    route,
  };

  if (nextScore < getStageRule(currentState.stage).targetScore) return movedState;
  if (currentState.stage === 5) {
    return { ...movedState, status: "game-over", endReason: "cleared" };
  }

  const nextRule = getStageRule((currentState.stage + 1) as GameStage);
  return {
    ...movedState,
    stage: nextRule.stage,
    stageEndsAt: nowMs + nextRule.durationMs,
    lives: INITIAL_LIVES,
    pursuerDistance: INITIAL_PURSUER_DISTANCE,
    endReason: null,
  };
}

export function resetGame(random: () => number = Math.random): GameState {
  return createGameState(random);
}
