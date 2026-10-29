import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LeaderboardPanel } from "./LeaderboardPanel";
import type { LeaderboardEntry } from "./leaderboard";

describe("LeaderboardPanel", () => {
  afterEach(cleanup);

  it("displays the same centisecond value used for ranking including zero and missing legacy time", () => {
    const base = { bestStage: 2 as const, bestScore: 80, achievedAt: "2026-10-29" };
    const rows: LeaderboardEntry[] = [
      { ...base, accountId: "slower", displayName: "느린 사람", remainingTimeCs: 1234 },
      { ...base, accountId: "faster", displayName: "빠른 사람", remainingTimeCs: 1235 },
      { ...base, accountId: "zero", displayName: "시간 소진", remainingTimeCs: 0 },
      { ...base, accountId: "legacy", displayName: "옛 기록" },
    ];
    render(<LeaderboardPanel entries={rows} currentAccountId="faster" />);
    const rendered = screen.getAllByRole("listitem");
    expect(within(rendered[0]).getByText("빠른 사람")).toBeVisible();
    expect(within(rendered[0]).getByText("남은 시간 12.35초")).toBeVisible();
    expect(within(rendered[0]).getByText("2단계")).toBeVisible();
    expect(within(rendered[0]).getByText("80점")).toBeVisible();
    expect(rendered[0]).toHaveClass("is-current-player");
    expect(within(rendered[1]).getByText("남은 시간 12.34초")).toBeVisible();
    expect(within(rendered[2]).getByText("남은 시간 0.00초")).toBeVisible();
    expect(within(rendered[3]).getByText("시간 미기록")).toBeVisible();
  });

  it("shows the empty state", () => {
    render(<LeaderboardPanel entries={[]} currentAccountId="player" />);
    expect(screen.getByText(/아직 저장된 기록이 없어요/)).toBeVisible();
  });

  it("shows the attempted stage and zero points and prioritizes a higher stage", () => {
    render(<LeaderboardPanel currentAccountId="zero" entries={[
      { accountId: "zero", displayName: "도전자", bestStage: 1, bestScore: 0, achievedAt: "2026-01-01" },
      { accountId: "one", displayName: "다음 도전", bestStage: 2, bestScore: 80, achievedAt: "2026-01-02" },
    ]} />);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("2단계")).toBeVisible();
    expect(within(rows[0]).getByText("80점")).toBeVisible();
    expect(within(rows[1]).getByText("1단계")).toBeVisible();
    expect(within(rows[1]).getByText("0점")).toBeVisible();
    expect(rows[1]).toHaveClass("is-current-player");
  });

  it("shows the top ten and highlights the current player", () => {
    const entries: LeaderboardEntry[] = Array.from({ length: 12 }, (_, index) => ({
      accountId: `player-${index}`,
      displayName: `플레이어 ${index}`,
      bestStage: 1,
      bestScore: 12 - index,
      achievedAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));
    render(<LeaderboardPanel entries={entries} currentAccountId="player-4" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("나")).toBeVisible();
    expect(screen.getByText("플레이어 4").closest("li")).toHaveClass("is-current-player");
    const currentRow = screen.getByText("플레이어 4").closest("li")!;
    expect(within(currentRow).getByText("1단계")).toBeVisible();
    expect(within(currentRow).getByText("8점")).toBeVisible();
  });

  it("keeps stage and score in each row and ranks a higher stage first", () => {
    const entries: LeaderboardEntry[] = [
      { accountId: "one", displayName: "단계 하나", bestStage: 1, bestScore: 999, achievedAt: "2026-01-01" },
      { accountId: "two", displayName: "단계 둘", bestStage: 2, bestScore: 350, achievedAt: "2026-01-02" },
    ];
    render(<LeaderboardPanel entries={entries} currentAccountId="two" />);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("단계 둘")).toBeVisible();
    expect(within(rows[0]).getByText("2단계")).toBeVisible();
    expect(within(rows[0]).getByText("350점")).toBeVisible();
    expect(within(rows[1]).getByText("1단계")).toBeVisible();
    expect(within(rows[1]).getByText("999점")).toBeVisible();
  });

  it("shows stages three through five and orders by stage, score, then earlier time", () => {
    const entries: LeaderboardEntry[] = [
      { accountId: "three", displayName: "셋", bestStage: 3, bestScore: 99_999, achievedAt: "2026-01-01" },
      { accountId: "four", displayName: "넷", bestStage: 4, bestScore: 99_999, achievedAt: "2026-01-01" },
      { accountId: "late", displayName: "늦은 다섯", bestStage: 5, bestScore: 1_500, achievedAt: "2026-01-03" },
      { accountId: "early", displayName: "이른 다섯", bestStage: 5, bestScore: 1_500, achievedAt: "2026-01-02" },
      { accountId: "best", displayName: "최고 다섯", bestStage: 5, bestScore: 1_501, achievedAt: "2026-01-04" },
    ];
    render(<LeaderboardPanel entries={entries} currentAccountId="early" />);
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.querySelector(".leaderboard-name")?.textContent)).toEqual(["최고 다섯", "이른 다섯나", "늦은 다섯", "넷", "셋"]);
    expect(rows[1]).toHaveClass("is-current-player");
    expect(within(rows[0]).getByText("5단계")).toBeVisible();
    expect(within(rows[3]).getByText("4단계")).toBeVisible();
    expect(within(rows[4]).getByText("3단계")).toBeVisible();
  });
});
