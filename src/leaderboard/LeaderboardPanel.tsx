import { getTopScores, type LeaderboardEntry } from "./leaderboard";

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
  currentAccountId: string;
}

export function LeaderboardPanel({ entries, currentAccountId }: LeaderboardPanelProps) {
  const topScores = getTopScores(entries);

  return (
    <section className="leaderboard-card" aria-labelledby="leaderboard-title">
      <div className="leaderboard-heading">
        <div>
          <p className="leaderboard-kicker">THIS BROWSER</p>
          <h2 id="leaderboard-title">최고 기록 랭킹</h2>
        </div>
        <span className="leaderboard-count">TOP 10</span>
      </div>
      {topScores.length === 0 ? (
        <p className="leaderboard-empty">아직 저장된 기록이 없어요. 첫 기록을 만들어 보세요!</p>
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
                <span className="leaderboard-stage">{entry.bestStage === 0 ? "미클리어(0단계)" : `${entry.bestStage}단계`}</span>
                <strong className="leaderboard-score">{entry.bestScore}점</strong>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
