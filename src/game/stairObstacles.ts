import { getRouteStep } from "./stairRoute";
import { getStageRule } from "./stageRules";
import type { GameStage, StairObstacleRun, StairObstacleState, StairRoute, StairRouteRun } from "./types";

export const VISIBLE_FUTURE_STEPS = 6;
const UINT32_RANGE = 4_294_967_296;

function validateRun(run: StairRouteRun): void {
  if (
    !run || !Number.isSafeInteger(run.startIndex) || run.startIndex < 1 ||
    !Number.isSafeInteger(run.startIndex + run.length - 1) || !Number.isInteger(run.length) ||
    (run.direction !== "left" && run.direction !== "right") ||
    !(run.kind === "long" ? run.length >= 5 && run.length <= 9 : run.kind === "short" && run.length >= 1 && run.length <= 3)
  ) {
    throw new RangeError("Obstacle placement requires valid run metadata.");
  }
}

export function chooseObstacleIndex(
  run: StairRouteRun,
  stage: GameStage,
  appearanceUnit: number,
  positionUnit: number,
): number | null {
  validateRun(run);
  const rule = getStageRule(stage);
  if ([appearanceUnit, positionUnit].some((unit) => !Number.isFinite(unit) || unit < 0 || unit >= 1)) {
    throw new RangeError("Obstacle selection requires unit values in [0, 1).");
  }
  if (run.kind === "short" || appearanceUnit >= rule.obstacleProbability) return null;
  return run.startIndex + 1 + Math.floor(positionUnit * (run.length - 2));
}

function validateState(state: StairObstacleState, route: StairRoute): void {
  if (
    !Array.isArray(state.runs) || !Number.isInteger(state.rngState) ||
    state.rngState < 0 || state.rngState >= UINT32_RANGE
  ) {
    throw new RangeError("Invalid obstacle generation state.");
  }
  let previousStart = 0;
  for (const record of state.runs) {
    if (!record) throw new RangeError("Invalid obstacle run decision.");
    const run: StairRouteRun = {
      startIndex: record.runStartIndex, length: record.runLength, kind: record.kind, direction: record.direction,
    };
    validateRun(run);
    getStageRule(record.stageAtGeneration);
    if (
      run.startIndex <= previousStart ||
      (record.obstacleIndex !== null && (
        run.kind !== "long" || !Number.isSafeInteger(record.obstacleIndex) ||
        record.obstacleIndex <= run.startIndex || record.obstacleIndex >= run.startIndex + run.length - 1
      ))
    ) {
      throw new RangeError("Invalid or duplicate obstacle run decision.");
    }
    previousStart = run.startIndex;
    const metadata = route.runs.find((entry) => entry.startIndex === run.startIndex);
    if (metadata ? metadata.length !== run.length || metadata.kind !== run.kind || metadata.direction !== run.direction
      : run.startIndex + run.length - 1 >= route.steps[0].index) {
      throw new RangeError("Obstacle decisions must match their original route runs.");
    }
  }
}

export function createObstacleState(route: StairRoute, stage: GameStage): StairObstacleState {
  return revealObstacles({ rngState: (route.rngState ^ 0xa5a5a5a5) >>> 0, runs: [] }, route, 0, stage);
}

export function revealObstacles(
  state: StairObstacleState,
  route: StairRoute,
  playerIndex: number,
  stage: GameStage,
): StairObstacleState {
  getRouteStep(route, playerIndex);
  getRouteStep(route, playerIndex + 18);
  if (playerIndex < 0) throw new RangeError("Obstacle reveal requires a non-negative player index.");
  getStageRule(stage);
  validateState(state, route);
  const runs = state.runs.filter((record) => record.runStartIndex + record.runLength - 1 >= playerIndex - 4);
  const decided = new Set(runs.map((record) => record.runStartIndex));
  let rngState = state.rngState;
  const nextUnit = () => {
    rngState = (Math.imul(rngState, 1_664_525) + 1_013_904_223) >>> 0;
    return rngState / UINT32_RANGE;
  };
  for (const run of route.runs) {
    if (run.startIndex + run.length - 1 < playerIndex - 4 || run.startIndex > playerIndex + VISIBLE_FUTURE_STEPS || decided.has(run.startIndex)) continue;
    const obstacleIndex = chooseObstacleIndex(run, stage, nextUnit(), nextUnit());
    const record: StairObstacleRun = {
      runStartIndex: run.startIndex, runLength: run.length, kind: run.kind,
      direction: run.direction, stageAtGeneration: stage, obstacleIndex,
    };
    runs.push(record);
    decided.add(run.startIndex);
  }
  if (runs.length === state.runs.length && rngState === state.rngState) return state;
  return { rngState, runs: runs.sort((a, b) => a.runStartIndex - b.runStartIndex) };
}

export function hasObstacle(state: StairObstacleState, index: number): boolean {
  if (!Number.isSafeInteger(index)) throw new RangeError("Obstacle index must be a safe integer.");
  return index > 0 && state.runs.some((record) => record.obstacleIndex === index);
}
