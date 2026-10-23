import { useId, type CSSProperties, type ReactElement } from "react";
import { buildStairSceneModel, type SceneStep } from "./stairSceneModel";
import { getRouteStep } from "./stairRoute";
import type { GameState } from "./types";
import { PixelOfficer } from "./pixel/PixelOfficer";
import { PixelOfficeBackdrop } from "./pixel/PixelOfficeBackdrop";
import { PixelStair } from "./pixel/PixelStair";
import { PixelIcon } from "./pixel/PixelIcon";
import "./pixel/pixel-scene.css";

interface StairSceneProps {
  state: GameState;
  climbAnimationKey: number;
  isClimbing: boolean;
  pursuerAnimationKey: number;
  isPursuerMoving: boolean;
  isPursuerCaught: boolean;
}

export function StairScene({ state, climbAnimationKey, isClimbing, pursuerAnimationKey, isPursuerMoving, isPursuerCaught }: StairSceneProps): ReactElement {
  const sceneId = useId();
  const feetClipId = `${sceneId}-feet`;
  const model = buildStairSceneModel(state);
  const atCorner = state.straightStepsRemaining === 0;
  const nextDirection = getRouteStep(state.route, state.stepsClimbed + 1).direction;
  // Place a catch at its final reset stair, then visit actual route nodes with CSS offsets.
  const pursuerPoint = model.pursuer;
  const moving = isPursuerMoving && model.pursuerMotion !== null && !isPursuerCaught;
  const moveX = model.pursuerMotion ? model.pursuerMotion.from.x - model.pursuerMotion.to.x : 0;
  const moveY = model.pursuerMotion ? model.pursuerMotion.from.y - model.pursuerMotion.to.y : 0;
  const motionStyle = { "--pursuer-move-x": `${moveX}px`, "--pursuer-move-y": `${moveY}px`, "--pursuer-mid-x": `${moveX / 2}px` } as CSSProperties;
  const extraPursuerStair = model.pursuerVisible && !model.steps.some((step) => step.index === model.pursuer.index);
  const catchStyle = Object.fromEntries(model.catchFrames.flatMap((frame, index) => [
    [`--catch-x-${index}`, `${(frame.x - pursuerPoint.x) / 520 * 100}%`],
    [`--catch-y-${index}`, `${(frame.y - pursuerPoint.y) / 400 * 100}%`],
    [`--catch-facing-${index}`, getRouteStep(state.route, frame.index).direction === "right" ? 1 : -1],
  ])) as CSSProperties;

  const runner = (
    <g
      className={`runner${state.lastMistake ? " is-falling" : isClimbing ? " is-climbing" : ""}`}
      data-testid="runner" data-step-count={state.stepsClimbed} data-route-index={model.player.index}
      data-direction={model.player.direction} data-motion-key={climbAnimationKey}
      transform={`translate(${model.player.x} ${model.player.y})`}
    >
      <g clipPath={`url(#${feetClipId})`}>
        <g
          key={state.lastMistake ? `fall-${state.recoveryEndsAt}` : climbAnimationKey}
          className="runner-pose" data-testid="runner-pose"
        >
          <PixelOfficer variant="young" direction={model.player.direction} pose={state.lastMistake ? "fall" : isClimbing ? "climb" : "idle"} />
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
      transform={`translate(${pursuerPoint.x} ${pursuerPoint.y})`} style={isPursuerCaught ? catchStyle : undefined}
    >
      <g className={`pursuer-motion${moving ? " is-moving" : ""}`} style={motionStyle} data-testid="pursuer-motion">
        <g clipPath={`url(#${feetClipId})`}>
          <g
            className="pursuer-facing"
            transform={isPursuerCaught ? `scale(${pursuerPoint.direction === "right" ? 1 : -1} 1)` : undefined}
          >
            {/* Catch keyframes own facing; the final facing above also works without motion. */}
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
            {atCorner ? "지금 방향을 바꾸세요" : `${state.straightStepsRemaining}칸 더 올라가세요`}
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
          aria-label={`계단이 ${nextDirection === "right" ? "오른쪽" : "왼쪽"}으로 이어집니다. 추격자와 ${state.pursuerDistance}칸 거리입니다.`}
        >
          <defs>
            <clipPath id={feetClipId} clipPathUnits="userSpaceOnUse">
              <rect x="-34" y="-88" width="68" height="84" />
            </clipPath>
          </defs>
          {[...model.steps].reverse().map((step) => (
            <g key={step.index} data-testid="stair-step" data-route-index={step.index} data-direction={step.direction}>
              <g className="stair-top" transform={`translate(${step.x} ${step.y})`}>
                <PixelStair face="top" direction={step.direction} />
              </g>
              {!isPursuerCaught && step.index === model.player.index && runner}
              {!isPursuerCaught && !moving && model.pursuerVisible && step.index === model.pursuer.index && pursuer}
              {stairFront(step)}
            </g>
          ))}
          {!isPursuerCaught && extraPursuerStair && (
            <g className="pursuer-history-stair" data-route-index={model.pursuer.index}>
              <g className="stair-top" transform={`translate(${model.pursuer.x} ${model.pursuer.y})`}>
                <PixelStair face="top" direction={model.pursuer.direction} />
              </g>
              {!moving && pursuer}
              {stairFront(model.pursuer)}
            </g>
          )}
          {!isPursuerCaught && moving && model.pursuerVisible && (
            <g className="pursuer-move-overlay">{pursuer}{stairFront(model.pursuer)}</g>
          )}
          {isPursuerCaught && (
            <g className="catch-overlay">
              {pursuer}
              {runner}
              {stairFront(model.player)}
            </g>
          )}
          <g className="scene-distance-tag" transform="translate(26 45)">
            <rect width="120" height="34" fill="#0b1427" stroke="#42647b" strokeWidth="2" />
            <rect x="12" y="12" width="8" height="8" fill="#f07cbd" />
            <text x="31" y="22" fill="#eef7ff" fontSize="13" fontWeight="700">추격자 {state.pursuerDistance}칸</text>
          </g>
        </svg>
      </div>
      <p className="scene-hint" aria-live="polite">
        {state.status === "ready"
          ? "시작하기를 누르고 계단을 올라가세요."
          : state.status === "game-over"
            ? `${state.endReason === "cleared" ? "최종 클리어" : "게임 종료"} · 최종 점수 ${state.score}점`
            : state.captureEndsAt !== null
              ? "추격자에게 잡혔어요! 잠시 숨을 고르세요."
            : state.lastMistake
              ? "앗, 발을 헛디뎠어요! 잠시 숨을 고르세요."
              : atCorner
                ? "모퉁이에 도착했어요. J 또는 방향 바꾸기 버튼을 누르세요."
                : "D 또는 앞으로 버튼을 눌러 한 칸 올라가세요."}
      </p>
    </section>
  );
}
