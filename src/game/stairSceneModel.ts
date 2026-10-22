import { getRouteStep } from "./stairRoute";
import type { Direction, GameState, StairRouteStep } from "./types";

export interface ScenePoint { x: number; y: number; }
export interface SceneStep extends ScenePoint { index: number; direction: Direction; }
export interface SceneActor extends ScenePoint { index: number; direction: Direction; }
export interface CatchFrame extends ScenePoint { offset: number; index: number; }
export interface StairSceneModel {
  steps: readonly SceneStep[];
  player: SceneActor;
  pursuer: SceneActor;
  catchFrames: readonly CatchFrame[];
}

export function projectRouteStep(step: StairRouteStep, playerStep: StairRouteStep): ScenePoint {
  return {
    x: 260 + (step.column - playerStep.column) * 34,
    y: 216 - (step.index - playerStep.index) * 28,
  };
}

export function buildStairSceneModel(state: GameState): StairSceneModel {
  if (!Number.isInteger(state.pursuerDistance) || state.pursuerDistance < 1 || state.pursuerDistance > 4) {
    throw new RangeError("Pursuit requires a distance of one to four stairs.");
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
    { offset: 1, behind: 4 },
  ];

  return {
    steps: Array.from({ length: 11 }, (_, offset) => actorAt(state.stepsClimbed - 4 + offset)),
    player: actorAt(state.stepsClimbed),
    pursuer: actorAt(state.stepsClimbed - state.pursuerDistance),
    catchFrames: catchStops.map(({ offset, behind }) => {
      const { x, y, index } = actorAt(state.stepsClimbed - behind);
      return { offset, x, y, index };
    }),
  };
}
