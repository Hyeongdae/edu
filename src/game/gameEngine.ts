import type { ClearedStage, GameInput, GameMove, GameStage, GameStartOptions, GameState } from "./types";
import { advanceStairRoute, countStraightSteps, createStairRoute, getRouteStep } from "./stairRoute";
import { getHighestUnlockedStage, getStageRule, getStageTargetScore, isClearedStage, isGameStage } from "./stageRules";
import { createObstacleState, hasObstacle, revealObstacles } from "./stairObstacles";

const INITIAL_PURSUER_DISTANCE = 4;
const EVENT_STEP_TARGET = 30;
const EVENT_DURATION_MS = 30_000;
const RECOVERY_DURATION_MS = 500;
export const FALL_PURSUER_INTERVAL_MS = 250;
export const STAGE_ONE_DURATION_MS = getStageRule(1).durationMs;
export const STAGE_ONE_TARGET_SCORE = getStageRule(1).scoreRequired;

function validateTime(nowMs: number): void {
  if (!Number.isFinite(nowMs) || nowMs < 0) throw new RangeError("nowMs must be a finite, non-negative number.");
}

function validatePursuit(state: GameState): void {
  getStageRule(state.stage);
  if (!isClearedStage(state.highestClearedStage) || !isClearedStage(state.clearedStageThisRun) ||
    state.highestClearedStage < state.clearedStageThisRun || state.clearedStageThisRun > state.stage ||
    state.stage > getHighestUnlockedStage(state.highestClearedStage) || !Number.isInteger(state.score) || state.score < 0 ||
    (state.status === "checkpoint" && (state.stage === 5 || state.clearedStageThisRun !== state.stage ||
      state.highestClearedStage < state.stage || state.checkpointEnteredAt === null || state.stageEndsAt !== null)) ||
    (state.status !== "checkpoint" && state.checkpointEnteredAt !== null)) {
    throw new RangeError("Invalid checkpoint session.");
  }
  if (
    !Number.isSafeInteger(state.stepsClimbed) || state.stepsClimbed < 0 ||
    !Number.isSafeInteger(state.pursuerIndex) || !Number.isSafeInteger(state.pursuerDistance) ||
    state.pursuerDistance < 1 || state.pursuerDistance !== state.stepsClimbed - state.pursuerIndex ||
    !Number.isSafeInteger(state.captureCount) || state.captureCount < 0 ||
    (state.status === "playing" ? state.stageEndsAt === null || state.nextPursuerStepAt === null : state.nextPursuerStepAt !== null)
  ) throw new RangeError("Invalid pursuit position or clock state.");
  for (const time of [state.stageEndsAt, state.nextPursuerStepAt, state.eventEndsAt, state.recoveryEndsAt, state.captureEndsAt, state.checkpointEnteredAt]) {
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

function getNextPursuerStepAt(state: GameState, atMs: number): number {
  const fastStepAt = atMs + FALL_PURSUER_INTERVAL_MS;
  return state.lastMistake && state.recoveryEndsAt !== null && fastStepAt <= state.recoveryEndsAt
    ? fastStepAt
    : atMs + getStageRule(state.stage).pursuerStepIntervalMs;
}

export function createGameState(random: () => number = Math.random, options: GameStartOptions = {}): GameState {
  if (typeof options !== "object" || options === null) throw new RangeError("Start options must be an object.");
  const stage = options.stage === undefined ? 1 : options.stage;
  const highest = options.highestClearedStage === undefined ? 0 : options.highestClearedStage;
  if (!isGameStage(stage) || !isClearedStage(highest) || stage > getHighestUnlockedStage(highest)) {
    throw new RangeError("Selected stage must be unlocked by cleared progress.");
  }
  const route = createStairRoute(random);
  return {
    status: "ready", stage, stageEndsAt: null, endReason: null,
    score: 0, highestClearedStage: highest, clearedStageThisRun: 0, checkpointEnteredAt: null,
    stepsClimbed: 0, direction: "right",
    straightStepsRemaining: countStraightSteps(route, 0, "right"),
    pursuerDistance: INITIAL_PURSUER_DISTANCE, pursuerIndex: -INITIAL_PURSUER_DISTANCE,
    nextPursuerStepAt: null, lastPursuerMove: null, captureCount: 0, captureEndsAt: null,
    eventSteps: 0, eventEndsAt: null, recoveryEndsAt: null, lastMistake: false, route,
    obstacles: createObstacleState(route, stage), lastMove: null,
  };
}

export function startGame(state: GameState, nowMs: number): GameState {
  validateTime(nowMs);
  validatePursuit(state);
  if (state.status !== "ready") return state;
  return {
    ...state, status: "playing", stageEndsAt: nowMs + getStageRule(state.stage).durationMs, endReason: null,
    nextPursuerStepAt: nowMs + getStageRule(state.stage).pursuerStepIntervalMs,
    lastMove: null,
  };
}

export function tickGame(state: GameState, nowMs: number): GameState {
  validateTime(nowMs);
  validatePursuit(state);
  if (state.status === "checkpoint") return state;
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
      current = { ...current, status: "game-over", endReason: "time-limit", stageEndsAt: null, eventEndsAt: null,
        eventSteps: current.eventEndsAt === at ? 0 : current.eventSteps, nextPursuerStepAt: null,
        recoveryEndsAt: null, captureEndsAt: null, lastMistake: false, lastPursuerMove: null, lastMove: null };
      continue;
    }
    if (current.eventEndsAt === at) current = { ...current, eventEndsAt: null, eventSteps: 0 };
    if (current.recoveryEndsAt === at) current = { ...current, recoveryEndsAt: null, lastMistake: false };
    if (current.captureEndsAt === at) current = { ...current, captureEndsAt: null };
    if (current.status !== "playing" || current.nextPursuerStepAt !== at) continue;

    const fromIndex = current.pursuerIndex;
    const toIndex = fromIndex + 1;
    getRouteStep(current.route, toIndex);
    if (toIndex >= current.stepsClimbed) {
      current = {
        ...current, status: "game-over", endReason: "caught", stageEndsAt: null, eventEndsAt: null,
        pursuerIndex: current.stepsClimbed - 1, pursuerDistance: 1,
        nextPursuerStepAt: null, lastPursuerMove: null,
        captureCount: current.captureCount + 1, captureEndsAt: at + RECOVERY_DURATION_MS,
        recoveryEndsAt: null, lastMistake: false, lastMove: null,
      };
    } else {
      current = { ...current, pursuerIndex: toIndex, pursuerDistance: current.stepsClimbed - toIndex,
        nextPursuerStepAt: getNextPursuerStepAt(current, at), lastPursuerMove: { fromIndex, toIndex, atMs: at } };
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
  if (state.status === "checkpoint" || state.status === "game-over") return 0;
  if (state.stageEndsAt === null) return rule.durationMs / 1000;
  return Math.max(0, Math.ceil((state.stageEndsAt - nowMs) / 1000));
}

export function applyInput(state: GameState, input: GameInput, nowMs: number): GameState {
  const currentState = tickGame(state, nowMs);
  if (currentState.status !== "playing" || currentState.recoveryEndsAt !== null) return currentState;
  const nextStep = getRouteStep(currentState.route, currentState.stepsClimbed + 1);
  const nextIsBlocked = hasObstacle(currentState.obstacles, nextStep.index);
  const landingStep = input === "jump" ? getRouteStep(currentState.route, nextStep.index + 1) : nextStep;
  const inputIsCorrect = input === "jump"
    ? nextIsBlocked && nextStep.direction === currentState.direction &&
      landingStep.direction === currentState.direction && !hasObstacle(currentState.obstacles, landingStep.index)
    : !nextIsBlocked && (nextStep.direction !== currentState.direction ? input === "turn" : input === "forward");
  if (!inputIsCorrect) return { ...currentState, recoveryEndsAt: nowMs + RECOVERY_DURATION_MS,
    nextPursuerStepAt: Math.min(currentState.nextPursuerStepAt!, nowMs + FALL_PURSUER_INTERVAL_MS),
    lastMistake: true, lastMove: null };

  const distance = input === "jump" ? 2 : 1;
  const nextStepsClimbed = landingStep.index;
  const oldest = Math.min(nextStepsClimbed - 4, currentState.pursuerIndex, currentState.lastPursuerMove?.fromIndex ?? currentState.pursuerIndex);
  const route = advanceStairRoute(currentState.route, nextStepsClimbed, oldest);
  const eventIsActive = currentState.eventEndsAt !== null;
  let eventSteps = currentState.eventSteps;
  let eventEndsAt = currentState.eventEndsAt;
  if (!eventIsActive) {
    eventSteps += distance;
    if (eventSteps >= EVENT_STEP_TARGET) { eventSteps = 0; eventEndsAt = nowMs + EVENT_DURATION_MS; }
  }
  const scoreGain = (distance * (eventIsActive ? 2 : 1)) as GameMove["scoreGain"];
  const score = currentState.score + scoreGain;
  const movedState: GameState = {
    ...currentState, score, stepsClimbed: nextStepsClimbed, direction: landingStep.direction,
    straightStepsRemaining: countStraightSteps(route, nextStepsClimbed, landingStep.direction),
    pursuerDistance: nextStepsClimbed - currentState.pursuerIndex,
    eventSteps, eventEndsAt, recoveryEndsAt: null, lastMistake: false, route,
    lastMove: { kind: input === "jump" ? "jump" : "climb", fromIndex: currentState.stepsClimbed,
      toIndex: nextStepsClimbed, scoreGain, isBonus: eventIsActive },
  };
  let result = movedState;
  const completed = score >= getStageTargetScore(currentState.stage);
  if (completed) {
    result = {
      ...movedState,
      clearedStageThisRun: Math.max(movedState.clearedStageThisRun, movedState.stage) as ClearedStage,
      highestClearedStage: Math.max(movedState.highestClearedStage, movedState.stage) as ClearedStage,
      status: movedState.stage === 5 ? "game-over" : "checkpoint",
      endReason: movedState.stage === 5 ? "cleared" : null,
      checkpointEnteredAt: movedState.stage === 5 ? null : nowMs,
      stageEndsAt: null, nextPursuerStepAt: null, lastPursuerMove: null, captureEndsAt: null,
      eventEndsAt: movedState.stage === 5 ? null : movedState.eventEndsAt,
    };
  }
  const revealStage = completed && result.stage < 5 ? (result.stage + 1) as GameStage : result.stage;
  return { ...result, obstacles: revealObstacles(result.obstacles, result.route, nextStepsClimbed, revealStage) };
}

export function continueGame(state: GameState, nowMs: number): GameState {
  validateTime(nowMs);
  validatePursuit(state);
  if (state.status !== "checkpoint") return state;
  const rule = getStageRule((state.stage + 1) as GameStage);
  const pausedMs = Math.max(0, nowMs - state.checkpointEnteredAt!);
  return {
    ...state, status: "playing", stage: rule.stage, score: 0, lastMove: null,
    recoveryEndsAt: null, captureEndsAt: null, lastMistake: false,
    checkpointEnteredAt: null, stageEndsAt: nowMs + rule.durationMs,
    eventEndsAt: state.eventEndsAt === null ? null : state.eventEndsAt + pausedMs,
    pursuerIndex: state.stepsClimbed - INITIAL_PURSUER_DISTANCE, pursuerDistance: INITIAL_PURSUER_DISTANCE,
    nextPursuerStepAt: nowMs + rule.pursuerStepIntervalMs, lastPursuerMove: null,
  };
}

export function quitAtCheckpoint(state: GameState, nowMs: number): GameState {
  validateTime(nowMs);
  validatePursuit(state);
  if (state.status !== "checkpoint") return state;
  return { ...state, status: "game-over", endReason: "quit", checkpointEnteredAt: null,
    stageEndsAt: null, nextPursuerStepAt: null, eventEndsAt: null, lastMove: null };
}

export function resetGame(random: () => number = Math.random, options: GameStartOptions = {}): GameState {
  return createGameState(random, options);
}
