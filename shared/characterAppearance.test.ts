// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  APPEARANCE_OPTIONS, areCharacterAppearancesEqual, cloneCharacterAppearance,
  getDefaultCharacterAppearance, getDefaultCharacterLook, isCharacterAppearance,
  isCharacterLook, isSaveAppearanceRequest, resolveCharacterAppearance,
} from "./characterAppearance";
import type { CharacterAppearance, CharacterLook } from "./characterAppearance";

const fields = Object.keys(APPEARANCE_OPTIONS) as (keyof CharacterLook)[];

describe("character appearance input boundary", () => {
  it("round-trips both original role defaults through JSON", () => {
    const appearance = getDefaultCharacterAppearance();
    expect(appearance.runner).toMatchObject({ gender: "male", hairStyle: "short", outfit: "shirt", hat: "none", glasses: "none" });
    expect(appearance.pursuer).toMatchObject({ gender: "male", hairColor: "gray", outfit: "suit", hat: "straw", glasses: "square" });
    expect(isSaveAppearanceRequest(JSON.parse(JSON.stringify({ appearance })))).toBe(true);
  });

  it.each(fields)("accepts every catalog %s for either role and gender", (field) => {
    for (const gender of ["male", "female"] as const) {
      for (const role of ["runner", "pursuer"] as const) {
        for (const option of APPEARANCE_OPTIONS[field]) {
          const appearance = getDefaultCharacterAppearance();
          appearance[role] = { ...appearance[role], gender, [field]: option.value };
          expect(isCharacterAppearance(appearance)).toBe(true);
        }
      }
    }
  });

  it("allows independent combinations without changing either role's selections", () => {
    const appearance = getDefaultCharacterAppearance();
    appearance.runner = { ...appearance.runner, gender: "female", hairStyle: "short", outfit: "suit", hat: "straw" };
    appearance.pursuer = { ...appearance.pursuer, gender: "male", hairStyle: "ponytail", outfit: "cardigan", outfitColor: "rose", hat: "none" };
    const before = structuredClone(appearance);
    expect(isSaveAppearanceRequest({ appearance })).toBe(true);
    expect(appearance).toEqual(before);
  });

  it.each([null, undefined, [], true, "look", 1, {}])("rejects a non-look or incomplete look: %j", (value) => {
    expect(isCharacterLook(value)).toBe(false);
  });

  it.each(fields)("requires an own valid catalog ID for %s", (field) => {
    const missing: Record<string, unknown> = { ...getDefaultCharacterLook("runner") };
    delete missing[field];
    expect(isCharacterLook(missing)).toBe(false);
    for (const invalid of [undefined, null, 0, true, [], {}, "", "unknown", "#ff0000"]) {
      expect(isCharacterLook({ ...getDefaultCharacterLook("runner"), [field]: invalid })).toBe(false);
    }
  });

  it("rejects IDs from another category and option metadata in place of an ID", () => {
    const look = getDefaultCharacterLook("runner");
    expect(isCharacterLook({ ...look, hairStyle: "straw" })).toBe(false);
    expect(isCharacterLook({ ...look, skinTone: APPEARANCE_OPTIONS.skinTone[0] })).toBe(false);
    expect(isCharacterLook({ ...look, outfitColor: APPEARANCE_OPTIONS.outfitColor[0].swatch })).toBe(false);
  });

  it("rejects extra visible, hidden and symbol fields on every nested look", () => {
    for (const role of ["runner", "pursuer"] as const) {
      for (const extra of ["accountId", "swatch"]) {
        const appearance = getDefaultCharacterAppearance();
        expect(isCharacterAppearance({ ...appearance, [role]: { ...appearance[role], [extra]: "forged" } })).toBe(false);
        Object.defineProperty(appearance[role], extra, { value: "hidden" });
        expect(isCharacterAppearance(appearance)).toBe(false);
      }
      const appearance = getDefaultCharacterAppearance();
      expect(isCharacterAppearance({ ...appearance, [role]: { ...appearance[role], [Symbol("extra")]: true } })).toBe(false);
    }
  });

  it("requires own fields rather than inherited properties", () => {
    const appearance = getDefaultCharacterAppearance();
    expect(isCharacterLook(Object.create(appearance.runner))).toBe(false);
    expect(isCharacterAppearance(Object.create(appearance))).toBe(false);
    expect(isSaveAppearanceRequest(Object.create({ appearance }))).toBe(false);
    const partial = { ...appearance.runner } as Partial<CharacterLook>;
    delete partial.hat;
    Object.setPrototypeOf(partial, { hat: "none" });
    expect(isCharacterLook(partial)).toBe(false);
  });

  it.each([null, undefined, [], {}, true, "appearance", 1])("rejects an invalid appearance envelope: %j", (value) => {
    expect(isCharacterAppearance(value)).toBe(false);
    expect(isSaveAppearanceRequest({ appearance: value })).toBe(false);
  });

  it("requires version one and both complete roles", () => {
    const appearance = getDefaultCharacterAppearance();
    for (const version of [undefined, null, 0, 2, "1"]) {
      expect(isCharacterAppearance({ ...appearance, version })).toBe(false);
    }
    for (const field of ["version", "runner", "pursuer"] as const) {
      const missing: Record<string, unknown> = { ...appearance };
      delete missing[field];
      expect(isCharacterAppearance(missing)).toBe(false);
    }
    expect(isCharacterAppearance({ ...appearance, runner: null })).toBe(false);
    expect(isCharacterAppearance({ ...appearance, pursuer: [] })).toBe(false);
  });

  it("rejects unknown and hidden outer fields and client-owned save fields", () => {
    const appearance = getDefaultCharacterAppearance();
    expect(isCharacterAppearance({ ...appearance, accountId: "someone-else" })).toBe(false);
    expect(isCharacterAppearance({ ...appearance, [Symbol("extra")]: true })).toBe(false);
    const hiddenAppearance = getDefaultCharacterAppearance();
    Object.defineProperty(hiddenAppearance, "extra", { value: 1 });
    expect(isCharacterAppearance(hiddenAppearance)).toBe(false);
    for (const extra of ["accountId", "displayName", "score", "stage"]) {
      expect(isSaveAppearanceRequest({ appearance, [extra]: "forged" })).toBe(false);
    }
    const request = { appearance };
    Object.defineProperty(request, "accountId", { value: "someone-else" });
    expect(isSaveAppearanceRequest(request)).toBe(false);
    expect(isSaveAppearanceRequest({ appearance, [Symbol("extra")]: true })).toBe(false);
    for (const invalid of [null, undefined, [], {}, { version: 1 }, appearance]) {
      expect(isSaveAppearanceRequest(invalid)).toBe(false);
    }
  });
});

describe("appearance value isolation and comparison", () => {
  it("does not share mutable defaults between roles or callers", () => {
    const first = getDefaultCharacterAppearance();
    const second = getDefaultCharacterAppearance();
    expect(first.runner).not.toBe(first.pursuer);
    expect(first.runner).not.toBe(second.runner);
    first.runner.hat = "cap";
    first.pursuer.hairStyle = "bob";
    expect(second.runner.hat).toBe("none");
    expect(second.pursuer.hairStyle).toBe("side-part");
    const look = getDefaultCharacterLook("runner");
    look.shoeColor = "white";
    expect(getDefaultCharacterLook("runner").shoeColor).toBe("black");
  });

  it.each([cloneCharacterAppearance, resolveCharacterAppearance])("copies both looks without mutating the source", (copy) => {
    const source = getDefaultCharacterAppearance();
    const result = copy(source);
    expect(result).toEqual(source);
    expect(result).not.toBe(source);
    expect(result.runner).not.toBe(source.runner);
    expect(result.pursuer).not.toBe(source.pursuer);
    result.runner.glasses = "round";
    source.pursuer.hat = "none";
    expect(source.runner.glasses).toBe("none");
    expect(result.pursuer.hat).toBe("straw");
  });

  it("falls back to independent defaults for absent or corrupt legacy data without accepting it as a request", () => {
    const corrupt = { ...getDefaultCharacterAppearance(), runner: { hat: "unknown" } };
    for (const value of [undefined, null, {}, corrupt]) {
      const resolved = resolveCharacterAppearance(value);
      expect(resolved).toEqual(getDefaultCharacterAppearance());
      resolved.runner.hat = "cap";
      expect(resolveCharacterAppearance(value).runner.hat).toBe("none");
      expect(isSaveAppearanceRequest({ appearance: value })).toBe(false);
    }
  });

  it("compares fields independently of JSON property order", () => {
    const original = getDefaultCharacterAppearance();
    const reordered: CharacterAppearance = {
      pursuer: { ...original.pursuer },
      runner: Object.fromEntries(Object.entries(original.runner).reverse()) as unknown as CharacterLook,
      version: 1,
    };
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(original));
    expect(areCharacterAppearancesEqual(original, reordered)).toBe(true);
    expect(areCharacterAppearancesEqual(original, { ...original, version: 2 } as unknown as CharacterAppearance)).toBe(false);
  });

  it.each(fields)("detects a different %s on either role", (field) => {
    const original = getDefaultCharacterAppearance();
    for (const role of ["runner", "pursuer"] as const) {
      const different = APPEARANCE_OPTIONS[field].find((option) => option.value !== original[role][field])!;
      const next = { ...original, [role]: { ...original[role], [field]: different.value } };
      expect(areCharacterAppearancesEqual(original, next)).toBe(false);
    }
  });
});
