import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from "react";

export type PauseMenuConfirmation = "restart" | "title" | null;

export interface PauseMenuDialogProps {
  modeName: string;
  confirmation: PauseMenuConfirmation;
  onResume: () => void;
  onRequestRestart: () => void;
  onRequestTitle: () => void;
  onConfirm: () => void;
  onCancelConfirmation: () => void;
}

export function PauseMenuDialog({
  modeName,
  confirmation,
  onResume,
  onRequestRestart,
  onRequestTitle,
  onConfirm,
  onCancelConfirmation,
}: PauseMenuDialogProps): ReactElement {
  const dialogRef = useRef<HTMLElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstActionRef.current?.focus();
  }, [confirmation]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (confirmation !== null) onCancelConfirmation();
      else onResume();
      return;
    }
    if (event.key === "Enter" && confirmation === "restart" && event.target === firstActionRef.current) {
      event.preventDefault();
      onConfirm();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const title = confirmation === "restart"
    ? "다시시작할까요?"
    : confirmation === "title" ? "타이틀로 돌아갈까요?" : `${modeName} 일시정지`;

  return (
    <div className="pause-menu-backdrop">
      <section ref={dialogRef} id="game-pause-dialog" className="pause-menu-dialog" role="dialog" aria-modal="true"
        aria-labelledby="pause-menu-title" data-keyboard-menu onKeyDown={onKeyDown}>
        <p className="pause-menu-kicker">GAME PAUSED</p>
        <h2 id="pause-menu-title">{title}</h2>
        {confirmation === null ? (
          <div className="pause-menu-actions">
            <button ref={firstActionRef} className="pause-menu-button is-primary" type="button" onClick={onResume}>게임 재개</button>
            <button className="pause-menu-button" type="button" onClick={onRequestRestart}>다시시작</button>
            <button className="pause-menu-button is-title" type="button" onClick={onRequestTitle}>타이틀로 돌아가기</button>
          </div>
        ) : (
          <>
            <p className="pause-menu-confirmation-copy">
              {confirmation === "restart"
                ? `현재 ${modeName} 진행을 초기화하고 0점부터 다시 시작할까요?`
                : "타이틀 화면으로 돌아갈까요? 현재 플레이는 종료됩니다."}
            </p>
            <div className="pause-menu-confirmation-actions">
              <button ref={firstActionRef} className="pause-menu-button is-primary" type="button" onClick={onConfirm}>예</button>
              <button className="pause-menu-button" type="button" onClick={onCancelConfirmation}>아니오</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
