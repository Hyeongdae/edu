// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { companyAck, companyProfile, companySubmission } from "../test/companyFixtures";
import { fetchLeaderboard, fetchProfile, isSharedBest, postResult } from "./recordApi";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

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
