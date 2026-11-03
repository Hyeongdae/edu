import { projectRouteStep } from "../game/stairSceneModel";
import { getRouteStep } from "../game/stairRoute";
import type {
  CatchFrame, SceneActor, ScenePoint, ScenePursuerMotion, SceneStep,
} from "../game/stairSceneModel";
import type { InfiniteGameState } from "./types";

const VISIBLE_STAIR_COUNT = 11;
const VISIBLE_BEHIND = 4;
const VISIBLE_WITH_TRAILING_PURSUER = 5;

export interface InfiniteSceneModel {
  steps: readonly SceneStep[];
  pursuerPreviewSteps: readonly SceneStep[];
  player: SceneActor;
  pursuer: SceneActor;
  catchFrames: readonly CatchFrame[];
  pursuerMotion: ScenePursuerMotion | null;
  pursuerVisible: boolean;
  playerMotion: { from: ScenePoint; to: ScenePoint } | null;
}

export function buildInfiniteSceneModel(state: InfiniteGameState): InfiniteSceneModel {
  if (
    !Number.isSafeInteger(state.stepsClimbed) || state.stepsClimbed < 0 ||
    !Number.isSafeInteger(state.pursuerIndex) || !Number.isSafeInteger(state.pursuerDistance) ||
    state.pursuerDistance < 1 || state.pursuerDistance !== state.stepsClimbed - state.pursuerIndex
  ) {
    throw new RangeError("Infinite scene requires matching route indices and positive pursuer distance.");
  }

  const playerStep = getRouteStep(state.route, state.stepsClimbed);
  const actorAt = (index: number): SceneActor => {
    const step = getRouteStep(state.route, index);
    return { ...projectRouteStep(step, playerStep), index, direction: step.direction };
  };
  const player = actorAt(state.stepsClimbed);
  const pursuer = actorAt(state.pursuerIndex);
  let pursuerMotion: InfiniteSceneModel["pursuerMotion"] = null;
  if (state.lastPursuerMove !== null) {
    const move = state.lastPursuerMove;
    if (
      !Number.isSafeInteger(move.fromIndex) || move.fromIndex + 1 !== move.toIndex ||
      move.toIndex !== state.pursuerIndex || !Number.isFinite(move.atMs) || move.atMs < 0
    ) {
      throw new RangeError("Invalid infinite pursuer motion.");
    }
    pursuerMotion = {
      from: projectRouteStep(getRouteStep(state.route, move.fromIndex), playerStep),
      to: { x: pursuer.x, y: pursuer.y },
      atMs: move.atMs,
    };
  }

  let playerMotion: InfiniteSceneModel["playerMotion"] = null;
  if (state.lastMove !== null && state.lastMove.toIndex === state.stepsClimbed) {
    const move = state.lastMove;
    if (!Number.isSafeInteger(move.fromIndex) || move.fromIndex + 1 !== move.toIndex) {
      throw new RangeError("An infinite move must join adjacent stairs.");
    }
    playerMotion = {
      from: projectRouteStep(getRouteStep(state.route, move.fromIndex), playerStep),
      to: { x: player.x, y: player.y },
    };
  }

  const catchStops = [
    { offset: 0, behind: 1 },
    { offset: 0.2, behind: 0 },
    { offset: 0.4, behind: 0 },
    { offset: 0.55, behind: 1 },
    { offset: 0.7, behind: 2 },
    { offset: 0.85, behind: 3 },
    { offset: 1, behind: state.pursuerDistance },
  ];
  const firstRetainedIndex = state.route.steps[0].index;
  const desiredBehind = state.pursuerDistance === VISIBLE_WITH_TRAILING_PURSUER
    ? VISIBLE_WITH_TRAILING_PURSUER
    : VISIBLE_BEHIND;
  const visibleBehind = Math.min(desiredBehind, state.stepsClimbed - firstRetainedIndex);
  const steps = Array.from({ length: VISIBLE_STAIR_COUNT }, (_, offset): SceneStep =>
    actorAt(state.stepsClimbed - visibleBehind + offset));
  const visibleIndices = new Set(steps.map((step) => step.index));
  const lastRetainedIndex = state.route.steps.at(-1)!.index;
  const pursuerPreviewSteps = [state.pursuerIndex - 1, state.pursuerIndex, state.pursuerIndex + 1]
    .filter((index) => index >= firstRetainedIndex && index <= lastRetainedIndex && !visibleIndices.has(index))
    .map(actorAt);

  return {
    steps,
    pursuerPreviewSteps,
    player,
    pursuer,
    pursuerMotion,
    playerMotion,
    pursuerVisible: pursuer.x + 34 > 0 && pursuer.x - 34 < 520 && pursuer.y + 16 > 0 && pursuer.y - 88 < 400,
    catchFrames: catchStops.map(({ offset, behind }) => {
      const point: ScenePoint & { index: number } = actorAt(state.stepsClimbed - behind);
      return { offset, x: point.x, y: point.y, index: point.index };
    }),
  };
}
