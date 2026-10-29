import type { KeyboardEvent as ReactKeyboardEvent, ReactElement, RefObject } from "react";
import { STAGE_RULES } from "./stageRules";

interface GameInstructionsDialogProps {
  onClose: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

function formatSeconds(milliseconds: number): string {
  return `${milliseconds / 1000}초`;
}

export function GameInstructionsDialog({ onClose, closeButtonRef, dialogRef, onKeyDown }: GameInstructionsDialogProps): ReactElement {
  return (
    <div className="instructions-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialogRef}
        className="instructions-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-instructions-title"
        onKeyDown={onKeyDown}
      >
        <header className="instructions-dialog-header">
          <div>
            <p className="instructions-eyebrow">STAIRWAY CHALLENGE</p>
            <h2 id="game-instructions-title">게임 설명</h2>
          </div>
          <button ref={closeButtonRef} className="instructions-close-button" type="button" aria-label="게임 설명 닫기" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="instructions-content">
          <section className="instructions-card" aria-labelledby="instructions-controls-title">
            <h3 id="instructions-controls-title">조작 방법</h3>
            <ul>
              <li><kbd>D</kbd> 한 칸 내려가기</li>
              <li><kbd>J</kbd> 모퉁이에서 방향을 바꾸며 한 칸 내려가기</li>
              <li><kbd>Space</kbd> 장애물을 넘어 두 칸 이동하기. 착지할 계단이 비어 있어야 성공해요.</li>
            </ul>
            <p>모바일에서는 화면의 내려가기, 방향 바꾸기, 점프 버튼을 사용하세요.</p>
          </section>

          <section className="instructions-card" aria-labelledby="instructions-stages-title">
            <h3 id="instructions-stages-title">단계별 목표와 난이도</h3>
            <div className="instructions-table-scroll">
              <table aria-label="단계별 목표와 난이도">
                <thead>
                  <tr>
                    <th scope="col">단계</th>
                    <th scope="col">제한시간</th>
                    <th scope="col">목표 점수</th>
                    <th scope="col">장애물 확률</th>
                    <th scope="col">추격자 속도</th>
                  </tr>
                </thead>
                <tbody>
                  {STAGE_RULES.map((rule) => (
                    <tr key={rule.stage}>
                      <th scope="row">{rule.stage}단계</th>
                      <td>{formatSeconds(rule.durationMs)}</td>
                      <td>{rule.scoreRequired}점</td>
                      <td>{Math.round(rule.obstacleProbability * 100)}%</td>
                      <td>{formatSeconds(rule.pursuerStepIntervalMs)}마다 1칸</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="instructions-encouragement">5단계를 모두 클리어하고 멋지게 퇴근해봐요 화이팅! 잡히면 야근일지도..</p>
        </div>
      </section>
    </div>
  );
}
