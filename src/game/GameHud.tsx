import type { ReactElement } from "react";
import type { GameState } from "./types";

interface GameHudProps {
  state: GameState;
  eventSecondsLeft: number;
}

export function GameHud({ state, eventSecondsLeft }: GameHudProps): ReactElement {
  const eventIsActive = state.eventEndsAt !== null;
  const eventProgress = eventIsActive ? 100 : Math.min(100, (state.eventSteps / 30) * 100);

  return (
    <section className="game-hud" aria-label="게임 현황">
      <div className="hud-card score-card">
        <span className="hud-label">현재 점수</span>
        <strong className="score-value" data-testid="score-value">
          {state.score}
        </strong>
        <span className="hud-caption">계단 {state.stepsClimbed}칸</span>
      </div>

      <div className="hud-card lives-card">
        <span className="hud-label">남은 기회</span>
        <div className="life-hearts" aria-label={`남은 기회 ${state.lives}회`}>
          {Array.from({ length: 3 }, (_, index) => (
            <span
              key={index}
              className={`life-heart${index < state.lives ? " is-full" : ""}`}
              aria-hidden="true"
            >
              ♥
            </span>
          ))}
        </div>
        <span className="hud-caption">잡히면 기회가 줄어요</span>
      </div>

      <div className={`hud-card event-card${eventIsActive ? " is-active" : ""}`}>
        <div className="event-heading">
          <span className="hud-label">계단 이벤트</span>
          <strong className="event-status" data-testid="event-status">
            {eventIsActive ? `2배 점수 · ${eventSecondsLeft}초` : `${state.eventSteps}/30칸`}
          </strong>
        </div>
        <div
          className="event-progress"
          role="progressbar"
          aria-label="이벤트 게이지"
          aria-valuemin={0}
          aria-valuemax={30}
          aria-valuenow={eventIsActive ? 30 : state.eventSteps}
        >
          <span className="event-progress-fill" style={{ width: `${eventProgress}%` }} />
        </div>
        <span className="hud-caption">
          {eventIsActive ? "30초 동안 한 칸마다 2점!" : "30칸을 오르면 30초 보너스"}
        </span>
      </div>
    </section>
  );
}
