import type { ReactElement } from "react";
import { PixelIcon } from "./pixel/PixelIcon";

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
        <PixelIcon name="forward" size={24} />
        <span>앞으로</span>
      </button>
      <button
        className="control-button turn-control"
        type="button"
        aria-label="방향을 바꾸며 오르기"
        onClick={onTurn}
        disabled={disabled}
      >
        <PixelIcon name="turn" size={24} />
        <span>방향 바꾸기</span>
      </button>
    </section>
  );
}
