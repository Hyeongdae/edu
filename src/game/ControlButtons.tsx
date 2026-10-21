import type { ReactElement } from "react";

interface ControlButtonsProps {
  onForward: () => void;
  onTurn: () => void;
  disabled: boolean;
}

export function ControlButtons({ onForward, onTurn, disabled }: ControlButtonsProps): ReactElement {
  return (
    <section className="game-controls" aria-label="게임 조작">
      <button
        className="control-button forward-control"
        type="button"
        aria-label="앞으로 한 칸 오르기"
        onClick={onForward}
        disabled={disabled}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 27V6m0 0L7.5 14.5M16 6l8.5 8.5" />
        </svg>
        <span>앞으로</span>
      </button>
      <button
        className="control-button turn-control"
        type="button"
        aria-label="방향을 바꾸며 오르기"
        onClick={onTurn}
        disabled={disabled}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M8 23a11 11 0 0 0 18-8.2V9m0 0-6 6m6-6 5 6M24 9H12a7 7 0 0 0-6 3" />
        </svg>
        <span>방향 바꾸기</span>
      </button>
    </section>
  );
}
