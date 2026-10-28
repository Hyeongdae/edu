import type { GameInput, GameState } from "../game/types";
import { applyDescentInput, resumeDescentAfterPause, startDescent, tickDescent } from "./descentEngine";

export interface DescentViewState {
  game: GameState;
  nowMs: number;
  settingsOpenedAt: number | null;
  playerMoveAt: number | null;
  playerMotionKey: number;
  scoreGain: 1 | 2 | 4 | null;
  scoreGainIsBonus: boolean;
  scoreGainUntil: number | null;
  successfulActionCount: number;
  mistakeCount: number;
}

export type DescentViewAction =
  | { type: "start" | "tick" | "open-settings" | "close-settings"; nowMs: number }
  | { type: "input"; input: GameInput; nowMs: number }
  | { type: "restart"; readyState: GameState; nowMs: number };

export function createDescentViewState(readyState: GameState, nowMs: number): DescentViewState {
  tickDescent(readyState, nowMs);
  if (readyState.status !== "ready" || readyState.score !== 0 || readyState.stepsClimbed !== 0 ||
    readyState.highestClearedStage !== 0 || readyState.clearedStageThisRun !== 0 || readyState.eventSteps !== 0 ||
    readyState.stageEndsAt !== null || readyState.nextPursuerStepAt !== null || readyState.eventEndsAt !== null ||
    readyState.recoveryEndsAt !== null || readyState.captureEndsAt !== null || readyState.captureCount !== 0 ||
    readyState.pursuerDistance !== 4 || readyState.pursuerIndex !== -4 || readyState.lastMove !== null ||
    readyState.lastPursuerMove !== null || readyState.lastMistake || readyState.endReason !== null) {
    throw new RangeError("A descent preview must be a fresh, unstarted first stage.");
  }
  return { game: readyState, nowMs, settingsOpenedAt: null, playerMoveAt: null, playerMotionKey: 0,
    scoreGain: null, scoreGainIsBonus: false, scoreGainUntil: null, successfulActionCount: 0, mistakeCount: 0 };
}

function updateView(view: DescentViewState, game: GameState, nowMs: number, input = false): DescentViewState {
  const moved = input && game.stepsClimbed > view.game.stepsClimbed;
  const mistake = input && game.lastMistake && game.recoveryEndsAt !== null &&
    game.recoveryEndsAt !== view.game.recoveryEndsAt;
  const active = game.status === "playing" && !game.lastMistake && game.captureEndsAt === null;
  const gain = moved ? game.score - view.game.score : null;
  if (gain !== null && gain !== 1 && gain !== 2 && gain !== 4) throw new RangeError("Invalid descent score gain.");
  const showGain = active && (moved || (view.scoreGainUntil !== null && nowMs < view.scoreGainUntil));
  return { ...view, game, nowMs,
    playerMoveAt: active && (moved || (view.playerMoveAt !== null && nowMs < view.playerMoveAt + 300))
      ? moved ? nowMs : view.playerMoveAt : null,
    playerMotionKey: view.playerMotionKey + (moved ? 1 : 0),
    scoreGain: showGain ? moved ? gain : view.scoreGain : null,
    scoreGainIsBonus: showGain && (moved ? game.lastMove?.isBonus === true : view.scoreGainIsBonus),
    scoreGainUntil: showGain ? moved ? nowMs + 600 : view.scoreGainUntil : null,
    successfulActionCount: view.successfulActionCount + (moved ? 1 : 0),
    mistakeCount: view.mistakeCount + (mistake ? 1 : 0),
  };
}

export function descentViewReducer(view: DescentViewState, action: DescentViewAction): DescentViewState {
  if (view.settingsOpenedAt !== null && action.type !== "close-settings") return view;
  switch (action.type) {
    case "start":
      return view.game.status === "ready" ? updateView(view, startDescent(view.game, action.nowMs), action.nowMs) : view;
    case "input":
      return updateView(view, applyDescentInput(view.game, action.input, action.nowMs), action.nowMs, true);
    case "tick":
      return updateView(view, tickDescent(view.game, action.nowMs), action.nowMs);
    case "open-settings": {
      if (view.game.status !== "playing") return view;
      const reconciled = updateView(view, tickDescent(view.game, action.nowMs), action.nowMs);
      return reconciled.game.status === "playing"
        ? { ...reconciled, game: { ...reconciled.game, lastPursuerMove: null }, settingsOpenedAt: action.nowMs, playerMoveAt: null,
          scoreGain: null, scoreGainIsBonus: false, scoreGainUntil: null } : reconciled;
    }
    case "close-settings":
      return view.settingsOpenedAt === null ? view : updateView({ ...view, settingsOpenedAt: null },
        resumeDescentAfterPause(view.game, view.settingsOpenedAt, action.nowMs), action.nowMs);
    case "restart":
      return view.game.status === "game-over" ? {
        ...createDescentViewState(action.readyState, action.nowMs), playerMotionKey: view.playerMotionKey + 1,
        successfulActionCount: view.successfulActionCount, mistakeCount: view.mistakeCount,
      } : view;
  }
}
