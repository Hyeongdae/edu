import { getRouteStep } from "./stairRoute";
import type { Direction, GameState, StairRouteStep } from "./types";

export interface ScenePoint { x: number; y: number; }
export interface SceneStep extends ScenePoint { index: number; direction: Direction; }
export interface SceneActor extends ScenePoint { index: number; direction: Direction; }
export interface CatchFrame extends ScenePoint { offset: number; index: number; }
export interface ScenePursuerMotion { from: ScenePoint; to: ScenePoint; atMs: number; }
export interface StairSceneModel {
  steps: readonly SceneStep[];
  player: SceneActor;
  pursuer: SceneActor;
  catchFrames: readonly CatchFrame[];
  pursuerMotion: ScenePursuerMotion | null;
  pursuerVisible: boolean;
}

export function projectRouteStep(step: StairRouteStep, playerStep: StairRouteStep): ScenePoint {
  return {
    x: 260 + (step.column - playerStep.column) * 34,
    y: 216 - (step.index - playerStep.index) * 28,
  };
}

export function buildStairSceneModel(state: GameState): StairSceneModel {
  if (!Number.isSafeInteger(state.pursuerIndex) || !Number.isSafeInteger(state.pursuerDistance) ||
    state.pursuerDistance < 1 || state.pursuerDistance !== state.stepsClimbed - state.pursuerIndex) {
    throw new RangeError("Pursuit requires matching real indices and a positive distance.");
  }
  const playerStep = getRouteStep(state.route, state.stepsClimbed);
  const actorAt = (index: number): SceneActor => {
    const step = getRouteStep(state.route, index);
    return { ...projectRouteStep(step, playerStep), index, direction: step.direction };
  };
  const catchStops = [
    { offset: 0, behind: 1 },
    { offset: 0.20, behind: 0 },
    { offset: 0.40, behind: 0 },
    { offset: 0.55, behind: 1 },
    { offset: 0.70, behind: 2 },
    { offset: 0.85, behind: 3 },
    { offset: 1, behind: state.pursuerDistance },
  ];

  const pursuer = actorAt(state.pursuerIndex);
  let pursuerMotion: ScenePursuerMotion | null = null;
  if (state.lastPursuerMove !== null) {
    const move = state.lastPursuerMove;
    if (!Number.isSafeInteger(move.fromIndex) || move.fromIndex + 1 !== move.toIndex || move.toIndex !== state.pursuerIndex ||
      !Number.isFinite(move.atMs) || move.atMs < 0) throw new RangeError("Invalid pursuer motion.");
    pursuerMotion = { from: projectRouteStep(getRouteStep(state.route, move.fromIndex), playerStep),
      to: { x: pursuer.x, y: pursuer.y }, atMs: move.atMs };
  }

  return {
    steps: Array.from({ length: 11 }, (_, offset) => actorAt(state.stepsClimbed - 4 + offset)),
    player: actorAt(state.stepsClimbed),
    pursuer,
    pursuerMotion,
    pursuerVisible: pursuer.x + 34 > 0 && pursuer.x - 34 < 520 && pursuer.y + 16 > 0 && pursuer.y - 88 < 400,
    catchFrames: catchStops.map(({ offset, behind }) => {
      const { x, y, index } = actorAt(state.stepsClimbed - behind);
      return { offset, x, y, index };
    }),
  };
}
