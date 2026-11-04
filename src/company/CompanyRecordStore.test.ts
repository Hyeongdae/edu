import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeSharedInfiniteScore, mergeSharedResult } from "../../shared/companyRecords";
import type { SaveAppearanceResponse, SharedProfile } from "../../shared/companyRecords";
import { companyAck, companyProfile, companyResult, companySubmission, deferred } from "../test/companyFixtures";
import { CompanyRecordStore, companyPendingKey } from "./CompanyRecordStore";
import { fetchProfile, normalizeSharedProfile, RecordApiError, type CompanyRecordApi } from "./recordApi";
import { cloneCharacterAppearance, getDefaultCharacterAppearance } from "../../shared/characterAppearance";
import type { CharacterAppearance, CharacterLook } from "../../shared/characterAppearance";
import { getDefaultCharacterAppearance as getLegacyAppearance } from "../../shared/legacyCharacterAppearance";

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
    fetchInfiniteLeaderboard: vi.fn<CompanyRecordApi["fetchInfiniteLeaderboard"]>().mockResolvedValue([]),
    postResult: vi.fn<CompanyRecordApi["postResult"]>().mockImplementation(async (accountId, input) => {
      server = mergeSharedResult(server, { accountId, displayName: server.displayName }, input.result, now).profile;
      return companyAck(input, server);
    }),
    postInfiniteResult: vi.fn<CompanyRecordApi["postInfiniteResult"]>().mockImplementation(async (accountId, input) => {
      server = mergeSharedInfiniteScore(server, { accountId, displayName: server.displayName }, input.result, now).profile;
      return { submissionId: input.submissionId, profile: server, entries: server.infiniteBest ? [server.infiniteBest] : [] };
    }),
    postAppearance: vi.fn<NonNullable<CompanyRecordApi["postAppearance"]>>().mockImplementation(async (accountId, input) => {
      if (accountId !== server.accountId) throw new RecordApiError("unauthenticated");
      server = { ...server, appearance: cloneCharacterAppearance(input.appearance) };
      return { profile: server };
    }),
  };
  const store = new CompanyRecordStore(initial.accountId, { api, storage: () => storage,
    now: () => new Date(now), uuid: () => `00000000-0000-4000-8000-${(++sequence).toString(16).padStart(12, "0")}` });
  stores.push(store);
  return { store, api, storage, readServer: () => structuredClone(server) };
}
function binding(store: CompanyRecordStore) {
  const snapshot = store.getSnapshot();
  if (snapshot.status !== "ready") throw new Error("Expected confirmed profile.");
  return snapshot.binding;
}

function appearanceBinding(store: CompanyRecordStore) {
  const appearance = binding(store).appearance;
  if (!appearance) throw new Error("Expected account appearance binding.");
  return appearance;
}

function withRunner(overrides: Partial<CharacterLook>): CharacterAppearance {
  const appearance = getDefaultCharacterAppearance();
  return { ...appearance, runner: { ...appearance.runner, ...overrides } };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { stores.splice(0).forEach((store) => store.stop()); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("account appearance autosave", () => {
  it("bootstraps a real legacy HTTP profile into the store without an automatic migration write", async () => {
    const appearance = getLegacyAppearance(); appearance.runner.hairStyle = "ponytail";
    const wire = { ...companyProfile(), appearance };
    const fetcher = vi.fn().mockResolvedValue(Response.json(wire)); vi.stubGlobal("fetch", fetcher);
    const { store, api, storage } = setup();
    api.fetchProfile.mockImplementationOnce(fetchProfile);
    store.start(); await vi.advanceTimersByTimeAsync(0);
    expect(appearanceBinding(store)).toMatchObject({ status: "idle", value: {
      version: 2, runner: { hairStyle: "ponytail", eyeStyle: "default", bag: "none", bagColor: "black" } } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.postAppearance).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(storage.setItem).not.toHaveBeenCalled(); expect(wire.appearance.version).toBe(1);
  });

  it("retains new bag and eye choices when a legacy score or refresh response is normalized", async () => {
    const { store, api } = setup(); store.start(); await settle();
    const draft = withRunner({ bag: "laptop", bagColor: "navy", eyeStyle: "sharp" });
    store.updateAppearance(draft);
    const old = { ...companyProfile(), appearance: getLegacyAppearance() };
    api.fetchProfile.mockResolvedValueOnce(normalizeSharedProfile(old, "employee-a")!);
    store.refresh(); await settle();
    api.postResult.mockImplementationOnce(async (_accountId, input) => companyAck(input, normalizeSharedProfile({
      ...old, best: { accountId: "employee-a", displayName: "회사원 A", bestStage: 1, bestScore: 100,
        remainingTimeCs: 6000, achievedAt: now },
    }, "employee-a")!));
    store.submitResult(companyResult()); await settle();
    expect(appearanceBinding(store).value).toEqual(draft);
    await vi.advanceTimersByTimeAsync(400);
    expect(api.postAppearance).toHaveBeenCalledExactlyOnceWith("employee-a", { appearance: draft }, expect.any(AbortSignal));
    expect(appearanceBinding(store)).toMatchObject({ status: "saved", value: draft });
    expect(binding(store).profile.best?.bestScore).toBe(100);
  });

  it("provides independent defaults without saving on bootstrap or touching the score queue", async () => {
    const { store, api, storage } = setup();
    store.updateAppearance(withRunner({ hat: "cap" }));
    expect(api.fetchProfile).not.toHaveBeenCalled();
    store.start(); await settle();
    expect(appearanceBinding(store)).toMatchObject({ value: getDefaultCharacterAppearance(), status: "idle", errorMessage: null });
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.postAppearance).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(binding(store).profile).not.toHaveProperty("appearance");
  });

  it("shows each choice immediately and saves once 400ms after the final choice", async () => {
    const { store, api, readServer } = setup(); store.start(); await settle();
    const first = withRunner({ hat: "cap" });
    store.updateAppearance(first);
    expect(appearanceBinding(store)).toMatchObject({ value: first, status: "pending" });
    await vi.advanceTimersByTimeAsync(100);
    const second = withRunner({ hat: "cap", hairStyle: "bob" });
    store.updateAppearance(second);
    await vi.advanceTimersByTimeAsync(150);
    const latest = withRunner({ hat: "cap", hairStyle: "bob", outfitColor: "teal" });
    store.updateAppearance(latest);
    await vi.advanceTimersByTimeAsync(399);
    expect(api.postAppearance).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.postAppearance).toHaveBeenCalledExactlyOnceWith("employee-a", { appearance: latest }, expect.any(AbortSignal));
    expect(readServer().appearance).toEqual(latest);
    expect(appearanceBinding(store)).toMatchObject({ value: latest, status: "saved", errorMessage: null });
  });

  it("ignores unchanged or invalid choices and isolates the draft from mutable caller/snapshot values", async () => {
    const { store, api } = setup(); store.start(); await settle();
    store.updateAppearance(getDefaultCharacterAppearance());
    store.updateAppearance({ version: 1 } as unknown as CharacterAppearance);
    expect(vi.getTimerCount()).toBe(0);
    const appearance = withRunner({ hat: "cap" });
    store.updateAppearance(appearance);
    appearance.runner.hat = "none";
    appearanceBinding(store).value.pursuer.hat = "none";
    await vi.advanceTimersByTimeAsync(400);
    expect(api.postAppearance.mock.calls[0][1].appearance).toEqual(withRunner({ hat: "cap" }));
    expect(appearanceBinding(store).value.pursuer.hat).toBe("straw");
  });

  it("retains the latest draft through an older acknowledgement and serializes the final save", async () => {
    const { store, api, readServer } = setup(); store.start(); await settle();
    const gate = deferred<void>();
    const save = api.postAppearance.getMockImplementation()!;
    api.postAppearance.mockImplementationOnce(async (...args) => { const response = await save(...args); await gate.promise; return response; });
    store.updateAppearance(withRunner({ hat: "cap", bag: "backpack", eyeStyle: "round" }));
    await vi.advanceTimersByTimeAsync(400);
    expect(appearanceBinding(store).status).toBe("saving");
    store.updateAppearance(withRunner({ hat: "cap", hairStyle: "bob" }));
    await vi.advanceTimersByTimeAsync(100);
    const latest = withRunner({ hat: "straw", hairStyle: "ponytail", bag: "laptop", bagColor: "navy", eyeStyle: "sharp" });
    store.updateAppearance(latest);
    await vi.advanceTimersByTimeAsync(400);
    expect(api.postAppearance).toHaveBeenCalledTimes(1);
    const seen: CharacterAppearance[] = [];
    const unsubscribe = store.subscribe(() => seen.push(appearanceBinding(store).value));
    gate.resolve(); await settle();
    unsubscribe();
    expect(api.postAppearance).toHaveBeenCalledTimes(2);
    expect(seen.every(value => value.runner.hairStyle === "ponytail" && value.runner.bag === "laptop" && value.runner.eyeStyle === "sharp")).toBe(true);
    expect(appearanceBinding(store)).toMatchObject({ value: latest, status: "saved" });
    expect(readServer().appearance).toEqual(latest);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("saves a return to the original look while a different look is in flight", async () => {
    const { store, api, readServer } = setup(); store.start(); await settle();
    const gate = deferred<void>();
    const save = api.postAppearance.getMockImplementation()!;
    api.postAppearance.mockImplementationOnce(async (...args) => { await gate.promise; return save(...args); });
    store.updateAppearance(withRunner({ hat: "cap" }));
    await vi.advanceTimersByTimeAsync(400);
    store.updateAppearance(getDefaultCharacterAppearance());
    await vi.advanceTimersByTimeAsync(400);
    gate.resolve(); await settle();
    expect(api.postAppearance).toHaveBeenCalledTimes(2);
    expect(readServer().appearance).toEqual(getDefaultCharacterAppearance());
    expect(appearanceBinding(store).status).toBe("saved");
  });

  it("keeps a newer choice pending when an earlier appearance request fails", async () => {
    const { store, api, readServer } = setup(); store.start(); await settle();
    const first = deferred<SaveAppearanceResponse>();
    api.postAppearance.mockReturnValueOnce(first.promise);
    store.updateAppearance(withRunner({ hat: "cap" }));
    await vi.advanceTimersByTimeAsync(400);
    const latest = withRunner({ hairStyle: "ponytail" });
    store.updateAppearance(latest);
    await vi.advanceTimersByTimeAsync(400);
    first.reject(new RecordApiError("storage-unavailable")); await settle();
    expect(api.postAppearance).toHaveBeenCalledTimes(2);
    expect(appearanceBinding(store)).toMatchObject({ value: latest, status: "saved", errorMessage: null });
    expect(readServer().appearance).toEqual(latest);
  });

  it("sends ready game results before a due appearance and never submits them in parallel", async () => {
    const { store, api, storage, readServer } = setup(); store.start(); await settle();
    const order: string[] = [];
    const gate = deferred<void>();
    const saveStage = api.postResult.getMockImplementation()!;
    const saveInfinite = api.postInfiniteResult.getMockImplementation()!;
    const saveAppearance = api.postAppearance.getMockImplementation()!;
    api.postResult.mockImplementationOnce(async (...args) => { order.push("stage"); const response = await saveStage(...args); await gate.promise; return response; });
    api.postInfiniteResult.mockImplementation(async (...args) => { order.push("infinite"); return saveInfinite(...args); });
    api.postAppearance.mockImplementation(async (...args) => { order.push("appearance"); return saveAppearance(...args); });
    const appearance = withRunner({ hat: "cap" });
    store.updateAppearance(appearance);
    store.submitResult(companyResult({ score: 150, outcome: "cleared" }));
    store.submitInfiniteScore({ score: 120 }); await settle();
    await vi.advanceTimersByTimeAsync(400);
    expect(order).toEqual(["stage"]);
    expect(binding(store).pendingCount).toBe(2);
    gate.resolve(); await settle();
    expect(order).toEqual(["stage", "infinite", "appearance"]);
    expect(readServer()).toMatchObject({ appearance, highestClearedStage: 1, best: { bestScore: 150 }, infiniteBest: { bestScore: 120 } });
    expect(binding(store).pendingCount).toBe(0);
    expect(appearanceBinding(store).status).toBe("saved");
    expect(JSON.parse(storage.data.get(companyPendingKey("employee-a"))!)).toEqual({ version: 2, accountId: "employee-a", pending: [] });
    expect(storage.data.size).toBe(1);
  });

  it("keeps a draft over score/refresh responses and accepts another device's look when no draft exists", async () => {
    const { store, api } = setup(); store.start(); await settle();
    const draft = withRunner({ hat: "cap" });
    const remote = withRunner({ hairStyle: "bob" });
    store.updateAppearance(draft);
    api.fetchProfile.mockResolvedValueOnce(companyProfile({ appearance: remote }));
    store.refresh(); await settle();
    expect(appearanceBinding(store).value).toEqual(draft);
    store.submitResult(companyResult()); await settle();
    expect(appearanceBinding(store).value).toEqual(draft);
    await vi.advanceTimersByTimeAsync(400);
    api.fetchProfile.mockResolvedValueOnce(companyProfile({ appearance: remote }));
    store.refresh(); await settle();
    expect(appearanceBinding(store).value).toEqual(remote);
    expect(binding(store).profile.best?.bestScore).toBe(100);
  });

  it.each(["storage-unavailable", "timeout", "network", "invalid-response"] as const)("retains a failed %s draft, lets scores save, and confirms only after retry", async (code) => {
    const { store, api, readServer } = setup(); store.start(); await settle();
    const appearance = withRunner({ hat: "cap", bag: "crossbody", bagColor: "beige", eyeStyle: "sleepy" });
    api.postAppearance.mockRejectedValueOnce(new RecordApiError(code));
    store.updateAppearance(appearance);
    await vi.advanceTimersByTimeAsync(400);
    expect(appearanceBinding(store)).toMatchObject({ value: appearance, status: "error" });
    expect(appearanceBinding(store).errorMessage).toContain("외형을 저장하지 못했어요");
    expect(binding(store)).toMatchObject({ syncStatus: "idle", errorMessage: null });
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.postAppearance).toHaveBeenCalledTimes(1);
    store.submitResult(companyResult({ score: 150, outcome: "cleared" })); await settle();
    expect(binding(store).profile.highestClearedStage).toBe(1);
    expect(appearanceBinding(store).value).toEqual(appearance);
    appearanceBinding(store).retry(); await settle();
    expect(appearanceBinding(store)).toMatchObject({ value: appearance, status: "saved", errorMessage: null });
    expect(readServer()).toMatchObject({ appearance, highestClearedStage: 1 });
  });

  it.each(["missing", "different", "other-account"])("does not falsely confirm an injected %s acknowledgement", async (kind) => {
    const { store, api } = setup(); store.start(); await settle();
    const appearance = withRunner({ hat: "cap" });
    const incoming = kind === "missing" ? companyProfile() : kind === "different"
      ? companyProfile({ appearance: getDefaultCharacterAppearance() }) : companyProfile({ accountId: "other", appearance });
    api.postAppearance.mockResolvedValueOnce({ profile: incoming });
    store.updateAppearance(appearance);
    await vi.advanceTimersByTimeAsync(400);
    expect(appearanceBinding(store)).toMatchObject({ value: appearance, status: "error" });
    expect(binding(store).profile.accountId).toBe("employee-a");
  });

  it("supports legacy injected APIs without reporting a successful appearance save", async () => {
    const { api } = setup();
    const legacyApi: CompanyRecordApi = { ...api };
    delete legacyApi.postAppearance;
    const store = new CompanyRecordStore("employee-a", { api: legacyApi, storage: () => memory() });
    stores.push(store); store.start(); await settle();
    store.updateAppearance(withRunner({ hat: "cap" }));
    await vi.advanceTimersByTimeAsync(400);
    expect(appearanceBinding(store).status).toBe("error");
    expect(binding(store).syncStatus).toBe("idle");
  });

  it("retries ordinary appearance errors on online without losing the draft", async () => {
    const { store, api, readServer } = setup(); store.start(); await settle();
    api.postAppearance.mockRejectedValueOnce(new RecordApiError("storage-unavailable"));
    const appearance = withRunner({ hat: "cap" });
    store.updateAppearance(appearance);
    await vi.advanceTimersByTimeAsync(400);
    window.dispatchEvent(new Event("online")); await settle();
    expect(api.fetchProfile).toHaveBeenCalledTimes(2);
    expect(api.postAppearance).toHaveBeenCalledTimes(2);
    expect(appearanceBinding(store).status).toBe("saved");
    expect(readServer().appearance).toEqual(appearance);
  });

  it("blocks even newer drafts after a stale request loses authentication and verifies the account on retry", async () => {
    const { store, api, readServer } = setup(); store.start(); await settle();
    const first = deferred<SaveAppearanceResponse>();
    api.postAppearance.mockReturnValueOnce(first.promise);
    store.updateAppearance(withRunner({ hat: "cap" }));
    await vi.advanceTimersByTimeAsync(400);
    const latest = withRunner({ hairStyle: "ponytail" });
    store.updateAppearance(latest);
    first.reject(new RecordApiError("unauthenticated")); await settle();
    expect(binding(store).syncStatus).toBe("auth-required");
    expect(appearanceBinding(store)).toMatchObject({ value: latest, status: "auth-required" });
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.postAppearance).toHaveBeenCalledTimes(1);
    api.fetchProfile.mockRejectedValueOnce(new RecordApiError("unauthenticated"));
    store.retryAppearance(); await settle();
    expect(api.postAppearance).toHaveBeenCalledTimes(1);
    expect(appearanceBinding(store).status).toBe("auth-required");
    store.retryAppearance(); await settle();
    expect(api.fetchProfile).toHaveBeenCalledTimes(3);
    expect(api.postAppearance).toHaveBeenCalledTimes(2);
    expect(appearanceBinding(store).status).toBe("saved");
    expect(readServer().appearance).toEqual(latest);
  });

  it("does not bypass a score authentication failure to save a pending appearance", async () => {
    const { store, api } = setup(); store.start(); await settle();
    store.updateAppearance(withRunner({ hat: "cap" }));
    api.postResult.mockRejectedValueOnce(new RecordApiError("unauthenticated"));
    store.submitResult(companyResult()); await settle();
    await vi.advanceTimersByTimeAsync(400);
    expect(api.postAppearance).not.toHaveBeenCalled();
    expect(appearanceBinding(store).status).toBe("auth-required");
    store.retryAppearance(); await settle();
    expect(api.postResult).toHaveBeenCalledTimes(2);
    expect(api.postAppearance).toHaveBeenCalledTimes(1);
    expect(appearanceBinding(store).status).toBe("saved");
  });

  it("cleans up a pending debounce and restores its draft across StrictMode reconnect", async () => {
    const { store, api } = setup(); store.start(); await settle();
    store.updateAppearance(withRunner({ hat: "cap" }));
    await vi.advanceTimersByTimeAsync(100);
    store.stop();
    expect(vi.getTimerCount()).toBe(0);
    store.start(); await settle();
    await vi.advanceTimersByTimeAsync(299);
    expect(api.postAppearance).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.postAppearance).toHaveBeenCalledTimes(1);
    expect(appearanceBinding(store).status).toBe("saved");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores an aborted generation's late acknowledgement after restarting its in-flight draft", async () => {
    const { store, api, readServer } = setup(); store.start(); await settle();
    const first = deferred<SaveAppearanceResponse>();
    api.postAppearance.mockReturnValueOnce(first.promise);
    const appearance = withRunner({ hat: "cap" });
    store.updateAppearance(appearance);
    await vi.advanceTimersByTimeAsync(400);
    const signal = api.postAppearance.mock.calls[0][2];
    store.stop(); expect(signal.aborted).toBe(true);
    store.start(); await settle();
    expect(api.postAppearance).toHaveBeenCalledTimes(2);
    expect(appearanceBinding(store).status).toBe("saved");
    first.resolve({ profile: companyProfile({ appearance: getDefaultCharacterAppearance() }) }); await settle();
    expect(appearanceBinding(store)).toMatchObject({ value: appearance, status: "saved" });
    expect(readServer().appearance).toEqual(appearance);
  });

  it("does not transfer an old account's draft or late write to a new account", async () => {
    const storage = memory();
    const a = setup(companyProfile(), storage); a.store.start(); await settle();
    const first = deferred<SaveAppearanceResponse>();
    a.api.postAppearance.mockReturnValueOnce(first.promise);
    const appearance = withRunner({ hat: "cap" });
    a.store.updateAppearance(appearance);
    await vi.advanceTimersByTimeAsync(400);
    a.store.stop();
    const b = setup(companyProfile({ accountId: "employee-b" }), storage); b.store.start(); await settle();
    first.resolve({ profile: companyProfile({ appearance }) }); await settle();
    expect(b.api.postAppearance).not.toHaveBeenCalled();
    expect(appearanceBinding(b.store)).toMatchObject({ value: getDefaultCharacterAppearance(), status: "idle" });
    expect(a.api.postAppearance.mock.calls[0][0]).toBe("employee-a");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("continues saving when the editor unsubscribes and keeps callbacks stable", async () => {
    const { store, api, readServer } = setup(); store.start(); await settle();
    const original = appearanceBinding(store);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const appearance = withRunner({ hat: "cap" });
    original.update(appearance);
    unsubscribe(); listener.mockClear();
    await vi.advanceTimersByTimeAsync(400);
    expect(listener).not.toHaveBeenCalled();
    expect(api.postAppearance).toHaveBeenCalledTimes(1);
    expect(readServer().appearance).toEqual(appearance);
    expect(appearanceBinding(store).update).toBe(original.update);
    expect(appearanceBinding(store).retry).toBe(original.retry);
  });

  it("does not strand a newer choice queued by a completion subscriber", async () => {
    const { store, api, readServer } = setup(); store.start(); await settle();
    const latest = withRunner({ hairStyle: "bob" });
    let changed = false;
    const unsubscribe = store.subscribe(() => {
      if (!changed && appearanceBinding(store).status === "saved" && binding(store).syncStatus === "idle") {
        changed = true;
        store.updateAppearance(latest);
      }
    });
    store.updateAppearance(withRunner({ hat: "cap" }));
    await vi.advanceTimersByTimeAsync(400);
    expect(appearanceBinding(store).status).toBe("pending");
    await vi.advanceTimersByTimeAsync(400);
    unsubscribe();
    expect(api.postAppearance).toHaveBeenCalledTimes(2);
    expect(readServer().appearance).toEqual(latest);
    expect(vi.getTimerCount()).toBe(0);
  });
});

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
    expect(JSON.parse(storage.data.get(companyPendingKey("employee-a"))!).version).toBe(2);
  });

  it("stores infinite scores in the v2 queue and updates only the infinite personal best", async () => {
    const { store, api } = setup();
    store.start(); await settle();
    store.submitInfiniteScore(Object.freeze({ score: 75 })); await settle();
    expect(api.postInfiniteResult).toHaveBeenCalledOnce();
    expect(api.postInfiniteResult.mock.calls[0][1].result).toEqual({ score: 75 });
    expect(binding(store).profile.infiniteBest).toMatchObject({ bestScore: 75 });
    expect(binding(store).profile.best).toBeNull();
    expect(binding(store).infiniteEntries).toHaveLength(1);
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
