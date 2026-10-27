import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readStageProgress, saveStageProgress } from "./stageProgress";
import type { ClearedStage } from "./types";

const key = "stair-climb:stage-progress:v1";
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("account stage progress", () => {
  it("defaults to zero and saves monotonic progress separately for each account", () => {
    expect(readStageProgress("a")).toEqual({ highestClearedStage: 0, available: true });
    expect(saveStageProgress("a", 3)).toEqual({ highestClearedStage: 3, saved: true });
    saveStageProgress("b", 1);
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(saveStageProgress("a", 2)).toEqual({ highestClearedStage: 3, saved: true });
    expect(write).not.toHaveBeenCalled();
    expect(readStageProgress("b").highestClearedStage).toBe(1);
    saveStageProgress("a", 5);
    expect(readStageProgress("a").highestClearedStage).toBe(5);
    expect(readStageProgress("b").highestClearedStage).toBe(1);
  });

  it.each(["broken", "null", "{}", "42"])("treats corrupt %s as empty without clearing unrelated keys", (serialized) => {
    localStorage.setItem(key, serialized);
    localStorage.setItem("sentinel", "keep");
    expect(readStageProgress("a")).toEqual({ highestClearedStage: 0, available: true });
    saveStageProgress("a", 1);
    expect(readStageProgress("a").highestClearedStage).toBe(1);
    expect(localStorage.getItem("sentinel")).toBe("keep");
  });

  it("retains valid rows, merges duplicates by maximum and safely handles special account names", () => {
    localStorage.setItem(key, JSON.stringify([
      { accountId: "a", highestClearedStage: 4 }, { accountId: "a", highestClearedStage: 2 },
      null, { accountId: "", highestClearedStage: 3 }, { accountId: "bad", highestClearedStage: 6 },
      { accountId: "__proto__", highestClearedStage: 2 }, { accountId: "b", highestClearedStage: 0 },
    ]));
    expect(readStageProgress("a").highestClearedStage).toBe(4);
    expect(readStageProgress("__proto__").highestClearedStage).toBe(2);
    saveStageProgress("c", 1);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([
      { accountId: "a", highestClearedStage: 4 }, { accountId: "__proto__", highestClearedStage: 2 },
      { accountId: "b", highestClearedStage: 0 }, { accountId: "c", highestClearedStage: 1 },
    ]);
  });

  it.each(["", null, 1])("rejects invalid account %s before storage access", (id) => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    expect(() => readStageProgress(id as string)).toThrow(RangeError);
    expect(() => saveStageProgress(id as string, 1)).toThrow(RangeError);
    expect(read).not.toHaveBeenCalled();
  });

  it.each([-1, 6, 1.5, NaN, "1", null])("rejects invalid cleared stage %s before storage", (stage) => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    expect(() => saveStageProgress("a", stage as ClearedStage)).toThrow(RangeError);
    expect(read).not.toHaveBeenCalled();
  });

  it("reports getter/read failures and preserves candidate progress when a write fails", () => {
    const getter = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    expect(readStageProgress("a")).toEqual({ highestClearedStage: 0, available: false });
    expect(saveStageProgress("a", 3)).toEqual({ highestClearedStage: 3, saved: false, error: "storage-unavailable" });
    getter.mockRestore();
    saveStageProgress("a", 4);
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    expect(saveStageProgress("a", 5)).toEqual({ highestClearedStage: 5, saved: false, error: "storage-unavailable" });
    expect(readStageProgress("a").highestClearedStage).toBe(4);
    write.mockRestore();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readStageProgress("a").available).toBe(false);
  });

  it("does not infer progress from old rankings or alter audio/auth/other accounts", () => {
    for (const name of ["stair-climb:leaderboard:v3", "stair-climb:audio:v1", "msal.account.keys"]) localStorage.setItem(name, "sentinel");
    saveStageProgress("other", 5);
    expect(readStageProgress("fresh").highestClearedStage).toBe(0);
    saveStageProgress("fresh", 1);
    for (const name of ["stair-climb:leaderboard:v3", "stair-climb:audio:v1", "msal.account.keys"]) expect(localStorage.getItem(name)).toBe("sentinel");
    expect(readStageProgress("other").highestClearedStage).toBe(5);
  });
});
