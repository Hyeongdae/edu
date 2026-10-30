// @vitest-environment node
import { describe, expect, it } from "vitest";
import { STAGE_RULES, getHighestUnlockedStage } from "../src/game/stageRules";
import type { ClearedStage } from "../src/game/types";
import {
  compareSharedPerformance, getSharedTopScores, isSubmitResultRequest,
  mergeSharedResult, validateResultForProfile,
} from "./companyRecords";
import type { AuthenticatedActor, ResultInput, SharedBest, SharedProfile, SubmitResultRequest } from "./companyRecords";

const FIRST_TIME = "2026-10-30T01:00:00.000Z";
const LATER_TIME = "2026-10-30T02:00:00.000Z";
const actor: AuthenticatedActor = Object.freeze({ accountId: "employee-a", displayName: "회사원 A" });
const UUID = "19b6ed4a-1afe-4d5f-872c-d9e6e903b3a1";

function result(overrides: Partial<ResultInput> = {}): ResultInput {
  return { stage: 1, score: 100, remainingTimeCs: 6000, outcome: "caught", ...overrides };
}

function request(overrides: Partial<ResultInput> = {}): SubmitResultRequest {
  return { submissionId: UUID, result: result(overrides) };
}

function best(overrides: Partial<SharedBest> = {}): SharedBest {
  return {
    accountId: actor.accountId, displayName: actor.displayName,
    bestStage: 1, bestScore: 100, remainingTimeCs: 6000, achievedAt: FIRST_TIME,
    ...overrides,
  };
}

function profile(overrides: Partial<SharedProfile> = {}): SharedProfile {
  return { ...actor, highestClearedStage: 0, best: best(), ...overrides };
}

describe("submission structural boundary", () => {
  it("accepts a JSON round trip and an uppercase UUID without any platform dependency", () => {
    expect(isSubmitResultRequest(JSON.parse(JSON.stringify(request())))).toBe(true);
    expect(isSubmitResultRequest({ ...request(), submissionId: UUID.toUpperCase() })).toBe(true);
  });

  it.each([null, undefined, [], true, "payload", 12, {}, { submissionId: UUID }, { result: result() }])(
    "rejects missing or non-object envelopes: %j", (value) => {
      expect(isSubmitResultRequest(value)).toBe(false);
    },
  );

  it.each(["", "id", UUID + "\n", " " + UUID, UUID.replaceAll("-", ""),
    "00000000-0000-0000-0000-000000000000", "19b6ed4a-1afe-4d5f-172c-d9e6e903b3a1", 1, null])(
    "rejects malformed submission IDs: %j", (submissionId) => {
      expect(isSubmitResultRequest({ ...request(), submissionId })).toBe(false);
    },
  );

  it.each(["accountId", "displayName", "tenant", "highestClearedStage", "endedAtMs", "achievedAt"])(
    "rejects client-owned or unknown %s on either object", (key) => {
      expect(isSubmitResultRequest({ ...request(), [key]: "forged" })).toBe(false);
      expect(isSubmitResultRequest({ ...request(), result: { ...result(), [key]: "forged" } })).toBe(false);
    },
  );

  it("rejects non-enumerable and symbol extras rather than checking only enumerable JSON keys", () => {
    const hidden = request();
    Object.defineProperty(hidden, "accountId", { value: "someone-else" });
    expect(isSubmitResultRequest(hidden)).toBe(false);
    expect(isSubmitResultRequest({ ...request(), [Symbol("extra")]: true })).toBe(false);
    expect(isSubmitResultRequest({ ...request(), result: { ...result(), [Symbol("extra")]: true } })).toBe(false);
  });

  it("requires own fields, not inherited required properties", () => {
    expect(isSubmitResultRequest(Object.create(request()))).toBe(false);
    expect(isSubmitResultRequest({ ...request(), result: Object.create(result()) })).toBe(false);
  });

  it.each([null, [], "result", {}, { ...result(), outcome: "quit" }, { ...result(), stage: "1" }])(
    "rejects invalid nested result shapes: %j", (nested) => {
      expect(isSubmitResultRequest({ ...request(), result: nested })).toBe(false);
    },
  );

  it.each(["stage", "score", "remainingTimeCs", "outcome"] as const)("rejects absent %s", (key) => {
    const missing: Record<string, unknown> = { ...result() };
    delete missing[key];
    expect(isSubmitResultRequest({ ...request(), result: missing })).toBe(false);
  });

  it.each(["score", "remainingTimeCs"] as const)("rejects non-safe %s numbers at the shape boundary", (key) => {
    for (const value of [-1, 0.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null, undefined]) {
      expect(isSubmitResultRequest({ ...request(), result: { ...result(), [key]: value } })).toBe(false);
    }
  });

  it("separates structurally correct requests from stage-specific validation", () => {
    const excessive = request({ score: 154, outcome: "cleared" });
    expect(isSubmitResultRequest(excessive)).toBe(true);
    expect(validateResultForProfile(excessive.result, 0)).toMatchObject({ ok: false, code: "invalid-request" });
  });
});

describe.each(STAGE_RULES)("stage $stage result limits", (rule) => {
  const highest = (rule.stage - 1) as ClearedStage;
  const valid = (overrides: Partial<ResultInput> = {}) => result({
    stage: rule.stage, score: rule.scoreRequired - 1, remainingTimeCs: rule.durationMs / 10, ...overrides,
  });

  it("accepts caught snapshots at both time boundaries without granting a clear", () => {
    expect(validateResultForProfile(valid(), highest)).toEqual({ ok: true });
    expect(validateResultForProfile(valid({ score: 0, remainingTimeCs: 0 }), highest)).toEqual({ ok: true });
  });

  it("accepts a clear at target and all possible bonus-jump overshoots", () => {
    for (const extra of [0, 1, 2, 3]) {
      expect(validateResultForProfile(valid({ score: rule.scoreRequired + extra, outcome: "cleared" }), highest))
        .toEqual({ ok: true });
    }
  });

  it("rejects impossible score/time and outcome combinations", () => {
    const invalid = [
      valid({ score: rule.scoreRequired + 4, outcome: "cleared" }),
      valid({ remainingTimeCs: rule.durationMs / 10 + 1 }),
      valid({ outcome: "cleared" }),
      valid({ score: rule.scoreRequired }),
      valid({ outcome: "time-limit", remainingTimeCs: 1 }),
      valid({ outcome: "time-limit", remainingTimeCs: 0, score: rule.scoreRequired }),
    ];
    for (const snapshot of invalid) {
      expect(validateResultForProfile(snapshot, highest)).toMatchObject({ ok: false, code: "invalid-request" });
    }
  });

  it("accepts timed-out runs only at zero centiseconds", () => {
    expect(validateResultForProfile(valid({ outcome: "time-limit", remainingTimeCs: 0 }), highest)).toEqual({ ok: true });
  });

  it("allows replay after the stage has already been cleared", () => {
    expect(validateResultForProfile(valid(), 5)).toEqual({ ok: true });
  });
});

describe("runtime validation and unlocks", () => {
  it.each([0, 6, -1, 1.5, NaN, Infinity, "1", null, undefined])("rejects invalid stage %s", (stage) => {
    const input = { ...result(), stage } as ResultInput;
    expect(isSubmitResultRequest({ submissionId: UUID, result: input })).toBe(false);
    expect(validateResultForProfile(input, 0)).toMatchObject({ ok: false, code: "invalid-request" });
  });

  it.each([null, undefined, [], {}, { ...result(), outcome: "quit" }])("rejects malformed runtime result %j", (value) => {
    expect(validateResultForProfile(value as ResultInput, 0)).toMatchObject({ ok: false, code: "invalid-request" });
  });

  it.each(["score", "remainingTimeCs"] as const)("rejects invalid runtime %s even if the shape guard was not called", (key) => {
    for (const value of [-1, 1.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null, undefined]) {
      expect(validateResultForProfile({ ...result(), [key]: value } as ResultInput, 0))
        .toMatchObject({ ok: false, code: "invalid-request" });
    }
  });

  it.each([2, 3, 4, 5] as const)("requires the actual previous clear for stage %s", (stage) => {
    expect(validateResultForProfile(result({ stage, score: 0, remainingTimeCs: 0 }), (stage - 2) as ClearedStage))
      .toMatchObject({ ok: false, code: "stage-locked" });
    expect(validateResultForProfile(result({ stage, score: 0, remainingTimeCs: 0 }), (stage - 1) as ClearedStage))
      .toEqual({ ok: true });
  });

  it.each([-1, 6, 1.5, NaN, Infinity, "0", null, undefined])("rejects corrupt stored clear value %s as a programmer error", (highest) => {
    expect(() => validateResultForProfile(result(), highest as ClearedStage)).toThrow(RangeError);
  });
});

describe("shared rankings", () => {
  it.each([
    { name: "stage before any score", ahead: { bestStage: 2, bestScore: 0, remainingTimeCs: 0 } },
    { name: "score before remaining time", ahead: { bestScore: 101, remainingTimeCs: 0 } },
    { name: "more remaining centiseconds", ahead: { remainingTimeCs: 6001 } },
    { name: "earlier server achievement", ahead: { achievedAt: "2026-10-30T00:59:59.999Z" } },
    { name: "deterministic account ID on full tie", ahead: { accountId: "employee-0" } },
  ] satisfies { name: string; ahead: Partial<SharedBest> }[])("orders by $name", ({ ahead }) => {
    const a = best(ahead);
    const b = best();
    expect(compareSharedPerformance(a, b)).toBeLessThan(0);
    expect(compareSharedPerformance(b, a)).toBeGreaterThan(0);
    expect(compareSharedPerformance(a, a)).toBe(0);
  });

  it("does not use display names for rank ordering", () => {
    expect(compareSharedPerformance(best({ displayName: "Z" }), best({ displayName: "A" }))).toBe(0);
  });

  it("returns the top ten without changing a frozen input", () => {
    const rows = Object.freeze(Array.from({ length: 12 }, (_, index) => Object.freeze(best({
      accountId: `person-${index}`, bestScore: index,
    }))));
    const before = [...rows];
    const top = getSharedTopScores(rows);
    expect(top.map((row) => row.bestScore)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    expect(rows).toEqual(before);
    expect(top).not.toBe(rows);
    expect(getSharedTopScores(rows, 2).map((row) => row.bestScore)).toEqual([11, 10]);
  });

  it("deduplicates each account by its best complete ranking in either input order", () => {
    const strongest = best({ bestStage: 2, bestScore: 20, remainingTimeCs: 1 });
    const weaker = best({ bestScore: 153, remainingTimeCs: 9000 });
    const laterTie = { ...strongest, achievedAt: LATER_TIME };
    const other = best({ accountId: "employee-b", bestScore: 150 });
    expect(getSharedTopScores([weaker, laterTie, other, strongest])).toEqual([strongest, other]);
    expect(getSharedTopScores([strongest, other, laterTie, weaker])).toEqual([strongest, other]);
  });

  it("sorts exact timestamp ties by account ID in either input order and accepts empty lists", () => {
    const a = best({ accountId: "a" });
    const b = best({ accountId: "b" });
    expect(getSharedTopScores([b, a])).toEqual([a, b]);
    expect(getSharedTopScores([a, b])).toEqual([a, b]);
    expect(getSharedTopScores([])).toEqual([]);
  });

  it.each([0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid rank limit %s", (limit) => {
    expect(() => getSharedTopScores([], limit)).toThrow(RangeError);
  });
});

describe("immutable personal record merging", () => {
  it("creates a new failed account without granting a clear", () => {
    expect(mergeSharedResult(null, actor, result(), FIRST_TIME)).toEqual({
      changed: true, profile: profile(),
    });
  });

  it("creates a clear record and unlocks the next stage", () => {
    const merged = mergeSharedResult(null, actor, result({ score: 153, outcome: "cleared" }), FIRST_TIME);
    expect(merged).toEqual({ changed: true, profile: profile({ highestClearedStage: 1, best: best({ bestScore: 153 }) }) });
    expect(getHighestUnlockedStage(merged.profile.highestClearedStage)).toBe(2);
  });

  it("fills an existing no-best profile without losing earlier clears", () => {
    const previous = profile({ highestClearedStage: 2, best: null });
    const merged = mergeSharedResult(previous, actor, result({ stage: 3, score: 0 }), FIRST_TIME);
    expect(merged.profile).toMatchObject({ highestClearedStage: 2, best: { bestStage: 3, bestScore: 0 } });
  });

  it("a caught stage-two record ranks there but leaves only stage one cleared", () => {
    const previous = profile({ highestClearedStage: 1, best: best({ bestScore: 150 }) });
    const input = result({ stage: 2, score: 80 });
    expect(validateResultForProfile(input, previous.highestClearedStage)).toEqual({ ok: true });
    const merged = mergeSharedResult(previous, actor, input, LATER_TIME);
    expect(merged.profile).toMatchObject({ highestClearedStage: 1, best: { bestStage: 2, bestScore: 80 } });
    expect(getHighestUnlockedStage(merged.profile.highestClearedStage)).toBe(2);
    expect(validateResultForProfile(result({ stage: 3, score: 0 }), merged.profile.highestClearedStage))
      .toMatchObject({ ok: false, code: "stage-locked" });
  });

  it("keeps the original accepted timestamp for equal retries, even with an earlier server clock", () => {
    const previous = Object.freeze(profile());
    Object.freeze(previous.best);
    for (const timestamp of [FIRST_TIME, LATER_TIME, "2026-10-29T00:00:00.000Z"]) {
      const merged = mergeSharedResult(previous, actor, result(), timestamp);
      expect(merged.changed).toBe(false);
      expect(merged.profile).toBe(previous);
      expect(merged.profile.best?.achievedAt).toBe(FIRST_TIME);
    }
  });

  it("preserves a stronger whole tuple instead of combining a worse score with a better time", () => {
    const previous = profile({ highestClearedStage: 1, best: best({ bestStage: 2, bestScore: 100, remainingTimeCs: 2000 }) });
    expect(mergeSharedResult(previous, actor, result({ stage: 2, score: 90, remainingTimeCs: 7000 }), LATER_TIME))
      .toEqual({ profile: previous, changed: false });
    const improved = mergeSharedResult(previous, actor, result({ stage: 2, score: 120, remainingTimeCs: 100 }), LATER_TIME);
    expect(improved.profile.best).toEqual(best({ bestStage: 2, bestScore: 120, remainingTimeCs: 100, achievedAt: LATER_TIME }));
  });

  it("replaces all fields when a higher stage beats a higher-score earlier stage", () => {
    const previous = profile({ highestClearedStage: 1, best: best({ bestScore: 153, remainingTimeCs: 8000 }) });
    const merged = mergeSharedResult(previous, actor, result({ stage: 2, score: 1, remainingTimeCs: 1 }), LATER_TIME);
    expect(merged.profile.best).toEqual(best({ bestStage: 2, bestScore: 1, remainingTimeCs: 1, achievedAt: LATER_TIME }));
  });

  it("improves same-stage/score remaining time without changing cleared progress", () => {
    const previous = profile();
    const merged = mergeSharedResult(previous, actor, result({ remainingTimeCs: 6001 }), LATER_TIME);
    expect(merged.profile.best).toEqual(best({ remainingTimeCs: 6001, achievedAt: LATER_TIME }));
    expect(merged.profile.highestClearedStage).toBe(0);
    expect(mergeSharedResult(merged.profile, actor, result(), LATER_TIME).changed).toBe(false);
  });

  it("updates only verified names on a worse run while preserving performance and achievement time", () => {
    const previous = Object.freeze(profile());
    Object.freeze(previous.best);
    const renamed = { ...actor, displayName: "이름 변경" };
    const merged = mergeSharedResult(previous, renamed, result({ score: 1 }), LATER_TIME);
    expect(merged.profile).toEqual(profile({ displayName: renamed.displayName, best: best({ displayName: renamed.displayName }) }));
    expect(merged.changed).toBe(true);
    expect(previous).toEqual(profile());
    expect(mergeSharedResult(merged.profile, renamed, result({ score: 1 }), LATER_TIME).changed).toBe(false);
  });

  it("never lowers a higher clear on a weaker replay or failure", () => {
    const previous = profile({ highestClearedStage: 4, best: best({ bestStage: 5, bestScore: 50, remainingTimeCs: 1000 }) });
    const replay = mergeSharedResult(previous, actor, result({ score: 150, outcome: "cleared" }), LATER_TIME);
    expect(replay).toEqual({ profile: previous, changed: false });
    expect(mergeSharedResult(previous, actor, result({ score: 1, outcome: "time-limit", remainingTimeCs: 0 }), LATER_TIME))
      .toEqual({ profile: previous, changed: false });
  });

  it("clears stage five and keeps the highest unlocked selection capped at five", () => {
    const previous = profile({ highestClearedStage: 4 });
    const merged = mergeSharedResult(previous, actor, result({ stage: 5, score: 350, outcome: "cleared", remainingTimeCs: 100 }), LATER_TIME);
    expect(merged.profile.highestClearedStage).toBe(5);
    expect(getHighestUnlockedStage(merged.profile.highestClearedStage)).toBe(5);
  });

  it("preserves monotonic state regardless of retry order when concurrent writes are reread and merged", () => {
    const initial = profile({ highestClearedStage: 1, best: best({ bestScore: 150 }) });
    const clear = result({ stage: 2, score: 201, remainingTimeCs: 100, outcome: "cleared" });
    const failure = result({ stage: 2, score: 199, remainingTimeCs: 7000 });
    const replay = result({ score: 153, remainingTimeCs: 9000, outcome: "cleared" });
    for (const sequence of [[clear, failure, replay, clear], [failure, replay, clear, failure], [replay, clear, failure, replay]]) {
      let current = initial;
      for (const input of sequence) {
        expect(validateResultForProfile(input, current.highestClearedStage)).toEqual({ ok: true });
        const merged = mergeSharedResult(current, actor, input, LATER_TIME);
        expect(merged.profile.highestClearedStage).toBeGreaterThanOrEqual(current.highestClearedStage);
        current = merged.profile;
      }
      expect(current).toEqual(profile({ highestClearedStage: 2, best: best({
        bestStage: 2, bestScore: 201, remainingTimeCs: 100, achievedAt: LATER_TIME,
      }) }));
    }
  });

  it("does not mutate frozen actor, input or previous best during an improvement", () => {
    const previous = Object.freeze(profile());
    Object.freeze(previous.best);
    const input = Object.freeze(result({ score: 150, outcome: "cleared" }));
    const before = structuredClone({ previous, actor, input });
    expect(mergeSharedResult(previous, actor, input, LATER_TIME).profile).not.toBe(previous);
    expect({ previous, actor, input }).toEqual(before);
  });

  it("rejects profile and nested best belonging to another actor", () => {
    expect(() => mergeSharedResult(profile({ accountId: "other" }), actor, result(), FIRST_TIME)).toThrow(RangeError);
    expect(() => mergeSharedResult(profile({ best: best({ accountId: "other" }) }), actor, result(), FIRST_TIME)).toThrow(RangeError);
  });

  it.each(["", "  ", null, undefined, 123])("rejects missing verified account IDs: %j", (accountId) => {
    expect(() => mergeSharedResult(null, { ...actor, accountId } as AuthenticatedActor, result(), FIRST_TIME)).toThrow(RangeError);
  });

  it.each(["invalid", "", "2026-10-30", "2026-02-30T00:00:00.000Z", "2026-10-30T00:00:00+09:00",
    "2026-10-30T24:00:00.000Z", null, undefined, 0])("rejects invalid server-owned timestamp %j", (timestamp) => {
    expect(() => mergeSharedResult(null, actor, result(), timestamp as string)).toThrow(RangeError);
  });

  it("normalizes valid UTC seconds while accepting millisecond precision", () => {
    expect(mergeSharedResult(null, actor, result(), "2026-10-30T01:00:00Z").profile.best?.achievedAt).toBe(FIRST_TIME);
    expect(mergeSharedResult(null, actor, result(), "2026-10-30T01:00:00.001Z").profile.best?.achievedAt)
      .toBe("2026-10-30T01:00:00.001Z");
  });
});
