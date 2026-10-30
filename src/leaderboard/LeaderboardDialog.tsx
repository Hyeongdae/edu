import type { KeyboardEvent as ReactKeyboardEvent, ReactElement, RefObject } from "react";
import type { LeaderboardEntry } from "./leaderboard";
import { LeaderboardPanel } from "./LeaderboardPanel";

interface LeaderboardDialogProps {
  entries: LeaderboardEntry[];
  currentAccountId: string;
  scope: "browser" | "company";
  onClose: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

export function LeaderboardDialog({
  entries, currentAccountId, scope, onClose, closeButtonRef, dialogRef, onKeyDown,
}: LeaderboardDialogProps): ReactElement {
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
        <LeaderboardPanel entries={entries} currentAccountId={currentAccountId} scope={scope} />
      </section>
    </div>
  );
}
