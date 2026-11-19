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
  return <g key={`${effect}-${animationKey}`} className={`player-step-effect is-${effect}`} data-testid="player-step-effect" data-effect={effect}
    style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}>
    {effect === "fire" && <g className="step-fire-flames">
      <path className="step-fire-flame step-fire-flame--left" d="M-16 2v-8h4v-7h4v-7h4v8h4v7h3v7Z" fill="#f4512b" />
      <path className="step-fire-flame step-fire-flame--right" d="M-3 2v-7h4v-8h4v-8h4v7h4v9h3v7Z" fill="#ff812d" />
      <path className="step-fire-core" d="M-8 2v-6h3v-7h4v5h4v8Z" fill="#ffd85a" />
      <path className="step-fire-core-highlight" d="M-2 2v-5h3v-5h3v7h2v3Z" fill="#fff1a0" />
    </g>}
    {effect === "sparkle" && <><path d="M0-18 3-5 13-2 3 1 0 14-3 1-13-2-3-5Z" fill="#8cf5ef"/><path d="M15-11v8m-4-4h8M-17-4v7m-3-3h7" stroke="#fff3a3" strokeWidth="2"/></>}
    {effect === "smoke" && <><circle cx="-6" cy="-6" r="5" fill="#bdc9d9"/><circle cx="2" cy="-12" r="6" fill="#e0e8f2"/><circle cx="9" cy="-5" r="4" fill="#aab8cb"/></>}
  </g>;
}
