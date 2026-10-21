import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTopScores, readLeaderboard, saveBestScore, type LeaderboardEntry } from "./leaderboard";

const key = "stair-climb:leaderboard:v1";
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((item: string) => values.get(item) ?? null),
    setItem: vi.fn((item: string, value: string) => values.set(item, value)),
    removeItem: vi.fn((item: string) => values.delete(item)),
  } as unknown as Storage & { values: Map<string, string> };
};

const entry = (accountId: string, bestScore: number, achievedAt: string): LeaderboardEntry => ({
  accountId,
  displayName: accountId,
  bestScore,
  achievedAt,
});

describe("leaderboard storage", () => {
  let fakeStorage: ReturnType<typeof storage>;

  beforeEach(() => {
    fakeStorage = storage();
  });

  it("returns an empty list when no record exists", () => {
    expect(readLeaderboard(fakeStorage)).toEqual([]);
  });

  it("keeps only a higher score for each account", () => {
    fakeStorage.setItem(key, JSON.stringify([entry("a", 10, "2026-01-01T00:00:00.000Z")]));

    const lower = saveBestScore({ accountId: "a", displayName: "A new name", bestScore: 8 }, fakeStorage);
    expect(lower.entries[0]).toMatchObject({ bestScore: 10, displayName: "a" });

    const higher = saveBestScore(
      { accountId: "a", displayName: "A", bestScore: 12 },
      fakeStorage,
      new Date("2026-02-01T00:00:00.000Z"),
    );
    expect(higher.entries).toEqual([{ ...entry("a", 12, "2026-02-01T00:00:00.000Z"), displayName: "A" }]);
    expect(JSON.parse(fakeStorage.getItem(key) ?? "[]")).toHaveLength(1);
  });

  it("sorts by score and then earlier achievement, capped at ten", () => {
    const scores = Array.from({ length: 12 }, (_, index) =>
      entry(`player-${index}`, index === 10 || index === 11 ? 20 : index, `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    );

    const top = getTopScores(scores);
    expect(top).toHaveLength(10);
    expect(top.slice(0, 2).map((item) => item.accountId)).toEqual(["player-10", "player-11"]);
    expect(getTopScores(scores, 2)).toHaveLength(2);
  });

  it("clears malformed JSON and remains usable if cleanup throws", () => {
    fakeStorage.getItem = vi.fn(() => "{bad json") as typeof fakeStorage.getItem;
    fakeStorage.removeItem = vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }) as typeof fakeStorage.removeItem;

    expect(readLeaderboard(fakeStorage)).toEqual([]);
    expect(saveBestScore({ accountId: "a", displayName: "A", bestScore: 1 }, fakeStorage).saved).toBe(true);
  });

  it("reports storage read and write failures without throwing", () => {
    fakeStorage.getItem = vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }) as typeof fakeStorage.getItem;
    expect(saveBestScore({ accountId: "a", displayName: "A", bestScore: 1 }, fakeStorage)).toMatchObject({ saved: false, error: "storage-unavailable" });

    fakeStorage.getItem = vi.fn(() => null) as typeof fakeStorage.getItem;
    fakeStorage.setItem = vi.fn(() => { throw new DOMException("full", "QuotaExceededError"); }) as typeof fakeStorage.setItem;
    expect(saveBestScore({ accountId: "a", displayName: "A", bestScore: 1 }, fakeStorage)).toMatchObject({ saved: false, error: "storage-unavailable" });
  });

  it("rejects invalid scores", () => {
    expect(() => saveBestScore({ accountId: "a", displayName: "A", bestScore: -1 }, fakeStorage)).toThrow(RangeError);
    expect(() => saveBestScore({ accountId: "a", displayName: "A", bestScore: Number.NaN }, fakeStorage)).toThrow(RangeError);
  });
});
