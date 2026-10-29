import { useId, type CSSProperties, type ReactElement } from "react";
import type { ScenePoint, SceneStep } from "./stairSceneModel";
import { buildDescentSceneModel } from "../descent/descentSceneModel";
import { getRouteStep } from "./stairRoute";
import { hasObstacle } from "./stairObstacles";
import type { GameState } from "./types";
import { getPursuerMotionDurationMs } from "./pursuitRules";
import { PixelOfficer } from "./pixel/PixelOfficer";
import { PixelOfficeBackdrop } from "./pixel/PixelOfficeBackdrop";
import { PixelStair } from "./pixel/PixelStair";
import { PixelIcon } from "./pixel/PixelIcon";
import { PixelObstacle } from "./pixel/PixelObstacle";
import "./pixel/pixel-scene.css";

interface StairSceneProps {
  state: GameState;
  climbAnimationKey: number;
  isClimbing: boolean;
  pursuerAnimationKey: number;
  isPursuerMoving: boolean;
  isPursuerCaught: boolean;
}

function travelStyle(from: ScenePoint, to: ScenePoint, prefix: string, lift: number): CSSProperties {
  return {
    [`--${prefix}-x`]: `${from.x - to.x}px`,
    [`--${prefix}-y`]: `${from.y - to.y}px`,
    [`--${prefix}-mid-x`]: `${(from.x - to.x) / 2}px`,
    [`--${prefix}-mid-y`]: `${(from.y - to.y) / 2 - lift}px`,
  } as CSSProperties;
}

export function StairScene({ state, climbAnimationKey, isClimbing, pursuerAnimationKey, isPursuerMoving, isPursuerCaught }: StairSceneProps): ReactElement {
  const sceneId = useId();
  const feetClipId = `${sceneId}-feet`;
  const model = buildDescentSceneModel(state);
  const atCorner = state.straightStepsRemaining === 0;
  const nextDirection = getRouteStep(state.route, state.stepsClimbed + 1).direction;
  const nextIsBlocked = hasObstacle(state.obstacles, state.stepsClimbed + 1);
  const climbing = isClimbing && model.playerMotion !== null && state.status === "playing" && !state.lastMistake && !isPursuerCaught;
  const jumping = climbing && model.playerMotion?.kind === "jump";
  const jumpedBoxIndex = jumping && state.lastMove?.kind === "jump"
    ? state.lastMove.fromIndex + 1 : null;
  const playerStyle = climbing ? travelStyle(model.playerMotion!.from, model.playerMotion!.to, jumping ? "jump" : "step", jumping ? 56 : 8) : undefined;
  const motionKind = state.lastMistake ? "fall" : jumping ? "jump" : climbing ? "climb" : "idle";
  // Keep the final safe stair as the catch animation's route anchor.
  const pursuerPoint = model.pursuer;
  const moving = isPursuerMoving && model.pursuerMotion !== null && state.status === "playing" && !isPursuerCaught;
  const motionStyle = moving ? { ...travelStyle(model.pursuerMotion!.from, model.pursuerMotion!.to, "pursuer-move", 8),
    "--pursuer-step-duration": `${getPursuerMotionDurationMs(state)}ms` } as CSSProperties : undefined;
  const sceneSteps = [...model.steps, ...model.pursuerPreviewSteps].sort((left, right) => left.index - right.index);
  const catchStyle = { "--catch-base-facing": pursuerPoint.direction === "right" ? 1 : -1, ...Object.fromEntries(model.catchFrames.flatMap((frame, index) => [
    [`--catch-x-${index}`, `${frame.x - pursuerPoint.x}px`],
    [`--catch-y-${index}`, `${frame.y - pursuerPoint.y}px`],
    [`--catch-facing-${index}`, getRouteStep(state.route, frame.index).direction === "right" ? 1 : -1],
  ])) } as CSSProperties;

  const runner = (
    <g
      className={`runner${state.lastMistake ? " is-falling" : jumping ? " is-jumping" : climbing ? " is-climbing" : ""}`}
      data-testid="runner" data-step-count={state.stepsClimbed} data-route-index={model.player.index}
      data-direction={model.player.direction} data-motion-key={climbAnimationKey} data-motion-kind={motionKind}
      transform={`translate(${model.player.x} ${model.player.y})`}
    >
      <g key={`${motionKind}-${climbAnimationKey}`} className={`runner-motion${climbing ? jumping ? " is-jumping" : " is-stepping" : ""}`}
        data-testid="runner-motion" style={playerStyle}>
        <g clipPath={`url(#${feetClipId})`}>
          <g
            key={state.lastMistake ? `fall-${state.recoveryEndsAt}` : climbAnimationKey}
            className="runner-pose" data-testid="runner-pose"
          >
            <PixelOfficer variant="young" direction={model.player.direction} pose={motionKind} />
          </g>
        </g>
      </g>
    </g>
  );
  const pursuer = (
    <g
      key={isPursuerCaught ? `catch-${state.captureCount}` : `move-${pursuerAnimationKey}`}
      className={`pursuer${isPursuerCaught ? " is-caught" : moving ? " is-following" : ""}`}
      data-testid="pursuer" data-motion-key={pursuerAnimationKey}
      data-route-index={pursuerPoint.index} data-direction={pursuerPoint.direction}
      transform={`translate(${pursuerPoint.x} ${pursuerPoint.y})`}
    >
      <g className={`pursuer-motion${isPursuerCaught ? " is-catching" : moving ? " is-moving" : ""}`} style={isPursuerCaught ? catchStyle : motionStyle} data-testid="pursuer-motion">
        <g clipPath={`url(#${feetClipId})`}>
          <g
            className="pursuer-facing"
          >
            {/* Catch travel and facing belong to inner nodes, leaving the stair anchor fixed. */}
            <PixelOfficer
              variant="older" direction={isPursuerCaught ? "right" : pursuerPoint.direction}
              pose={moving || isPursuerCaught ? "climb" : "idle"}
            />
          </g>
        </g>
      </g>
    </g>
  );
  const stairFront = (step: SceneStep) => (
    <g className="stair-front" transform={`translate(${step.x} ${step.y})`}>
      <PixelStair face="front" direction={step.direction} />
    </g>
  );

  return (
    <section className="scene-card" aria-label="계단 장면">
      <div className="scene-heading">
        <div>
          <span className="hud-label">다음 모퉁이</span>
          <strong className="route-direction" data-testid="route-direction">
            {nextIsBlocked ? "장애물! 점프하세요" : atCorner ? "지금 방향을 바꾸세요" : `${state.straightStepsRemaining}칸 더 내려가세요`}
          </strong>
        </div>
        <span className={`direction-pill is-${nextDirection}`}>
          <PixelIcon name="stair" size={16} />
          {nextDirection === "right" ? "오른쪽 길" : "왼쪽 길"}
        </span>
      </div>
      <div className="pixel-scene-stage">
        <PixelOfficeBackdrop />
        <svg
          className="stair-scene" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid meet" role="img" shapeRendering="crispEdges"
          data-pursuer-index={model.pursuer.index} data-pursuer-visible={model.pursuerVisible}
          aria-label={`계단이 ${nextDirection === "right" ? "오른쪽" : "왼쪽"} 아래로 이어집니다. 위쪽 추격자가 따라옵니다.${nextIsBlocked ? " 다음 계단에 장애물이 있습니다. Space 또는 점프 버튼을 누르세요." : ""}`}
        >
          <defs>
            <clipPath id={feetClipId} clipPathUnits="userSpaceOnUse">
              <rect x="-34" y="-88" width="68" height="84" />
            </clipPath>
          </defs>
          {sceneSteps.map((step) => (
            <g key={step.index} data-testid="stair-step" data-route-index={step.index} data-direction={step.direction}>
              <g className="stair-top" transform={`translate(${step.x} ${step.y})`}>
                <PixelStair face="top" direction={step.direction} />
              </g>
              {hasObstacle(state.obstacles, step.index) && (step.index > state.stepsClimbed || step.index === jumpedBoxIndex) && (
                <g data-testid="stair-obstacle" data-route-index={step.index} transform={`translate(${step.x} ${step.y})`}>
                  <PixelObstacle />
                </g>
              )}
              {!isPursuerCaught && !climbing && step.index === model.player.index && runner}
              {!isPursuerCaught && !moving && model.pursuerVisible && step.index === model.pursuer.index && pursuer}
              {(!moving || step.index !== model.pursuer.index) && stairFront(step)}
            </g>
          ))}
          {!isPursuerCaught && moving && model.pursuerVisible && (
            <g className="pursuer-move-overlay">{pursuer}{stairFront(model.pursuer)}</g>
          )}
          {climbing && <g className={jumping ? "jump-overlay" : "step-overlay"}>{runner}{stairFront(model.player)}</g>}
          {isPursuerCaught && (
            <g className="catch-overlay">
              {pursuer}
              {runner}
              {stairFront(model.player)}
            </g>
          )}
        </svg>
      </div>
      <p className="scene-hint" aria-live="polite">
        {state.status === "ready"
          ? "시작하기를 누르고 계단을 내려가세요."
          : state.status === "checkpoint"
            ? "단계를 클리어했어요. 계속할지 선택하세요."
          : state.status === "game-over"
            ? `${state.endReason === "cleared" ? "최종 클리어" : state.endReason === "quit" ? "체크포인트에서 종료했어요" : "게임 종료"} · 최종 점수 ${state.score}점`
            : state.captureEndsAt !== null
              ? "추격자에게 잡혔어요! 잠시 숨을 고르세요."
            : state.lastMistake
              ? "앗, 발을 헛디뎠어요! 잠시 숨을 고르세요."
              : nextIsBlocked
                ? "장애물이에요. Space 또는 점프 버튼으로 두 칸을 뛰어넘으세요."
              : atCorner
                ? "모퉁이에 도착했어요. J 또는 방향 바꾸기 버튼을 누르세요."
                : "D 또는 내려가기 버튼을 눌러 한 칸 내려가세요."}
      </p>
    </section>
  );
}
