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
    {effect === "fire" && <g className="step-fire-flames" transform="scale(1.55 1.18)">
      <path className="step-fire-flame step-fire-flame--left" d="M-18 2V-4H-14V-10H-11V-19H-8V-13H-5V-7H-2V2Z" fill="#ef4c32" stroke="#8e342d" strokeWidth="1.2" />
      <path className="step-fire-flame step-fire-flame--right" d="M-3 2V-5H0V-11H3V-20H6V-14H9V-8H13V-4H17V2Z" fill="#ff7135" stroke="#a3422d" strokeWidth="1.2" />
      <path className="step-fire-core" d="M-9 2V-4H-6V-9H-3V-15H0V-9H3V-5H7V2Z" fill="#ffb347" />
      <path className="step-fire-core-highlight" d="M-4 2V-3H-1V-8H2V-4H5V2Z" fill="#ffe36e" />
    </g>}
    {effect === "sparkle" && <g className="step-sparkle">
      <g transform="translate(-13 0) scale(.65)"><path className="step-sparkle-particle step-sparkle-particle--left" d="M0-12 3-3 12 0 3 3 0 12-3 3-12 0-3-3Z" fill="#ffd34f" stroke="#b87520" strokeWidth="2" /></g>
      <g transform="translate(0 3) scale(.95)"><path className="step-sparkle-particle step-sparkle-particle--center" d="M0-12 3-3 12 0 3 3 0 12-3 3-12 0-3-3Z" fill="#ffe36e" stroke="#c48724" strokeWidth="1.7" /></g>
      <g transform="translate(13 0) scale(.58)"><path className="step-sparkle-particle step-sparkle-particle--right" d="M0-12 3-3 12 0 3 3 0 12-3 3-12 0-3-3Z" fill="#fff0a0" stroke="#c48724" strokeWidth="2" /></g>
    </g>}
    {effect === "smoke" && <g className="step-cloud">
      <g transform="translate(-12 0) scale(.39)"><path className="step-cloud-particle step-cloud-particle--left" d="M-18 4C-23 4-25 0-23-4C-22-8-18-10-14-8C-14-15-8-19-2-17C2-24 12-22 15-15C22-16 26-10 23-4C27 0 23 5 18 5H-18Z" fill="#9ed5ff" stroke="#4d8fca" strokeWidth="3"/><path d="M-18 1C-21 1-22-1-21-4C-19-6-17-7-14-5C-13-11-9-14-4-13C0-19 8-18 11-12C16-14 20-10 19-6C22-3 20 1 16 1H-18Z" fill="#d8efff"/></g>
      <g transform="translate(0 4) scale(.5)"><path className="step-cloud-particle step-cloud-particle--center" d="M-18 4C-23 4-25 0-23-4C-22-8-18-10-14-8C-14-15-8-19-2-17C2-24 12-22 15-15C22-16 26-10 23-4C27 0 23 5 18 5H-18Z" fill="#9ed5ff" stroke="#4d8fca" strokeWidth="3"/><path d="M-18 1C-21 1-22-1-21-4C-19-6-17-7-14-5C-13-11-9-14-4-13C0-19 8-18 11-12C16-14 20-10 19-6C22-3 20 1 16 1H-18Z" fill="#d8efff"/></g>
      <g transform="translate(12 1) scale(.36)"><path className="step-cloud-particle step-cloud-particle--right" d="M-18 4C-23 4-25 0-23-4C-22-8-18-10-14-8C-14-15-8-19-2-17C2-24 12-22 15-15C22-16 26-10 23-4C27 0 23 5 18 5H-18Z" fill="#9ed5ff" stroke="#4d8fca" strokeWidth="3"/><path d="M-18 1C-21 1-22-1-21-4C-19-6-17-7-14-5C-13-11-9-14-4-13C0-19 8-18 11-12C16-14 20-10 19-6C22-3 20 1 16 1H-18Z" fill="#d8efff"/></g>
    </g>}
    {effect === "heart" && <g className="step-heart">
      <g transform="translate(-12 1) scale(.42)"><path className="step-heart-particle step-heart-particle--left" d="M0 12C-3 9-12 3-12-3C-12-10-4-12 0-6C4-12 12-10 12-3C12 3 3 9 0 12Z" fill="#fff0f5" stroke="#e9568b" strokeWidth="2.5" /></g>
      <g transform="translate(0 3) scale(.57)"><path className="step-heart-particle step-heart-particle--center" d="M0 12C-3 9-12 3-12-3C-12-10-4-12 0-6C4-12 12-10 12-3C12 3 3 9 0 12Z" fill="#fff0f5" stroke="#e9568b" strokeWidth="2.5" /></g>
      <g transform="translate(12 0) scale(.36)"><path className="step-heart-particle step-heart-particle--right" d="M0 12C-3 9-12 3-12-3C-12-10-4-12 0-6C4-12 12-10 12-3C12 3 3 9 0 12Z" fill="#fff0f5" stroke="#e9568b" strokeWidth="2.5" /></g>
    </g>}
  </g>;
}
