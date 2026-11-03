import type { ReactElement } from "react";
import type { InfiniteGameState } from "./types";

interface InfiniteHudProps {
  state: InfiniteGameState;
  nowMs: number;
}

export function InfiniteHud({ state, nowMs }: InfiniteHudProps): ReactElement {
  const eventActive = state.eventEndsAt !== null;
  const eventSeconds = eventActive ? Math.max(0, Math.ceil((state.eventEndsAt! - nowMs) / 1000)) : 0;
  const gaugeValue = eventActive ? 50 : state.eventSteps;
  return (
    <section className="game-hud infinite-hud" aria-label="무한 모드 기록">
      <div className="hud-card score-card">
        <div className="score-summary">
          <span className="hud-label">현재 점수</span>
          <div className="score-value-row"><strong className="score-value" data-testid="infinite-score">{state.score}</strong></div>
          <span className="hud-caption">올라온 계단 {state.stepsClimbed}칸</span>
        </div>
        <div className="stage-clock" role="group" aria-label="추격자와 거리">
          <div className="stage-clock-heading"><span className="stage-value">무한 모드</span><span className="hud-label">추격자와 거리</span></div>
          <strong className="stage-time" data-testid="infinite-distance">{state.pursuerDistance}칸</strong>
          <span className="hud-caption" data-testid="infinite-steps">계단 {state.stepsClimbed}칸 올라옴</span>
        </div>
      </div>
      <div className={`hud-card event-card${eventActive ? " is-active" : ""}`}>
        <div className="event-heading">
          <span className="hud-label">점수 이벤트</span>
          <strong className="event-status">{eventActive ? `2배 점수 · ${eventSeconds}초` : `${state.eventSteps}/50칸`}</strong>
        </div>
        <div className="event-progress" role="progressbar" aria-label="2배 이벤트 진행 게이지" aria-valuemin={0} aria-valuemax={50} aria-valuenow={gaugeValue}>
          <span className="event-progress-fill" style={{ width: `${(gaugeValue / 50) * 100}%` }} />
        </div>
        <span className="hud-caption">{eventActive ? "30초 동안 계단마다 2점" : "50칸마다 30초 보너스"}</span>
      </div>
    </section>
  );
}
