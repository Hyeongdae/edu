import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTopScores, readLeaderboard, saveBestScore, type LeaderboardEntry } from "./leaderboard";
import type { GameStage } from "../game/types";

const key = "stair-climb:leaderboard:v5";
const legacyKey = "stair-climb:leaderboard:v1";
const legacyKeys = [legacyKey, "stair-climb:leaderboard:v2", "stair-climb:leaderboard:v3"];
const storage = () => {
  const values = new Map<string, string>();
  return {
    values,
    get length() { return values.size; },
    clear: vi.fn(() => values.clear()),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    getItem: vi.fn((item: string) => values.get(item) ?? null),
    setItem: vi.fn((item: string, value: string) => values.set(item, value)),
    removeItem: vi.fn((item: string) => values.delete(item)),
  };
};

const entry = (accountId: string, bestScore: number, achievedAt: string, bestStage: GameStage = 1): LeaderboardEntry => ({
  accountId,
  displayName: accountId,
  bestStage,
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

    const lower = saveBestScore({ accountId: "a", displayName: "A new name", bestStage: 1, bestScore: 8 }, fakeStorage);
    expect(lower.entries[0]).toMatchObject({ bestScore: 10, displayName: "a" });

    const higher = saveBestScore(
      { accountId: "a", displayName: "A", bestStage: 1, bestScore: 12 },
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
    fakeStorage.getItem = vi.fn((item: string) => item === key ? "{bad json" : null);
    fakeStorage.removeItem = vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }) as typeof fakeStorage.removeItem;

    expect(readLeaderboard(fakeStorage)).toEqual([]);
    expect(saveBestScore({ accountId: "a", displayName: "A", bestStage: 1, bestScore: 1 }, fakeStorage).saved).toBe(true);
    expect(fakeStorage.removeItem).toHaveBeenCalledWith(key);
  });

  it("reports storage read and write failures without throwing", () => {
    fakeStorage.getItem = vi.fn(() => { throw new DOMException("blocked", "SecurityError"); }) as typeof fakeStorage.getItem;
    expect(readLeaderboard(fakeStorage)).toEqual([]);
    expect(saveBestScore({ accountId: "a", displayName: "A", bestStage: 1, bestScore: 1 }, fakeStorage)).toMatchObject({ saved: false, error: "storage-unavailable" });

    fakeStorage.getItem = vi.fn(() => null) as typeof fakeStorage.getItem;
    fakeStorage.setItem = vi.fn(() => { throw new DOMException("full", "QuotaExceededError"); }) as typeof fakeStorage.setItem;
    expect(saveBestScore({ accountId: "a", displayName: "A", bestStage: 1, bestScore: 1 }, fakeStorage)).toMatchObject({ saved: false, error: "storage-unavailable" });
  });

  it("rejects invalid scores", () => {
    expect(() => saveBestScore({ accountId: "a", displayName: "A", bestStage: 1, bestScore: -1 }, fakeStorage)).toThrow(RangeError);
    expect(() => saveBestScore({ accountId: "a", displayName: "A", bestStage: 1, bestScore: Number.NaN }, fakeStorage)).toThrow(RangeError);
    expect(fakeStorage.getItem).not.toHaveBeenCalled();
  });

  it("compares stage before score without mutating the source array", () => {
    const scores = [
      entry("stage-one", 999, "2026-01-01"),
      entry("stage-two-late", 350, "2026-01-03", 2),
      entry("stage-two-early", 350, "2026-01-02", 2),
      entry("stage-two-best", 400, "2026-01-04", 2),
    ];
    const snapshot = structuredClone(scores);
    expect(getTopScores(scores).map((score) => score.accountId)).toEqual([
      "stage-two-best", "stage-two-early", "stage-two-late", "stage-one",
    ]);
    expect(getTopScores(scores, -1)).toEqual([]);
    expect(getTopScores(scores, 2.8)).toHaveLength(2);
    expect(scores).toEqual(snapshot);
  });

  it("replaces the whole personal record for a higher stage even with fewer points", () => {
    fakeStorage.setItem(key, JSON.stringify([entry("a", 999, "2026-01-01")]));
    const incoming = { accountId: "a", displayName: "New A", bestStage: 2 as const, bestScore: 350 };
    const result = saveBestScore(incoming, fakeStorage, new Date("2026-02-01"));
    expect(result).toEqual({
      saved: true, entries: [{ ...incoming, achievedAt: "2026-02-01T00:00:00.000Z" }],
    });
    expect(readLeaderboard(fakeStorage)).toEqual(result.entries);
  });

  it.each([
    [1, 999],
    [2, 349],
    [2, 350],
  ] as const)("preserves the entire best record and timestamp for stage %s / score %s", (bestStage, bestScore) => {
    const previous = entry("a", 350, "2026-01-01", 2);
    fakeStorage.setItem(key, JSON.stringify([previous]));
    fakeStorage.setItem.mockClear();
    const result = saveBestScore({ accountId: "a", displayName: "Changed", bestStage, bestScore }, fakeStorage);
    expect(result).toEqual({ saved: true, entries: [previous] });
    expect(fakeStorage.setItem).not.toHaveBeenCalled();
  });

  it("deletes only legacy scores and preserves unrelated storage and new records", () => {
    const records = [entry("new", 1_501, "2026-01-01", 5)];
    const serialized = JSON.stringify(records);
    fakeStorage.setItem(legacyKey, JSON.stringify([{ accountId: "old", bestScore: 9999 }]));
    fakeStorage.setItem(legacyKeys[1], JSON.stringify([entry("old-v2", 99_999, "2026-01-01", 2)]));
    fakeStorage.setItem(legacyKeys[2], JSON.stringify([entry("old-v3", 99_999, "2026-01-01", 5)]));
    fakeStorage.setItem(key, serialized);
    fakeStorage.setItem("stair-climb:audio:v1", "audio-sentinel");
    fakeStorage.setItem("msal.account.keys", "auth-sentinel");
    fakeStorage.setItem("unrelated", "other-sentinel");
    fakeStorage.setItem("stair-climb:stage-progress:v1", "progress-sentinel");
    fakeStorage.setItem.mockClear();
    expect(readLeaderboard(fakeStorage)).toEqual(records);
    expect(readLeaderboard(fakeStorage)).toEqual(records);
    expect(fakeStorage.removeItem.mock.calls).toEqual(legacyKeys.map((oldKey) => [oldKey]));
    expect(fakeStorage.getItem(legacyKey)).toBeNull();
    expect(fakeStorage.getItem(legacyKeys[1])).toBeNull();
    expect(fakeStorage.getItem(key)).toBe(serialized);
    expect(fakeStorage.getItem("stair-climb:audio:v1")).toBe("audio-sentinel");
    expect(fakeStorage.getItem("msal.account.keys")).toBe("auth-sentinel");
    expect(fakeStorage.getItem("unrelated")).toBe("other-sentinel");
    expect(fakeStorage.getItem("stair-climb:stage-progress:v1")).toBe("progress-sentinel");
    expect(fakeStorage.setItem).not.toHaveBeenCalled();
    expect(fakeStorage.clear).not.toHaveBeenCalled();
  });

  it.each(legacyKeys)("starts empty with only %s and keeps new records on subsequent reads", (oldKey) => {
    fakeStorage.setItem(oldKey, JSON.stringify([{ accountId: "old", bestScore: 9999 }]));
    fakeStorage.setItem.mockClear();
    expect(readLeaderboard(fakeStorage)).toEqual([]);
    expect(fakeStorage.getItem(oldKey)).toBeNull();
    expect(fakeStorage.setItem).not.toHaveBeenCalled();
    const result = saveBestScore({ accountId: "new", displayName: "New", bestStage: 1, bestScore: 20 }, fakeStorage);
    expect(result.saved).toBe(true);
    expect(readLeaderboard(fakeStorage)).toEqual(result.entries);
    expect(fakeStorage.removeItem).toHaveBeenCalledExactlyOnceWith(oldKey);
    expect(fakeStorage.setItem).toHaveBeenCalledOnce();
    expect(fakeStorage.setItem.mock.calls[0][0]).toBe(key);
  });

  it.each(legacyKeys)("cleans %s even when saving directly without an initial read", (oldKey) => {
    fakeStorage.setItem(oldKey, "old scores");
    fakeStorage.setItem.mockClear();
    expect(saveBestScore({ accountId: "a", displayName: "A", bestStage: 2, bestScore: 350 }, fakeStorage).saved).toBe(true);
    expect(fakeStorage.getItem(oldKey)).toBeNull();
    expect(fakeStorage.setItem).toHaveBeenCalledOnce();
    expect(readLeaderboard(fakeStorage)[0]).toMatchObject({ bestStage: 2, bestScore: 350 });
  });

  it.each(legacyKeys)("keeps valid new records usable if %s removal fails and retries after recovery", (oldKey) => {
    fakeStorage.setItem(oldKey, "old scores");
    const existing = [entry("existing", 1_000, "2026-01-01", 4)];
    fakeStorage.setItem(key, JSON.stringify(existing));
    const removeNormally = fakeStorage.removeItem.getMockImplementation()!;
    fakeStorage.removeItem.mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    fakeStorage.setItem.mockClear();
    expect(readLeaderboard(fakeStorage)).toEqual(existing);
    const incoming = { accountId: "a", displayName: "A", bestStage: 1 as const, bestScore: 1 };
    const saved = saveBestScore(incoming, fakeStorage);
    expect(saved.saved).toBe(true);
    expect(saved.entries).toContainEqual(existing[0]);
    expect(saved.entries).toContainEqual(expect.objectContaining(incoming));
    expect(fakeStorage.setItem).toHaveBeenCalledExactlyOnceWith(key, JSON.stringify(saved.entries));
    expect(fakeStorage.getItem(oldKey)).toBe("old scores");
    expect(fakeStorage.getItem(key)).toBe(JSON.stringify(saved.entries));
    fakeStorage.removeItem.mockImplementation(removeNormally);
    expect(saveBestScore(incoming, fakeStorage).saved).toBe(true);
    expect(fakeStorage.getItem(oldKey)).toBeNull();
    expect(readLeaderboard(fakeStorage)).toContainEqual(existing[0]);
  });

  it("reports v5 read failures separately from corrupt JSON", () => {
    fakeStorage.getItem.mockImplementation((item) => {
      if (item === key) throw new DOMException("blocked", "SecurityError");
      return null;
    });
    expect(readLeaderboard(fakeStorage)).toEqual([]);
    expect(saveBestScore({ accountId: "a", displayName: "A", bestStage: 1, bestScore: 1 }, fakeStorage).saved).toBe(false);
    expect(fakeStorage.removeItem).not.toHaveBeenCalled();
    expect(fakeStorage.setItem).not.toHaveBeenCalled();
  });

  it("returns the old records when writing a genuine improvement fails", () => {
    const previous = entry("a", 10, "2026-01-01");
    fakeStorage.setItem(key, JSON.stringify([previous]));
    fakeStorage.setItem.mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    expect(saveBestScore({ accountId: "a", displayName: "A", bestStage: 2, bestScore: 350 }, fakeStorage)).toEqual({
      entries: [previous], saved: false, error: "storage-unavailable",
    });
  });

  it.each([0, 6, 1.5, NaN, "2", undefined, null])("rejects an invalid saved stage without touching storage: %s", (bestStage) => {
    const invalid = { accountId: "a", displayName: "A", bestStage, bestScore: 10 } as unknown as Omit<LeaderboardEntry, "achievedAt">;
    expect(() => saveBestScore(invalid, fakeStorage)).toThrow(RangeError);
    expect(fakeStorage.getItem).not.toHaveBeenCalled();
  });

  it.each([0, 6, 1.5, "2", undefined])("clears v5 with invalid or missing stage without inferring from points: %s", (bestStage) => {
    fakeStorage.setItem(key, JSON.stringify([{ ...entry("a", 999, "2026-01-01"), bestStage }]));
    expect(readLeaderboard(fakeStorage)).toEqual([]);
    expect(fakeStorage.getItem(key)).toBeNull();
    expect(fakeStorage.removeItem).toHaveBeenCalledExactlyOnceWith(key);
  });

  it("preserves the existing last-entry-wins account deduplication", () => {
    const last = entry("a", 500, "2026-01-02", 2);
    fakeStorage.setItem(key, JSON.stringify([entry("a", 100, "2026-01-01"), last]));
    expect(readLeaderboard(fakeStorage)).toEqual([last]);
  });

  it.each([1, 2, 3, 4, 5] as const)("reads and saves stage %s without inferring from its score", (bestStage) => {
    const result = saveBestScore({ accountId: "a", displayName: "A", bestStage, bestScore: 10 }, fakeStorage, new Date("2026-01-01"));
    expect(result.saved).toBe(true);
    expect(readLeaderboard(fakeStorage)).toEqual(result.entries);
    expect(result.entries[0]).toMatchObject({ bestStage, bestScore: 10 });
  });

  it("prioritizes stage five and keeps stage/score/timestamp from a single run", () => {
    const scores = [
      entry("four", 99_999, "2026-01-01", 4),
      entry("five-late", 1_501, "2026-01-03", 5),
      entry("five-early", 1_501, "2026-01-02", 5),
      entry("five-best", 1_502, "2026-01-04", 5),
    ];
    expect(getTopScores(scores).map((item) => item.accountId)).toEqual(["five-best", "five-early", "five-late", "four"]);
    fakeStorage.setItem(key, JSON.stringify([scores[0]]));
    const incoming = { accountId: "four", displayName: "New", bestStage: 5 as const, bestScore: 1_500 };
    const improved = saveBestScore(incoming, fakeStorage, new Date("2026-02-01"));
    expect(improved.entries).toEqual([{ ...incoming, achievedAt: "2026-02-01T00:00:00.000Z" }]);
    for (const [stage, score] of [[4, 100_000], [5, 1_499], [5, 1_500]] as const) {
      const unchanged = saveBestScore({ accountId: "four", displayName: "Changed", bestStage: stage, bestScore: score }, fakeStorage, new Date("2026-03-01"));
      expect(unchanged.entries).toEqual(improved.entries);
    }
  });

  it("ranks actual attempted stages and preserves an existing stage-local best on ties or worse scores", () => {
    const previous = entry("player", 80, "2026-01-01", 2);
    const higher = entry("higher", 10, "2026-01-02", 3);
    expect(getTopScores([previous, higher])).toEqual([higher, previous]);
    fakeStorage.setItem(key, JSON.stringify([previous]));
    for (const bestScore of [0, 79, 80]) {
      expect(saveBestScore({ accountId: "player", displayName: "Changed", bestStage: 2, bestScore }, fakeStorage).entries).toEqual([previous]);
    }
    expect(saveBestScore({ accountId: "player", displayName: "Next", bestStage: 3, bestScore: 0 }, fakeStorage).entries[0]).toMatchObject({ bestStage: 3, bestScore: 0, displayName: "Next" });
  });

  it.each(["", null, 123])("rejects invalid account IDs before storage access: %s", (accountId) => {
    const invalid = { accountId, displayName: "A", bestStage: 1, bestScore: 10 } as unknown as Omit<LeaderboardEntry, "achievedAt">;
    expect(() => saveBestScore(invalid, fakeStorage)).toThrow(RangeError);
    expect(fakeStorage.getItem).not.toHaveBeenCalled();
  });

  it("preserves every valid v4 clear before removing it and never copies old points into v5", () => {
    const progressKey = "stair-climb:stage-progress:v1", oldKey = "stair-climb:leaderboard:v4";
    fakeStorage.setItem(progressKey, JSON.stringify([
      { accountId: "a", highestClearedStage: 2 }, { accountId: "progress-only", highestClearedStage: 4 },
    ]));
    fakeStorage.setItem(oldKey, JSON.stringify([
      entry("a", 9999, "2026-01-01", 3), entry("other", 100, "2026-01-02", 5),
      entry("a", 100, "2026-01-03", 1), null, { ...entry("invalid", 50, "2026-01-01", 5), displayName: null },
    ]));
    const records = [entry("new-record", 80, "2026-10-01", 2)];
    fakeStorage.setItem(key, JSON.stringify(records));
    fakeStorage.setItem.mockClear();
    expect(readLeaderboard(fakeStorage)).toEqual(records);
    const merged = [{ accountId: "a", highestClearedStage: 3 }, { accountId: "progress-only", highestClearedStage: 4 },
      { accountId: "other", highestClearedStage: 5 }];
    expect(fakeStorage.setItem.mock.calls).toEqual([[progressKey, JSON.stringify(merged)]]);
    expect(fakeStorage.setItem.mock.invocationCallOrder[0]).toBeLessThan(fakeStorage.removeItem.mock.invocationCallOrder[0]);
    expect(fakeStorage.getItem(oldKey)).toBeNull();
    expect(fakeStorage.getItem(key)).toBe(JSON.stringify(records));
    expect(readLeaderboard(fakeStorage)).toEqual(records);
    expect(fakeStorage.setItem).toHaveBeenCalledOnce();
  });

  it.each(["progress-read", "legacy-read", "progress-write"])("retains v4 on %s failure while v5 remains independent, then retries migration", (failure) => {
    const progressKey = "stair-climb:stage-progress:v1", oldKey = "stair-climb:leaderboard:v4";
    const oldRaw = JSON.stringify([entry("a", 800, "2026-01-01", 3), entry("other", 900, "2026-01-02", 4)]);
    const progressRaw = JSON.stringify([{ accountId: "progress-only", highestClearedStage: 5 }]);
    fakeStorage.setItem(progressKey, progressRaw); fakeStorage.setItem(oldKey, oldRaw);
    const get = fakeStorage.getItem.getMockImplementation()!, set = fakeStorage.setItem.getMockImplementation()!;
    fakeStorage.getItem.mockImplementation((name) => {
      if ((failure === "progress-read" && name === progressKey) || (failure === "legacy-read" && name === oldKey)) {
        throw new DOMException("blocked", "SecurityError");
      }
      return get(name);
    });
    fakeStorage.setItem.mockImplementation((name, value) => {
      if (failure === "progress-write" && name === progressKey) throw new DOMException("full", "QuotaExceededError");
      return set(name, value);
    });
    const result = saveBestScore({ accountId: "new", displayName: "New", bestStage: 2, bestScore: 80 }, fakeStorage);
    expect(result.saved).toBe(true);
    expect(result.entries[0]).toMatchObject({ bestStage: 2, bestScore: 80 });
    expect(fakeStorage.values.get(oldKey)).toBe(oldRaw);
    expect(fakeStorage.values.get(progressKey)).toBe(progressRaw);
    expect(fakeStorage.removeItem).not.toHaveBeenCalledWith(oldKey);
    fakeStorage.getItem.mockImplementation(get); fakeStorage.setItem.mockImplementation(set);
    expect(readLeaderboard(fakeStorage)).toEqual(result.entries);
    expect(fakeStorage.getItem(oldKey)).toBeNull();
    expect(JSON.parse(fakeStorage.getItem(progressKey)!)).toEqual([
      { accountId: "progress-only", highestClearedStage: 5 }, { accountId: "a", highestClearedStage: 3 },
      { accountId: "other", highestClearedStage: 4 },
    ]);
  });

  it("does not grant cleared progress from v5 and tolerates a v4 cleanup failure after durable migration", () => {
    const progressKey = "stair-climb:stage-progress:v1", oldKey = "stair-climb:leaderboard:v4";
    fakeStorage.setItem(key, JSON.stringify([entry("new-five", 10, "2026-10-01", 5)]));
    expect(readLeaderboard(fakeStorage)[0].bestStage).toBe(5);
    expect(fakeStorage.getItem(progressKey)).toBeNull();
    fakeStorage.setItem(oldKey, JSON.stringify([entry("old", 400, "2026-01-01", 1)]));
    const remove = fakeStorage.removeItem.getMockImplementation()!;
    fakeStorage.removeItem.mockImplementation((name) => {
      if (name === oldKey) throw new DOMException("blocked", "SecurityError");
      return remove(name);
    });
    expect(readLeaderboard(fakeStorage)[0].accountId).toBe("new-five");
    expect(JSON.parse(fakeStorage.getItem(progressKey)!)).toEqual([{ accountId: "old", highestClearedStage: 1 }]);
    expect(fakeStorage.getItem(oldKey)).not.toBeNull();
    expect(saveBestScore({ accountId: "new", displayName: "New", bestStage: 2, bestScore: 80 }, fakeStorage).saved).toBe(true);
    fakeStorage.removeItem.mockImplementation(remove);
    expect(readLeaderboard(fakeStorage)).toHaveLength(2);
    expect(fakeStorage.getItem(oldKey)).toBeNull();
  });
});
