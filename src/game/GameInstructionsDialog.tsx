import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type RefObject } from "react";
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
  const [mode, setMode] = useState<"stage" | "infinite">("stage");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectTab = (next: "stage" | "infinite") => {
    setMode(next);
    tabRefs.current[next === "stage" ? 0 : 1]?.focus();
  };
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(mode === "stage" ? "infinite" : "stage");
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      selectTab(event.key === "Home" ? "stage" : "infinite");
    }
  };
  return (
    <div className="instructions-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialogRef}
        className="instructions-dialog"
        role="dialog"
        aria-modal="true"
        data-keyboard-menu
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
          <div className="mode-tabs" role="tablist" aria-label="게임 설명 모드">
            <button ref={(node) => { tabRefs.current[0] = node; }} id="stage-instructions-tab" type="button" role="tab"
              aria-selected={mode === "stage"} aria-controls="instructions-tabpanel" tabIndex={mode === "stage" ? 0 : -1}
              onClick={() => setMode("stage")} onKeyDown={onTabKeyDown}>단계 모드</button>
            <button ref={(node) => { tabRefs.current[1] = node; }} id="infinite-instructions-tab" type="button" role="tab"
              aria-selected={mode === "infinite"} aria-controls="instructions-tabpanel" tabIndex={mode === "infinite" ? 0 : -1}
              onClick={() => setMode("infinite")} onKeyDown={onTabKeyDown}>무한 모드</button>
          </div>
          <div id="instructions-tabpanel" role="tabpanel" aria-labelledby={mode === "stage" ? "stage-instructions-tab" : "infinite-instructions-tab"}>
          <div hidden={mode !== "stage"}>
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
          <div className="infinite-instructions-panel" hidden={mode !== "infinite"}>
            <section className="instructions-card"><h3>조작 방법</h3><ul>
              <li><kbd>D</kbd>를 눌러 한 칸 올라가요.</li><li><kbd>J</kbd>를 눌러 방향을 바꾸며 한 칸 올라가요.</li>
              <li><kbd>Space</kbd>는 사용하지 않아요. 모바일은 화면의 앞/회전 버튼을 눌러요.</li>
            </ul></section>
            <section className="instructions-card"><h3>무한 모드 규칙</h3><ul>
              <li>제한 시간이나 단계 목표, 장애물 없이 계속 올라가요.</li><li>계단 한 칸마다 1점, 50칸마다 30초 동안 2배 점수를 받아요.</li>
              <li>추격자는 기본 0.3초마다 한 칸씩 올라와요. 거리가 15칸 이상이면 0.1초 간격으로 좁히고, 6칸 이내가 되면 기본 속도로 돌아가요.</li>
              <li>방향을 잘못 입력하거나 추격자에게 잡히면 기록이 끝나요.</li>
            </ul></section>
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}
