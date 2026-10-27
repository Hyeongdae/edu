import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { migrateLegacyStageProgress, readStageProgress, saveStageProgress } from "./stageProgress";
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

const legacyKey = "stair-climb:leaderboard:v4";
function legacyEntry(accountId: string, bestStage: ClearedStage, overrides: Record<string, unknown> = {}) {
  return { accountId, displayName: accountId, bestStage, bestScore: 400,
    achievedAt: "2026-10-01T00:00:00.000Z", ...overrides };
}

describe("legacy cleared progress migration", () => {
  it("merges every account's maximum once, keeps zero rows and handles duplicate and special IDs", () => {
    localStorage.setItem(key, JSON.stringify([
      { accountId: "a", highestClearedStage: 2 }, { accountId: "b", highestClearedStage: 4 },
      { accountId: "zero", highestClearedStage: 0 }, { accountId: "a", highestClearedStage: 1 },
    ]));
    const rawLegacy = JSON.stringify([
      legacyEntry("a", 3), legacyEntry("a", 1), legacyEntry("b", 1), legacyEntry("c", 5),
      legacyEntry("__proto__", 2), legacyEntry("__proto__", 1), legacyEntry("legacy-zero", 0),
    ]);
    localStorage.setItem(legacyKey, rawLegacy);
    const write = vi.spyOn(Storage.prototype, "setItem");
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    const expected = [
      { accountId: "a", highestClearedStage: 3 }, { accountId: "b", highestClearedStage: 4 },
      { accountId: "zero", highestClearedStage: 0 }, { accountId: "c", highestClearedStage: 5 },
      { accountId: "__proto__", highestClearedStage: 2 },
    ];
    expect(readStageProgress("a")).toEqual({ highestClearedStage: 3, available: true });
    expect(write.mock.calls).toEqual([[key, JSON.stringify(expected)]]);
    expect(migrateLegacyStageProgress()).toEqual({ entries: expected, available: true });
    expect(readStageProgress("c")).toEqual({ highestClearedStage: 5, available: true });
    expect(saveStageProgress("a", 2)).toEqual({ highestClearedStage: 3, saved: true });
    expect(write).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    expect(localStorage.getItem(legacyKey)).toBe(rawLegacy);
  });

  it("migrates other accounts even when reading a fresh account and leaves all ranking/audio/auth values unchanged", () => {
    localStorage.setItem(legacyKey, JSON.stringify([legacyEntry("other", 4)]));
    const preservedKeys = [legacyKey, "stair-climb:leaderboard:v1", "stair-climb:leaderboard:v2",
      "stair-climb:leaderboard:v3", "stair-climb:leaderboard:v5", "stair-climb:audio:v1", "msal.account.keys", "other-key"];
    for (const name of preservedKeys.slice(1)) {
      localStorage.setItem(name, JSON.stringify([legacyEntry("fresh", 5)]));
    }
    const before = preservedKeys.map((name) => [name, localStorage.getItem(name)]);
    const remove = vi.spyOn(Storage.prototype, "removeItem");
    expect(readStageProgress("fresh")).toEqual({ highestClearedStage: 0, available: true });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([{ accountId: "other", highestClearedStage: 4 }]);
    expect(readStageProgress("other")).toEqual({ highestClearedStage: 4, available: true });
    expect(preservedKeys.map((name) => [name, localStorage.getItem(name)])).toEqual(before);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([
    ["account missing", { accountId: undefined }], ["empty account", { accountId: "" }],
    ["numeric account", { accountId: 2 }], ["missing name", { displayName: undefined }],
    ["numeric name", { displayName: 2 }], ["negative stage", { bestStage: -1 }],
    ["stage six", { bestStage: 6 }], ["fractional stage", { bestStage: 1.5 }],
    ["string stage", { bestStage: "3" }], ["null stage", { bestStage: null }],
    ["missing score", { bestScore: undefined }], ["negative score", { bestScore: -1 }],
    ["fractional score", { bestScore: 1.5 }], ["string score", { bestScore: "9999" }],
    ["nonfinite score", { bestScore: Infinity }], ["missing time", { achievedAt: undefined }],
    ["invalid time", { achievedAt: "not a date" }], ["numeric time", { achievedAt: 0 }],
  ])("does not infer a clear from a row with %s while retaining valid siblings", (_label, overrides) => {
    localStorage.setItem(legacyKey, JSON.stringify([
      null, 5, [], {}, legacyEntry("invalid", 5, overrides), legacyEntry("valid", 2),
    ]));
    expect(migrateLegacyStageProgress()).toEqual({
      entries: [{ accountId: "valid", highestClearedStage: 2 }], available: true,
    });
    expect(readStageProgress("invalid").highestClearedStage).toBe(0);
  });

  it.each(["broken", "null", "{}", "42", "[null]"])("treats malformed legacy %s as empty without rewriting progress", (raw) => {
    localStorage.setItem(key, JSON.stringify([{ accountId: "known", highestClearedStage: 3 }]));
    localStorage.setItem(legacyKey, raw);
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(readStageProgress("known")).toEqual({ highestClearedStage: 3, available: true });
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(legacyKey)).toBe(raw);
  });

  it.each(["broken", "null", "{}", "42"])("recovers valid legacy rows when progress is %s", (raw) => {
    localStorage.setItem(key, raw);
    localStorage.setItem(legacyKey, JSON.stringify([legacyEntry("a", 3), legacyEntry("b", 4)]));
    expect(readStageProgress("a")).toEqual({ highestClearedStage: 3, available: true });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([
      { accountId: "a", highestClearedStage: 3 }, { accountId: "b", highestClearedStage: 4 },
    ]);
  });

  it("does not turn a valid zero-stage high score into a cleared stage or an unnecessary progress write", () => {
    localStorage.setItem(legacyKey, JSON.stringify([legacyEntry("a", 0, { bestScore: 99999, displayName: "5단계" })]));
    const write = vi.spyOn(Storage.prototype, "setItem");
    expect(readStageProgress("a")).toEqual({ highestClearedStage: 0, available: true });
    expect(migrateLegacyStageProgress()).toEqual({ entries: [], available: true });
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it.each([key, legacyKey])("keeps partial known history and refuses writes when %s cannot be read, then retries", (blockedKey) => {
    const originalProgress = JSON.stringify([
      { accountId: "a", highestClearedStage: 4 }, { accountId: "progress-only", highestClearedStage: 5 },
    ]);
    const originalLegacy = JSON.stringify([legacyEntry("a", 2), legacyEntry("legacy-only", 3)]);
    localStorage.setItem(key, originalProgress);
    localStorage.setItem(legacyKey, originalLegacy);
    const get = Storage.prototype.getItem;
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, name) {
      if (name === blockedKey) throw new DOMException("blocked", "SecurityError");
      return get.call(this, name);
    });
    const write = vi.spyOn(Storage.prototype, "setItem"), remove = vi.spyOn(Storage.prototype, "removeItem");
    const expectedKnown = blockedKey === key ? 2 : 4;
    expect(readStageProgress("a")).toEqual({ highestClearedStage: expectedKnown, available: false });
    expect(read.mock.calls).toEqual([[key], [legacyKey]]);
    expect(saveStageProgress("a", 1)).toEqual({ highestClearedStage: expectedKnown, saved: false, error: "storage-unavailable" });
    expect(saveStageProgress("a", 5)).toEqual({ highestClearedStage: 5, saved: false, error: "storage-unavailable" });
    expect(saveStageProgress("new", 3)).toEqual({ highestClearedStage: 3, saved: false, error: "storage-unavailable" });
    expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
    read.mockRestore();
    expect(localStorage.getItem(key)).toBe(originalProgress);
    expect(localStorage.getItem(legacyKey)).toBe(originalLegacy);
    expect(migrateLegacyStageProgress()).toEqual({ entries: [
      { accountId: "a", highestClearedStage: 4 }, { accountId: "progress-only", highestClearedStage: 5 },
      { accountId: "legacy-only", highestClearedStage: 3 },
    ], available: true });
    expect(write).toHaveBeenCalledOnce();
    expect(readStageProgress("progress-only").highestClearedStage).toBe(5);
    expect(readStageProgress("legacy-only").highestClearedStage).toBe(3);
  });

  it("returns known merged clears on a migration write failure without attempting a candidate overwrite", () => {
    const originalProgress = JSON.stringify([
      { accountId: "a", highestClearedStage: 2 }, { accountId: "progress-only", highestClearedStage: 4 },
    ]);
    const originalLegacy = JSON.stringify([legacyEntry("a", 5), legacyEntry("legacy-only", 3)]);
    localStorage.setItem(key, originalProgress); localStorage.setItem(legacyKey, originalLegacy);
    const set = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, name, value) {
      if (name === key) throw new DOMException("full", "QuotaExceededError");
      set.call(this, name, value);
    });
    const expected = [
      { accountId: "a", highestClearedStage: 5 }, { accountId: "progress-only", highestClearedStage: 4 },
      { accountId: "legacy-only", highestClearedStage: 3 },
    ];
    expect(migrateLegacyStageProgress()).toEqual({ entries: expected, available: false });
    expect(readStageProgress("a")).toEqual({ highestClearedStage: 5, available: false });
    expect(saveStageProgress("new", 4)).toEqual({ highestClearedStage: 4, saved: false, error: "storage-unavailable" });
    expect(write.mock.calls).toEqual(Array.from({ length: 3 }, () => [key, JSON.stringify(expected)]));
    expect(localStorage.getItem(key)).toBe(originalProgress); expect(localStorage.getItem(legacyKey)).toBe(originalLegacy);
    write.mockRestore();
    expect(saveStageProgress("new", 4)).toEqual({ highestClearedStage: 4, saved: true });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([...expected, { accountId: "new", highestClearedStage: 4 }]);
    expect(localStorage.getItem(legacyKey)).toBe(originalLegacy);
  });

  it("keeps a successful migration even if the following new clear cannot be saved", () => {
    localStorage.setItem(legacyKey, JSON.stringify([legacyEntry("a", 3), legacyEntry("other", 5)]));
    const set = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(function (this: Storage, name, value) {
      set.call(this, name, value);
    }).mockImplementationOnce(() => { throw new DOMException("full", "QuotaExceededError"); });
    expect(saveStageProgress("a", 4)).toEqual({ highestClearedStage: 4, saved: false, error: "storage-unavailable" });
    expect(readStageProgress("a")).toEqual({ highestClearedStage: 3, available: true });
    expect(readStageProgress("other").highestClearedStage).toBe(5);
    expect(saveStageProgress("a", 4)).toEqual({ highestClearedStage: 4, saved: true });
  });

  it("reports a blocked storage getter while accepting an explicit storage without touching that getter", () => {
    const supplied = window.localStorage;
    supplied.setItem(legacyKey, JSON.stringify([legacyEntry("a", 3)]));
    const getter = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    expect(migrateLegacyStageProgress()).toEqual({ entries: [], available: false });
    expect(readStageProgress("a")).toEqual({ highestClearedStage: 0, available: false });
    expect(saveStageProgress("a", 4)).toEqual({ highestClearedStage: 4, saved: false, error: "storage-unavailable" });
    getter.mockClear();
    expect(migrateLegacyStageProgress(supplied)).toEqual({ entries: [{ accountId: "a", highestClearedStage: 3 }], available: true });
    expect(readStageProgress("a", supplied)).toEqual({ highestClearedStage: 3, available: true });
    expect(saveStageProgress("a", 4, supplied)).toEqual({ highestClearedStage: 4, saved: true });
    expect(getter).not.toHaveBeenCalled();
  });

  it("validates public arguments before a storage getter or migration can run", () => {
    const getter = vi.spyOn(window, "localStorage", "get");
    expect(() => readStageProgress("")).toThrow(RangeError);
    expect(() => saveStageProgress("", 1)).toThrow(RangeError);
    expect(() => saveStageProgress("a", 6 as ClearedStage)).toThrow(RangeError);
    expect(getter).not.toHaveBeenCalled();
  });
});
