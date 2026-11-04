import { HttpRequest, InvocationContext } from "@azure/functions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTOR, NOW, principal, submission } from "../test/fixtures";
import { RecordServiceError } from "./errors";
import { createRecordHandlers } from "./handlers";
import { getDefaultCharacterAppearance } from "../../shared/characterAppearance";
import { getDefaultCharacterAppearance as getLegacyAppearance } from "../../shared/legacyCharacterAppearance";

const context = new InvocationContext({ functionName: "records-test" });
const profile = { ...ACTOR, highestClearedStage: 0 as const, best: null, infiniteBest: null };
const repository = {
  getProfile: vi.fn().mockResolvedValue(profile),
  listTopScores: vi.fn().mockResolvedValue([]),
  listTopInfiniteScores: vi.fn().mockResolvedValue([]),
  submit: vi.fn().mockResolvedValue(profile),
  submitInfiniteScore: vi.fn().mockResolvedValue(profile),
  saveAppearance: vi.fn().mockResolvedValue({ ...profile, appearance: getDefaultCharacterAppearance() }),
};
const handlers = createRecordHandlers({ repository });

function request(options: { body?: string; headers?: Record<string, string>; path?: string; method?: string } = {}): HttpRequest {
  return new HttpRequest({
    method: options.method ?? "POST", url: "https://game.example/api/" + (options.path ?? "results"),
    headers: {
      "x-ms-client-principal": principal(), "x-game-request": "1", "content-type": "application/json",
      ...options.headers,
    },
    body: { string: options.body ?? JSON.stringify(submission()) },
  });
}

beforeEach(() => {
  repository.getProfile.mockReset().mockResolvedValue(profile);
  repository.listTopScores.mockReset().mockResolvedValue([]);
  repository.listTopInfiniteScores.mockReset().mockResolvedValue([]);
  repository.submit.mockReset().mockResolvedValue(profile);
  repository.submitInfiniteScore.mockReset().mockResolvedValue(profile);
  repository.saveAppearance.mockReset().mockResolvedValue({ ...profile, appearance: getDefaultCharacterAppearance() });
});

describe("record handlers", () => {
  it("rejects a queued request after cookies switch to another authenticated account", async () => {
    expect(await handlers.results(request({ headers: { "x-game-account": "previous-account" } }), context))
      .toMatchObject({ status: 401, jsonBody: { error: { code: "unauthenticated" } } });
    expect(repository.submit).not.toHaveBeenCalled();
    expect(await handlers.results(request({ headers: { "x-game-account": ACTOR.accountId } }), context))
      .toMatchObject({ status: 200 });
  });
  it.each(["profile", "leaderboard", "results", "infiniteLeaderboard", "infiniteResults", "appearance"] as const)("authenticates %s before repository access", async (route) => {
    const response = await handlers[route](request({ headers: { "x-ms-client-principal": "" } }), context);
    expect(response).toMatchObject({ status: 401, jsonBody: { error: { code: "unauthenticated" } } });
    expect(repository.getProfile).not.toHaveBeenCalled();
    expect(repository.listTopScores).not.toHaveBeenCalled();
    expect(repository.submit).not.toHaveBeenCalled();
    expect(repository.listTopInfiniteScores).not.toHaveBeenCalled();
    expect(repository.submitInfiniteScore).not.toHaveBeenCalled();
    expect(repository.saveAppearance).not.toHaveBeenCalled();
  });

  it("returns only the current actor's profile, ignoring arbitrary query actor selectors", async () => {
    const response = await handlers.profile(request({ path: "profile?accountId=other", method: "GET" }), context);
    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual(profile);
    expect(repository.getProfile).toHaveBeenCalledExactlyOnceWith(ACTOR);
    expect(response.headers).toMatchObject({ "Cache-Control": "no-store" });
  });

  it("returns the authenticated shared ranking envelope", async () => {
    const entries = [{ ...ACTOR, bestStage: 1, bestScore: 10, remainingTimeCs: 100, achievedAt: NOW }];
    repository.listTopScores.mockResolvedValue(entries);
    expect(await handlers.leaderboard(request({ method: "GET" }), context))
      .toMatchObject({ status: 200, jsonBody: { entries } });
  });

  it("serves and submits an authenticated infinite score independently", async () => {
    const infiniteBest = { accountId: ACTOR.accountId, displayName: ACTOR.displayName, bestScore: 45, achievedAt: NOW };
    repository.listTopInfiniteScores.mockResolvedValue([infiniteBest]);
    expect(await handlers.infiniteLeaderboard(request({ method: "GET" }), context))
      .toMatchObject({ status: 200, jsonBody: { entries: [infiniteBest] } });
    const payload = { submissionId: submission().submissionId, result: { score: 45 } };
    repository.submitInfiniteScore.mockResolvedValue({ ...profile, infiniteBest });
    repository.listTopInfiniteScores.mockResolvedValue([infiniteBest]);
    expect(await handlers.infiniteResults(request({ body: JSON.stringify(payload) }), context))
      .toMatchObject({ status: 200, jsonBody: { submissionId: payload.submissionId, entries: [infiniteBest] } });
    expect(repository.submitInfiniteScore).toHaveBeenCalledExactlyOnceWith(ACTOR, payload.result);
  });

  it.each([{ score: -1 }, { score: 1.5 }, { score: Number.MAX_SAFE_INTEGER + 1 }, { score: 1, extra: true }])("rejects invalid infinite score payload %j", async (result) => {
      expect(await handlers.infiniteResults(request({ body: JSON.stringify({ submissionId: submission().submissionId, result }) }), context))
        .toMatchObject({ status: 400, jsonBody: { error: { code: "invalid-request" } } });
      expect(repository.submitInfiniteScore).not.toHaveBeenCalled();
    });

  it("submits the verified actor and echoes only the acknowledged request ID", async () => {
    const response = await handlers.results(request(), context);
    expect(repository.submit).toHaveBeenCalledExactlyOnceWith(ACTOR, submission());
    expect(response).toMatchObject({ status: 200, jsonBody: { submissionId: submission().submissionId, profile, entries: [] } });
  });

  it.each(["accountId", "displayName", "highestClearedStage", "tenant", "endedAtMs"])("denies forged %s fields", async (key) => {
    for (const body of [
      { ...submission(), [key]: "other" },
      { ...submission(), result: { ...submission().result, [key]: "other" } },
    ]) {
      const response = await handlers.results(request({ body: JSON.stringify(body) }), context);
      expect(response).toMatchObject({ status: 400, jsonBody: { error: { code: "invalid-request" } } });
    }
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it.each(["not-json", "[]", "null", "{}", ""])("rejects malformed body %s", async (body) => {
    expect(await handlers.results(request({ body }), context)).toMatchObject({ status: 400 });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { "content-type": "text/plain" }, { "content-type": "application/x-www-form-urlencoded" },
    { "content-type": "" }, { "x-game-request": "" }, { "x-game-request": "0" },
  ])("rejects non-JSON/forms or missing same-origin request marker: %j", async (headers) => {
    expect(await handlers.results(request({ headers }), context)).toMatchObject({ status: 400 });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("accepts JSON with charset and case-insensitive media type", async () => {
    expect(await handlers.results(request({ headers: { "content-type": "Application/JSON; charset=utf-8" } }), context))
      .toMatchObject({ status: 200 });
  });

  it("rejects excessive actual bytes even when content-length is absent or lies", async () => {
    for (const headers of [{}, { "content-length": "1" }] as Record<string, string>[]) {
      expect(await handlers.results(request({ body: JSON.stringify({ large: "가".repeat(3000) }), headers }), context))
        .toMatchObject({ status: 413, jsonBody: { error: { code: "invalid-request" } } });
    }
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("rejects an advertised oversized body before any record write", async () => {
    expect(await handlers.results(request({ headers: { "content-length": "8193" } }), context))
      .toMatchObject({ status: 413 });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid-request", 400], ["stage-locked", 409], ["conflict", 409], ["storage-unavailable", 503],
  ] as const)("maps %s to HTTP %s", async (code, status) => {
    repository.submit.mockRejectedValueOnce(new RecordServiceError(code));
    expect(await handlers.results(request(), context)).toMatchObject({ status, jsonBody: { error: { code } } });
  });

  it("does not expose SDK secrets/stacks in errors and never enables CORS", async () => {
    repository.getProfile.mockRejectedValueOnce(new Error("AccountKey=private-credential;secretText=private"));
    const response = await handlers.profile(request(), context);
    expect(response).toMatchObject({ status: 503, headers: { "Cache-Control": "no-store" } });
    expect(JSON.stringify(response)).not.toMatch(/private|AccountKey|stack|Access-Control-Allow-Origin/);
  });

  it("returns retryable failure if ranking read fails after a committed save", async () => {
    repository.listTopScores.mockRejectedValueOnce(new Error("offline"));
    expect(await handlers.results(request(), context)).toMatchObject({ status: 503 });
    expect(repository.submit).toHaveBeenCalledTimes(1);
  });
});

describe("account appearance handler", () => {
  const payload = () => ({ appearance: getDefaultCharacterAppearance() });

  it("returns the saved profile using only the authenticated actor and no ranking queries", async () => {
    const input = payload();
    input.appearance.runner = { ...input.appearance.runner, hat: "beanie", eyeStyle: "round", bag: "backpack", bagColor: "navy" };
    const saved = { ...profile, appearance: input.appearance };
    repository.saveAppearance.mockResolvedValue(saved);
    repository.listTopScores.mockRejectedValue(new Error("ranking offline"));
    repository.listTopInfiniteScores.mockRejectedValue(new Error("ranking offline"));
    const response = await handlers.appearance(request({ path: "appearance?accountId=other", body: JSON.stringify(input),
      headers: { "x-game-account": ACTOR.accountId } }), context);
    expect(response).toMatchObject({ status: 200, jsonBody: { profile: saved }, headers: {
      "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8",
    } });
    expect(repository.saveAppearance).toHaveBeenCalledExactlyOnceWith(ACTOR, input.appearance);
    expect(repository.listTopScores).not.toHaveBeenCalled();
    expect(repository.listTopInfiniteScores).not.toHaveBeenCalled();
    expect(repository.submit).not.toHaveBeenCalled();
    expect(repository.submitInfiniteScore).not.toHaveBeenCalled();
  });

  it("rejects an appearance queued for another account before writing or reading storage", async () => {
    const response = await handlers.appearance(request({ body: JSON.stringify(payload()),
      headers: { "x-game-account": "previous-account" } }), context);
    expect(response).toMatchObject({ status: 401, jsonBody: { error: { code: "unauthenticated" } } });
    expect(repository.saveAppearance).not.toHaveBeenCalled();
    expect(repository.getProfile).not.toHaveBeenCalled();
  });

  it.each(["accountId", "displayName", "score", "stage"])("rejects a forged %s on the save envelope", async (field) => {
    expect(await handlers.appearance(request({ body: JSON.stringify({ ...payload(), [field]: "forged" }) }), context))
      .toMatchObject({ status: 400, jsonBody: { error: { code: "invalid-request" } } });
    expect(repository.saveAppearance).not.toHaveBeenCalled();
  });

  it.each([
    { ...getDefaultCharacterAppearance(), version: 3 },
    getLegacyAppearance(),
    { ...getDefaultCharacterAppearance(), runner: getLegacyAppearance().runner },
    { ...getDefaultCharacterAppearance(), runner: { ...getDefaultCharacterAppearance().runner, bagColor: "#ffffff" } },
    { ...getDefaultCharacterAppearance(), runner: { hat: "cap" } },
    { ...getDefaultCharacterAppearance(), pursuer: null },
    { ...getDefaultCharacterAppearance(), accountId: "other" },
    { ...getDefaultCharacterAppearance(), runner: { ...getDefaultCharacterAppearance().runner, hat: "unknown" } },
    { ...getDefaultCharacterAppearance(), runner: { ...getDefaultCharacterAppearance().runner, skinTone: "#ffffff" } },
    { ...getDefaultCharacterAppearance(), pursuer: { ...getDefaultCharacterAppearance().pursuer, score: 100 } },
  ])("rejects invalid nested appearance: %j", async (appearance) => {
    expect(await handlers.appearance(request({ body: JSON.stringify({ appearance }) }), context))
      .toMatchObject({ status: 400, jsonBody: { error: { code: "invalid-request" } } });
    expect(repository.saveAppearance).not.toHaveBeenCalled();
  });

  it.each(["not-json", "[]", "null", "{}", "", '{"appearance":null}'])("rejects malformed appearance body %s", async (body) => {
    expect(await handlers.appearance(request({ body }), context)).toMatchObject({ status: 400 });
    expect(repository.saveAppearance).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { "content-type": "text/plain" }, { "content-type": "application/x-www-form-urlencoded" },
    { "content-type": "" }, { "x-game-request": "" }, { "x-game-request": "0" },
  ])("enforces the same-origin JSON save boundary: %j", async (headers) => {
    expect(await handlers.appearance(request({ body: JSON.stringify(payload()), headers }), context))
      .toMatchObject({ status: 400 });
    expect(repository.saveAppearance).not.toHaveBeenCalled();
  });

  it("accepts case-insensitive JSON with a charset", async () => {
    expect(await handlers.appearance(request({ body: JSON.stringify(payload()),
      headers: { "content-type": "Application/JSON; charset=utf-8" } }), context)).toMatchObject({ status: 200 });
  });

  it("enforces both advertised and actual streamed body limits", async () => {
    expect(await handlers.appearance(request({ body: JSON.stringify(payload()), headers: { "content-length": "8193" } }), context))
      .toMatchObject({ status: 413 });
    for (const headers of [{}, { "content-length": "1" }] as Record<string, string>[]) {
      expect(await handlers.appearance(request({ body: JSON.stringify({ appearance: "가".repeat(3000) }), headers }), context))
        .toMatchObject({ status: 413, jsonBody: { error: { code: "invalid-request" } } });
    }
    expect(repository.saveAppearance).not.toHaveBeenCalled();
  });

  it.each([["invalid-request", 400], ["conflict", 409], ["storage-unavailable", 503]] as const)(
    "maps appearance %s to HTTP %s", async (code, status) => {
      repository.saveAppearance.mockRejectedValueOnce(new RecordServiceError(code));
      expect(await handlers.appearance(request({ body: JSON.stringify(payload()) }), context))
        .toMatchObject({ status, headers: { "Cache-Control": "no-store" }, jsonBody: { error: { code } } });
    },
  );

  it("does not expose storage details when appearance persistence fails", async () => {
    repository.saveAppearance.mockRejectedValueOnce(new Error("AccountKey=private-appearance-key;_etag=internal"));
    const response = await handlers.appearance(request({ body: JSON.stringify(payload()) }), context);
    expect(response).toMatchObject({ status: 503, headers: { "Cache-Control": "no-store" } });
    expect(JSON.stringify(response)).not.toMatch(/private|AccountKey|_etag|stack|Access-Control-Allow-Origin/);
  });
});
