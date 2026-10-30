import { randomUUID } from "node:crypto";
import type { Container } from "@azure/cosmos";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPlayerRepository, getPlayerRowKey } from "../src/playerRepository";
import type { PlayerContainer, PlayerDocument } from "../src/playerRepository";
import { NOW, submission } from "./fixtures";
import { createCosmosEmulatorHarness, holdFirstItemReadsTogether } from "./cosmosEmulatorHarness";

let emulator: Awaited<ReturnType<typeof createCosmosEmulatorHarness>>;
let testScope = "";

beforeAll(async () => { emulator = await createCosmosEmulatorHarness(); }, 60000);
afterAll(async () => { await emulator?.close(); }, 60000);

function actor(suffix: string) {
  return { accountId: `${testScope}-${suffix}`, displayName: `Player ${suffix}` };
}

function repository(container: PlayerContainer = emulator.container, timestamp = NOW) {
  return createPlayerRepository(container, {
    now: () => new Date(timestamp),
  });
}

async function countAccountDocuments(accountId: string): Promise<number> {
  const { resources = [] } = await emulator.container.items.query<PlayerDocument>({
    query: "SELECT * FROM c WHERE c.accountId = @accountId",
    parameters: [{ name: "@accountId", value: accountId }],
  }, { maxItemCount: 10 }).fetchAll();
  return resources.length;
}

beforeEach(() => { testScope = randomUUID().replaceAll("-", ""); });

describe("real isolated Cosmos DB repository operations", () => {
  it("returns a fresh profile for a missing point read without persisting it", async () => {
    const newActor = actor("new");
    expect(await repository().getProfile(newActor)).toEqual({
      ...newActor,
      highestClearedStage: 0,
      best: null,
    });
    expect(await repository().listTopScores()).toEqual([]);
    expect(await countAccountDocuments(newActor.accountId)).toBe(0);
  });

  it("round-trips one account's saved profile through a second repository and isolates another account", async () => {
    const owner = actor("owner");
    const other = actor("other");
    const saved = await repository().submit(owner, submission({ score: 150, outcome: "cleared" }));

    expect(saved.highestClearedStage).toBe(1);
    expect(await repository().getProfile(owner)).toEqual(saved);
    expect(await repository().getProfile(other)).toEqual({ ...other, highestClearedStage: 0, best: null });
    expect(await countAccountDocuments(owner.accountId)).toBe(1);
    expect(JSON.stringify(saved)).not.toMatch(/_etag|_rid|_self|_attachments|_ts/);
  });

  it("resolves concurrent creates through the real 409 conflict without creating duplicate documents", async () => {
    const owner = actor("create-race");
    const shared = holdFirstItemReadsTogether(emulator.container as unknown as Container);
    await Promise.all([
      repository(shared).submit(owner, submission({ score: 150, outcome: "cleared", remainingTimeCs: 100 })),
      repository(shared).submit(owner, submission({ score: 100, remainingTimeCs: 8000 })),
    ]);

    expect(await repository().getProfile(owner)).toMatchObject({
      highestClearedStage: 1,
      best: { bestStage: 1, bestScore: 150, remainingTimeCs: 100 },
    });
    expect(await countAccountDocuments(owner.accountId)).toBe(1);
  });

  it("re-reads after concurrent real 412 updates and preserves the strongest whole result and unlock", async () => {
    const owner = actor("update-race");
    await repository().submit(owner, submission({ score: 10 }));
    const shared = holdFirstItemReadsTogether(emulator.container as unknown as Container);
    await Promise.all([
      repository(shared).submit(owner, submission({ score: 150, outcome: "cleared", remainingTimeCs: 1 })),
      repository(shared).submit(owner, submission({ score: 149, remainingTimeCs: 8000 })),
    ]);

    expect(await repository().getProfile(owner)).toMatchObject({
      highestClearedStage: 1,
      best: { bestStage: 1, bestScore: 150, remainingTimeCs: 1 },
    });
    expect(await countAccountDocuments(owner.accountId)).toBe(1);
  });

  it("rejects an actually stale ETag with 412, then saves after the repository rereads", async () => {
    const owner = actor("stale-etag");
    const repo = repository();
    await repo.submit(owner, submission({ score: 100 }));
    const item = emulator.container.item(getPlayerRowKey(owner.accountId), owner.accountId);
    const stale = await item.read<PlayerDocument>();
    expect(stale.resource).toBeDefined();
    expect(stale.etag).toBeTruthy();

    await repo.submit(owner, submission({ score: 101 }));
    await expect(item.replace({ ...stale.resource!, bestScore: 102 }, {
      accessCondition: { type: "IfMatch", condition: stale.etag! },
    })).rejects.toMatchObject({ code: 412 });

    expect((await repo.submit(owner, submission({ score: 102 }))).best?.bestScore).toBe(102);
  });

  it("returns 503 when the requested container is missing", async () => {
    const missingName = `Players${randomUUID().replaceAll("-", "")}`;
    const databaseId = (emulator.container as unknown as Container).database.id;
    const missingContainer = (emulator.container as unknown as Container).database.container(missingName);
    const missingRepository = createPlayerRepository(missingContainer as unknown as PlayerContainer, {
      containerId: missingName,
    });

    await expect(missingRepository.getProfile(actor("missing-container")))
      .rejects.toMatchObject({ code: "storage-unavailable", status: 503 });
    expect(databaseId).toMatch(/^test_[a-f0-9]{32}$/);
  });

  it("ranks cross-partition documents by stage, score, remaining time and timestamp/account ties", async () => {
    const profiles = repository();
    const stageThree = actor("stage-three");
    await profiles.submit(stageThree, submission({ score: 150, outcome: "cleared" }));
    await profiles.submit(stageThree, submission({ stage: 2, score: 200, outcome: "cleared" }));
    await profiles.submit(stageThree, submission({ stage: 3, score: 1, remainingTimeCs: 3000 }));

    const createStageTwo = async (suffix: string, score: number, achievedAt: string) => {
      const player = actor(suffix);
      const playerRepository = repository(emulator.container, achievedAt);
      await playerRepository.submit(player, submission({ score: 150, outcome: "cleared" }));
      await playerRepository.submit(player, submission({ stage: 2, score, remainingTimeCs: 6000 }));
    };

    await createStageTwo("rank-early", 112, NOW);
    await createStageTwo("rank-late", 112, "2026-10-30T03:00:01.000Z");
    await createStageTwo("tie-a", 112, "2026-10-30T03:00:02.000Z");
    await createStageTwo("tie-z", 112, "2026-10-30T03:00:02.000Z");
    for (let score = 103; score <= 111; score++) {
      await createStageTwo(`rank-${score}`, score, NOW);
    }

    const ranking = await profiles.listTopScores();
    expect(ranking[0]).toMatchObject({ accountId: stageThree.accountId, bestStage: 3 });
    expect(ranking.slice(1, 5).map((entry) => entry.accountId)).toEqual([
      actor("rank-early").accountId,
      actor("rank-late").accountId,
      actor("tie-a").accountId,
      actor("tie-z").accountId,
    ]);
    expect(ranking).toHaveLength(10);
    expect(ranking.map((entry) => entry.bestScore)).toEqual([1, 112, 112, 112, 112, 111, 110, 109, 108, 107]);
    expect(JSON.stringify(ranking)).not.toMatch(/_etag|_rid|_self|_attachments|_ts|schemaVersion/);
  });
});
