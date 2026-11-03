import type { PointerEvent, ReactElement } from "react";
import { PixelIcon, type PixelIconName } from "./pixel/PixelIcon";

interface ControlButtonsProps {
  onForward: () => void;
  onTurn: () => void;
  onJump: () => void;
  disabled: boolean;
  showJump?: boolean;
  direction?: "up" | "down";
}

export function ControlButtons({ onForward, onTurn, onJump, disabled, showJump = true, direction = "down" }: ControlButtonsProps): ReactElement {
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, action: () => void) => {
    if (disabled || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    action();
  };
  const button = (name: PixelIconName, label: string, text: string, action: () => void) => (
    <button
      className={`control-button ${name}-control`} type="button" aria-label={label}
      onPointerDown={(event) => onPointerDown(event, action)}
      onClick={(event) => { if (!disabled && event.detail === 0) action(); }}
      disabled={disabled}
    >
      <PixelIcon name={name} size={24} className={name === "forward" ? "descent-forward-icon" : undefined} />
      <span>{text}</span>
    </button>
  );
  const forwardLabel = direction === "up" ? "한 칸 올라가기" : "한 칸 내려가기";
  const turnLabel = direction === "up" ? "방향 바꾸며 한 칸 올라가기" : "방향을 바꾸며 내려가기";
  const forwardText = direction === "up" ? "올라가기" : "내려가기";
  return (
    <section className="game-controls" aria-label="게임 조작">
      {button("forward", forwardLabel, forwardText, onForward)}
      <div className="control-actions">
        {button("turn", turnLabel, "방향 바꾸기", onTurn)}
        {showJump && button("jump", "장애물을 뛰어넘기", "점프", onJump)}
      </div>
    </section>
  );
}
