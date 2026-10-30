import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTOR, NOW, submission } from "../test/fixtures";
import {
  createPlayerRepository, createPlayerRepositoryFromEnvironment, getPlayerRowKey,
} from "./playerRepository";
import type { PlayerContainer, PlayerDocument } from "./playerRepository";

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
      expect(await repository().getProfile(ACTOR)).toEqual({ ...ACTOR, highestClearedStage: 0, best: null });
      expect(container.read).toHaveBeenCalledExactlyOnceWith();
      expect(container.item).toHaveBeenCalledExactlyOnceWith(getPlayerRowKey(ACTOR.accountId), ACTOR.accountId);
      expect(container.items.create).not.toHaveBeenCalled();
    },
  );

  it("treats the SDK's resolved 404 response with no resource as a missing item", async () => {
    item.read.mockResolvedValueOnce({ statusCode: 404 });
    expect(await repository().getProfile(ACTOR)).toEqual({ ...ACTOR, highestClearedStage: 0, best: null });
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
    expect(await repository().getProfile(ACTOR)).toEqual({ ...ACTOR, highestClearedStage: 0, best: null });
    item.read.mockResolvedValueOnce({ resource: { ...noBest, bestScore: 10 }, etag: ITEM_ETAG });
    await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable" });
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
