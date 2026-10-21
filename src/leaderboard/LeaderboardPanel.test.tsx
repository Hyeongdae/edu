import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeaderboardPanel } from "./LeaderboardPanel";

describe("LeaderboardPanel", () => {
  it("shows the empty state", () => {
    render(<LeaderboardPanel entries={[]} currentAccountId="player" />);
    expect(screen.getByText(/아직 저장된 기록이 없어요/)).toBeVisible();
  });

  it("shows the top ten and highlights the current player", () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      accountId: `player-${index}`,
      displayName: `플레이어 ${index}`,
      bestScore: 12 - index,
      achievedAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    }));
    render(<LeaderboardPanel entries={entries} currentAccountId="player-4" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("나")).toBeVisible();
    expect(screen.getByText("플레이어 4").closest("li")).toHaveClass("is-current-player");
  });
});
