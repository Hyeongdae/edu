import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type RefObject } from "react";
import type { LeaderboardEntry } from "./leaderboard";
import { LeaderboardPanel } from "./LeaderboardPanel";
import type { SharedInfiniteBest } from "../../shared/companyRecords";

interface LeaderboardDialogProps {
  entries: LeaderboardEntry[];
  infiniteV1Entries?: SharedInfiniteBest[];
  infiniteV2Entries?: SharedInfiniteBest[];
  currentAccountId: string;
  scope: "browser" | "company";
  onClose: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

export function LeaderboardDialog({
  entries, infiniteV1Entries = [], infiniteV2Entries = [], currentAccountId, scope, onClose, closeButtonRef, dialogRef, onKeyDown,
}: LeaderboardDialogProps): ReactElement {
  const [mode, setMode] = useState<"stage" | "infinite-v1" | "infinite-v2">("infinite-v2");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const modes = ["stage", "infinite-v1", "infinite-v2"] as const;
  const tabLabels = ["단계 모드", "무한모드 v1", "무한모드 v2"] as const;
  const tabIds = ["stage-ranking-tab", "infinite-v1-ranking-tab", "infinite-v2-ranking-tab"] as const;
  const selectTab = (next: typeof modes[number]) => {
    setMode(next);
    tabRefs.current[modes.indexOf(next)]?.focus();
  };
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, focusedMode: typeof modes[number]) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const currentIndex = modes.indexOf(focusedMode);
      const offset = event.key === "ArrowRight" ? 1 : -1;
      selectTab(modes[(currentIndex + offset + modes.length) % modes.length]);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      selectTab(event.key === "Home" ? modes[0] : modes.at(-1)!);
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
        data-keyboard-menu
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
          {modes.map((tabMode, index) => <button key={tabMode} ref={(node) => { tabRefs.current[index] = node; }}
            id={tabIds[index]} type="button" role="tab" aria-selected={mode === tabMode} aria-controls="leaderboard-tabpanel"
            tabIndex={mode === tabMode ? 0 : -1} onClick={() => setMode(tabMode)} onKeyDown={(event) => onTabKeyDown(event, tabMode)}>{tabLabels[index]}</button>)}
        </div>
        <div id="leaderboard-tabpanel" role="tabpanel" aria-labelledby={tabIds[modes.indexOf(mode)]}>
          <LeaderboardPanel entries={entries} infiniteV1Entries={infiniteV1Entries} infiniteV2Entries={infiniteV2Entries}
            currentAccountId={currentAccountId} scope={scope} mode={mode} />
        </div>
      </section>
    </div>
  );
}
