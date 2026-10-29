import { buildStairSceneModel, projectRouteStep, type ScenePoint, type StairSceneModel } from "../game/stairSceneModel";
import { getRouteStep } from "../game/stairRoute";
import type { GameState, StairRouteStep } from "../game/types";

export interface DescentPlayerMotion {
  kind: "climb" | "jump";
  from: ScenePoint;
  to: ScenePoint;
}

export interface DescentSceneModel extends StairSceneModel {
  playerMotion: DescentPlayerMotion | null;
}

function descendPoint<T extends ScenePoint>(point: T): T {
  // Reflect coordinates about the player's y=216 anchor, not the character art.
  return { ...point, y: 432 - point.y };
}

export function projectDescentRouteStep(step: StairRouteStep, playerStep: StairRouteStep): ScenePoint {
  return descendPoint(projectRouteStep(step, playerStep));
}

export function buildDescentSceneModel(state: GameState): DescentSceneModel {
  const original = buildStairSceneModel(state);
  const player = descendPoint(original.player);
  const pursuer = descendPoint(original.pursuer);
  let playerMotion: DescentPlayerMotion | null = null;
  if (state.lastMove !== null && state.lastMove.toIndex === state.stepsClimbed) {
    const move = state.lastMove;
    const distance = move.kind === "jump" ? 2 : 1;
    if (!Number.isSafeInteger(move.fromIndex) || move.fromIndex + distance !== move.toIndex) {
      throw new RangeError("A descent move must join its actual departure and landing stairs.");
    }
    const from = getRouteStep(state.route, move.fromIndex);
    const to = getRouteStep(state.route, state.stepsClimbed);
    playerMotion = {
      kind: move.kind,
      from: projectDescentRouteStep(from, to),
      to: { x: player.x, y: player.y },
    };
  }

  return {
    steps: original.steps.map(descendPoint),
    pursuerPreviewSteps: original.pursuerPreviewSteps.map(descendPoint),
    player,
    pursuer,
    catchFrames: original.catchFrames.map(descendPoint),
    pursuerMotion: original.pursuerMotion === null ? null : {
      from: descendPoint(original.pursuerMotion.from),
      to: descendPoint(original.pursuerMotion.to),
      atMs: original.pursuerMotion.atMs,
    },
    playerJump: original.playerJump === null ? null : {
      from: descendPoint(original.playerJump.from),
      to: descendPoint(original.playerJump.to),
    },
    pursuerVisible: pursuer.x + 34 > 0 && pursuer.x - 34 < 520 && pursuer.y + 16 > 0 && pursuer.y - 88 < 400,
    playerMotion,
  };
}
