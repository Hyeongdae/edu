import type { ReactElement } from "react";
import type { GameStage } from "./types";

interface StageTransitionCountdownProps {
  stage: GameStage;
  secondsRemaining: 1 | 2 | 3;
}

export function StageTransitionCountdown({ stage, secondsRemaining }: StageTransitionCountdownProps): ReactElement {
  return (
    <section className="stage-transition-countdown" role="status" aria-live="assertive" aria-atomic="true">
      <p className="stage-transition-label">{stage}단계 시작</p>
      <span className="stage-transition-number" aria-label={`${secondsRemaining}초`}>{secondsRemaining}</span>
    </section>
  );
}
