import { describe, expect, it, vi } from "vitest";
import {
  DESCENT_LEADERBOARD_KEY, DESCENT_PROGRESS_KEY, DESCENT_RESET_KEY, prepareDescentRecords,
} from "./recordStorage";
import { readStageProgress, saveStageProgress } from "./stageProgress";
import { readLeaderboard, saveBestScore } from "../leaderboard/leaderboard";

const legacyKeys = [
  ...[1, 2, 3, 4, 5].map((version) => `stair-climb:leaderboard:v${version}`),
  "stair-climb:stage-progress:v1",
];
const newRank = { accountId: "a", displayName: "A", bestStage: 2 as const, bestScore: 80,
  achievedAt: "2026-10-28T00:00:00.000Z" };
const newProgress = [{ accountId: "a", highestClearedStage: 1 }];

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    get length(): number { throw new Error("Must not enumerate storage"); },
    key: vi.fn((): string | null => { throw new Error("Must not enumerate storage"); }),
    clear: vi.fn(() => { throw new Error("Must not clear storage"); }),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
}

function seedNewRecords(target: ReturnType<typeof storage>) {
  target.values.set(DESCENT_LEADERBOARD_KEY, JSON.stringify([newRank]));
  target.values.set(DESCENT_PROGRESS_KEY, JSON.stringify(newProgress));
}

function verifyNewRecordsUsable(target: ReturnType<typeof storage>) {
  expect(readLeaderboard(target, "descent")).toEqual([newRank]);
  expect(readStageProgress("a", target, "descent")).toEqual({ highestClearedStage: 1, available: true });
  expect(saveStageProgress("b", 3, target, "descent")).toEqual({ highestClearedStage: 3, saved: true });
  expect(saveBestScore({ ...newRank, accountId: "b", bestStage: 3, bestScore: 150 }, target,
    new Date(newRank.achievedAt), "descent").saved).toBe(true);
  expect(readLeaderboard(target, "descent")).toHaveLength(2);
  expect(readStageProgress("a", target, "descent").highestClearedStage).toBe(1);
  expect(target.removeItem.mock.calls.every(([key]) => legacyKeys.includes(key))).toBe(true);
  expect(target.clear).not.toHaveBeenCalled();
  expect(target.key).not.toHaveBeenCalled();
}

describe("bounded descent record preparation", () => {
  it("removes exactly six legacy keys for all accounts without migrating clears or touching sentinels", () => {
    const target = storage();
    const oldRows = JSON.stringify([{ ...newRank, bestStage: 5 }, { ...newRank, accountId: "b", bestStage: 5 }]);
    for (const key of legacyKeys) target.values.set(key, oldRows);
    const preserved = new Map([
      ["stair-climb:audio:v1", '{"musicVolume":0.3}'], ["msal.account.keys", "auth bytes"],
      ["session.token", "session bytes"], ["unrelated", "keep\nexact bytes"],
      ["stair-climb:leaderboard:v6", "future"], ["stair-descent:records-reset:v2", "future marker"],
    ]);
    for (const [key, value] of preserved) target.values.set(key, value);
    expect(readLeaderboard(target, "descent")).toEqual([]);
    expect(readStageProgress("a", target, "descent")).toEqual({ highestClearedStage: 0, available: true });
    expect(readStageProgress("b", target, "descent").highestClearedStage).toBe(0);
    expect(target.removeItem.mock.calls).toEqual(legacyKeys.map((key) => [key]));
    expect(target.setItem.mock.calls).toEqual([[DESCENT_RESET_KEY, "1"]]);
    expect(target.values).toEqual(new Map([...preserved, [DESCENT_RESET_KEY, "1"]]));
    expect(target.key).not.toHaveBeenCalled();
    expect(target.clear).not.toHaveBeenCalled();
  });

  it.each([null, "", "0", "true", '"1"'])("prepares marker %s without resetting existing descent rows", (marker) => {
    const target = storage();
    seedNewRecords(target);
    if (marker !== null) target.values.set(DESCENT_RESET_KEY, marker);
    target.values.set(legacyKeys[0], "");
    expect(prepareDescentRecords(target)).toEqual({ complete: true });
    expect(target.removeItem.mock.calls).toEqual([[legacyKeys[0]]]);
    expect(target.values.get(DESCENT_LEADERBOARD_KEY)).toBe(JSON.stringify([newRank]));
    expect(target.values.get(DESCENT_PROGRESS_KEY)).toBe(JSON.stringify(newProgress));
    expect(target.setItem.mock.calls).toEqual([[DESCENT_RESET_KEY, "1"]]);
  });

  it("short circuits exact marker 1 and repeated API calls, including reintroduced old records", () => {
    const target = storage();
    expect(prepareDescentRecords(target).complete).toBe(true);
    seedNewRecords(target);
    for (const key of legacyKeys) target.values.set(key, "reintroduced old records");
    target.getItem.mockClear();
    expect(prepareDescentRecords(target)).toEqual({ complete: true });
    expect(target.getItem.mock.calls).toEqual([[DESCENT_RESET_KEY]]);
    for (let index = 0; index < 2; index++) {
      expect(readLeaderboard(target, "descent")).toEqual([newRank]);
      expect(saveStageProgress("a", 0, target, "descent").highestClearedStage).toBe(1);
      expect(saveBestScore(newRank, target, undefined, "descent").saved).toBe(true);
    }
    expect(target.setItem.mock.calls).toEqual([[DESCENT_RESET_KEY, "1"]]);
    expect(target.removeItem).not.toHaveBeenCalled();
    for (const key of legacyKeys) expect(target.values.get(key)).toBe("reintroduced old records");
  });

  it("returns incomplete immediately on marker read failure but APIs can use and save new records", () => {
    const target = storage();
    seedNewRecords(target);
    target.values.set(legacyKeys[0], "keep until readable");
    target.getItem.mockImplementation((key) => {
      if (key === DESCENT_RESET_KEY) throw new Error("marker blocked");
      return target.values.get(key) ?? null;
    });
    expect(prepareDescentRecords(target)).toEqual({ complete: false });
    expect(target.getItem.mock.calls).toEqual([[DESCENT_RESET_KEY]]);
    expect(target.setItem).not.toHaveBeenCalled();
    expect(target.removeItem).not.toHaveBeenCalled();
    verifyNewRecordsUsable(target);
    expect(target.values.has(DESCENT_RESET_KEY)).toBe(false);
    expect(target.values.get(legacyKeys[0])).toBe("keep until readable");
    target.getItem.mockImplementation((key) => target.values.get(key) ?? null);
    expect(prepareDescentRecords(target).complete).toBe(true);
    expect(readLeaderboard(target, "descent")).toHaveLength(2);
    expect(readStageProgress("b", target, "descent").highestClearedStage).toBe(3);
  });

  it.each(legacyKeys.flatMap((key) => ["get", "remove"].map((operation) => ({ key, operation }))))(
    "continues after $operation failure at $key and retries only old records", ({ key: blockedKey, operation }) => {
      const target = storage();
      seedNewRecords(target);
      target.values.set(DESCENT_RESET_KEY, "0");
      for (const key of legacyKeys) target.values.set(key, "old");
      let blocked = true;
      target.getItem.mockImplementation((key) => {
        if (blocked && operation === "get" && key === blockedKey) throw new Error("read blocked");
        return target.values.get(key) ?? null;
      });
      target.removeItem.mockImplementation((key) => {
        if (blocked && operation === "remove" && key === blockedKey) throw new Error("remove blocked");
        target.values.delete(key);
      });
      expect(prepareDescentRecords(target)).toEqual({ complete: false });
      expect(target.getItem.mock.calls).toEqual([[DESCENT_RESET_KEY], ...legacyKeys.map((key) => [key])]);
      for (const key of legacyKeys) expect(target.values.has(key)).toBe(key === blockedKey);
      expect(target.values.get(DESCENT_RESET_KEY)).toBe("0");
      verifyNewRecordsUsable(target);
      expect(target.setItem.mock.calls.some(([key]) => key === DESCENT_RESET_KEY)).toBe(false);
      blocked = false;
      expect(prepareDescentRecords(target)).toEqual({ complete: true });
      expect(target.values.get(DESCENT_RESET_KEY)).toBe("1");
      expect(target.setItem.mock.calls.filter(([key]) => key === DESCENT_RESET_KEY)).toHaveLength(1);
      expect(readLeaderboard(target, "descent")).toHaveLength(2);
      expect(readStageProgress("b", target, "descent").highestClearedStage).toBe(3);
    },
  );

  it("retries a failed marker write while preserving all newly saved records", () => {
    const target = storage();
    seedNewRecords(target);
    for (const key of legacyKeys) target.values.set(key, "old");
    target.setItem.mockImplementation((key, value) => {
      if (key === DESCENT_RESET_KEY) throw new Error("marker full");
      target.values.set(key, value);
    });
    expect(prepareDescentRecords(target)).toEqual({ complete: false });
    expect(target.values.has(DESCENT_RESET_KEY)).toBe(false);
    verifyNewRecordsUsable(target);
    expect(target.removeItem.mock.calls).toEqual(legacyKeys.map((key) => [key]));
    target.setItem.mockImplementation((key, value) => { target.values.set(key, value); });
    expect(prepareDescentRecords(target).complete).toBe(true);
    expect(readLeaderboard(target, "descent")).toHaveLength(2);
    expect(readStageProgress("b", target, "descent").highestClearedStage).toBe(3);
  });
});
