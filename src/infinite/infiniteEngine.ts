import { advanceStairRoute, countStraightSteps, createStairRoute, getRouteStep } from "../game/stairRoute";
import {
  PURSUER_CATCH_UP_INTERVAL_MS,
} from "../game/pursuitRules";
import type { PursuerMove, StairRoute } from "../game/types";
import type { InfiniteGameState, InfiniteInput } from "./types";

const INITIAL_PURSUER_DISTANCE = 4;
const BASE_PURSUER_INTERVAL_MS = 250;
const MIN_PURSUER_INTERVAL_MS = 100;
const PURSUER_SPEED_SCORE_STEP = 50;
const PURSUER_INTERVAL_REDUCTION_MS = 10;
const INFINITE_CATCH_UP_START_DISTANCE = 10;
const INFINITE_CATCH_UP_END_DISTANCE = 6;
const EVENT_STEP_TARGET = 50;
const EVENT_DURATION_MS = 30_000;
const TERMINAL_ANIMATION_MS = 500;
const HISTORY_STEPS = 4;
const FUTURE_STEPS = 18;

function validateTime(nowMs: number): void {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new RangeError("nowMs must be a finite, non-negative number.");
  }
}

function validateDeadline(value: number | null): void {
  if (value !== null) validateTime(value);
}

function validateState(state: InfiniteGameState): void {
  if (
    !state || (state.status !== "ready" && state.status !== "playing" && state.status !== "game-over") ||
    !Number.isSafeInteger(state.score) || state.score < 0 ||
    !Number.isSafeInteger(state.stepsClimbed) || state.stepsClimbed < 0 ||
    (state.direction !== "left" && state.direction !== "right") ||
    !Number.isSafeInteger(state.straightStepsRemaining) || state.straightStepsRemaining < 0 ||
    !Number.isSafeInteger(state.pursuerIndex) ||
    !Number.isSafeInteger(state.pursuerDistance) || state.pursuerDistance < 1 ||
    state.pursuerDistance !== state.stepsClimbed - state.pursuerIndex ||
    typeof state.isPursuerCatchingUp !== "boolean" ||
    !Number.isSafeInteger(state.captureCount) || state.captureCount < 0 ||
    !Number.isSafeInteger(state.eventSteps) || state.eventSteps < 0 || state.eventSteps >= EVENT_STEP_TARGET ||
    typeof state.lastMistake !== "boolean" ||
    !Array.isArray(state.route?.steps) || !Array.isArray(state.route?.runs)
  ) {
    throw new RangeError("Invalid infinite game state.");
  }

  const playing = state.status === "playing";
  if (
    (playing ? state.nextPursuerStepAt === null : state.nextPursuerStepAt !== null) ||
    (state.status === "ready" && (state.endReason !== null || state.lastMistake || state.captureEndsAt !== null || state.fallEndsAt !== null)) ||
    (playing && (state.endReason !== null || state.captureEndsAt !== null || state.fallEndsAt !== null || state.lastMistake)) ||
    (state.status === "game-over" && state.endReason === null) ||
    (state.endReason === "fall" && (!state.lastMistake || state.captureEndsAt !== null)) ||
    (state.endReason === "caught" && (state.lastMistake || state.fallEndsAt !== null)) ||
    (state.endReason !== null && state.endReason !== "fall" && state.endReason !== "caught")
  ) {
    throw new RangeError("Invalid infinite game status or deadline.");
  }
  if (state.eventEndsAt !== null && (!playing || state.eventSteps !== 0)) {
    throw new RangeError("An active event must have a playing state and a reset gauge.");
  }

  validateDeadline(state.nextPursuerStepAt);
  validateDeadline(state.eventEndsAt);
  validateDeadline(state.captureEndsAt);
  validateDeadline(state.fallEndsAt);

  const playerStep = getRouteStep(state.route, state.stepsClimbed);
  getRouteStep(state.route, state.pursuerIndex);
  if (
    playerStep.direction !== state.direction ||
    state.straightStepsRemaining !== countStraightSteps(state.route, state.stepsClimbed, state.direction)
  ) {
    throw new RangeError("Infinite player state does not match its route.");
  }
  if (state.lastPursuerMove !== null) {
    validatePursuerMove(state.lastPursuerMove, state.pursuerIndex, state.route);
  }
  if (state.lastMove !== null) {
    const move = state.lastMove;
    if (
      !Number.isSafeInteger(move.fromIndex) || move.fromIndex + 1 !== move.toIndex ||
      move.toIndex !== state.stepsClimbed || (move.scoreGain !== 1 && move.scoreGain !== 2) ||
      typeof move.isBonus !== "boolean"
    ) {
      throw new RangeError("Invalid infinite player move.");
    }
    getRouteStep(state.route, move.fromIndex);
    if (move.isBonus !== (move.scoreGain === 2)) throw new RangeError("Infinite move bonus does not match its score.");
  }
}

function validatePursuerMove(move: PursuerMove, pursuerIndex: number, route: StairRoute): void {
  if (
    !Number.isSafeInteger(move.fromIndex) || move.fromIndex + 1 !== move.toIndex ||
    move.toIndex !== pursuerIndex || !Number.isFinite(move.atMs) || move.atMs < 0
  ) {
    throw new RangeError("Invalid infinite pursuer move.");
  }
  getRouteStep(route, move.fromIndex);
}

function retainRoute(state: InfiniteGameState): InfiniteGameState {
  const oldestRequired = Math.min(
    state.stepsClimbed - HISTORY_STEPS,
    state.pursuerIndex,
    state.lastPursuerMove?.fromIndex ?? state.pursuerIndex,
  );
  if (
    state.route.steps[0].index === oldestRequired &&
    state.route.steps.at(-1)!.index >= state.stepsClimbed + FUTURE_STEPS
  ) {
    return state;
  }
  return {
    ...state,
    route: advanceStairRoute(state.route, state.stepsClimbed, oldestRequired),
  };
}

function nextPursuerDeadline(
  state: Pick<InfiniteGameState, "score" | "isPursuerCatchingUp">,
  atMs: number,
): number {
  return atMs + getInfinitePursuerIntervalMs(state);
}

function getInfiniteCatchUpState(wasCatchingUp: boolean, distance: number): boolean {
  return wasCatchingUp ? distance > INFINITE_CATCH_UP_END_DISTANCE : distance >= INFINITE_CATCH_UP_START_DISTANCE;
}

export function getInfinitePursuerIntervalMs(
  state: Pick<InfiniteGameState, "score" | "isPursuerCatchingUp">,
): number {
  if (state.isPursuerCatchingUp) return PURSUER_CATCH_UP_INTERVAL_MS;
  const speedSteps = Math.floor(state.score / PURSUER_SPEED_SCORE_STEP);
  return Math.max(MIN_PURSUER_INTERVAL_MS, BASE_PURSUER_INTERVAL_MS - speedSteps * PURSUER_INTERVAL_REDUCTION_MS);
}

export function createInfiniteGameState(random: () => number = Math.random): InfiniteGameState {
  const route = createStairRoute(random);
  const direction = getRouteStep(route, 0).direction;
  return {
    status: "ready",
    endReason: null,
    score: 0,
    stepsClimbed: 0,
    direction,
    straightStepsRemaining: countStraightSteps(route, 0, direction),
    pursuerDistance: INITIAL_PURSUER_DISTANCE,
    pursuerIndex: -INITIAL_PURSUER_DISTANCE,
    isPursuerCatchingUp: false,
    nextPursuerStepAt: null,
    lastPursuerMove: null,
    captureCount: 0,
    captureEndsAt: null,
    fallEndsAt: null,
    eventSteps: 0,
    eventEndsAt: null,
    lastMistake: false,
    route,
    lastMove: null,
  };
}

export function startInfiniteGame(state: InfiniteGameState, nowMs: number): InfiniteGameState {
  validateTime(nowMs);
  validateState(state);
  if (state.status !== "ready") return state;
  return {
    ...state,
    status: "playing",
    nextPursuerStepAt: nowMs + getInfinitePursuerIntervalMs(state),
    lastMove: null,
  };
}

export function tickInfiniteGame(state: InfiniteGameState, nowMs: number): InfiniteGameState {
  validateTime(nowMs);
  validateState(state);
  if (state.status !== "playing") {
    if (state.status !== "game-over") return state;
    const captureEndsAt = state.captureEndsAt !== null && state.captureEndsAt <= nowMs ? null : state.captureEndsAt;
    const fallEndsAt = state.fallEndsAt !== null && state.fallEndsAt <= nowMs ? null : state.fallEndsAt;
    if (captureEndsAt === state.captureEndsAt && fallEndsAt === state.fallEndsAt) return state;
    const next = { ...state, captureEndsAt, fallEndsAt };
    validateState(next);
    return next;
  }

  let current = state;
  while (current.status === "playing") {
    const at = Math.min(current.nextPursuerStepAt!, current.eventEndsAt ?? Infinity);
    if (!Number.isFinite(at) || at > nowMs) break;

    if (current.eventEndsAt === at) current = { ...current, eventEndsAt: null, eventSteps: 0 };
    if (current.status !== "playing" || current.nextPursuerStepAt !== at) continue;

    const fromIndex = current.pursuerIndex;
    const toIndex = fromIndex + 1;
    const toStep = getRouteStep(current.route, toIndex);
    if (toIndex >= current.stepsClimbed) {
      current = {
        ...current,
        status: "game-over",
        endReason: "caught",
        pursuerIndex: current.stepsClimbed - 1,
        pursuerDistance: 1,
        nextPursuerStepAt: null,
        lastPursuerMove: null,
        isPursuerCatchingUp: false,
        captureCount: current.captureCount + 1,
        captureEndsAt: at + TERMINAL_ANIMATION_MS,
        eventSteps: 0,
        eventEndsAt: null,
        fallEndsAt: null,
        lastMistake: false,
        lastMove: null,
      };
      continue;
    }

    const pursuerDistance = current.stepsClimbed - toIndex;
    const isPursuerCatchingUp = getInfiniteCatchUpState(current.isPursuerCatchingUp, pursuerDistance);
    const move: PursuerMove = { fromIndex, toIndex, atMs: at };
    const moved = {
      ...current,
      pursuerIndex: toIndex,
      pursuerDistance,
      isPursuerCatchingUp,
      lastPursuerMove: move,
    };
    // Keep getRouteStep in this transition so the actual traversed stair is validated before position changes.
    if (toStep.index !== toIndex) throw new RangeError("Pursuer must move on a real stair.");
    current = { ...moved, nextPursuerStepAt: nextPursuerDeadline(moved, at) };
  }
  return current === state ? state : retainRoute(current);
}

export function applyInfiniteInput(
  state: InfiniteGameState,
  input: InfiniteInput,
  nowMs: number,
): InfiniteGameState {
  if (input !== "forward" && input !== "turn") throw new RangeError("Infinite input must be forward or turn.");
  const current = tickInfiniteGame(state, nowMs);
  if (current.status !== "playing") return current;

  const nextStep = getRouteStep(current.route, current.stepsClimbed + 1);
  const inputIsCorrect = nextStep.direction === current.direction
    ? input === "forward"
    : input === "turn";
  if (!inputIsCorrect) {
    const fallen: InfiniteGameState = {
      ...current,
      status: "game-over",
      endReason: "fall",
      nextPursuerStepAt: null,
      eventSteps: 0,
      eventEndsAt: null,
      fallEndsAt: nowMs + TERMINAL_ANIMATION_MS,
      captureEndsAt: null,
      lastMistake: true,
      lastPursuerMove: null,
      lastMove: null,
    };
    validateState(fallen);
    return fallen;
  }

  if (current.score === Number.MAX_SAFE_INTEGER) throw new RangeError("Infinite score exceeds the safe integer range.");
  const nextStepsClimbed = nextStep.index;
  const oldestRequired = Math.min(
    nextStepsClimbed - HISTORY_STEPS,
    current.pursuerIndex,
    current.lastPursuerMove?.fromIndex ?? current.pursuerIndex,
  );
  const route = advanceStairRoute(current.route, nextStepsClimbed, oldestRequired);
  const isBonus = current.eventEndsAt !== null;
  const scoreGain = isBonus ? 2 : 1;
  let eventSteps = current.eventSteps;
  let eventEndsAt = current.eventEndsAt;
  if (!isBonus) {
    eventSteps += 1;
    if (eventSteps === EVENT_STEP_TARGET) {
      eventSteps = 0;
      eventEndsAt = nowMs + EVENT_DURATION_MS;
    }
  }

  const pursuerDistance = nextStepsClimbed - current.pursuerIndex;
  const isPursuerCatchingUp = getInfiniteCatchUpState(current.isPursuerCatchingUp, pursuerDistance);
  const moved: InfiniteGameState = {
    ...current,
    score: current.score + scoreGain,
    stepsClimbed: nextStepsClimbed,
    direction: nextStep.direction,
    straightStepsRemaining: countStraightSteps(route, nextStepsClimbed, nextStep.direction),
    pursuerDistance,
    isPursuerCatchingUp,
    nextPursuerStepAt: isPursuerCatchingUp && !current.isPursuerCatchingUp
      ? Math.min(current.nextPursuerStepAt!, nowMs + PURSUER_CATCH_UP_INTERVAL_MS)
      : current.nextPursuerStepAt,
    eventSteps,
    eventEndsAt,
    lastMistake: false,
    route,
    lastMove: {
      fromIndex: current.stepsClimbed,
      toIndex: nextStepsClimbed,
      scoreGain,
      isBonus,
    },
  };
  validateState(moved);
  return moved;
}

export function getInfinitePursuerMotionDurationMs(
  state: Pick<InfiniteGameState, "score" | "isPursuerCatchingUp">,
): number {
  return getInfinitePursuerIntervalMs(state);
}
