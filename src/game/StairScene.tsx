import { useId, type CSSProperties, type ReactElement } from "react";
import { buildStairSceneModel, type SceneStep } from "./stairSceneModel";
import { getRouteStep } from "./stairRoute";
import type { GameState } from "./types";

interface StairSceneProps {
  state: GameState;
  climbAnimationKey: number;
  isClimbing: boolean;
  pursuerAnimationKey: number;
  isPursuerCaught: boolean;
}

export function StairScene({ state, climbAnimationKey, isClimbing, pursuerAnimationKey, isPursuerCaught }: StairSceneProps): ReactElement {
  const sceneId = useId();
  const skyId = `${sceneId}-sky`;
  const frontId = `${sceneId}-front`;
  const feetClipId = `${sceneId}-feet`;
  const model = buildStairSceneModel(state);
  const atCorner = state.straightStepsRemaining === 0;
  const nextDirection = getRouteStep(state.route, state.stepsClimbed + 1).direction;
  // Place a catch at its final reset stair, then visit actual route nodes with CSS offsets.
  const pursuerPoint = isPursuerCaught
    ? { ...model.catchFrames[6], direction: getRouteStep(state.route, state.stepsClimbed - 4).direction }
    : model.pursuer;
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
        <g transform={`scale(${model.player.direction === "right" ? 1 : -1} 1)`}>
          <g transform="translate(-30 -81)">
            <ellipse cx="30" cy="81" rx="23" ry="6" fill="#6ba77a" opacity="0.26" />
            <g
              key={state.lastMistake ? `fall-${state.recoveryEndsAt}` : climbAnimationKey}
              className="runner-pose" data-testid="runner-pose"
            >
              <path d="M16 60 5 77h19l10-13 8 13h18L45 54Z" fill="#4659ae" stroke="#263c83" strokeWidth="3" strokeLinejoin="round" />
              <path d="m20 34-5 26c9 8 21 8 33 0l-5-27Z" fill="#f28d68" stroke="#ba604d" strokeWidth="3" strokeLinejoin="round" />
              <path d="M19 41 2 54" className="runner-arm runner-arm-left" fill="none" stroke="#f28d68" strokeWidth="8" strokeLinecap="round" />
              <path d="m41 43 15 13" className="runner-arm runner-arm-right" fill="none" stroke="#f28d68" strokeWidth="8" strokeLinecap="round" />
              <circle cx="31" cy="19" r="17" fill="#f7c99d" stroke="#ba805c" strokeWidth="3" />
              <path d="M14 18c1-15 11-22 24-18 8 2 12 8 12 17-5-5-10-8-17-8-6 7-12 9-19 9Z" fill="#344574" />
              <circle cx="36" cy="20" r="1.8" fill="#293252" />
              <path d="M33 27q4 3 8 0" fill="none" stroke="#b56458" strokeWidth="2" strokeLinecap="round" />
              <path d="M27 59 18 78" className="runner-leg runner-leg-left" stroke="#ffe09b" strokeWidth="7" strokeLinecap="round" />
              <path d="M40 59 48 78" className="runner-leg runner-leg-right" stroke="#ffe09b" strokeWidth="7" strokeLinecap="round" />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
  const pursuer = (
    <g
      key={pursuerAnimationKey}
      className={`pursuer${isPursuerCaught ? " is-caught" : state.lastMistake ? " is-approaching" : isClimbing ? " is-following" : ""}`}
      data-testid="pursuer" data-motion-key={pursuerAnimationKey}
      data-route-index={pursuerPoint.index} data-direction={pursuerPoint.direction}
      transform={`translate(${pursuerPoint.x} ${pursuerPoint.y})`} style={isPursuerCaught ? catchStyle : undefined}
    >
      <g clipPath={`url(#${feetClipId})`}>
        <g className="pursuer-facing" transform={`scale(${pursuerPoint.direction === "right" ? 1 : -1} 1)`}>
          <g transform="translate(-29 -47)">
            <ellipse cx="29" cy="47" rx="27" ry="7" fill="#628998" opacity="0.2" />
            <path d="M9 30q1-23 20-23t21 23v12H9Z" fill="#7461b4" stroke="#4b4181" strokeWidth="3" />
            <path d="m13 13-7-9 15 4m22 5 7-9-15 4" fill="#f5ad58" stroke="#4b4181" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="22" cy="23" r="2.5" fill="white" />
            <circle cx="37" cy="23" r="2.5" fill="white" />
            <path d="M21 33q8 8 17 0" fill="none" stroke="#fff1bb" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </g>
  );
  const stairFront = (step: SceneStep) => (
    <path
      className="stair-front"
      d={`M${step.x - 34} ${step.y - 12}L${step.x} ${step.y}L${step.x + 34} ${step.y - 12}v16L${step.x} ${step.y + 16}L${step.x - 34} ${step.y + 4}Z`}
      fill={`url(#${frontId})`} stroke="#d8894f" strokeWidth="2.5" strokeLinejoin="round"
    />
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
          <span aria-hidden="true">{nextDirection === "right" ? "↗" : "↖"}</span>
          {nextDirection === "right" ? "오른쪽 길" : "왼쪽 길"}
        </span>
      </div>
      <svg
        className="stair-scene" viewBox="0 0 520 400" role="img"
        aria-label={`계단이 ${nextDirection === "right" ? "오른쪽" : "왼쪽"}으로 이어집니다. 추격자와 ${state.pursuerDistance}칸 거리입니다.`}
      >
        <defs>
          <linearGradient id={skyId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b9e6ff" />
            <stop offset="100%" stopColor="#e9f8ff" />
          </linearGradient>
          <linearGradient id={frontId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffbd72" />
            <stop offset="100%" stopColor="#f49a51" />
          </linearGradient>
          <clipPath id={feetClipId} clipPathUnits="userSpaceOnUse">
            <rect x="-34" y="-88" width="68" height="84" />
          </clipPath>
        </defs>
        <rect width="520" height="400" rx="22" fill={`url(#${skyId})`} />
        <circle cx="435" cy="63" r="28" fill="#fff3b3" />
        <path d="M0 287c54-23 93-9 143-27 55-20 92-7 136 4 60 15 111-21 241-8v144H0Z" fill="#d6f0c2" />
        <path d="M0 328c95-21 176-7 249 0 92 9 169-20 271-7v79H0Z" fill="#b9df9e" />
        {[...model.steps].reverse().map((step) => (
          <g key={step.index} data-testid="stair-step" data-route-index={step.index} data-direction={step.direction}>
            <path
              className="stair-top"
              d={`M${step.x - 34} ${step.y - 12}L${step.x} ${step.y - 24}L${step.x + 34} ${step.y - 12}L${step.x} ${step.y}Z`}
              fill={Math.abs(step.index) % 2 === 0 ? "#ffe0a1" : "#ffe9bb"} stroke="#d8894f" strokeWidth="2.5"
            />
            {!isPursuerCaught && step.index === model.player.index && runner}
            {!isPursuerCaught && step.index === model.pursuer.index && pursuer}
            {stairFront(step)}
          </g>
        ))}
        {isPursuerCaught && (
          <g className="catch-overlay">
            {pursuer}
            {runner}
            {stairFront(model.player)}
          </g>
        )}
        <g className="scene-distance-tag" transform="translate(26 45)">
          <rect width="120" height="34" rx="17" fill="#fff" opacity="0.88" />
          <circle cx="18" cy="17" r="5" fill="#9b71dc" />
          <text x="31" y="22" fill="#454164" fontSize="13" fontWeight="700">추격자 {state.pursuerDistance}칸</text>
        </g>
      </svg>
      <p className="scene-hint" aria-live="polite">
        {state.status === "ready"
          ? "시작하기를 누르고 계단을 올라가세요."
          : state.status === "game-over"
            ? `게임 종료 · 최종 점수 ${state.score}점`
            : state.lastMistake
              ? "앗, 발을 헛디뎠어요! 잠시 숨을 고르세요."
              : atCorner
                ? "모퉁이에 도착했어요. J 또는 방향 바꾸기 버튼을 누르세요."
                : "D 또는 앞으로 버튼을 눌러 한 칸 올라가세요."}
      </p>
    </section>
  );
}
