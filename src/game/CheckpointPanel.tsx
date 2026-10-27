import { useEffect, useRef, type KeyboardEvent, type ReactElement } from "react";
import type { GameStage } from "./types";

interface CheckpointPanelProps {
  stage: GameStage;
  score: number;
  onContinue: () => void;
  onQuit: () => void;
  disabled: boolean;
  progressError?: boolean;
}

export function CheckpointPanel({ stage, score, onContinue, onQuit, disabled, progressError = false }: CheckpointPanelProps): ReactElement {
  const continueRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { continueRef.current?.focus(); }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
    if (!buttons.length) return;
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return (
    <section className="checkpoint-panel" role="dialog" aria-modal="true" aria-labelledby="checkpoint-title" onKeyDown={onKeyDown}>
      <h2 id="checkpoint-title">{stage}단계 클리어!</h2>
      <p>이번 단계 점수 {score}점</p>
      <p>다음 단계에 계속 도전할까요? 선택하는 동안 게임은 멈춰 있어요.</p>
      {progressError && <p className="checkpoint-progress-error" role="status">진행도를 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.</p>}
      <div className="checkpoint-actions">
        <button ref={continueRef} type="button" disabled={disabled} onClick={onContinue}>계속하기</button>
        <button type="button" disabled={disabled} onClick={onQuit}>그만두기</button>
      </div>
    </section>
  );
}
