import type { GameStage, GameState, StairObstacleState, StairRoute } from "../game/types";
import { getRouteRun, getRouteStep } from "../game/stairRoute";

// Isolate movement regressions from chance while retaining real run metadata and prior decisions.
export function makeObstacleFixture(route: StairRoute, playerIndex: number, stage: GameStage, previous?: StairObstacleState): StairObstacleState {
  return {
    rngState: previous?.rngState ?? 0,
    runs: route.runs.filter((run) => run.startIndex <= playerIndex + 6 && run.startIndex + run.length - 1 >= playerIndex - 4)
      .map((run) => previous?.runs.find((entry) => entry.runStartIndex === run.startIndex) ?? {
        runStartIndex: run.startIndex, runLength: run.length, kind: run.kind, direction: run.direction,
        stageAtGeneration: stage, obstacleIndex: null,
      }),
  };
}

export function withObstacle(state: GameState, index: number): GameState {
  const run = getRouteRun(state.route, index);
  if (!run || run.kind !== "long" || index <= run.startIndex || index >= run.startIndex + run.length - 1 ||
    getRouteStep(state.route, index - 1).direction !== run.direction || getRouteStep(state.route, index + 1).direction !== run.direction) {
    throw new RangeError("A test obstacle needs a long run with clear takeoff and landing stairs.");
  }
  const obstacles = makeObstacleFixture(state.route, state.stepsClimbed, state.stage, state.obstacles);
  if (!obstacles.runs.some((entry) => entry.runStartIndex === run.startIndex)) throw new RangeError("Test obstacle must be exposed.");
  return { ...state, obstacles: { ...obstacles, runs: obstacles.runs.map((entry) => entry.runStartIndex === run.startIndex
    ? { ...entry, obstacleIndex: index } : entry) } };
}
