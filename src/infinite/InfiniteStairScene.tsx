import type { ReactElement } from "react";
import { PixelOfficer } from "../game/pixel/PixelOfficer";
import { PixelOfficeBackdrop } from "../game/pixel/PixelOfficeBackdrop";
import { PixelStair } from "../game/pixel/PixelStair";
import { buildInfiniteSceneModel } from "./infiniteSceneModel";
import type { InfiniteGameState } from "./types";

export function InfiniteStairScene({ state, isMoving }: { state: InfiniteGameState; isMoving: boolean }): ReactElement {
  const model = buildInfiniteSceneModel(state);
  const nextTurn = state.straightStepsRemaining === 0;
  return (
    <section className="scene-card infinite-scene-card" aria-label="위로 올라가는 계단 장면">
      <div className="scene-heading">
        <div><span className="hud-label">다음 입력</span><strong className="route-direction">
          {nextTurn ? "J를 눌러 방향 전환" : `D로 ${state.straightStepsRemaining}칸 올라가기`}
        </strong></div>
        <span className={`direction-pill is-${state.direction}`}>{state.direction === "right" ? "오른쪽" : "왼쪽"}</span>
      </div>
      <div className="pixel-scene-stage">
        <PixelOfficeBackdrop />
        <svg className="stair-scene infinite-stair-scene" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid meet"
          role="img" shapeRendering="crispEdges" data-testid="infinite-stair-scene"
          aria-label={`위로 올라온 계단 ${state.stepsClimbed}칸, 추격자와 ${state.pursuerDistance}칸 거리`}>
          {model.steps.map((step) => (
            <g key={step.index} data-testid="infinite-stair-step" data-route-index={step.index} data-direction={step.direction}>
              <g className="stair-top" transform={`translate(${step.x} ${step.y})`}><PixelStair face="top" direction={step.direction} /></g>
              {step.index === model.pursuer.index && model.pursuerVisible && (
                <g className={`infinite-actor infinite-pursuer${isMoving ? " is-moving" : ""}`} data-testid="infinite-pursuer"
                  transform={`translate(${model.pursuer.x} ${model.pursuer.y})`}>
                  <PixelOfficer variant="older" direction={model.pursuer.direction} pose={isMoving ? "climb" : "idle"} />
                </g>
              )}
              {step.index === model.player.index && (
                <g className={`infinite-actor infinite-player${state.status === "game-over" ? " is-falling" : ""}`}
                  data-testid="infinite-player" data-route-index={model.player.index} data-direction={model.player.direction}
                  transform={`translate(${model.player.x} ${model.player.y})`}>
                  <PixelOfficer variant="young" direction={model.player.direction} pose={state.status === "game-over" ? "fall" : isMoving ? "climb" : "idle"} />
                </g>
              )}
              <g className="stair-front" transform={`translate(${step.x} ${step.y})`}><PixelStair face="front" direction={step.direction} /></g>
            </g>
          ))}
        </svg>
      </div>
      <p className="scene-hint">D로 올라가고, 계단이 꺾일 때 J를 눌러 방향을 바꿔요.</p>
    </section>
  );
}
