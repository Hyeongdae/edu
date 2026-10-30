import { useEffect, useRef, type ReactElement } from "react";
import { getHighestUnlockedStage, getStageRule, getStageTargetScore, STAGE_RULES } from "./stageRules";
import type { ClearedStage, GameStage } from "./types";

interface StageSelectPanelProps {
  selectedStage: GameStage;
  highestClearedStage: ClearedStage;
  onSelect: (stage: GameStage) => void;
  onStart: () => void;
  onOpenLeaderboard: (trigger: HTMLButtonElement) => void;
  disabled: boolean;
  progressUnavailable: boolean;
}

export function StageSelectPanel({ selectedStage, highestClearedStage, onSelect, onStart, onOpenLeaderboard, disabled, progressUnavailable }: StageSelectPanelProps): ReactElement {
  const selectedButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { selectedButtonRef.current?.focus(); }, []);
  const seconds = getStageRule(selectedStage).durationMs / 1000;
  const duration = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <section className="stage-select-panel" aria-label="단계 선택">
      <h2>시작 단계를 선택하세요</h2>
      <div className="stage-select-grid">
        {STAGE_RULES.map(({ stage }) => {
          const locked = stage > getHighestUnlockedStage(highestClearedStage);
          return (
            <button key={stage} ref={stage === selectedStage ? selectedButtonRef : undefined}
              type="button" aria-label={`${stage}단계 ${locked ? "잠김" : "선택"}`}
              aria-pressed={stage === selectedStage} disabled={disabled || locked}
              onClick={() => onSelect(stage)}>
              <strong>{stage}단계</strong>
              <span>{locked ? "잠김" : stage === selectedStage ? "선택됨" : "선택"}</span>
            </button>
          );
        })}
      </div>
      <p className="stage-select-summary">선택: {selectedStage}단계 · 제한시간 {duration}</p>
      <p>이번 단계 0점부터 · 목표 {getStageTargetScore(selectedStage)}점</p>
      {highestClearedStage > 0 && <p>최고 클리어 {highestClearedStage}단계</p>}
      {progressUnavailable && <p role="status">진행도를 읽지 못했습니다. 확인된 클리어 이력과 이번 플레이 진행도를 사용합니다.</p>}
      <button className="stage-select-start" type="button" disabled={disabled} onClick={onStart}>시작하기</button>
      <button className="stage-select-leaderboard" type="button" aria-haspopup="dialog" aria-controls="leaderboard-dialog" disabled={disabled}
        onClick={(event) => onOpenLeaderboard(event.currentTarget)}>랭킹 보기</button>
    </section>
  );
}
