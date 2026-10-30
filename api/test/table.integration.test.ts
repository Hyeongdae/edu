import { randomUUID } from "node:crypto";
import type { GetTableEntityOptions, TableClient } from "@azure/data-tables";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlayerRepository, getPlayerRowKey } from "../src/playerRepository";
import { ACTOR, NOW, submission } from "./fixtures";
import { startAzurite } from "./azuriteHarness";

let emulator: Awaited<ReturnType<typeof startAzurite>>;
let a: TableClient;
let b: TableClient;

beforeAll(async () => { emulator = await startAzurite(); });
afterAll(async () => { await emulator?.stop(); });
beforeEach(async () => {
  const name = "Players" + randomUUID().replaceAll("-", "");
  a = emulator.client(name);
  b = emulator.client(name);
  await a.createTable();
});

function repo(client: TableClient, timestamp = NOW, pageSize = 100) {
  return createPlayerRepository(client, { now: () => new Date(timestamp), pageSize });
}

/** Force both independent clients to read the same version before either can write. */
function holdFirstReadsTogether(first: TableClient, second: TableClient) {
  let release!: () => void;
  const both = new Promise<void>((accept) => { release = accept; });
  let arrivals = 0;
  return [first, second].map((client) => {
    const original = client.getEntity.bind(client);
    return vi.spyOn(client, "getEntity").mockImplementationOnce(async function<T extends object>(
      partition: string, row: string, options?: GetTableEntityOptions,
    ) {
      try {
        return await original<T>(partition, row, options);
      } finally {
        if (++arrivals === 2) release();
        await both;
      }
    });
  });
}

describe("real isolated Table Storage SDK operations", () => {
  it("reports the service code separately from the SDK transport code for a missing entity", async () => {
    try {
      await a.getEntity("descent-v1", getPlayerRowKey(ACTOR.accountId));
      throw new Error("Expected the entity to be absent.");
    } catch (failure) {
      const error = failure as { code?: string; statusCode?: number; details?: Record<string, unknown> };
      expect(error.statusCode).toBe(404);
      expect(error.details).toMatchObject({ odataError: { code: "ResourceNotFound" } });
    }
  });
  it("starts empty, saves a real snapshot and restores the same account from an independent client", async () => {
    expect(await repo(a).getProfile(ACTOR)).toEqual({ ...ACTOR, highestClearedStage: 0, best: null });
    expect(await repo(a).listTopScores()).toEqual([]);
    const saved = await repo(a).submit(ACTOR, submission({ score: 150, outcome: "cleared" }));
    expect(saved.highestClearedStage).toBe(1);
    expect(await repo(b).getProfile(ACTOR)).toEqual(saved);
    expect(await repo(b).getProfile({ accountId: "another-employee", displayName: "B" }))
      .toMatchObject({ highestClearedStage: 0, best: null });
  });

  it("handles a deterministic simultaneous create409 without losing a clear or making duplicate rows", async () => {
    const reads = holdFirstReadsTogether(a, b);
    const creates = [vi.spyOn(a, "createEntity"), vi.spyOn(b, "createEntity")];
    await Promise.all([
      repo(a).submit(ACTOR, submission({ score: 151, outcome: "cleared", remainingTimeCs: 100 })),
      repo(b).submit(ACTOR, submission({ score: 100, remainingTimeCs: 8000 })),
    ]);
    const saved = await repo(a).getProfile(ACTOR);
    expect(saved).toMatchObject({ highestClearedStage: 1, best: { bestScore: 151, remainingTimeCs: 100 } });
    expect(creates.reduce((count, spy) => count + spy.mock.calls.length, 0)).toBe(2);
    expect(reads.reduce((count, spy) => count + spy.mock.calls.length, 0)).toBeGreaterThanOrEqual(3);
    const rows = [];
    for await (const row of a.listEntities()) rows.push(row);
    expect(rows).toHaveLength(1);
  });

  it("handles simultaneous updates with real412 and preserves the strongest whole tuple and clear", async () => {
    await repo(a).submit(ACTOR, submission({ score: 10 }));
    const reads = holdFirstReadsTogether(a, b);
    const writes = [vi.spyOn(a, "updateEntity"), vi.spyOn(b, "updateEntity")];
    await Promise.all([
      repo(a).submit(ACTOR, submission({ score: 150, outcome: "cleared", remainingTimeCs: 1 })),
      repo(b).submit(ACTOR, submission({ score: 149, remainingTimeCs: 8000 })),
    ]);
    expect(await repo(b).getProfile(ACTOR)).toMatchObject({
      highestClearedStage: 1, best: { bestStage: 1, bestScore: 150, remainingTimeCs: 1 },
    });
    expect(reads.reduce((count, spy) => count + spy.mock.calls.length, 0)).toBeGreaterThanOrEqual(3);
    expect(writes.reduce((count, spy) => count + spy.mock.calls.length, 0)).toBeGreaterThanOrEqual(2);
    for (const spy of writes) {
      for (const call of spy.mock.calls) {
        expect(call[1]).toBe("Replace");
        expect(call[2]?.etag).toBeTruthy();
        expect(call[2]?.etag).not.toBe("*");
      }
    }
  });

  it("rejects a stale ETag at the actual service and succeeds after rereading", async () => {
    await repo(a).submit(ACTOR, submission());
    const stale = await a.getEntity("descent-v1", getPlayerRowKey(ACTOR.accountId));
    await repo(b).submit(ACTOR, submission({ score: 101 }));
    await expect(a.updateEntity({ ...stale, partitionKey: "descent-v1", rowKey: getPlayerRowKey(ACTOR.accountId), bestScore: 102 },
      "Replace", { etag: stale.etag })).rejects.toMatchObject({ statusCode: 412 });
    expect((await repo(a).submit(ACTOR, submission({ score: 102 }))).best?.bestScore).toBe(102);
  });

  it("replays an unacknowledged committed result without replacing timestamp, ETag or row", async () => {
    const snapshot = submission({ score: 153, outcome: "cleared" });
    const first = await repo(a).submit(ACTOR, snapshot);
    const version = (await a.getEntity("descent-v1", getPlayerRowKey(ACTOR.accountId))).etag;
    const writes = vi.spyOn(b, "updateEntity");
    const replay = await repo(b, "2026-10-30T04:00:00.000Z").submit(ACTOR, snapshot);
    expect(replay).toEqual(first);
    expect(writes).not.toHaveBeenCalled();
    expect((await a.getEntity("descent-v1", getPlayerRowKey(ACTOR.accountId))).etag).toBe(version);
  });

  it("ranks a failed second-stage attempt without unlocking stage three", async () => {
    await repo(a).submit(ACTOR, submission({ score: 150, outcome: "cleared" }));
    const saved = await repo(b).submit(ACTOR, submission({ stage: 2, score: 80 }));
    expect(saved).toMatchObject({ highestClearedStage: 1, best: { bestStage: 2, bestScore: 80 } });
    await expect(repo(a).submit(ACTOR, submission({ stage: 3, score: 10 }))).rejects.toMatchObject({ code: "stage-locked" });
    expect((await repo(a).getProfile(ACTOR)).highestClearedStage).toBe(1);
  });

  it("scans real continuation pages beyond ten rows and excludes unrelated partitions/keys", async () => {
    for (let score = 0; score < 14; score++) {
      await repo(a).submit({ accountId: `rank-${score}`, displayName: `P${score}` }, submission({ score }));
    }
    await a.createEntity({ partitionKey: "not-this-game", rowKey: "p_ignored", secretTestField: "not-a-player" });
    await a.createEntity({ partitionKey: "descent-v1", rowKey: "metadata", secretTestField: "not-a-player" });
    let pageCount = 0;
    for await (const page of a.listEntities({ queryOptions: { filter: "PartitionKey eq 'descent-v1' and RowKey ge 'p_' and RowKey lt 'p`'" } })
      .byPage({ maxPageSize: 3 })) {
      expect(page.length).toBeLessThanOrEqual(3);
      pageCount++;
    }
    expect(pageCount).toBeGreaterThanOrEqual(5);
    const top = await repo(b, NOW, 3).listTopScores();
    expect(top.map((entry) => entry.bestScore)).toEqual([13, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
    expect(JSON.stringify(top)).not.toMatch(/rowKey|partitionKey|secretTestField|etag/);
  });

  it("uses stage, score, time and earliest server achievement in shared order", async () => {
    const early = { accountId: "early", displayName: "Early" };
    const late = { accountId: "late", displayName: "Late" };
    const lessTime = { accountId: "less-time", displayName: "Less" };
    await repo(a).submit(early, submission({ remainingTimeCs: 6001 }));
    await repo(a, "2026-10-30T04:00:00.000Z").submit(late, submission({ remainingTimeCs: 6001 }));
    await repo(a).submit(lessTime, submission());
    await repo(a).submit(ACTOR, submission({ score: 150, outcome: "cleared" }));
    await repo(a).submit(ACTOR, submission({ stage: 2, score: 1, remainingTimeCs: 1 }));
    expect((await repo(b).listTopScores()).map((entry) => entry.accountId))
      .toEqual([ACTOR.accountId, early.accountId, late.accountId, lessTime.accountId]);
  });

  it("returns503 rather than an empty profile when the actual table is absent", async () => {
    const missing = emulator.client("Players" + randomUUID().replaceAll("-", ""));
    await expect(repo(missing).getProfile(ACTOR)).rejects.toMatchObject({ code: "storage-unavailable", status: 503 });
  });
});
