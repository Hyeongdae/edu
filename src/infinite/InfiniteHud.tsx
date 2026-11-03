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
    <section className="infinite-hud" aria-label="무한 모드 기록">
      <div className="infinite-hud-stats">
        <article className="infinite-stat infinite-score-stat">
          <span>현재 점수</span><strong data-testid="infinite-score">{state.score}</strong>
        </article>
        <article className="infinite-stat">
          <span>올라온 계단</span><strong data-testid="infinite-steps">{state.stepsClimbed}칸</strong>
        </article>
        <article className="infinite-stat">
          <span>추격자와 거리</span><strong data-testid="infinite-distance">{state.pursuerDistance}칸</strong>
        </article>
      </div>
      <div className={`infinite-event-card${eventActive ? " is-active" : ""}`}>
        <div className="infinite-event-heading">
          <strong>{eventActive ? "점수 2배 이벤트" : "다음 점수 이벤트"}</strong>
          <span>{eventActive ? `${eventSeconds}초` : `${state.eventSteps}/50칸`}</span>
        </div>
        <progress aria-label="2배 이벤트 진행 게이지" aria-valuemax={50} max={50} value={gaugeValue} />
      </div>
    </section>
  );
}
