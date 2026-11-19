import type { ReactElement } from "react";
import type { PointEffectId } from "../../shared/companyRecords";

export function PointCoin({ stairIndex }: { stairIndex: number }): ReactElement {
  return <g className="point-coin" data-testid="point-coin" data-stair-index={stairIndex} aria-label="포인트 코인">
    <rect x="-7" y="-17" width="14" height="14" fill="#f6b93b" stroke="#fff0a6" strokeWidth="2" />
    <rect x="-3" y="-14" width="6" height="8" fill="#fff0a6" aria-hidden="true" />
    <rect x="-5" y="-15" width="2" height="2" fill="#fff" aria-hidden="true" />
  </g>;
}

export function PlayerStepEffect({ effect, animationKey }: { effect: PointEffectId | null; animationKey: number }): ReactElement | null {
  if (!effect) return null;
  return <g key={`${effect}-${animationKey}`} className={`player-step-effect is-${effect}`} data-testid="player-step-effect" data-effect={effect}>
    {effect === "fire" && <><path d="M-11 0 Q-16-12-7-17 Q-9-8 0-14 Q8-9 7-17 Q17-8 10 0Z" fill="#ff8a35"/><path d="M-5 0 Q-8-7-1-12 Q0-5 5-9 Q9-4 4 0Z" fill="#ffe36e"/></>}
    {effect === "sparkle" && <><path d="M0-18 3-5 13-2 3 1 0 14-3 1-13-2-3-5Z" fill="#8cf5ef"/><path d="M15-11v8m-4-4h8M-17-4v7m-3-3h7" stroke="#fff3a3" strokeWidth="2"/></>}
    {effect === "smoke" && <><circle cx="-6" cy="-6" r="5" fill="#bdc9d9"/><circle cx="2" cy="-12" r="6" fill="#e0e8f2"/><circle cx="9" cy="-5" r="4" fill="#aab8cb"/></>}
  </g>;
}
