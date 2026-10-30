import type { ReactElement } from "react";
import type { GameStage } from "./types";

interface StageTransitionCountdownProps {
  nextStage: GameStage;
  secondsRemaining: 1 | 2 | 3;
}

export function StageTransitionCountdown({ nextStage, secondsRemaining }: StageTransitionCountdownProps): ReactElement {
  return (
    <section className="stage-transition-countdown" role="status" aria-live="assertive" aria-atomic="true">
      <p className="stage-transition-label">{nextStage}단계 시작</p>
      <span className="stage-transition-number" aria-label={`${secondsRemaining}초`}>{secondsRemaining}</span>
    </section>
  );
}
