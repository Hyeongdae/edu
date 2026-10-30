import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeSharedResult } from "../../shared/companyRecords";
import type { SharedProfile } from "../../shared/companyRecords";
import { companyAck, companyProfile, companyResult, companySubmission, deferred } from "../test/companyFixtures";
import { CompanyRecordStore, companyPendingKey } from "./CompanyRecordStore";
import { RecordApiError, type CompanyRecordApi } from "./recordApi";

const stores: CompanyRecordStore[] = [];
const now = "2026-10-30T07:00:00.000Z";
async function settle() { for (let step = 0; step < 12; step++) await Promise.resolve(); }
function memory() {
  const data = new Map<string, string>();
  return { data, getItem: vi.fn((key: string) => data.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { data.set(key, value); }) };
}
function setup(initial = companyProfile(), storage = memory()) {
  let server = initial;
  let sequence = 0;
  const api = {
    fetchProfile: vi.fn<CompanyRecordApi["fetchProfile"]>().mockImplementation(async () => server),
    fetchLeaderboard: vi.fn<CompanyRecordApi["fetchLeaderboard"]>().mockResolvedValue([]),
    postResult: vi.fn<CompanyRecordApi["postResult"]>().mockImplementation(async (accountId, input) => {
      server = mergeSharedResult(server, { accountId, displayName: server.displayName }, input.result, now).profile;
      return companyAck(input, server);
    }),
  };
  const store = new CompanyRecordStore(initial.accountId, { api, storage: () => storage,
    now: () => new Date(now), uuid: () => `00000000-0000-4000-8000-${(++sequence).toString(16).padStart(12, "0")}` });
  stores.push(store);
  return { store, api, storage };
}
function binding(store: CompanyRecordStore) {
  const snapshot = store.getSnapshot();
  if (snapshot.status !== "ready") throw new Error("Expected confirmed profile.");
  return snapshot.binding;
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { stores.splice(0).forEach((store) => store.stop()); vi.useRealTimers(); });

describe("account-bound company record store", () => {
  it("constructs without storage/network effects and caches snapshots until a real update", async () => {
    const { store, api, storage } = setup();
    expect(api.fetchProfile).not.toHaveBeenCalled(); expect(storage.getItem).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    store.start(); await settle();
    expect(binding(store).profile).toEqual(companyProfile());
    expect(binding(store).pendingCount).toBe(0);
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("keeps a failed bootstrap outside the game and permits an explicit successful retry", async () => {
    const { store, api } = setup();
    api.fetchProfile.mockRejectedValueOnce(new RecordApiError("network"));
    store.start(); await settle();
    expect(store.getSnapshot()).toMatchObject({ status: "error", authRequired: false });
    store.retry(); await settle();
    expect(binding(store).profile.highestClearedStage).toBe(0);
  });

  it("persists a frozen payload before upload and deduplicates the same StageResult reference", async () => {
    const { store, api, storage } = setup();
    store.start(); await settle();
    const save = api.postResult.getMockImplementation()!;
    api.postResult.mockImplementationOnce(async (...args) => {
      expect(JSON.parse(storage.data.get(companyPendingKey("employee-a"))!).pending).toHaveLength(1);
      expect(args[1].result).not.toHaveProperty("endedAtMs");
      return save(...args);
    });
    const result = companyResult();
    store.submitResult(result); store.submitResult(result); await settle(); store.submitResult(result);
    expect(api.postResult).toHaveBeenCalledTimes(1);
    expect(binding(store).pendingCount).toBe(0);
    expect(binding(store).profile.best?.bestScore).toBe(100);
  });

  it("serializes a clear before the following unlocked stage despite immediate continued play", async () => {
    const { store, api } = setup();
    store.start(); await settle();
    const gate = deferred<void>();
    const save = api.postResult.getMockImplementation()!;
    api.postResult.mockImplementationOnce(async (...args) => { const response = await save(...args); await gate.promise; return response; });
    store.submitResult(companyResult({ score: 150, outcome: "cleared" }));
    store.submitResult(companyResult({ stage: 2, score: 80 })); await settle();
    expect(api.postResult).toHaveBeenCalledTimes(1);
    expect(binding(store).pendingCount).toBe(2);
    gate.resolve(); await settle();
    expect(api.postResult.mock.calls.map((call) => call[1].result.stage)).toEqual([1, 2]);
    expect(binding(store).profile).toMatchObject({ highestClearedStage: 1, best: { bestStage: 2, bestScore: 80 } });
  });

  it("retries the identical ID after a remotely committed result loses its acknowledgement", async () => {
    const { store, api } = setup(); store.start(); await settle();
    const save = api.postResult.getMockImplementation()!;
    api.postResult.mockImplementationOnce(async (...args) => { await save(...args); throw new RecordApiError("network"); });
    store.submitResult(companyResult()); await settle();
    const first = api.postResult.mock.calls[0][1];
    expect(binding(store).pendingCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1000); await settle();
    expect(api.postResult.mock.calls[1][1]).toEqual(first);
    expect(binding(store).profile.best?.achievedAt).toBe(now);
    expect(binding(store).pendingCount).toBe(0);
  });

  it("reloads only this account's pending namespace without importing or clearing legacy records", async () => {
    const storage = memory();
    const pending = { ...companySubmission(), createdAt: now };
    storage.data.set(companyPendingKey("employee-a"), JSON.stringify({ version: 1, accountId: "employee-a", pending: [pending] }));
    storage.data.set(companyPendingKey("other"), "other account bytes");
    storage.data.set("stair-descent:leaderboard:v2", "old demo scores");
    const { store, api } = setup(companyProfile(), storage); store.start(); await settle();
    expect(api.postResult.mock.calls[0][1]).toEqual(companySubmission());
    expect(storage.getItem.mock.calls).toEqual([[companyPendingKey("employee-a")]]);
    expect(storage.data.get(companyPendingKey("other"))).toBe("other account bytes");
    expect(storage.data.get("stair-descent:leaderboard:v2")).toBe("old demo scores");
  });

  it("ignores a corrupt or mismatched queue instead of uploading another account", async () => {
    const storage = memory();
    storage.data.set(companyPendingKey("employee-a"), JSON.stringify({ version: 1, accountId: "other", pending: [companySubmission()] }));
    const { store, api } = setup(companyProfile(), storage); store.start(); await settle();
    expect(api.postResult).not.toHaveBeenCalled();
    expect(binding(store).errorMessage).toContain("대기 기록을 읽지 못했습니다");
  });

  it("retains in-memory pending results and warns when browser persistence is denied", async () => {
    const { store, api, storage } = setup(); store.start(); await settle();
    storage.setItem.mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    const ack = deferred<ReturnType<typeof companyAck>>();
    api.postResult.mockReturnValueOnce(ack.promise);
    store.submitResult(companyResult()); await settle();
    expect(binding(store).pendingCount).toBe(1);
    expect(binding(store).errorMessage).toContain("새로고침");
    expect(api.postResult).toHaveBeenCalledTimes(1);
  });

  it("applies bounded 1/2/5/10/30-second retry delays and cancels them on stop", async () => {
    const { store, api } = setup(); store.start(); await settle();
    api.postResult.mockRejectedValue(new RecordApiError("storage-unavailable"));
    store.submitResult(companyResult()); await settle();
    expect(api.postResult).toHaveBeenCalledTimes(1);
    for (const [index, delay] of [1000, 2000, 5000, 10000, 30000, 30000].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1); expect(api.postResult).toHaveBeenCalledTimes(index + 1);
      await vi.advanceTimersByTimeAsync(1); expect(api.postResult).toHaveBeenCalledTimes(index + 2);
    }
    store.stop(); expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["unauthenticated", "invalid-request", "stage-locked", "invalid-response"] as const)("pauses %s failures without online/autoretry loops", async (code) => {
    const { store, api } = setup(); store.start(); await settle();
    api.postResult.mockRejectedValue(new RecordApiError(code));
    store.submitResult(companyResult()); await settle();
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.postResult).toHaveBeenCalledTimes(1);
    expect(binding(store).syncStatus).toBe(code === "unauthenticated" ? "auth-required" : "error");
    expect(binding(store).pendingCount).toBe(1);
  });

  it("retains pending data after a wrong-account or wrong-ID acknowledgement", async () => {
    const { store, api } = setup(); store.start(); await settle();
    api.postResult.mockImplementationOnce(async (_id, input) => companyAck(input, companyProfile({ accountId: "other" })));
    store.submitResult(companyResult()); await settle();
    expect(binding(store).pendingCount).toBe(1);
    expect(binding(store).profile.accountId).toBe("employee-a");
    expect(binding(store).syncStatus).toBe("error");
  });

  it("ignores stopped-generation reads during StrictMode start/stop/start", async () => {
    const { store, api } = setup();
    const first = deferred<SharedProfile>();
    api.fetchProfile.mockReturnValueOnce(first.promise).mockResolvedValueOnce(companyProfile({ highestClearedStage: 2 }));
    store.start(); const signal = api.fetchProfile.mock.calls[0][1]; store.stop(); store.start(); await settle();
    expect(signal.aborted).toBe(true);
    expect(binding(store).profile.highestClearedStage).toBe(2);
    first.resolve(companyProfile()); await settle();
    expect(binding(store).profile.highestClearedStage).toBe(2);
  });

  it("does not acknowledge an old account's late write or transfer its pending queue to a new account", async () => {
    const storage = memory(); const a = setup(companyProfile(), storage); a.store.start(); await settle();
    const late = deferred<ReturnType<typeof companyAck>>(); a.api.postResult.mockReturnValueOnce(late.promise);
    a.store.submitResult(companyResult()); await settle(); const sent = a.api.postResult.mock.calls[0][1];
    a.store.stop();
    const b = setup(companyProfile({ accountId: "employee-b" }), storage); b.store.start(); await settle();
    late.resolve(companyAck(sent)); await settle();
    expect(b.api.postResult).not.toHaveBeenCalled();
    expect(binding(b.store).profile.accountId).toBe("employee-b");
    expect(JSON.parse(storage.data.get(companyPendingKey("employee-a"))!).pending).toHaveLength(1);
  });

  it("keeps server-confirmed progress and stable callbacks when a later refresh returns older data", async () => {
    const best = { accountId: "employee-a", displayName: "회사원 A", bestStage: 2 as const,
      bestScore: 100, remainingTimeCs: 1000, achievedAt: now };
    const { store, api } = setup(companyProfile({ highestClearedStage: 2, best })); store.start(); await settle();
    const callbacks = binding(store);
    api.fetchProfile.mockResolvedValueOnce(companyProfile());
    store.refresh(); await settle();
    expect(binding(store).profile.highestClearedStage).toBe(2);
    expect(binding(store).profile.best).toEqual(best);
    expect(binding(store).submitResult).toBe(callbacks.submitResult);
    expect(binding(store).retry).toBe(callbacks.retry);
    expect(binding(store).refresh).toBe(callbacks.refresh);
  });

  it("serializes a refresh behind an in-flight acknowledgement and never lowers the confirmed clear", async () => {
    const { store, api } = setup(); store.start(); await settle();
    const gate = deferred<void>();
    const save = api.postResult.getMockImplementation()!;
    api.postResult.mockImplementationOnce(async (...args) => { const result = await save(...args); await gate.promise; return result; });
    store.submitResult(companyResult({ score: 150, outcome: "cleared" })); await settle();
    api.fetchProfile.mockResolvedValueOnce(companyProfile());
    store.refresh(); await settle();
    expect(api.fetchProfile).toHaveBeenCalledTimes(1);
    gate.resolve(); await settle();
    expect(api.fetchProfile).toHaveBeenCalledTimes(2);
    expect(binding(store).profile.highestClearedStage).toBe(1);
    expect(binding(store).profile.best?.bestScore).toBe(150);
  });
});
