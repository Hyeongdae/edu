import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type RefObject } from "react";
import type { LeaderboardEntry } from "./leaderboard";
import { LeaderboardPanel } from "./LeaderboardPanel";
import type { SharedInfiniteBest } from "../../shared/companyRecords";

interface LeaderboardDialogProps {
  entries: LeaderboardEntry[];
  infiniteEntries?: SharedInfiniteBest[];
  currentAccountId: string;
  scope: "browser" | "company";
  onClose: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

export function LeaderboardDialog({
  entries, infiniteEntries = [], currentAccountId, scope, onClose, closeButtonRef, dialogRef, onKeyDown,
}: LeaderboardDialogProps): ReactElement {
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
    <div className="leaderboard-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        ref={dialogRef}
        id="leaderboard-dialog"
        className="leaderboard-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        onKeyDown={onKeyDown}
      >
        <header className="leaderboard-dialog-header">
          <p className="leaderboard-dialog-kicker">STAIRWAY CHALLENGE</p>
          <button ref={closeButtonRef} className="leaderboard-dialog-close" type="button" aria-label="랭킹 닫기" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="mode-tabs" role="tablist" aria-label="랭킹 모드">
          <button ref={(node) => { tabRefs.current[0] = node; }} id="stage-ranking-tab" type="button" role="tab"
            aria-selected={mode === "stage"} aria-controls="leaderboard-tabpanel" tabIndex={mode === "stage" ? 0 : -1}
            onClick={() => setMode("stage")} onKeyDown={onTabKeyDown}>단계 모드</button>
          <button ref={(node) => { tabRefs.current[1] = node; }} id="infinite-ranking-tab" type="button" role="tab"
            aria-selected={mode === "infinite"} aria-controls="leaderboard-tabpanel" tabIndex={mode === "infinite" ? 0 : -1}
            onClick={() => setMode("infinite")} onKeyDown={onTabKeyDown}>무한 모드</button>
        </div>
        <div id="leaderboard-tabpanel" role="tabpanel" aria-labelledby={mode === "stage" ? "stage-ranking-tab" : "infinite-ranking-tab"}>
          <LeaderboardPanel entries={entries} infiniteEntries={infiniteEntries} currentAccountId={currentAccountId} scope={scope} mode={mode} />
        </div>
      </section>
    </div>
  );
}
