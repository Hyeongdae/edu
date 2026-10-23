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
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new RangeError("nowMs must be a finite, non-negative number.");
}

function validatePursuit(state: GameState): void {
  getStageRule(state.stage);
  if (
    !Number.isSafeInteger(state.stepsClimbed) || state.stepsClimbed < 0 ||
    !Number.isSafeInteger(state.pursuerIndex) || !Number.isSafeInteger(state.pursuerDistance) ||
    state.pursuerDistance < 1 || state.pursuerDistance !== state.stepsClimbed - state.pursuerIndex ||
    !Number.isSafeInteger(state.captureCount) || state.captureCount < 0 ||
    (state.status === "playing" ? state.stageEndsAt === null || state.nextPursuerStepAt === null : state.nextPursuerStepAt !== null)
  ) throw new RangeError("Invalid pursuit position or clock state.");
  for (const time of [state.stageEndsAt, state.nextPursuerStepAt, state.eventEndsAt, state.recoveryEndsAt, state.captureEndsAt]) {
    if (time !== null) validateTime(time);
  }
  getRouteStep(state.route, state.stepsClimbed);
  getRouteStep(state.route, state.pursuerIndex);
  if (state.lastPursuerMove !== null) {
    const move = state.lastPursuerMove;
    validateTime(move.atMs);
    if (!Number.isSafeInteger(move.fromIndex) || move.fromIndex + 1 !== move.toIndex || move.toIndex !== state.pursuerIndex) {
      throw new RangeError("A pursuer move must join adjacent real stairs.");
    }
    getRouteStep(state.route, move.fromIndex);
  }
}

function retainPursuitRoute(state: GameState): GameState {
  const oldest = Math.min(state.stepsClimbed - 4, state.pursuerIndex, state.lastPursuerMove?.fromIndex ?? state.pursuerIndex);
  if (state.route.steps[0].index === oldest && state.route.steps.at(-1)!.index >= state.stepsClimbed + 18) return state;
  return { ...state, route: advanceStairRoute(state.route, state.stepsClimbed, oldest) };
}

export function createGameState(random: () => number = Math.random): GameState {
  const route = createStairRoute(random);
  return {
    status: "ready", stage: 1, stageEndsAt: null, endReason: null,
    score: 0, stepsClimbed: 0, lives: INITIAL_LIVES, direction: "right",
    straightStepsRemaining: countStraightSteps(route, 0, "right"),
    pursuerDistance: INITIAL_PURSUER_DISTANCE, pursuerIndex: -INITIAL_PURSUER_DISTANCE,
    nextPursuerStepAt: null, lastPursuerMove: null, captureCount: 0, captureEndsAt: null,
    eventSteps: 0, eventEndsAt: null, recoveryEndsAt: null, lastMistake: false, route,
  };
}

export function startGame(state: GameState, nowMs: number): GameState {
  validateTime(nowMs);
  validatePursuit(state);
  if (state.status !== "ready") return state;
  return {
    ...state, status: "playing", stage: 1, stageEndsAt: nowMs + STAGE_ONE_DURATION_MS, endReason: null,
    nextPursuerStepAt: nowMs + getStageRule(1).pursuerStepIntervalMs,
  };
}

export function tickGame(state: GameState, nowMs: number): GameState {
  validateTime(nowMs);
  validatePursuit(state);
  let current = state;
  // Deadlines remain absolute so delayed callbacks and hidden tabs follow the same timeline.
  while (true) {
    const at = Math.min(
      current.status === "playing" ? current.stageEndsAt! : Infinity,
      current.status === "playing" ? current.nextPursuerStepAt! : Infinity,
      current.eventEndsAt ?? Infinity, current.recoveryEndsAt ?? Infinity, current.captureEndsAt ?? Infinity,
    );
    if (!Number.isFinite(at) || at > nowMs) break;
    if (current.status === "playing" && current.stageEndsAt === at) {
      current = { ...current, status: "game-over", endReason: "time-limit", nextPursuerStepAt: null,
        recoveryEndsAt: null, captureEndsAt: null, lastMistake: false, lastPursuerMove: null };
      continue;
    }
    if (current.eventEndsAt === at) current = { ...current, eventEndsAt: null, eventSteps: 0 };
    if (current.recoveryEndsAt === at) current = { ...current, recoveryEndsAt: null, lastMistake: false };
    if (current.captureEndsAt === at) current = { ...current, captureEndsAt: null };
    if (current.status !== "playing" || current.nextPursuerStepAt !== at) continue;

    const interval = getStageRule(current.stage).pursuerStepIntervalMs;
    const fromIndex = current.pursuerIndex;
    const toIndex = fromIndex + 1;
    getRouteStep(current.route, toIndex);
    if (toIndex >= current.stepsClimbed) {
      const lives = Math.max(0, current.lives - 1);
      current = {
        ...current, lives, status: lives === 0 ? "game-over" : "playing", endReason: lives === 0 ? "caught" : null,
        pursuerIndex: current.stepsClimbed - INITIAL_PURSUER_DISTANCE, pursuerDistance: INITIAL_PURSUER_DISTANCE,
        nextPursuerStepAt: lives === 0 ? null : at + interval, lastPursuerMove: null,
        captureCount: current.captureCount + 1, captureEndsAt: at + RECOVERY_DURATION_MS,
        recoveryEndsAt: at + RECOVERY_DURATION_MS, lastMistake: false,
      };
    } else {
      current = { ...current, pursuerIndex: toIndex, pursuerDistance: current.stepsClimbed - toIndex,
        nextPursuerStepAt: at + interval, lastPursuerMove: { fromIndex, toIndex, atMs: at } };
    }
  }
  return current === state ? state : retainPursuitRoute(current);
}

export function resumeGameAfterPause(state: GameState, openedAtMs: number, closedAtMs: number): GameState {
  validateTime(openedAtMs);
  validateTime(closedAtMs);
  const atOpen = tickGame(state, openedAtMs);
  if (atOpen.status !== "playing") return tickGame(atOpen, closedAtMs);
  const pausedMs = Math.max(0, closedAtMs - openedAtMs);
  const resumed = pausedMs === 0 ? atOpen : {
    ...atOpen,
    stageEndsAt: atOpen.stageEndsAt! + pausedMs,
    eventEndsAt: atOpen.eventEndsAt === null ? null : atOpen.eventEndsAt + pausedMs,
    nextPursuerStepAt: atOpen.nextPursuerStepAt! + pausedMs,
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

export function applyInput(state: GameState, input: GameInput, nowMs: number): GameState {
  const currentState = tickGame(state, nowMs);
  if (currentState.status !== "playing" || currentState.recoveryEndsAt !== null) return currentState;
  const nextStep = getRouteStep(currentState.route, currentState.stepsClimbed + 1);
  const inputIsCorrect = nextStep.direction !== currentState.direction ? input === "turn" : input === "forward";
  if (!inputIsCorrect) return { ...currentState, recoveryEndsAt: nowMs + RECOVERY_DURATION_MS, lastMistake: true };

  const nextStepsClimbed = currentState.stepsClimbed + 1;
  const oldest = Math.min(nextStepsClimbed - 4, currentState.pursuerIndex, currentState.lastPursuerMove?.fromIndex ?? currentState.pursuerIndex);
  const route = advanceStairRoute(currentState.route, nextStepsClimbed, oldest);
  const eventIsActive = currentState.eventEndsAt !== null;
  let eventSteps = currentState.eventSteps;
  let eventEndsAt = currentState.eventEndsAt;
  if (!eventIsActive) {
    eventSteps += 1;
    if (eventSteps >= EVENT_STEP_TARGET) { eventSteps = 0; eventEndsAt = nowMs + EVENT_DURATION_MS; }
  }
  const score = currentState.score + (eventIsActive ? 2 : 1);
  const movedState: GameState = {
    ...currentState, score, stepsClimbed: nextStepsClimbed, direction: nextStep.direction,
    straightStepsRemaining: countStraightSteps(route, nextStepsClimbed, nextStep.direction),
    pursuerDistance: nextStepsClimbed - currentState.pursuerIndex,
    eventSteps, eventEndsAt, recoveryEndsAt: null, lastMistake: false, route,
  };
  if (score < getStageRule(currentState.stage).targetScore) return movedState;
  if (currentState.stage === 5) return { ...movedState, status: "game-over", endReason: "cleared",
    nextPursuerStepAt: null, lastPursuerMove: null, captureEndsAt: null };
  const nextRule = getStageRule((currentState.stage + 1) as GameStage);
  return retainPursuitRoute({
    ...movedState, stage: nextRule.stage, stageEndsAt: nowMs + nextRule.durationMs,
    lives: INITIAL_LIVES, pursuerIndex: nextStepsClimbed - INITIAL_PURSUER_DISTANCE,
    pursuerDistance: INITIAL_PURSUER_DISTANCE, nextPursuerStepAt: nowMs + nextRule.pursuerStepIntervalMs,
    lastPursuerMove: null, captureEndsAt: null, endReason: null,
  });
}

export function resetGame(random: () => number = Math.random): GameState {
  return createGameState(random);
}
