import { getTopScores, type LeaderboardEntry } from "./leaderboard";
import { formatRemainingTimeCs } from "../game/stageResult";
import { getSharedTopScores, type SharedBest } from "../../shared/companyRecords";

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
  currentAccountId: string;
  scope?: "browser" | "company";
}

export function LeaderboardPanel({ entries, currentAccountId, scope = "browser" }: LeaderboardPanelProps) {
  const topScores = scope === "company" ? getSharedTopScores(entries.filter((entry): entry is SharedBest => entry.remainingTimeCs !== undefined))
    : getTopScores(entries);

  return (
    <section className="leaderboard-card" aria-labelledby="leaderboard-title">
      <div className="leaderboard-heading">
        <div>
          <p className="leaderboard-kicker">{scope === "company" ? "COMPANY RANKING" : "LOCAL PLAY"}</p>
          <h2 id="leaderboard-title">최고 기록 랭킹</h2>
        </div>
        <span className="leaderboard-count">TOP 10</span>
      </div>
      {topScores.length === 0 ? (
        <p className="leaderboard-empty">
          {scope === "company"
            ? "아직 저장된 기록이 없어요. 첫 기록을 만들어 보세요!"
            : "로컬 플레이 기록은 저장되지 않아요. 회사 게임에 로그인하면 랭킹에 기록됩니다."}
        </p>
      ) : (
        <ol className="leaderboard-list">
          {topScores.map((entry, index) => (
            <li
              className={`leaderboard-row${entry.accountId === currentAccountId ? " is-current-player" : ""}`}
              key={entry.accountId}
            >
              <span className="leaderboard-rank">{index + 1}</span>
              <span className="leaderboard-name">
                {entry.displayName || "이름 없음"}
                {entry.accountId === currentAccountId && <span className="leaderboard-you">나</span>}
              </span>
              <span className="leaderboard-record">
                <span className="leaderboard-stage">{entry.bestStage}단계</span>
                <strong className="leaderboard-score">{entry.bestScore}점</strong>
                <span className="leaderboard-time">{entry.remainingTimeCs === undefined ? "시간 미기록" : `남은 시간 ${formatRemainingTimeCs(entry.remainingTimeCs)}`}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
