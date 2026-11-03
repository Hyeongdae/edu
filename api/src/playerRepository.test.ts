import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTOR, NOW, submission } from "../test/fixtures";
import {
  createPlayerRepository, createPlayerRepositoryFromEnvironment, getPlayerRowKey,
} from "./playerRepository";
import type { PlayerContainer, PlayerDocument } from "./playerRepository";
import { getDefaultCharacterAppearance } from "../../shared/characterAppearance";
import type { CharacterAppearance } from "../../shared/characterAppearance";

const ITEM_ETAG = '"player-version-1"';
const CONTAINER_ID = "stair-climb-players";
const itemNotFound = { statusCode: 404, code: "NotFound" };
const item = { read: vi.fn(), replace: vi.fn() };
const container = {
  read: vi.fn(),
  item: vi.fn(),
  items: { create: vi.fn(), query: vi.fn() },
};

function stored(overrides: Record<string, unknown> = {}): PlayerDocument {
  return {
    id: getPlayerRowKey(ACTOR.accountId),
    accountId: ACTOR.accountId,
    schemaVersion: 1,
    displayName: ACTOR.displayName,
    highestClearedStage: 0,
    bestStage: 1,
    bestScore: 100,
    remainingTimeCs: 6000,
    achievedAt: NOW,
    ...overrides,
  } as PlayerDocument;
}

function repository() {
  return createPlayerRepository(container as unknown as PlayerContainer, {
    now: () => new Date(NOW),
    containerId: CONTAINER_ID,
  });
}

function useMemoryDocument(initial?: PlayerDocument) {
  let document = initial ? structuredClone(initial) : undefined;
  let version = 1;
  item.read.mockImplementation(async () => document
    ? { resource: structuredClone(document), etag: `"version-${version}"` }
    : { statusCode: 404 });
  container.items.create.mockImplementation(async (next: PlayerDocument) => {
    if (document) throw { code: 409 };
    document = structuredClone(next);
    version++;
  });
  item.replace.mockImplementation(async (next: PlayerDocument, options: { accessCondition: { condition: string } }) => {
    if (options.accessCondition.condition !== `"version-${version}"`) throw { code: 412 };
    document = structuredClone(next);
    version++;
  });
  return () => document ? structuredClone(document) : undefined;
}

beforeEach(() => {
  container.read.mockReset().mockResolvedValue({ resource: { id: CONTAINER_ID, partitionKey: { paths: ["/accountId"] } } });
  container.item.mockReset().mockReturnValue(item);
  item.read.mockReset().mockResolvedValue({ resource: stored(), etag: ITEM_ETAG });
  item.replace.mockReset().mockResolvedValue({});
  container.items.create.mockReset().mockResolvedValue({});
  container.items.query.mockReset().mockImplementation(() => ({
    fetchAll: vi.fn().mockResolvedValue({ resources: [] }),
  }));
});

describe("account character appearance persistence", () => {
  it("round-trips appearance and preserves stage and infinite records through later saves", async () => {
    const current = useMemoryDocument(stored({ infiniteBestScore: 40, infiniteAchievedAt: NOW }));
    const repo = repository();
    const appearance = getDefaultCharacterAppearance();
    appearance.runner = { ...appearance.runner, gender: "female", hairStyle: "ponytail", hat: "cap" };
    appearance.pursuer = { ...appearance.pursuer, glasses: "round", skinTone: "deep" };
    const saved = await repo.saveAppearance(ACTOR, appearance);
    expect(saved).toMatchObject({ appearance, highestClearedStage: 0, best: { bestScore: 100 }, infiniteBest: { bestScore: 40 } });
    const clear = await repo.submit(ACTOR, submission({ score: 150, outcome: "cleared" }));
    expect(clear.appearance).toEqual(appearance);
    const infinite = await repo.submitInfiniteScore(ACTOR, { score: 99 });
    expect(infinite).toMatchObject({ appearance, highestClearedStage: 1, best: { bestScore: 150 }, infiniteBest: { bestScore: 99 } });
    expect(await repository().getProfile(ACTOR)).toEqual(infinite);
    expect(current()).toMatchObject({ appearance, schemaVersion: 1, bestScore: 150, infiniteBestScore: 99 });
    expect(JSON.stringify(saved)).not.toMatch(/_etag|_rid|_self|_ts|schemaVersion/);
    expect(container.items.query).not.toHaveBeenCalled();
  });

  it("creates an appearance-only account document and does not create it on a plain read", async () => {
    const current = useMemoryDocument();
    const repo = repository();
    expect(await repo.getProfile(ACTOR)).not.toHaveProperty("appearance");
    expect(container.items.create).not.toHaveBeenCalled();
    const appearance = getDefaultCharacterAppearance();
    expect(await repo.saveAppearance(ACTOR, appearance)).toEqual({
      ...ACTOR, highestClearedStage: 0, best: null, infiniteBest: null, appearance,
    });
    expect(current()).toEqual({
      id: getPlayerRowKey(ACTOR.accountId), ...ACTOR, schemaVersion: 1, highestClearedStage: 0, appearance,
    });
    expect(container.items.create).toHaveBeenCalledTimes(1);
    expect(item.replace).not.toHaveBeenCalled();
  });

  it("uses only the requested actor's hash and partition, then keeps another account independent", async () => {
    const other = { accountId: "employee-b", displayName: "회사원 B" };
    const appearance = getDefaultCharacterAppearance();
    item.read.mockRejectedValueOnce(itemNotFound);
    await repository().saveAppearance(other, appearance);
    expect(container.item).toHaveBeenCalledWith(getPlayerRowKey(other.accountId), other.accountId);
    expect(container.items.create).toHaveBeenCalledExactlyOnceWith({
      id: getPlayerRowKey(other.accountId), ...other, schemaVersion: 1, highestClearedStage: 0, appearance,
    });
    expect(await repository().getProfile(ACTOR)).not.toHaveProperty("appearance");
  });

  it("keeps returned values and the captured request independent from persisted objects", async () => {
    const appearance = getDefaultCharacterAppearance();
    const resource = stored({ appearance });
    item.read.mockResolvedValue({ resource, etag: ITEM_ETAG });
    const read = await repository().getProfile(ACTOR);
    read.appearance!.runner.hat = "cap";
    expect(resource.appearance?.runner.hat).toBe("none");
    const input = getDefaultCharacterAppearance();
    const saving = repository().saveAppearance(ACTOR, input);
    input.runner.hat = "cap";
    const saved = await saving;
    expect(saved.appearance?.runner.hat).toBe("none");
    // The same default was already stored: this retry needs no write.
    expect(item.replace).not.toHaveBeenCalled();
  });

  it("does not share the response appearance with the document submitted to Cosmos", async () => {
    const input = getDefaultCharacterAppearance();
    const saved = await repository().saveAppearance(ACTOR, input);
    saved.appearance!.pursuer.hat = "none";
    input.runner.hat = "cap";
    const written = item.replace.mock.calls[0][0] as PlayerDocument;
    expect(written.appearance?.pursuer.hat).toBe("straw");
    expect(written.appearance?.runner.hat).toBe("none");
  });

  it.each([undefined, null, {}, [], { version: 2 }, { ...getDefaultCharacterAppearance(), runner: { hat: "unknown" } }])(
    "omits only invalid legacy appearance without failing profile or rankings: %j", async (appearance) => {
      const document = stored({ appearance, infiniteBestScore: 50, infiniteAchievedAt: NOW });
      item.read.mockResolvedValue({ resource: document, etag: ITEM_ETAG });
      container.items.query.mockReturnValue({ fetchAll: vi.fn().mockResolvedValue({ resources: [document] }) });
      const repo = repository();
      expect(await repo.getProfile(ACTOR)).not.toHaveProperty("appearance");
      expect(await repo.listTopScores()).toHaveLength(1);
      expect(await repo.listTopInfiniteScores()).toHaveLength(1);
      expect(item.replace).not.toHaveBeenCalled();
    },
  );

  it("continues to reject corrupt scores even if appearance also needs fallback", async () => {
    item.read.mockResolvedValue({ resource: stored({ appearance: {}, bestScore: 151 }), etag: ITEM_ETAG });
    await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable" });
  });

  it.each([null, {}, { ...getDefaultCharacterAppearance(), runner: { hat: "cap" } },
    { ...getDefaultCharacterAppearance(), accountId: "other" }])("rejects an invalid save before any storage access: %j", async (appearance) => {
      await expect(repository().saveAppearance(ACTOR, appearance as CharacterAppearance))
        .rejects.toMatchObject({ code: "invalid-request", status: 400 });
      expect(container.read).not.toHaveBeenCalled();
      expect(item.read).not.toHaveBeenCalled();
      expect(item.replace).not.toHaveBeenCalled();
    });

  it("updates verified names without changing performance values or achievement times", async () => {
    item.read.mockResolvedValue({ resource: stored({ highestClearedStage: 2, infiniteBestScore: 400, infiniteAchievedAt: NOW }), etag: ITEM_ETAG });
    const renamed = { ...ACTOR, displayName: "새 이름" };
    const saved = await repository().saveAppearance(renamed, getDefaultCharacterAppearance());
    expect(saved).toMatchObject({ displayName: renamed.displayName, highestClearedStage: 2,
      best: { displayName: renamed.displayName, bestScore: 100, achievedAt: NOW },
      infiniteBest: { displayName: renamed.displayName, bestScore: 400, achievedAt: NOW } });
    expect(item.replace).toHaveBeenCalledWith(expect.objectContaining({ displayName: renamed.displayName }),
      { accessCondition: { type: "IfMatch", condition: ITEM_ETAG } });
  });

  it.each(["create", "replace"] as const)("rereads after an appearance %s conflict and preserves new game records", async (mode) => {
    const latest = stored({ highestClearedStage: 2, bestStage: 2, bestScore: 200, infiniteBestScore: 999, infiniteAchievedAt: NOW });
    if (mode === "create") {
      item.read.mockRejectedValueOnce(itemNotFound);
      container.items.create.mockRejectedValueOnce({ code: 409 });
    } else {
      item.read.mockResolvedValueOnce({ resource: stored(), etag: ITEM_ETAG });
      item.replace.mockRejectedValueOnce({ code: 412 });
    }
    item.read.mockResolvedValueOnce({ resource: latest, etag: '"latest-version"' });
    const appearance = getDefaultCharacterAppearance();
    appearance.runner.hat = "cap";
    const saved = await repository().saveAppearance(ACTOR, appearance);
    expect(saved).toMatchObject({ appearance, highestClearedStage: 2, best: { bestStage: 2, bestScore: 200 }, infiniteBest: { bestScore: 999 } });
    expect(item.replace).toHaveBeenLastCalledWith(expect.objectContaining({
      appearance, highestClearedStage: 2, bestStage: 2, bestScore: 200, infiniteBestScore: 999,
    }), { accessCondition: { type: "IfMatch", condition: '"latest-version"' } });
  });

  it.each(["stage", "infinite"] as const)("preserves a newly committed appearance after a %s score write conflict", async (mode) => {
    const previous = getDefaultCharacterAppearance();
    const latest = getDefaultCharacterAppearance();
    latest.pursuer.hat = "cap";
    item.read.mockResolvedValueOnce({ resource: stored({ appearance: previous }), etag: ITEM_ETAG })
      .mockResolvedValueOnce({ resource: stored({ appearance: latest }), etag: '"new-appearance"' });
    item.replace.mockRejectedValueOnce({ code: 412 });
    const repo = repository();
    const saved = mode === "stage" ? await repo.submit(ACTOR, submission({ score: 101 }))
      : await repo.submitInfiniteScore(ACTOR, { score: 999 });
    expect(saved.appearance).toEqual(latest);
    expect(item.replace).toHaveBeenLastCalledWith(expect.objectContaining({ appearance: latest }),
      { accessCondition: { type: "IfMatch", condition: '"new-appearance"' } });
  });

  it.each(["create", "replace"] as const)("bounds appearance %s conflicts to five attempts", async (mode) => {
    if (mode === "create") {
      item.read.mockRejectedValue(itemNotFound);
      container.items.create.mockRejectedValue({ code: 409 });
    } else item.replace.mockRejectedValue({ code: 412 });
    await expect(repository().saveAppearance(ACTOR, getDefaultCharacterAppearance()))
      .rejects.toMatchObject({ code: "conflict", status: 409 });
    expect(item.read).toHaveBeenCalledTimes(5);
    expect(mode === "create" ? container.items.create : item.replace).toHaveBeenCalledTimes(5);
  });

  it("maps appearance read and write failures to fixed public errors", async () => {
    const repo = repository();
    item.read.mockRejectedValueOnce(new Error("private-read-key"));
    await expect(repo.saveAppearance(ACTOR, getDefaultCharacterAppearance()))
      .rejects.toMatchObject({ code: "storage-unavailable", status: 503 });
    item.replace.mockRejectedValueOnce(new Error("private-write-key"));
    await expect(repo.saveAppearance(ACTOR, getDefaultCharacterAppearance()))
      .rejects.toMatchObject({ code: "storage-unavailable", status: 503 });
  });
});

describe("Cosmos player repository", () => {
  it("uses a deterministic hash as the stable document ID", () => {
    const id = getPlayerRowKey("guest/id?#account");
    expect(id).toMatch(/^p_[a-f0-9]{64}$/);
    expect(id).toBe(getPlayerRowKey("guest/id?#account"));
    expect(id).not.toBe(getPlayerRowKey("another-user"));
  });

  it.each([itemNotFound, { code: 404 }])(
    "returns a new profile only when the verified container has no matching item: %j", async (error) => {
      item.read.mockRejectedValueOnce(error);
      expect(await repository().getProfile(ACTOR)).toEqual({ ...ACTOR, highestClearedStage: 0, best: null, infiniteBest: null });
      expect(container.read).toHaveBeenCalledExactlyOnceWith();
      expect(container.item).toHaveBeenCalledExactlyOnceWith(getPlayerRowKey(ACTOR.accountId), ACTOR.accountId);
      expect(container.items.create).not.toHaveBeenCalled();
    },
  );

  it("treats the SDK's resolved 404 response with no resource as a missing item", async () => {
    item.read.mockResolvedValueOnce({ statusCode: 404 });
    expect(await repository().getProfile(ACTOR)).toEqual({ ...ACTOR, highestClearedStage: 0, best: null, infiniteBest: null });
    expect(container.items.create).not.toHaveBeenCalled();
  });

  it("checks the configured container once and fails closed when it is missing", async () => {
    container.read.mockRejectedValueOnce({ statusCode: 404, code: "NotFound" });
    await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable", status: 503 });
    expect(container.item).not.toHaveBeenCalled();
  });

  it("fails closed when the configured container uses a different partition key", async () => {
    container.read.mockResolvedValueOnce({ resource: { id: CONTAINER_ID, partitionKey: { paths: ["/id"] } } });
    await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable", status: 503 });
    expect(container.item).not.toHaveBeenCalled();
  });

  it.each([
    { statusCode: 404, code: "ContainerNotFound" },
    { statusCode: 403, code: "Forbidden" },
    { statusCode: 429, code: "TooManyRequests" },
    new Error("AccountKey=private"),
  ])("does not treat a container or service failure as an empty profile: %j", async (error) => {
    item.read.mockRejectedValueOnce(error);
    await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable", status: 503 });
  });

  it("maps the stored item to public profile fields and reuses the container readiness check", async () => {
    const repo = repository();
    expect(await repo.getProfile(ACTOR)).toEqual({
      ...ACTOR,
      highestClearedStage: 0,
      best: { ...ACTOR, bestStage: 1, bestScore: 100, remainingTimeCs: 6000, achievedAt: NOW },
      infiniteBest: null,
    });
    await repo.getProfile(ACTOR);
    expect(container.read).toHaveBeenCalledExactlyOnceWith();
    expect(container.item).toHaveBeenCalledWith(getPlayerRowKey(ACTOR.accountId), ACTOR.accountId);
  });

  it.each([
    { id: "someone-else" }, { schemaVersion: 2 }, { accountId: "" }, { displayName: " " },
    { displayName: "x".repeat(201) }, { highestClearedStage: 6 }, { bestStage: 6 },
    { bestScore: 151 }, { bestScore: -1 }, { remainingTimeCs: 9001 },
    { remainingTimeCs: 1.5 }, { achievedAt: "bad-time" }, { achievedAt: undefined },
    { bestStage: undefined }, { displayName: "x".repeat(201) }, { best: null },
    { infiniteBestScore: 10 }, { infiniteAchievedAt: NOW }, { infiniteBestScore: -1, infiniteAchievedAt: NOW },
    { infiniteBestScore: 1.5, infiniteAchievedAt: NOW }, { infiniteBestScore: Number.MAX_SAFE_INTEGER + 1, infiniteAchievedAt: NOW },
    { infiniteBestScore: 10, infiniteAchievedAt: "bad-time" },
  ])("fails closed on corrupt persisted documents: %j", async (overrides) => {
    item.read.mockResolvedValueOnce({ resource: stored(overrides), etag: ITEM_ETAG });
    await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable" });
  });

  it("accepts no best-result fields but rejects a partially written best tuple", async () => {
    const noBest = stored();
    for (const key of ["bestStage", "bestScore", "remainingTimeCs", "achievedAt"]) {
      delete noBest[key as keyof PlayerDocument];
    }
    item.read.mockResolvedValueOnce({ resource: noBest, etag: ITEM_ETAG });
    expect(await repository().getProfile(ACTOR)).toEqual({ ...ACTOR, highestClearedStage: 0, best: null, infiniteBest: null });
    item.read.mockResolvedValueOnce({ resource: { ...noBest, bestScore: 10 }, etag: ITEM_ETAG });
    await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable" });
  });

  it("writes an infinite best without changing the stage best or clear progress", async () => {
    item.read.mockResolvedValueOnce({ resource: stored({ highestClearedStage: 2 }), etag: ITEM_ETAG });
    const saved = await repository().submitInfiniteScore(ACTOR, { score: 321 });
    expect(saved).toMatchObject({ highestClearedStage: 2, best: { bestScore: 100 }, infiniteBest: { bestScore: 321, achievedAt: NOW } });
    expect(item.replace).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      highestClearedStage: 2, bestScore: 100, infiniteBestScore: 321, infiniteAchievedAt: NOW,
    }), { accessCondition: { type: "IfMatch", condition: ITEM_ETAG } });
  });

  it("keeps a higher infinite score and its original time on lower or equal retries", async () => {
    item.read.mockResolvedValue({ resource: stored({ infiniteBestScore: 400, infiniteAchievedAt: NOW }), etag: ITEM_ETAG });
    const repo = repository();
    expect((await repo.submitInfiniteScore(ACTOR, { score: 300 })).infiniteBest?.bestScore).toBe(400);
    expect((await repo.submitInfiniteScore(ACTOR, { score: 400 })).infiniteBest?.achievedAt).toBe(NOW);
    expect(item.replace).not.toHaveBeenCalled();
  });

  it("queries the separate top-ten infinite list and excludes stage-only rows", async () => {
    const entries = Array.from({ length: 12 }, (_, score) => stored({
      accountId: `infinite-${score}`, id: getPlayerRowKey(`infinite-${score}`), displayName: `P${score}`,
      infiniteBestScore: score, infiniteAchievedAt: NOW,
    }));
    container.items.query.mockReturnValue({ fetchAll: vi.fn().mockResolvedValue({ resources: [stored(), ...entries] }) });
    expect((await repository().listTopInfiniteScores()).map((entry) => entry.bestScore)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    expect(container.items.query).toHaveBeenCalledWith({
      query: "SELECT TOP 10 * FROM c WHERE IS_DEFINED(c.infiniteBestScore) ORDER BY c.infiniteBestScore DESC, c.infiniteAchievedAt ASC, c.accountId ASC",
    }, { maxItemCount: 10 });
  });

  it.each([undefined, "", " * ", "*"])("rejects a missing or unsafe response ETag: %j", async (etag) => {
    item.read.mockResolvedValueOnce({ resource: stored(), etag });
    await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable" });
  });

  it("creates one item with the account partition key and without null best fields", async () => {
    item.read.mockRejectedValueOnce(itemNotFound);
    const saved = await repository().submit(ACTOR, submission({ score: 150, outcome: "cleared" }));
    expect(saved.highestClearedStage).toBe(1);
    expect(container.items.create).toHaveBeenCalledExactlyOnceWith({
      id: getPlayerRowKey(ACTOR.accountId),
      accountId: ACTOR.accountId,
      schemaVersion: 1,
      displayName: ACTOR.displayName,
      highestClearedStage: 1,
      bestStage: 1,
      bestScore: 150,
      remainingTimeCs: 6000,
      achievedAt: NOW,
    });
    expect(item.replace).not.toHaveBeenCalled();
  });

  it("uses the stored ETag for a conditional replace and keeps the best tuple together", async () => {
    await repository().submit(ACTOR, submission({ score: 120, remainingTimeCs: 100 }));
    expect(item.replace).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ bestStage: 1, bestScore: 120, remainingTimeCs: 100, achievedAt: NOW }),
      { accessCondition: { type: "IfMatch", condition: ITEM_ETAG } },
    );
    expect(container.items.create).not.toHaveBeenCalled();
  });

  it("does not write unchanged or weaker results", async () => {
    await repository().submit(ACTOR, submission());
    await repository().submit(ACTOR, submission({ score: 99, remainingTimeCs: 9000 }));
    expect(item.replace).not.toHaveBeenCalled();
    expect(container.items.create).not.toHaveBeenCalled();
  });

  it("validates stage limits and the latest unlock before writing", async () => {
    await expect(repository().submit(ACTOR, submission({ stage: 2 })))
      .rejects.toMatchObject({ code: "stage-locked" });
    await expect(repository().submit(ACTOR, submission({ score: 151, outcome: "cleared" })))
      .rejects.toMatchObject({ code: "invalid-request" });
    expect(item.replace).not.toHaveBeenCalled();
  });

  it("re-reads after a create conflict and preserves a stronger committed result", async () => {
    item.read.mockRejectedValueOnce(itemNotFound).mockResolvedValueOnce({
      resource: stored({ bestScore: 120 }), etag: '"player-version-2"',
    });
    container.items.create.mockRejectedValueOnce({ code: 409 });
    expect((await repository().submit(ACTOR, submission())).best?.bestScore).toBe(120);
    expect(item.read).toHaveBeenCalledTimes(2);
    expect(container.items.create).toHaveBeenCalledTimes(1);
    expect(item.replace).not.toHaveBeenCalled();
  });

  it("re-reads and merges the latest unlock after a conditional replace conflict", async () => {
    item.read.mockResolvedValueOnce({ resource: stored(), etag: ITEM_ETAG }).mockResolvedValueOnce({
      resource: stored({ highestClearedStage: 1, bestScore: 149 }), etag: '"player-version-2"',
    });
    item.replace.mockRejectedValueOnce({ code: 412 }).mockResolvedValueOnce({});
    const saved = await repository().submit(ACTOR, submission({ score: 150, outcome: "cleared" }));
    expect(saved.highestClearedStage).toBe(1);
    expect(item.replace).toHaveBeenLastCalledWith(
      expect.objectContaining({ highestClearedStage: 1, bestScore: 150 }),
      { accessCondition: { type: "IfMatch", condition: '"player-version-2"' } },
    );
  });

  it("revalidates the submitted stage against the reread profile after a 412", async () => {
    item.read.mockResolvedValueOnce({ resource: stored({ highestClearedStage: 1 }), etag: ITEM_ETAG })
      .mockResolvedValueOnce({ resource: stored(), etag: '"player-version-2"' });
    item.replace.mockRejectedValueOnce({ code: 412 });
    await expect(repository().submit(ACTOR, submission({ stage: 2, score: 100 })))
      .rejects.toMatchObject({ code: "stage-locked" });
    expect(item.replace).toHaveBeenCalledTimes(1);
  });

  it("bounds repeated ETag conflicts to five attempts", async () => {
    item.replace.mockRejectedValue({ code: 412 });
    await expect(repository().submit(ACTOR, submission({ score: 101 })))
      .rejects.toMatchObject({ code: "conflict", status: 409 });
    expect(item.read).toHaveBeenCalledTimes(5);
    expect(item.replace).toHaveBeenCalledTimes(5);
  });

  it("maps write failures to a fixed storage-unavailable error", async () => {
    item.replace.mockRejectedValueOnce(new Error("AccountKey=private-credential"));
    await expect(repository().submit(ACTOR, submission({ score: 101 })))
      .rejects.toMatchObject({ code: "storage-unavailable", status: 503 });
  });

  it("runs the cross-partition TOP 10 query and returns only validated public profiles", async () => {
    const documents = Array.from({ length: 14 }, (_, index) => stored({
      id: getPlayerRowKey(`employee-${index}`),
      accountId: `employee-${index}`,
      displayName: `P${index}`,
      bestScore: index,
      _etag: "private-etag",
      _rid: "private-resource-id",
    }));
    const noBest: PlayerDocument = {
      id: getPlayerRowKey("no-best"), accountId: "no-best", schemaVersion: 1,
      displayName: "New employee", highestClearedStage: 0,
    };
    container.items.query.mockReturnValue({
      fetchAll: vi.fn().mockResolvedValue({ resources: [noBest, ...documents] }),
    });

    const scores = await repository().listTopScores();
    expect(scores.map((entry) => entry.bestScore)).toEqual([13, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
    expect(container.items.query).toHaveBeenCalledExactlyOnceWith({
      query: "SELECT TOP 10 * FROM c WHERE IS_DEFINED(c.bestStage) ORDER BY c.bestStage DESC, c.bestScore DESC, c.remainingTimeCs DESC, c.achievedAt ASC, c.accountId ASC",
    }, { maxItemCount: 10 });
    expect(JSON.stringify(scores)).not.toMatch(/etag|rowKey|partitionKey|schemaVersion|_rid|_self|_ts/);
  });

  it("preserves stage, score, remaining-time, then earliest-time ranking order", async () => {
    const entries = [
      stored({ accountId: "later", id: getPlayerRowKey("later"), displayName: "Later", achievedAt: "2026-10-30T04:00:00.000Z" }),
      stored({ accountId: "early", id: getPlayerRowKey("early"), displayName: "Early" }),
      stored({ accountId: "less-time", id: getPlayerRowKey("less-time"), displayName: "Less", remainingTimeCs: 5000 }),
      stored({ accountId: "higher-score", id: getPlayerRowKey("higher-score"), displayName: "Higher", bestScore: 101 }),
    ];
    container.items.query.mockReturnValue({ fetchAll: vi.fn().mockResolvedValue({ resources: entries }) });
    expect((await repository().listTopScores()).map((entry) => entry.accountId))
      .toEqual(["higher-score", "early", "later", "less-time"]);
  });

  it.each([
    {},
    { GAME_RECORDS_COSMOS_CONNECTION_STRING: "private" },
    { GAME_RECORDS_COSMOS_DATABASE: "maze-rescue" },
    { GAME_RECORDS_COSMOS_CONTAINER: "stair-climb-players" },
    { GAME_RECORDS_COSMOS_CONNECTION_STRING: "private", GAME_RECORDS_COSMOS_DATABASE: "maze-rescue", GAME_RECORDS_COSMOS_CONTAINER: "stair-climb-players" },
    { GAME_RECORDS_COSMOS_CONNECTION_STRING: "bad-connection", GAME_RECORDS_COSMOS_DATABASE: "maze-rescue", GAME_RECORDS_COSMOS_CONTAINER: "stair-climb-players" },
    { GAME_RECORDS_COSMOS_CONNECTION_STRING: "endpoint=https://example.invalid;accountkey=private", GAME_RECORDS_COSMOS_DATABASE: " ", GAME_RECORDS_COSMOS_CONTAINER: "stair-climb-players" },
    { GAME_RECORDS_COSMOS_CONNECTION_STRING: "private", GAME_RECORDS_COSMOS_DATABASE: "x".repeat(256), GAME_RECORDS_COSMOS_CONTAINER: "stair-climb-players" },
  ])("fails closed on absent or invalid Cosmos environment settings: %j", (env) => {
    expect(() => createPlayerRepositoryFromEnvironment(env)).toThrow("Company records are temporarily unavailable");
  });
});
