import { useId, type CSSProperties, type ReactElement } from "react";
import type { SceneActor, ScenePoint } from "../game/stairSceneModel";
import { getRouteStep } from "../game/stairRoute";
import { hasObstacle } from "../game/stairObstacles";
import type { GameState } from "../game/types";
import { getPursuerMotionDurationMs } from "../game/pursuitRules";
import { PixelOfficer } from "../game/pixel/PixelOfficer";
import { PixelOfficeBackdrop } from "../game/pixel/PixelOfficeBackdrop";
import { PixelObstacle } from "../game/pixel/PixelObstacle";
import { PixelStair } from "../game/pixel/PixelStair";
import { buildDescentSceneModel } from "./descentSceneModel";

interface DescentSceneProps {
  state: GameState;
  playerMotionKey: number;
  isPlayerMoving: boolean;
  isPursuerMoving: boolean;
  isCaught: boolean;
}

function travelStyle(from: ScenePoint, to: ScenePoint, lift: number): CSSProperties {
  return { "--descent-from-x": `${from.x - to.x}px`, "--descent-from-y": `${from.y - to.y}px`,
    "--descent-mid-x": `${(from.x - to.x) / 2}px`, "--descent-mid-y": `${(from.y - to.y) / 2 - lift}px`,
  } as CSSProperties;
}

export function DescentScene({ state, playerMotionKey, isPlayerMoving, isPursuerMoving, isCaught }: DescentSceneProps): ReactElement {
  const clipId = `${useId()}-descent-feet`;
  const model = buildDescentSceneModel(state);
  const blocked = hasObstacle(state.obstacles, state.stepsClimbed + 1);
  const next = getRouteStep(state.route, state.stepsClimbed + 1);
  const playerMoving = isPlayerMoving && model.playerMotion !== null && state.status === "playing" && !state.lastMistake && !isCaught;
  const jumping = playerMoving && model.playerMotion?.kind === "jump";
  const npcMoving = isPursuerMoving && model.pursuerMotion !== null && state.status === "playing" && !isCaught;
  const pose = state.lastMistake ? "fall" : jumping ? "jump" : playerMoving ? "climb" : "idle";
  const catchStyle = Object.fromEntries(model.catchFrames.flatMap((frame, index) => [
    [`--descent-catch-x-${index}`, `${frame.x - model.pursuer.x}px`],
    [`--descent-catch-y-${index}`, `${frame.y - model.pursuer.y}px`],
    [`--descent-catch-facing-${index}`, getRouteStep(state.route, frame.index).direction === "right" ? 1 : -1],
  ])) as CSSProperties;
  const player = (
    <g data-testid="descent-runner" data-route-index={model.player.index} data-direction={model.player.direction}
      data-motion-key={playerMotionKey} data-motion-kind={pose} transform={`translate(${model.player.x} ${model.player.y})`}>
      <g key={`${pose}-${playerMotionKey}`} data-testid="descent-runner-motion"
        className={`descent-player-motion${playerMoving ? jumping ? " is-jumping" : " is-stepping" : ""}`}
        style={playerMoving ? travelStyle(model.playerMotion!.from, model.playerMotion!.to, jumping ? 56 : 8) : undefined}>
        <g clipPath={`url(#${clipId})`}><PixelOfficer variant="young" direction={model.player.direction} pose={pose} /></g>
      </g>
    </g>
  );
  const npc = (
    <g key={isCaught ? `catch-${state.captureCount}` : `npc-${state.lastPursuerMove?.atMs ?? 0}`}
      data-testid="descent-pursuer" data-route-index={model.pursuer.index} data-direction={model.pursuer.direction}
      transform={`translate(${model.pursuer.x} ${model.pursuer.y})`}>
      <g data-testid="descent-pursuer-motion" className={isCaught ? "descent-catch-motion" : `descent-npc-motion${npcMoving ? " is-moving" : ""}`}
        style={isCaught ? catchStyle : npcMoving ? { ...travelStyle(model.pursuerMotion!.from, model.pursuerMotion!.to, 8),
          "--pursuer-step-duration": `${getPursuerMotionDurationMs(state)}ms` } as CSSProperties : undefined}>
        <g clipPath={`url(#${clipId})`}><g className={isCaught ? "descent-catch-facing" : undefined} style={isCaught ? catchStyle : undefined}>
          <PixelOfficer variant="older" direction={isCaught ? "right" : model.pursuer.direction} pose={npcMoving || isCaught ? "climb" : "idle"} />
        </g></g>
      </g>
    </g>
  );
  const front = (step: SceneActor) => <g className="descent-stair-front" transform={`translate(${step.x} ${step.y})`}>
    <PixelStair face="front" direction={step.direction} /></g>;
  const extraNpcStair = model.pursuerVisible && !model.steps.some(step => step.index === model.pursuer.index);
  const cue = blocked ? "장애물! 점프하세요" : state.straightStepsRemaining === 0 ? "지금 방향을 바꾸세요" : `${state.straightStepsRemaining}칸 더 내려가세요`;
  return (
    <section className="descent-scene" aria-label="내려오는 계단 장면">
      <header className="descent-scene-heading"><strong data-testid="descent-route-direction">{cue}</strong>
        <span>{next.direction === "right" ? "오른쪽 길" : "왼쪽 길"}</span></header>
      <div className="descent-scene-stage">
        <PixelOfficeBackdrop />
        <svg className="descent-stair-scene" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid meet"
          role="img" shapeRendering="crispEdges" data-pursuer-index={model.pursuer.index} data-pursuer-visible={model.pursuerVisible}
          aria-label={`계단이 ${next.direction === "right" ? "오른쪽" : "왼쪽"} 아래로 이어집니다. 위쪽 추격자가 따라옵니다.${blocked ? " 다음 계단에 장애물이 있습니다." : ""}`}>
          <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x="-34" y="-88" width="68" height="84" /></clipPath></defs>
          {model.steps.map(step => (
            <g key={step.index} data-testid="descent-stair-step" data-route-index={step.index} data-direction={step.direction}>
              <g className="descent-stair-top" transform={`translate(${step.x} ${step.y})`}><PixelStair face="top" direction={step.direction} /></g>
              {hasObstacle(state.obstacles, step.index) && (step.index > state.stepsClimbed ||
                (jumping && step.index === state.lastMove!.fromIndex + 1)) && (
                <g data-testid="descent-stair-obstacle" data-route-index={step.index} transform={`translate(${step.x} ${step.y})`}><PixelObstacle /></g>
              )}
              {!playerMoving && !isCaught && step.index === model.player.index && player}
              {!npcMoving && !isCaught && model.pursuerVisible && step.index === model.pursuer.index && npc}
              {front(step)}
            </g>
          ))}
          {extraNpcStair && <g className="descent-history-stair" data-route-index={model.pursuer.index}>
            <g transform={`translate(${model.pursuer.x} ${model.pursuer.y})`}><PixelStair face="top" direction={model.pursuer.direction} /></g>
            {!npcMoving && !isCaught && npc}{front(model.pursuer)}
          </g>}
          {npcMoving && model.pursuerVisible && <g className="descent-npc-overlay">{npc}{front(model.pursuer)}</g>}
          {playerMoving && <g className={jumping ? "descent-jump-overlay" : "descent-step-overlay"}>{player}{front(model.player)}</g>}
          {isCaught && <g className="descent-catch-overlay">{npc}{player}{front(model.player)}</g>}
        </svg>
      </div>
      <p className="descent-scene-hint" aria-live="polite">{state.status === "ready" ? "시작하기를 누르고 계단을 내려가세요."
        : state.status === "game-over" ? state.endReason === "cleared" ? "1단계 클리어!" : "도전이 끝났어요. 다시 내려가 볼까요?"
        : state.lastMistake ? "앗, 발을 헛디뎠어요! 잠시 숨을 고르세요."
        : blocked ? "Space 또는 점프로 상자를 넘어 두 칸 이동하세요."
        : state.straightStepsRemaining === 0 ? "J 또는 방향 전환으로 내려가세요." : "D 또는 내려가기 버튼을 누르세요."}</p>
    </section>
  );
}
