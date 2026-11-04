// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { companyAck, companyProfile, companySubmission, deferred } from "../test/companyFixtures";
import { fetchInfiniteLeaderboard, fetchLeaderboard, fetchProfile, isSharedBest, isSharedProfile, normalizeSharedProfile, postAppearance, postInfiniteResult, postResult } from "./recordApi";
import { getDefaultCharacterAppearance } from "../../shared/characterAppearance";
import type { SaveAppearanceRequest } from "../../shared/characterAppearance";
import { getDefaultCharacterAppearance as getLegacyAppearance } from "../../shared/legacyCharacterAppearance";
import { getDefaultCharacterAppearance as getExpandedAppearance } from "../../shared/expandedCharacterAppearance";
import { normalizeCharacterAppearance } from "../../shared/characterAppearance";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function legacyWireProfile() {
  const appearance = getLegacyAppearance();
  appearance.runner = { gender: "female", hairStyle: "ponytail", hairColor: "blond", skinTone: "deep",
    outfit: "cardigan", outfitColor: "teal", hat: "cap", glasses: "round", shoes: "sneakers", shoeColor: "white" };
  return { ...companyProfile({ highestClearedStage: 1,
    best: { accountId: "employee-a", displayName: "회사원 A", bestStage: 1, bestScore: 150,
      remainingTimeCs: 6000, achievedAt: "2026-11-04T00:00:00.000Z" },
    infiniteBest: { accountId: "employee-a", displayName: "회사원 A", bestScore: 300, achievedAt: "2026-11-04T00:00:00.000Z" },
  }), appearance };
}

function expandedWireProfile() {
  const appearance = getExpandedAppearance();
  Object.assign(appearance.runner, { gender: "female", hairStyle: "long", hat: "beanie", eyeStyle: "smile", bag: "crossbody", bagColor: "beige" });
  Object.assign(appearance.pursuer, { hairStyle: "curly", eyeStyle: "sharp", bag: "laptop", bagColor: "navy" });
  return { ...legacyWireProfile(), appearance };
}
const oldWireProfiles = [{ name: "v1", make: legacyWireProfile }, { name: "v2", make: expandedWireProfile }];

describe("versioned profile normalization", () => {
  it.each(oldWireProfiles)("normalizes $name without claiming the raw value has the new type", ({ make }) => {
    const wire = make(), before = structuredClone(wire);
    expect(isSharedProfile(wire, "employee-a")).toBe(false);
    const normalized = normalizeSharedProfile(wire, "employee-a")!;
    expect(isSharedProfile(normalized, "employee-a")).toBe(true);
    expect(normalized.appearance).toEqual(normalizeCharacterAppearance(wire.appearance));
    expect(normalized.appearance).toMatchObject({ version: 3,
      runner: { bottoms: "trousers", bottomsColor: "navy" }, pursuer: { bottoms: "trousers", bottomsColor: "navy" } });
    expect(normalized.best).toEqual(wire.best); expect(normalized.infiniteBest).toEqual(wire.infiniteBest);
    expect(wire).toEqual(before); expect(normalized).not.toBe(wire);
    normalized.appearance!.runner.hat = "none"; expect(wire.appearance.runner.hat).toBe(before.appearance.runner.hat);
    expect(normalizeSharedProfile(wire, "another-account")).toBeNull();
  });

  it.each(oldWireProfiles.flatMap(schema => ["profile", "stage", "infinite"].map(mode => ({ ...schema, mode }))))(
    "normalizes the actual $name $mode HTTP response before returning it", async ({ make, mode }) => {
    const wire = make(), input = companySubmission();
    const json = mode === "profile" ? wire : { submissionId: input.submissionId, profile: wire, entries: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(json)));
    const signal = new AbortController().signal;
    const profile = mode === "profile" ? await fetchProfile("employee-a", signal) : mode === "stage"
      ? (await postResult("employee-a", input, signal)).profile
      : (await postInfiniteResult("employee-a", { submissionId: input.submissionId, result: { score: 300 } }, signal)).profile;
    expect(profile.appearance).toEqual(normalizeSharedProfile(wire, "employee-a")!.appearance);
    expect(profile.appearance?.version).toBe(3); expect(profile.best).toEqual(wire.best);
    expect(profile.highestClearedStage).toBe(1);
    expect(wire.appearance.version).toBe(make().appearance.version);
  });

  it.each(["stage", "infinite"] as const)("does not normalize away account, score or appearance corruption in a %s acknowledgement", async mode => {
    const wire = legacyWireProfile(), input = companySubmission();
    const invalidProfiles = [
      { ...wire, accountId: "other" }, { ...wire, best: { ...wire.best!, bestScore: 151 } },
      { ...wire, appearance: { version: 2, runner: wire.appearance.runner, pursuer: wire.appearance.pursuer } },
      { ...wire, appearance: { ...getDefaultCharacterAppearance(), version: 4 } },
      { ...wire, appearance: { ...wire.appearance, runner: { ...wire.appearance.runner, hat: "unknown" } } },
    ];
    for (const profile of invalidProfiles) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ submissionId: input.submissionId, profile, entries: [] })));
      const call = mode === "stage" ? postResult("employee-a", input, new AbortController().signal)
        : postInfiniteResult("employee-a", { submissionId: input.submissionId, result: { score: 300 } }, new AbortController().signal);
      await expect(call).rejects.toMatchObject({ code: "invalid-response" });
    }
  });

  it.each([getLegacyAppearance, getExpandedAppearance])("does not acknowledge an old echo even when upgraded defaults match", async make => {
    const profile = { ...companyProfile(), appearance: make() };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ profile })));
    await expect(postAppearance("employee-a", { appearance: getDefaultCharacterAppearance() }, new AbortController().signal))
      .rejects.toMatchObject({ code: "invalid-response" });
  });

  it.each([getLegacyAppearance, getExpandedAppearance])("rejects old save payloads before any HTTP request", async make => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(postAppearance("employee-a", { appearance: make() } as unknown as SaveAppearanceRequest, new AbortController().signal))
      .rejects.toMatchObject({ code: "invalid-request" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("appearance HTTP boundary", () => {
  it.each(["bottoms", "bottomsColor"] as const)("does not acknowledge a missing or changed %s field", async field => {
    const appearance = getDefaultCharacterAppearance();
    appearance.runner = { ...appearance.runner, bottoms: "skirt", bottomsColor: "beige" };
    for (const value of [undefined, field === "bottoms" ? "jeans" : "white"]) {
      const invalid = { ...appearance, runner: { ...appearance.runner, [field]: value } };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ profile: companyProfile({ appearance: invalid as typeof appearance }) })));
      await expect(postAppearance("employee-a", { appearance }, new AbortController().signal))
        .rejects.toMatchObject({ code: "invalid-response" });
    }
  });

  it("posts only the appearance and validates the matching authenticated acknowledgement", async () => {
    const appearance = getDefaultCharacterAppearance();
    appearance.runner = { ...appearance.runner, hairStyle: "long", eyeStyle: "smile", bag: "backpack", bagColor: "navy", bottoms: "skirt", bottomsColor: "beige" };
    appearance.pursuer = { ...appearance.pursuer, eyeStyle: "sharp", bag: "briefcase", bagColor: "brown", bottoms: "shorts", bottomsColor: "white" };
    const profile = companyProfile({ appearance });
    const fetcher = vi.fn().mockResolvedValue(Response.json({ profile }));
    vi.stubGlobal("fetch", fetcher);
    expect(await postAppearance("employee-a", { appearance }, new AbortController().signal)).toEqual({ profile });
    expect(fetcher).toHaveBeenCalledWith("/api/appearance", expect.objectContaining({
      method: "POST", credentials: "include", cache: "no-store", redirect: "manual", mode: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Game-Request": "1", "X-Game-Account": "employee-a" },
      body: JSON.stringify({ appearance }),
    }));
    expect(fetcher.mock.calls[0][1].body).not.toMatch(/accountId|displayName|highestClearedStage|bestScore/);
    const sent = JSON.parse(fetcher.mock.calls[0][1].body).appearance;
    expect(sent.version).toBe(3); expect(Object.keys(sent.runner)).toHaveLength(15);
  });

  it("loads optional appearance from a fresh session while retaining legacy profile support", async () => {
    const appearance = getDefaultCharacterAppearance();
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(companyProfile({ appearance })))
      .mockResolvedValueOnce(Response.json(companyProfile()));
    vi.stubGlobal("fetch", fetcher);
    expect((await fetchProfile("employee-a", new AbortController().signal)).appearance).toEqual(appearance);
    expect(await fetchProfile("employee-a", new AbortController().signal)).not.toHaveProperty("appearance");
  });

  it.each([null, {}, { ...getDefaultCharacterAppearance(), version: 4 },
    { ...getDefaultCharacterAppearance(), runner: { ...getDefaultCharacterAppearance().runner, bottomsColor: "unknown" } },
    { ...getDefaultCharacterAppearance(), runner: { hat: "unknown" } }])("rejects an invalid optional appearance in a profile: %j", async (appearance) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...companyProfile(), appearance })));
      await expect(fetchProfile("employee-a", new AbortController().signal)).rejects.toMatchObject({ code: "invalid-response" });
    });

  it.each(["missing", "different", "other-account"])("does not acknowledge an appearance that is %s", async (kind) => {
    const appearance = getDefaultCharacterAppearance();
    appearance.runner.hat = "cap";
    const profile = kind === "missing" ? companyProfile() : kind === "different"
      ? companyProfile({ appearance: getDefaultCharacterAppearance() })
      : companyProfile({ accountId: "other-account", appearance });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ profile })));
    await expect(postAppearance("employee-a", { appearance }, new AbortController().signal))
      .rejects.toMatchObject({ code: "invalid-response" });
  });

  it("captures the posted appearance before a caller edits its mutable input", async () => {
    const appearance = getDefaultCharacterAppearance();
    const response = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(response.promise);
    vi.stubGlobal("fetch", fetcher);
    const saving = postAppearance("employee-a", { appearance }, new AbortController().signal);
    appearance.runner.hat = "cap";
    response.resolve(Response.json({ profile: companyProfile({ appearance: getDefaultCharacterAppearance() }) }));
    expect((await saving).profile.appearance?.runner.hat).toBe("none");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).appearance.runner.hat).toBe("none");
  });

  it("rejects invalid save requests before network access", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const payload of [null, {}, { appearance: getDefaultCharacterAppearance(), accountId: "other" }]) {
      await expect(postAppearance("employee-a", payload as SaveAppearanceRequest, new AbortController().signal))
        .rejects.toMatchObject({ code: "invalid-request" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([401, 403, 302])("requires login for an appearance HTTP%s failure", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    await expect(postAppearance("employee-a", { appearance: getDefaultCharacterAppearance() }, new AbortController().signal))
      .rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("keeps appearance gateway failures retryable without exposing server details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private gateway diagnostic", { status: 503 })));
    await expect(postAppearance("employee-a", { appearance: getDefaultCharacterAppearance() }, new AbortController().signal))
      .rejects.toMatchObject({ code: "storage-unavailable" });
  });

  it("cancels an appearance request with the account lifetime and removes its timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_path, { signal }: { signal: AbortSignal }) => new Promise((_accept, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const controller = new AbortController();
    const outcome = postAppearance("employee-a", { appearance: getDefaultCharacterAppearance() }, controller.signal).catch(error => error);
    controller.abort();
    expect(await outcome).toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("company record HTTP boundary", () => {
  it("loads the expected profile only, with same-origin cookies, no cache and account precondition", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(companyProfile()));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    expect(await fetchProfile("employee-a", signal)).toEqual(companyProfile());
    expect(fetcher).toHaveBeenCalledWith("/api/profile", expect.objectContaining({
      method: "GET", cache: "no-store", credentials: "include", redirect: "manual", mode: "same-origin",
      headers: { Accept: "application/json", "X-Game-Account": "employee-a" },
    }));
  });

  it("posts no identity, clear override or client timestamp in the body", async () => {
    const input = companySubmission();
    const fetcher = vi.fn().mockResolvedValue(Response.json(companyAck(input)));
    vi.stubGlobal("fetch", fetcher);
    expect(await postResult("employee-a", input, new AbortController().signal)).toEqual(companyAck(input));
    const options = fetcher.mock.calls[0][1];
    expect(options.headers).toMatchObject({ "Content-Type": "application/json", "X-Game-Request": "1", "X-Game-Account": "employee-a" });
    expect(JSON.parse(options.body)).toEqual(input);
    expect(options.body).not.toMatch(/accountId|displayName|endedAtMs|highestClearedStage/);
  });

  it("uses the isolated infinite endpoints with the same authenticated request boundary", async () => {
    const input = { submissionId: "0b220b82-bccc-4b85-b763-d824001bc73b", result: { score: 450 } };
    const profile = companyProfile({ infiniteBest: { accountId: "employee-a", displayName: "회사원 A", bestScore: 450,
      achievedAt: "2026-10-30T00:00:00.000Z" } });
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ entries: [profile.infiniteBest] }))
      .mockResolvedValueOnce(Response.json({ submissionId: input.submissionId, profile, entries: [profile.infiniteBest] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchInfiniteLeaderboard(new AbortController().signal)).toEqual([profile.infiniteBest]);
    expect(await postInfiniteResult("employee-a", input, new AbortController().signal))
      .toMatchObject({ submissionId: input.submissionId, profile, entries: [profile.infiniteBest] });
    expect(fetcher.mock.calls[0][0]).toBe("/api/infinite-leaderboard");
    expect(fetcher.mock.calls[1][0]).toBe("/api/infinite-results");
    expect(fetcher.mock.calls[1][1]).toMatchObject({ credentials: "include", cache: "no-store", mode: "same-origin" });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(input);
  });

  it.each([401, 403, 302])("requires login on HTTP%s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    await expect(fetchProfile("employee-a", new AbortController().signal)).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("recognizes browser opaque login redirects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ type: "opaqueredirect", status: 0 }));
    await expect(fetchLeaderboard(new AbortController().signal)).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("keeps non-JSON or malformed gateway503 failures retryable", async () => {
    for (const response of [new Response("upstream unavailable", { status: 503 }),
      new Response("bad JSON", { status: 503, headers: { "content-type": "application/json" } })]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(fetchProfile("employee-a", new AbortController().signal)).rejects.toMatchObject({ code: "storage-unavailable" });
    }
  });

  it.each([
    companyProfile({ accountId: "other-user" }), companyProfile({ highestClearedStage: 6 as never }),
    {}, { ...companyProfile(), best: { accountId: "employee-a", bestStage: 1, bestScore: 100 } },
    companyProfile({ highestClearedStage: 1, best: { accountId: "employee-a", displayName: "A", bestStage: 1, bestScore: 151, remainingTimeCs: 100, achievedAt: "2026-10-30T00:00:00.000Z" } }),
  ])("rejects wrong-account or malformed official profiles: %j", async (profile) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(profile)));
    await expect(fetchProfile("employee-a", new AbortController().signal)).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("rejects login HTML and malformed JSON instead of inventing empty records", async () => {
    for (const response of [new Response("login html"), new Response("bad JSON", { headers: { "content-type": "application/json" } })]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(fetchProfile("employee-a", new AbortController().signal)).rejects.toMatchObject({ code: "invalid-response" });
    }
  });

  it("rejects wrong acknowledgements even after a possible remote commit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...companyAck(companySubmission()), submissionId: "wrong" })));
    await expect(postResult("employee-a", companySubmission(), new AbortController().signal)).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("loads a typed empty company board and rejects malformed ranking entries", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ entries: [] })).mockResolvedValueOnce(Response.json({ entries: [{ bestScore: 100 }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchLeaderboard(new AbortController().signal)).toEqual([]);
    await expect(fetchLeaderboard(new AbortController().signal)).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("rejects a company ranking entry above its stage score target", () => {
    expect(isSharedBest({ accountId: "employee-a", displayName: "A", bestStage: 1, bestScore: 150,
      remainingTimeCs: 100, achievedAt: "2026-10-30T00:00:00.000Z" })).toBe(true);
    expect(isSharedBest({ accountId: "employee-a", displayName: "A", bestStage: 1, bestScore: 151,
      remainingTimeCs: 100, achievedAt: "2026-10-30T00:00:00.000Z" })).toBe(false);
  });

  it.each(["conflict", "stage-locked", "invalid-request", "storage-unavailable"] as const)("preserves safe API error code %s", async (code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code, message: "private server diagnostic" } }, { status: 409 })));
    const error = await fetchProfile("employee-a", new AbortController().signal).catch((failure) => failure);
    expect(error.code).toBe(code);
    expect(error.message).not.toContain("private");
  });

  it("times out at15s and removes its timer after cancellation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_path, { signal }: { signal: AbortSignal }) => new Promise((_accept, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const outcome = fetchProfile("employee-a", new AbortController().signal).catch((error) => error);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await outcome).toMatchObject({ code: "timeout" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("forwards caller abort and cleans up without presenting a storage error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_path, { signal }: { signal: AbortSignal }) => new Promise((_accept, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const controller = new AbortController();
    const outcome = fetchProfile("employee-a", controller.signal).catch((error) => error);
    controller.abort();
    expect(await outcome).toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
