import { getTopScores, type LeaderboardEntry } from "./leaderboard";
import { formatRemainingTimeCs } from "../game/stageResult";
import { getSharedTopInfiniteScores, getSharedTopScores, type SharedBest, type SharedInfiniteBest } from "../../shared/companyRecords";

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
  currentAccountId: string;
  scope?: "browser" | "company";
  mode?: "stage" | "infinite-v1" | "infinite-v2";
  infiniteV1Entries?: SharedInfiniteBest[];
  infiniteV2Entries?: SharedInfiniteBest[];
}

export function LeaderboardPanel({ entries, currentAccountId, scope = "browser", mode = "stage", infiniteV1Entries = [], infiniteV2Entries = [] }: LeaderboardPanelProps) {
  const topScores = scope === "company" ? getSharedTopScores(entries.filter((entry): entry is SharedBest => entry.remainingTimeCs !== undefined))
    : getTopScores(entries);
  const isInfinite = mode !== "stage";
  const selectedInfiniteEntries = mode === "infinite-v1" ? infiniteV1Entries : infiniteV2Entries;
  const infiniteScores = scope === "company" && isInfinite ? getSharedTopInfiniteScores(selectedInfiniteEntries) : [];
  const rankedInfiniteScores = infiniteScores.reduce<Array<SharedInfiniteBest & { rank: number }>>((rows, entry) => {
    const previous = rows.at(-1);
    rows.push({ ...entry, rank: !previous ? 1 : previous.bestScore === entry.bestScore ? previous.rank : previous.rank + 1 });
    return rows;
  }, []);

  return (
    <section className="leaderboard-card" aria-labelledby="leaderboard-title">
      <div className="leaderboard-heading">
        <div>
          <p className="leaderboard-kicker">{scope === "company" ? "COMPANY RANKING" : "LOCAL PLAY"}</p>
          <h2 id="leaderboard-title">최고 기록 랭킹</h2>
          <p className="leaderboard-ranking-rule">{isInfinite ? "순위 기준: 점수가 높은 순" : "순위 기준: 단계 → 점수 → 남은 시간"}</p>
        </div>
        <span className="leaderboard-count">TOP 10</span>
      </div>
      <p className="leaderboard-mode-label">{mode === "stage" ? "단계 모드" : mode === "infinite-v1" ? "무한모드 v1" : "무한모드 v2"}</p>
      {isInfinite ? rankedInfiniteScores.length === 0 ? (
        <p className="leaderboard-empty">{scope === "company"
          ? mode === "infinite-v1" ? "무한모드 v1 기록이 없습니다." : "무한모드 v2 기록이 없습니다. 첫 기록을 만들어 보세요!"
          : "회사 계정으로 접속하면 무한모드 랭킹이 기록됩니다."}</p>
      ) : (
        <ol className="leaderboard-list infinite-leaderboard-list">
          {rankedInfiniteScores.map((entry) => <li className={`leaderboard-row${entry.accountId === currentAccountId ? " is-current-player" : ""}`}
            key={entry.accountId}>
            <span className="leaderboard-rank">{entry.rank}</span>
            <span className="leaderboard-name">{entry.displayName || "이름 없음"}{entry.accountId === currentAccountId && <span className="leaderboard-you">나</span>}</span>
            <strong className="leaderboard-score">{entry.bestScore}점</strong>
          </li>)}
        </ol>
      ) : topScores.length === 0 ? (
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
