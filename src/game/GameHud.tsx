import type { ReactElement } from "react";
import type { GameState } from "./types";
import { getStageRule } from "./stageRules";
import { PixelIcon } from "./pixel/PixelIcon";

interface GameHudProps {
  state: GameState;
  eventSecondsLeft: number;
  scoreGain: number | null;
  scoreGainIsBonus: boolean;
  scoreAnimationKey: number;
  stageSecondsLeft: number;
}

function formatStageTime(secondsLeft: number): string {
  const totalSeconds = Math.max(0, Math.ceil(secondsLeft));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function GameHud({ state, eventSecondsLeft, scoreGain, scoreGainIsBonus, scoreAnimationKey, stageSecondsLeft }: GameHudProps): ReactElement {
  const eventIsActive = state.eventEndsAt !== null;
  const eventProgress = eventIsActive ? 100 : Math.min(100, (state.eventSteps / 30) * 100);
  const cleared = state.endReason === "cleared";

  return (
    <section className="game-hud" aria-label="게임 현황">
      <div className="hud-card score-card">
        <div className="score-summary">
          <span className="hud-label">현재 점수</span>
          <div className="score-value-row">
            <strong
              key={`score-${scoreAnimationKey}`}
              className={`score-value${scoreGain !== null ? " is-scoring" : ""}`}
              data-testid="score-value"
            >
              {state.score}
            </strong>
            {scoreGain !== null && (
              <span
                key={`gain-${scoreAnimationKey}`}
                className={`score-gain${scoreGainIsBonus ? " is-bonus" : ""}`}
                data-testid="score-gain"
                aria-label={`${scoreGain}점 획득`}
                aria-live="polite"
              >
                +{scoreGain}
              </span>
            )}
          </div>
          <span className="hud-caption">계단 {state.stepsClimbed}칸</span>
        </div>
        <div className="stage-clock" role="timer" aria-label="단계 제한시간" aria-live="off">
          <div className="stage-clock-heading">
            <span className="stage-value" data-testid="stage-value">{state.stage}단계</span>
            <span className="hud-label">남은 시간</span>
          </div>
          <strong className="stage-time" data-testid="stage-time">{cleared ? "클리어" : formatStageTime(stageSecondsLeft)}</strong>
          <span className="hud-caption">{cleared ? "모든 단계 클리어" : `목표 ${getStageRule(state.stage).targetScore}점`}</span>
        </div>
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
              <PixelIcon name="heart" size={22} />
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
