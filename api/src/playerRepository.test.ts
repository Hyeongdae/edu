import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTOR, NOW, submission } from "../test/fixtures";
import {
  createPlayerRepository, createPlayerRepositoryFromEnvironment, getPlayerRowKey,
} from "./playerRepository";
import type { PlayerTable } from "./playerRepository";

const entityMissing = { statusCode: 404, code: "ResourceNotFound" };
const table = {
  getEntity: vi.fn(), createEntity: vi.fn(), updateEntity: vi.fn(), listEntities: vi.fn(),
};

function stored(overrides: Record<string, unknown> = {}) {
  return {
    partitionKey: "descent-v1", rowKey: getPlayerRowKey(ACTOR.accountId), schemaVersion: 1,
    ...ACTOR, highestClearedStage: 0, bestStage: 1, bestScore: 100, remainingTimeCs: 6000,
    achievedAt: NOW, etag: 'W/"first-version"', ...overrides,
  };
}

function repository() {
  return createPlayerRepository(table as unknown as PlayerTable, { now: () => new Date(NOW) });
}

beforeEach(() => {
  table.getEntity.mockReset().mockResolvedValue(stored());
  table.createEntity.mockReset().mockResolvedValue({});
  table.updateEntity.mockReset().mockResolvedValue({});
  table.listEntities.mockReset();
});

describe("private player repository", () => {
  it("hashes the full platform ID into a deterministic safe row key", () => {
    const key = getPlayerRowKey("guest/id?#会社員");
    expect(key).toMatch(/^p_[a-f0-9]{64}$/);
    expect(key).toBe(getPlayerRowKey("guest/id?#会社員"));
    expect(key).not.toBe(getPlayerRowKey("another-user"));
  });

  it.each([entityMissing, { statusCode: 404, details: { odataError: { code: "ResourceNotFound" } } }])(
    "returns a new account without creating any row for supported SDK missing-entity codes", async (failure) => {
    table.getEntity.mockRejectedValueOnce(failure);
    expect(await repository().getProfile(ACTOR)).toEqual({ ...ACTOR, highestClearedStage: 0, best: null });
    expect(table.createEntity).not.toHaveBeenCalled();
    expect(table.getEntity).toHaveBeenCalledWith("descent-v1", getPlayerRowKey(ACTOR.accountId));
  });

  it.each([{ statusCode: 404, code: "TableNotFound" },
    { statusCode: 404, details: { odataError: { code: "TableNotFound" } } },
    { statusCode: 404 }, new Error("AccountKey=private")])(
    "never treats a missing table or unknown storage failure as a fresh account: %j", async (error) => {
      table.getEntity.mockRejectedValueOnce(error);
      await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable" });
      expect(table.createEntity).not.toHaveBeenCalled();
    },
  );

  it("maps a valid entity to public profile fields without ETag or storage keys", async () => {
    expect(await repository().getProfile(ACTOR)).toEqual({
      ...ACTOR, highestClearedStage: 0,
      best: { ...ACTOR, bestStage: 1, bestScore: 100, remainingTimeCs: 6000, achievedAt: NOW },
    });
  });

  it.each([
    { schemaVersion: 2 }, { rowKey: "someone-else" }, { partitionKey: "wrong" },
    { accountId: "other" }, { highestClearedStage: 6 }, { bestStage: 6 }, { bestScore: 154 },
    { bestScore: 150 }, { bestScore: -1 }, { remainingTimeCs: 9001 }, { remainingTimeCs: 1.5 },
    { achievedAt: "bad-time" }, { achievedAt: undefined }, { etag: undefined }, { etag: "*" }, { etag: " * " },
    { bestStage: 3 }, { displayName: "x".repeat(201) },
  ])("fails closed on corrupt persisted data: %j", async (overrides) => {
    table.getEntity.mockResolvedValueOnce(stored(overrides));
    await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable" });
  });

  it("accepts a fully absent best but rejects partial best columns", async () => {
    const noBest = stored();
    for (const key of ["bestStage", "bestScore", "remainingTimeCs", "achievedAt"]) {
      delete (noBest as Record<string, unknown>)[key];
    }
    table.getEntity.mockResolvedValueOnce(noBest);
    expect(await repository().getProfile(ACTOR)).toEqual({ ...ACTOR, highestClearedStage: 0, best: null });
    table.getEntity.mockResolvedValueOnce({ ...noBest, bestScore: 10 });
    await expect(repository().getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable" });
  });

  it("creates a result and clear as one entity, without a client timestamp or submission receipt", async () => {
    table.getEntity.mockRejectedValueOnce(entityMissing);
    const saved = await repository().submit(ACTOR, submission({ score: 153, outcome: "cleared" }));
    expect(saved.highestClearedStage).toBe(1);
    expect(table.createEntity).toHaveBeenCalledExactlyOnceWith({
      partitionKey: "descent-v1", rowKey: getPlayerRowKey(ACTOR.accountId), schemaVersion: 1,
      ...ACTOR, highestClearedStage: 1, bestStage: 1, bestScore: 153, remainingTimeCs: 6000, achievedAt: NOW,
    });
    expect(table.updateEntity).not.toHaveBeenCalled();
  });

  it("updates with the exact read ETag and Replace, keeping the complete new tuple", async () => {
    await repository().submit(ACTOR, submission({ score: 120, remainingTimeCs: 100 }));
    expect(table.updateEntity).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ bestScore: 120, remainingTimeCs: 100, achievedAt: NOW }),
      "Replace", { etag: 'W/"first-version"' },
    );
    expect(table.createEntity).not.toHaveBeenCalled();
  });

  it("does not write unchanged or weaker performance", async () => {
    await repository().submit(ACTOR, submission());
    await repository().submit(ACTOR, submission({ score: 99, remainingTimeCs: 9000 }));
    expect(table.updateEntity).not.toHaveBeenCalled();
    expect(table.createEntity).not.toHaveBeenCalled();
  });

  it("validates stage bounds and actual unlocks before attempting a write", async () => {
    await expect(repository().submit(ACTOR, submission({ stage: 2 }))).rejects.toMatchObject({ code: "stage-locked" });
    await expect(repository().submit(ACTOR, submission({ score: 154, outcome: "cleared" })))
      .rejects.toMatchObject({ code: "invalid-request" });
    expect(table.updateEntity).not.toHaveBeenCalled();
  });

  it("rereads after a create409 race and retains a stronger committed result", async () => {
    table.getEntity.mockRejectedValueOnce(entityMissing).mockResolvedValueOnce(stored({ bestScore: 120 }));
    table.createEntity.mockRejectedValueOnce({ statusCode: 409 });
    expect((await repository().submit(ACTOR, submission())).best?.bestScore).toBe(120);
    expect(table.getEntity).toHaveBeenCalledTimes(2);
    expect(table.createEntity).toHaveBeenCalledTimes(1);
    expect(table.updateEntity).not.toHaveBeenCalled();
  });

  it("rereads and recomputes using a new exact ETag after412 without losing a concurrent clear", async () => {
    table.getEntity.mockResolvedValueOnce(stored()).mockResolvedValueOnce(stored({
      highestClearedStage: 1, etag: 'W/"new-version"', bestScore: 150,
    }));
    table.updateEntity.mockRejectedValueOnce({ statusCode: 412 }).mockResolvedValueOnce({});
    const saved = await repository().submit(ACTOR, submission({ score: 151, outcome: "cleared" }));
    expect(saved.highestClearedStage).toBe(1);
    expect(table.updateEntity).toHaveBeenLastCalledWith(
      expect.objectContaining({ highestClearedStage: 1, bestScore: 151 }), "Replace", { etag: 'W/"new-version"' },
    );
  });

  it("validates the reread profile rather than reusing an earlier unlock decision", async () => {
    table.getEntity.mockResolvedValueOnce(stored({ highestClearedStage: 1 })).mockResolvedValueOnce(stored());
    table.updateEntity.mockRejectedValueOnce({ statusCode: 412 });
    await expect(repository().submit(ACTOR, submission({ stage: 2, score: 100 })))
      .rejects.toMatchObject({ code: "stage-locked" });
    expect(table.updateEntity).toHaveBeenCalledTimes(1);
  });

  it("bounds repeated stale updates to five attempts and returns retryable conflict", async () => {
    table.updateEntity.mockRejectedValue({ statusCode: 412 });
    await expect(repository().submit(ACTOR, submission({ score: 101 }))).rejects.toMatchObject({ code: "conflict", status: 409 });
    expect(table.getEntity).toHaveBeenCalledTimes(5);
    expect(table.updateEntity).toHaveBeenCalledTimes(5);
  });

  it("does not misclassify a non-concurrency write failure as a conflict", async () => {
    table.updateEntity.mockRejectedValueOnce({ statusCode: 403, message: "private credential" });
    await expect(repository().submit(ACTOR, submission({ score: 101 }))).rejects.toMatchObject({ code: "storage-unavailable" });
    expect(table.updateEntity).toHaveBeenCalledTimes(1);
  });

  it("scans every page, excludes no-best profiles and returns only bounded public top10", async () => {
    const rows = Array.from({ length: 14 }, (_, index) => stored({
      accountId: `employee-${index}`, rowKey: getPlayerRowKey(`employee-${index}`), bestScore: index,
    }));
    const noBest = { partitionKey: "descent-v1", rowKey: getPlayerRowKey("no-best"), schemaVersion: 1,
      accountId: "no-best", displayName: "new account", highestClearedStage: 0 };
    table.listEntities.mockReturnValue({ byPage: () => (async function* () {
      yield [noBest, ...rows.slice(0, 3)];
      yield rows.slice(3, 9);
      yield rows.slice(9);
    })() });
    const top = await repository().listTopScores();
    expect(top.map((entry) => entry.bestScore)).toEqual([13, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
    expect(JSON.stringify(top)).not.toMatch(/etag|rowKey|partitionKey|schemaVersion/);
    expect(table.listEntities).toHaveBeenCalledWith({ queryOptions: {
      filter: "PartitionKey eq 'descent-v1' and RowKey ge 'p_' and RowKey lt 'p`'",
    } });
  });

  it.each([{}, { GAME_RECORDS_CONNECTION_STRING: "private" }, { GAME_RECORDS_TABLE: "DexEscapePlayers" },
    { GAME_RECORDS_CONNECTION_STRING: "bad-connection", GAME_RECORDS_TABLE: "DexEscapePlayers" }])(
    "fails closed on absent/invalid private environment settings", (env) => {
      expect(() => createPlayerRepositoryFromEnvironment(env)).toThrow("Company records are temporarily unavailable");
    },
  );
});
