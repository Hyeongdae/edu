import { randomUUID } from "node:crypto";
import type { Container } from "@azure/cosmos";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPlayerRepository, getPlayerRowKey } from "../src/playerRepository";
import type { PlayerContainer, PlayerDocument } from "../src/playerRepository";
import { NOW, submission } from "./fixtures";
import { createCosmosEmulatorHarness, holdFirstItemReadsTogether } from "./cosmosEmulatorHarness";
import { getDefaultCharacterAppearance, normalizeCharacterAppearance } from "../../shared/characterAppearance";
import { getDefaultCharacterAppearance as getLegacyAppearance } from "../../shared/legacyCharacterAppearance";
import { getDefaultCharacterAppearance as getExpandedAppearance } from "../../shared/expandedCharacterAppearance";

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

function expandedDocument(owner: ReturnType<typeof actor>): PlayerDocument {
  const appearance = getExpandedAppearance();
  Object.assign(appearance.runner, { gender: "female", hairStyle: "long", eyeStyle: "smile", bag: "crossbody", bagColor: "beige" });
  Object.assign(appearance.pursuer, { hairStyle: "curly", glasses: "round", eyeStyle: "sharp", bag: "laptop", bagColor: "navy" });
  return { id: getPlayerRowKey(owner.accountId), ...owner, schemaVersion: 1,
    highestClearedStage: 1, bestStage: 2, bestScore: 80, remainingTimeCs: 4000, achievedAt: NOW,
    infiniteBestScore: 60, infiniteAchievedAt: NOW, appearance };
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
      infiniteBest: null,
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
    expect(await repository().getProfile(other)).toEqual({ ...other, highestClearedStage: 0, best: null, infiniteBest: null });
    expect(await countAccountDocuments(owner.accountId)).toBe(1);
    expect(JSON.stringify(saved)).not.toMatch(/_etag|_rid|_self|_attachments|_ts/);
  });

  it("reads a real legacy document without changing its ETag, then upgrades on an explicit save", async () => {
    const owner = actor("legacy-appearance"), appearance = getLegacyAppearance();
    appearance.runner = { ...appearance.runner, gender: "female", hairStyle: "ponytail", hat: "cap", outfitColor: "teal" };
    const document: PlayerDocument = { id: getPlayerRowKey(owner.accountId), ...owner, schemaVersion: 1,
      highestClearedStage: 0, bestStage: 1, bestScore: 100, remainingTimeCs: 6000, achievedAt: NOW,
      infiniteBestScore: 60, infiniteAchievedAt: NOW, appearance };
    await emulator.container.items.create(document);
    const item = (emulator.container as unknown as Container).item(document.id, owner.accountId);
    const before = await item.read<PlayerDocument>();
    const profile = await repository().getProfile(owner);
    const afterRead = await item.read<PlayerDocument>();
    expect(profile.appearance).toEqual(normalizeCharacterAppearance(appearance));
    expect(afterRead.etag).toBe(before.etag); expect(afterRead.resource?.appearance).toEqual(appearance);
    await repository().saveAppearance(owner, profile.appearance!);
    const upgraded = await item.read<PlayerDocument>();
    expect(upgraded.etag).not.toBe(before.etag); expect(upgraded.resource).toMatchObject({ schemaVersion: 1,
      appearance: profile.appearance, bestScore: 100, remainingTimeCs: 6000, infiniteBestScore: 60 });
    expect(upgraded.resource?.appearance?.version).toBe(3);
    expect(await repository().getProfile(owner)).toEqual(profile);
    await repository().saveAppearance(owner, profile.appearance!);
    expect((await item.read<PlayerDocument>()).etag).toBe(upgraded.etag);
    expect(await repository().getProfile(actor("legacy-other"))).not.toHaveProperty("appearance");
    expect(await countAccountDocuments(owner.accountId)).toBe(1);
  });

  it.each(["stage", "infinite"] as const)("preserves legacy choices when a real %s improvement upgrades the document", async mode => {
    const owner = actor(`legacy-${mode}`), appearance = getLegacyAppearance(); appearance.pursuer.hairStyle = "bob";
    const document: PlayerDocument = { id: getPlayerRowKey(owner.accountId), ...owner, schemaVersion: 1,
      highestClearedStage: 0, bestStage: 1, bestScore: 100, remainingTimeCs: 6000, achievedAt: NOW,
      infiniteBestScore: 60, infiniteAchievedAt: NOW, appearance };
    await emulator.container.items.create(document);
    const saved = mode === "stage" ? await repository().submit(owner, submission({ score: 101 }))
      : await repository().submitInfiniteScore(owner, { score: 61 });
    expect(saved.appearance).toEqual(normalizeCharacterAppearance(appearance));
    const raw = await (emulator.container as unknown as Container).item(document.id, owner.accountId).read<PlayerDocument>();
    expect(raw.resource).toMatchObject({ schemaVersion: 1, appearance: saved.appearance,
      bestScore: mode === "stage" ? 101 : 100, infiniteBestScore: mode === "infinite" ? 61 : 60 });
    expect(raw.resource?.appearance?.version).toBe(3);
  });

  it("preserves a real v2 document on GET then writes its identical normalized appearance exactly once", async () => {
    const owner = actor("expanded-read"), document = expandedDocument(owner);
    await emulator.container.items.create(document);
    const item = (emulator.container as unknown as Container).item(document.id, owner.accountId);
    const before = await item.read<PlayerDocument>();
    const profile = await repository().getProfile(owner);
    const read = await item.read<PlayerDocument>();
    expect(profile.appearance).toEqual(normalizeCharacterAppearance(document.appearance));
    expect(profile.appearance).toMatchObject({ version: 3, runner: { bottoms: "trousers", bottomsColor: "navy" } });
    expect(read.etag).toBe(before.etag); expect(read.resource?.appearance).toEqual(document.appearance);
    await repository().saveAppearance(owner, profile.appearance!);
    const written = await item.read<PlayerDocument>();
    expect(written.etag).not.toBe(read.etag);
    expect(written.resource).toMatchObject({ ...document, appearance: profile.appearance });
    await repository().saveAppearance(owner, profile.appearance!);
    expect((await item.read<PlayerDocument>()).etag).toBe(written.etag);
    expect(await repository().getProfile(owner)).toEqual(profile);
  });

  it.each(["stage", "infinite"] as const)("keeps v2 unchanged for a real %s no-op and preserves it on improvement", async mode => {
    const owner = actor(`expanded-${mode}`), document = expandedDocument(owner);
    await emulator.container.items.create(document);
    const item = (emulator.container as unknown as Container).item(document.id, owner.accountId);
    const before = await item.read<PlayerDocument>();
    const repo = repository();
    const unchanged = mode === "stage" ? await repo.submit(owner, submission({ stage: 2, score: 80, remainingTimeCs: 4000 }))
      : await repo.submitInfiniteScore(owner, { score: 60 });
    const afterNoOp = await item.read<PlayerDocument>();
    expect(unchanged.appearance).toEqual(normalizeCharacterAppearance(document.appearance));
    expect(afterNoOp.etag).toBe(before.etag); expect(afterNoOp.resource?.appearance).toEqual(document.appearance);
    const updated = mode === "stage" ? await repo.submit(owner, submission({ stage: 2, score: 81, remainingTimeCs: 4000 }))
      : await repo.submitInfiniteScore(owner, { score: 61 });
    const afterWrite = await item.read<PlayerDocument>();
    expect(afterWrite.etag).not.toBe(before.etag);
    expect(afterWrite.resource).toMatchObject({ schemaVersion: 1, highestClearedStage: 1,
      bestStage: 2, bestScore: mode === "stage" ? 81 : 80, remainingTimeCs: 4000,
      infiniteBestScore: mode === "infinite" ? 61 : 60, appearance: updated.appearance });
    expect(updated.appearance).toEqual(unchanged.appearance);
    expect(afterWrite.resource?.appearance?.version).toBe(3);
  });

  it("round-trips an appearance-only account through a fresh repository and isolates another actor", async () => {
    const owner = actor("appearance-owner");
    const other = actor("appearance-other");
    const appearance = getDefaultCharacterAppearance();
    appearance.runner = { ...appearance.runner, hat: "beanie", hairStyle: "long", eyeStyle: "round", bag: "backpack", bagColor: "navy", bottoms: "skirt", bottomsColor: "beige" };
    appearance.pursuer = { ...appearance.pursuer, glasses: "round", eyeStyle: "sharp", bag: "briefcase", bagColor: "brown", bottoms: "shorts", bottomsColor: "white" };
    const saved = await repository().saveAppearance(owner, appearance);
    expect(saved).toEqual({ ...owner, highestClearedStage: 0, best: null, infiniteBest: null, appearance });
    expect(await repository().getProfile(owner)).toEqual(saved);
    expect(await repository().getProfile(other)).not.toHaveProperty("appearance");
    await repository().saveAppearance(owner, appearance);
    expect(await countAccountDocuments(owner.accountId)).toBe(1);
  });

  it("preserves appearance and both scores across concurrent real 409 creates", async () => {
    const owner = actor("appearance-create-race");
    const shared = holdFirstItemReadsTogether(emulator.container as unknown as Container, 3);
    const appearance = getDefaultCharacterAppearance();
    appearance.runner = { ...appearance.runner, gender: "female", hairStyle: "long", eyeStyle: "smile", bag: "crossbody", bagColor: "navy", bottoms: "skirt", bottomsColor: "beige" };
    await Promise.all([
      repository(shared).saveAppearance(owner, appearance),
      repository(shared).submit(owner, submission({ score: 150, outcome: "cleared", remainingTimeCs: 100 })),
      repository(shared).submitInfiniteScore(owner, { score: 123 }),
    ]);
    expect(await repository().getProfile(owner)).toMatchObject({
      appearance, highestClearedStage: 1, best: { bestScore: 150, remainingTimeCs: 100 }, infiniteBest: { bestScore: 123 },
    });
    expect(await countAccountDocuments(owner.accountId)).toBe(1);
  });

  it("preserves the newest appearance and records across concurrent real 412 replacements", async () => {
    const owner = actor("appearance-update-race");
    const initial = repository();
    await initial.saveAppearance(owner, getDefaultCharacterAppearance());
    await initial.submit(owner, submission({ score: 100 }));
    await initial.submitInfiniteScore(owner, { score: 50 });
    const shared = holdFirstItemReadsTogether(emulator.container as unknown as Container, 3);
    const appearance = getDefaultCharacterAppearance();
    appearance.pursuer = { ...appearance.pursuer, hat: "beret", skinTone: "deep", eyeStyle: "sleepy", bag: "laptop", bagColor: "beige", bottoms: "jeans", bottomsColor: "white" };
    await Promise.all([
      repository(shared).saveAppearance(owner, appearance),
      repository(shared).submit(owner, submission({ score: 150, outcome: "cleared", remainingTimeCs: 100 })),
      repository(shared).submitInfiniteScore(owner, { score: 123 }),
    ]);
    expect(await repository().getProfile(owner)).toMatchObject({
      appearance, highestClearedStage: 1, best: { bestScore: 150, remainingTimeCs: 100 }, infiniteBest: { bestScore: 123 },
    });
    expect(await countAccountDocuments(owner.accountId)).toBe(1);
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
