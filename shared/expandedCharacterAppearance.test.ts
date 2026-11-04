// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as current from "./characterAppearance";
import * as legacy from "./legacyCharacterAppearance";
import {
  APPEARANCE_OPTIONS, areCharacterAppearancesEqual, cloneCharacterAppearance,
  getDefaultCharacterAppearance, getDefaultCharacterLook, isCharacterAppearance, isCharacterLook,
  isSaveAppearanceRequest, normalizeCharacterAppearance, normalizeCharacterLook,
  resolveCharacterAppearance, resolveCharacterLook,
} from "./expandedCharacterAppearance";
import type { CharacterAppearance, CharacterLook } from "./expandedCharacterAppearance";

const fields = Object.keys(APPEARANCE_OPTIONS) as (keyof CharacterLook)[];
const roles = ["runner", "pursuer"] as const;

function savedLegacyAppearance(): legacy.CharacterAppearance {
  return {
    version: 1,
    runner: {
      gender: "female", hairStyle: "ponytail", hairColor: "blond", skinTone: "deep",
      outfit: "cardigan", outfitColor: "teal", hat: "cap", glasses: "round", shoes: "sneakers", shoeColor: "white",
    },
    pursuer: {
      gender: "female", hairStyle: "bob", hairColor: "brown", skinTone: "tan",
      outfit: "shirt", outfitColor: "rose", hat: "none", glasses: "none", shoes: "sneakers", shoeColor: "brown",
    },
  };
}

describe("expanded catalog and strict input boundary", () => {
  it("preserves the fixed thirteen-field contract after the public version-three transition", () => {
    expect(fields).toHaveLength(13);
    expect(Object.fromEntries(fields.map(field => [field, APPEARANCE_OPTIONS[field].length]))).toEqual({
      gender: 2, hairStyle: 6, hairColor: 6, skinTone: 4, outfit: 5, outfitColor: 9,
      hat: 5, glasses: 4, shoes: 3, shoeColor: 6, eyeStyle: 5, bag: 5, bagColor: 4,
    });
    expect(APPEARANCE_OPTIONS.eyeStyle.map(option => option.value)).toEqual(["default", "round", "smile", "sleepy", "sharp"]);
    expect(APPEARANCE_OPTIONS.bag.map(option => option.label)).toEqual(["없음", "백팩", "노트북 가방", "크로스백", "서류가방"]);
    for (const field of fields) expect(current.APPEARANCE_OPTIONS[field]).toBe(APPEARANCE_OPTIONS[field]);
    expect(current.getDefaultCharacterAppearance().version).toBe(3);
    expect(Object.keys(legacy.APPEARANCE_OPTIONS)).toHaveLength(10);
    expect(legacy.APPEARANCE_OPTIONS.hairStyle.map(option => option.value)).toEqual(["short", "side-part", "bob", "ponytail"]);
    expect(current.isCharacterAppearance(getDefaultCharacterAppearance())).toBe(false);
    expect(current.normalizeCharacterAppearance(getDefaultCharacterAppearance())).toMatchObject({ version: 3 });
    expect(isCharacterAppearance(legacy.getDefaultCharacterAppearance())).toBe(false);
  });

  it("preserves all existing labels and swatches and freezes each catalog layer", () => {
    for (const field of Object.keys(legacy.APPEARANCE_OPTIONS) as (keyof legacy.CharacterLook)[]) {
      const original = legacy.APPEARANCE_OPTIONS[field];
      expect(APPEARANCE_OPTIONS[field].slice(0, original.length)).toEqual(original);
    }
    expect(Object.isFrozen(APPEARANCE_OPTIONS)).toBe(true);
    expect(Reflect.set(APPEARANCE_OPTIONS, "bag", [])).toBe(false);
    for (const field of fields) {
      const options = APPEARANCE_OPTIONS[field];
      expect(Object.isFrozen(options)).toBe(true);
      expect(Reflect.set(options, "0", { value: "forged" })).toBe(false);
      expect(new Set(options.map(option => option.value)).size).toBe(options.length);
      for (const option of options) {
        expect(Object.isFrozen(option)).toBe(true);
        expect(Reflect.set(option, "label", "changed")).toBe(false);
        expect(option.label.length).toBeGreaterThan(0);
        if (option.swatch) expect(option.swatch).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it.each(fields)("accepts every allowed %s for either role and gender", field => {
    for (const gender of ["male", "female"] as const) {
      for (const role of roles) {
        for (const option of APPEARANCE_OPTIONS[field]) {
          const appearance = getDefaultCharacterAppearance();
          appearance[role] = { ...appearance[role], gender, [field]: option.value };
          expect(isCharacterAppearance(appearance)).toBe(true);
          expect(isSaveAppearanceRequest(JSON.parse(JSON.stringify({ appearance })))).toBe(true);
        }
      }
    }
  });

  it.each(fields)("rejects a missing or invalid %s instead of making a saveable default", field => {
    const missing: Record<string, unknown> = { ...getDefaultCharacterLook("runner") };
    delete missing[field];
    expect(isCharacterLook(missing)).toBe(false);
    for (const invalid of [undefined, null, 0, true, [], {}, "", "unknown", "#ff0000"]) {
      const value = { ...getDefaultCharacterAppearance(), runner: { ...getDefaultCharacterLook("runner"), [field]: invalid } };
      expect(isCharacterAppearance(value)).toBe(false);
      expect(normalizeCharacterAppearance(value)).toBeNull();
      expect(isSaveAppearanceRequest({ appearance: value })).toBe(false);
    }
  });

  it("rejects extra, hidden, symbol and inherited-only keys at each boundary", () => {
    const value = getDefaultCharacterAppearance();
    for (const role of roles) {
      expect(isCharacterAppearance({ ...value, [role]: { ...value[role], extra: true } })).toBe(false);
      expect(isCharacterAppearance({ ...value, [role]: { ...value[role], [Symbol("extra")]: true } })).toBe(false);
      const hidden = getDefaultCharacterLook(role);
      Object.defineProperty(hidden, "extra", { value: true });
      expect(isCharacterLook(hidden)).toBe(false);
      expect(normalizeCharacterLook(hidden)).toBeNull();
      expect(isCharacterLook(Object.create(value[role]))).toBe(false);
    }
    const inherited = { ...value.runner } as Partial<CharacterLook>;
    delete inherited.bag;
    Object.setPrototypeOf(inherited, { bag: "none" });
    expect(isCharacterLook(inherited)).toBe(false);
    expect(isCharacterAppearance(Object.create(value))).toBe(false);
    expect(isSaveAppearanceRequest(Object.create({ appearance: value }))).toBe(false);
    expect(isCharacterAppearance({ ...value, accountId: "another-account" })).toBe(false);
    expect(isCharacterAppearance({ ...value, [Symbol("extra")]: true })).toBe(false);
    const hiddenEnvelope = getDefaultCharacterAppearance();
    Object.defineProperty(hiddenEnvelope, "extra", { value: true });
    expect(isCharacterAppearance(hiddenEnvelope)).toBe(false);
    for (const extra of ["accountId", "displayName", "score", "stage"]) {
      expect(isSaveAppearanceRequest({ appearance: value, [extra]: "forged" })).toBe(false);
    }
    const hiddenRequest = { appearance: value };
    Object.defineProperty(hiddenRequest, "accountId", { value: "forged" });
    expect(isSaveAppearanceRequest(hiddenRequest)).toBe(false);
    expect(isSaveAppearanceRequest({ appearance: value, [Symbol("extra")]: true })).toBe(false);
  });

  it("requires a complete version-two envelope and a single-field save request", () => {
    const value = getDefaultCharacterAppearance();
    for (const version of [undefined, null, 0, 1, 3, "2", true]) {
      expect(isCharacterAppearance({ ...value, version })).toBe(false);
      expect(normalizeCharacterAppearance({ ...value, version })).toBeNull();
    }
    for (const field of ["version", "runner", "pursuer"] as const) {
      const missing: Record<string, unknown> = { ...value };
      delete missing[field];
      expect(isCharacterAppearance(missing)).toBe(false);
      expect(normalizeCharacterAppearance(missing)).toBeNull();
    }
    for (const invalid of [null, undefined, [], true, "appearance", 1, {}, { version: 2 }, value]) {
      expect(isSaveAppearanceRequest(invalid)).toBe(false);
    }
    expect(isCharacterAppearance({ ...value, runner: null })).toBe(false);
    expect(isCharacterAppearance({ ...value, pursuer: [] })).toBe(false);
    expect(isSaveAppearanceRequest({ appearance: value })).toBe(true);
  });
});

describe("lossless legacy normalization", () => {
  it("preserves every previous choice across a JSON round trip and only adds the new defaults", () => {
    const saved = savedLegacyAppearance();
    const source = JSON.parse(JSON.stringify(saved));
    for (const role of roles) {
      for (const field of Object.keys(saved[role]) as (keyof legacy.CharacterLook)[]) {
        expect(saved[role][field]).not.toBe(legacy.getDefaultCharacterLook(role)[field]);
      }
    }
    const result = normalizeCharacterAppearance(source)!;
    expect(result).toEqual({
      version: 2,
      runner: { ...saved.runner, eyeStyle: "default", bag: "none", bagColor: "black" },
      pursuer: { ...saved.pursuer, eyeStyle: "default", bag: "none", bagColor: "black" },
    });
    expect(isCharacterAppearance(result)).toBe(true);
    expect(isSaveAppearanceRequest({ appearance: source })).toBe(false);
    expect(source).toEqual(saved);
    expect(Object.isFrozen(source)).toBe(false);
    result.runner.hat = "none"; source.pursuer.outfit = "suit";
    expect(source.runner.hat).toBe("cap"); expect(result.pursuer.outfit).toBe("shirt");
  });

  it("normalizes legacy standalone looks and preserves known non-enumerable fields", () => {
    const original = savedLegacyAppearance();
    Object.defineProperty(original.runner, "hat", { enumerable: false });
    expect(legacy.isCharacterLook(original.runner)).toBe(true);
    const look = normalizeCharacterLook(original.runner)!;
    expect(look.hat).toBe("cap"); expect(isCharacterLook(look)).toBe(true);
    expect(resolveCharacterLook(original.runner, "pursuer")).toEqual(look);
    const modern = getDefaultCharacterAppearance(); modern.runner.bag = "backpack";
    Object.defineProperty(modern.runner, "bag", { enumerable: false });
    expect(isCharacterAppearance(modern)).toBe(true);
    expect(normalizeCharacterAppearance(modern)!.runner.bag).toBe("backpack");
    expect(isCharacterAppearance(cloneCharacterAppearance(modern))).toBe(true);
  });

  it("does not interpret incomplete version two or mixed look versions as legacy data", () => {
    const old = savedLegacyAppearance();
    const latest = getDefaultCharacterAppearance();
    const incomplete = { version: 2, runner: old.runner, pursuer: old.pursuer };
    // A standalone ten-field look is recognizable; a declared version-two envelope must be complete.
    expect(normalizeCharacterLook(old.runner)).not.toBeNull();
    expect(normalizeCharacterAppearance(incomplete)).toBeNull();
    expect(normalizeCharacterAppearance({ ...old, runner: latest.runner })).toBeNull();
    expect(normalizeCharacterAppearance({ ...latest, pursuer: old.pursuer })).toBeNull();
    for (const field of ["eyeStyle", "bag", "bagColor"] as const) {
      const missing: Record<string, unknown> = { ...latest.runner };
      delete missing[field];
      const value = { ...latest, runner: missing };
      expect(normalizeCharacterLook(missing)).toBeNull();
      expect(normalizeCharacterAppearance(value)).toBeNull();
      expect(isSaveAppearanceRequest({ appearance: value })).toBe(false);
    }
  });

  it("rejects future and corrupt legacy values instead of dropping or repairing individual choices", () => {
    const old = savedLegacyAppearance();
    const invalid = [
      null, undefined, [], {}, { ...old, version: 3 },
      { ...old, runner: { ...old.runner, hairStyle: "long" } },
      { ...old, pursuer: { ...old.pursuer, bag: "none" } },
      { ...old, runner: { ...old.runner, shoeColor: "unknown" } },
      { ...old, accountId: "another-account" },
    ];
    for (const value of invalid) {
      expect(normalizeCharacterAppearance(value)).toBeNull();
      expect(isSaveAppearanceRequest({ appearance: value })).toBe(false);
      expect(resolveCharacterAppearance(value)).toEqual(getDefaultCharacterAppearance());
    }
    expect(normalizeCharacterLook({ ...old.runner, outfit: "hoodie" })).toBeNull();
    expect(normalizeCharacterLook({ ...old.runner, [Symbol("extra")]: true })).toBeNull();
  });
});

describe("expanded value isolation and comparison", () => {
  it("keeps role defaults and display fallbacks independent without resetting valid selections", () => {
    for (const role of roles) {
      const look = getDefaultCharacterLook(role);
      expect(look).toEqual({ ...legacy.getDefaultCharacterLook(role), eyeStyle: "default", bag: "none", bagColor: "black" });
      const fallback = resolveCharacterLook(undefined, role);
      fallback.bag = "briefcase";
      expect(resolveCharacterLook(undefined, role).bag).toBe("none");
      expect(resolveCharacterLook(look, role)).not.toBe(look);
    }
    const first = getDefaultCharacterAppearance(), second = getDefaultCharacterAppearance();
    expect(first.runner).not.toBe(first.pursuer);
    first.runner.eyeStyle = "sharp"; first.pursuer.bagColor = "beige";
    expect(second.runner.eyeStyle).toBe("default"); expect(second.pursuer.bagColor).toBe("black");
    const fallback = resolveCharacterAppearance(undefined); fallback.runner.bag = "laptop";
    expect(resolveCharacterAppearance(undefined).runner.bag).toBe("none");
  });

  it.each([
    { name: "clone", copy: cloneCharacterAppearance },
    { name: "normalize", copy: normalizeCharacterAppearance },
    { name: "resolve", copy: resolveCharacterAppearance },
  ])("$name copies both complete looks without retaining mutable references", ({ copy }) => {
    const source = getDefaultCharacterAppearance();
    source.runner = { ...source.runner, hairStyle: "long", eyeStyle: "smile", bag: "laptop", bagColor: "navy" };
    source.pursuer = { ...source.pursuer, outfit: "hoodie", hat: "beanie", shoes: "boots", bag: "crossbody" };
    const result = copy(source)!;
    expect(result).toEqual(source); expect(result).not.toBe(source);
    expect(result.runner).not.toBe(source.runner); expect(result.pursuer).not.toBe(source.pursuer);
    result.runner.bagColor = "brown"; source.pursuer.bag = "none";
    expect(source.runner.bagColor).toBe("navy"); expect(result.pursuer.bag).toBe("crossbody");
    expect(Object.isFrozen(source)).toBe(false); expect(Object.isFrozen(source.runner)).toBe(false);
  });

  it("compares independent of property order and distinguishes the schema version", () => {
    const original = getDefaultCharacterAppearance();
    const reordered: CharacterAppearance = { version: 2, pursuer: { ...original.pursuer },
      runner: Object.fromEntries(Object.entries(original.runner).reverse()) as unknown as CharacterLook };
    expect(areCharacterAppearancesEqual(original, reordered)).toBe(true);
    expect(areCharacterAppearancesEqual(original, { ...original, version: 3 } as unknown as CharacterAppearance)).toBe(false);
  });

  it.each(fields)("detects changes to %s on either role including the three new selections", field => {
    const original = getDefaultCharacterAppearance();
    for (const role of roles) {
      const different = APPEARANCE_OPTIONS[field].find(option => option.value !== original[role][field])!;
      const next = { ...original, [role]: { ...original[role], [field]: different.value } };
      expect(areCharacterAppearancesEqual(original, next)).toBe(false);
    }
  });
});
