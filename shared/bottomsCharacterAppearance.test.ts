// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as current from "./characterAppearance";
import * as expanded from "./expandedCharacterAppearance";
import * as legacy from "./legacyCharacterAppearance";
import {
  APPEARANCE_OPTIONS, areCharacterAppearancesEqual, cloneCharacterAppearance,
  getDefaultCharacterAppearance, getDefaultCharacterLook, isCharacterAppearance, isCharacterLook,
  isSaveAppearanceRequest, normalizeCharacterAppearance, normalizeCharacterLook,
  resolveCharacterAppearance, resolveCharacterLook,
} from "./bottomsCharacterAppearance";
import type { CharacterAppearance, CharacterLook } from "./bottomsCharacterAppearance";

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

function savedExpandedAppearance(): expanded.CharacterAppearance {
  return {
    version: 2,
    runner: {
      gender: "female", hairStyle: "long", hairColor: "pink", skinTone: "deep",
      outfit: "hoodie", outfitColor: "beige", hat: "beret", glasses: "sunglasses", shoes: "boots", shoeColor: "red",
      eyeStyle: "smile", bag: "crossbody", bagColor: "beige",
    },
    pursuer: {
      gender: "female", hairStyle: "curly", hairColor: "blue", skinTone: "tan",
      outfit: "vest", outfitColor: "sky", hat: "beanie", glasses: "round", shoes: "sneakers", shoeColor: "navy",
      eyeStyle: "sharp", bag: "laptop", bagColor: "brown",
    },
  };
}

describe("bottoms catalog and strict version-three boundary", () => {
  it("prepares fifteen fields without activating the new public contract or changing old catalogs", () => {
    expect(Object.fromEntries(fields.map(field => [field, APPEARANCE_OPTIONS[field].length]))).toEqual({
      gender: 2, hairStyle: 6, hairColor: 6, skinTone: 4, outfit: 5, outfitColor: 9,
      hat: 5, glasses: 4, shoes: 3, shoeColor: 6, eyeStyle: 5, bag: 5, bagColor: 4, bottoms: 4, bottomsColor: 6,
    });
    expect(APPEARANCE_OPTIONS.bottoms).toEqual([
      { value: "trousers", label: "긴바지" }, { value: "jeans", label: "청바지" },
      { value: "shorts", label: "반바지" }, { value: "skirt", label: "치마" },
    ]);
    expect(APPEARANCE_OPTIONS.bottomsColor).toEqual([
      { value: "black", label: "검정", swatch: "#283247" }, { value: "navy", label: "남색", swatch: "#354766" },
      { value: "gray", label: "회색", swatch: "#788394" }, { value: "beige", label: "베이지", swatch: "#c8b38b" },
      { value: "brown", label: "갈색", swatch: "#785039" }, { value: "white", label: "흰색", swatch: "#e6edf2" },
    ]);
    expect(current.APPEARANCE_OPTIONS).toBe(expanded.APPEARANCE_OPTIONS);
    expect(current.getDefaultCharacterAppearance().version).toBe(2);
    expect(Object.keys(expanded.APPEARANCE_OPTIONS)).toHaveLength(13);
    expect(Object.keys(legacy.APPEARANCE_OPTIONS)).toHaveLength(10);
    expect(expanded.isCharacterAppearance(getDefaultCharacterAppearance())).toBe(false);
    expect(legacy.isCharacterAppearance(getDefaultCharacterAppearance())).toBe(false);
    for (const field of Object.keys(expanded.APPEARANCE_OPTIONS) as (keyof expanded.CharacterLook)[]) {
      expect(APPEARANCE_OPTIONS[field]).toBe(expanded.APPEARANCE_OPTIONS[field]);
    }
  });

  it("keeps every catalog layer immutable and option IDs unique", () => {
    expect(Object.isFrozen(APPEARANCE_OPTIONS)).toBe(true);
    expect(Reflect.set(APPEARANCE_OPTIONS, "bottoms", [])).toBe(false);
    for (const field of fields) {
      const options = APPEARANCE_OPTIONS[field];
      expect(Object.isFrozen(options)).toBe(true);
      expect(Reflect.set(options, "0", { value: "forged" })).toBe(false);
      expect(new Set(options.map(option => option.value)).size).toBe(options.length);
      for (const option of options) {
        expect(Object.isFrozen(option)).toBe(true);
        expect(Reflect.set(option, "label", "changed")).toBe(false);
      }
    }
  });

  it.each(fields)("accepts the complete %s catalog independently for either role and gender", field => {
    for (const role of roles) {
      for (const gender of ["male", "female"] as const) {
        for (const option of APPEARANCE_OPTIONS[field]) {
          const value = getDefaultCharacterAppearance();
          value[role] = { ...value[role], gender, [field]: option.value };
          expect(isCharacterLook(value[role])).toBe(true);
          expect(isCharacterAppearance(value)).toBe(true);
          expect(isSaveAppearanceRequest(JSON.parse(JSON.stringify({ appearance: value })))).toBe(true);
        }
      }
    }
  });

  it.each(fields)("rejects missing or invalid %s rather than saving repaired defaults", field => {
    for (const role of roles) {
      const missing: Record<string, unknown> = { ...getDefaultCharacterLook(role) };
      delete missing[field];
      const value = { ...getDefaultCharacterAppearance(), [role]: missing };
      expect(isCharacterLook(missing)).toBe(false);
      expect(isCharacterAppearance(value)).toBe(false);
      expect(normalizeCharacterAppearance(value)).toBeNull();
      expect(isSaveAppearanceRequest({ appearance: value })).toBe(false);
      for (const invalid of [undefined, null, 0, true, [], {}, "", "none", "unknown", "#354766"]) {
        if (APPEARANCE_OPTIONS[field].some(option => option.value === invalid)) continue;
        const corrupt = { ...getDefaultCharacterAppearance(), [role]: { ...getDefaultCharacterLook(role), [field]: invalid } };
        expect(isCharacterAppearance(corrupt)).toBe(false);
        expect(normalizeCharacterAppearance(corrupt)).toBeNull();
        expect(isSaveAppearanceRequest({ appearance: corrupt })).toBe(false);
      }
    }
  });

  it("rejects extra enumerable, hidden and symbol keys at all three boundaries", () => {
    for (const extra of ["accountId", "score", Symbol("extra")]) {
      const value = getDefaultCharacterAppearance();
      for (const role of roles) {
        const look = { ...value[role], [extra]: true };
        expect(isCharacterLook(look)).toBe(false);
        expect(normalizeCharacterLook(look)).toBeNull();
        expect(normalizeCharacterAppearance({ ...value, [role]: look })).toBeNull();
        const hidden = { ...value[role] };
        Object.defineProperty(hidden, extra, { value: true });
        expect(isCharacterLook(hidden)).toBe(false);
        expect(normalizeCharacterLook(hidden)).toBeNull();
      }
      expect(isCharacterAppearance({ ...value, [extra]: true })).toBe(false);
      expect(normalizeCharacterAppearance({ ...value, [extra]: true })).toBeNull();
      const hidden = getDefaultCharacterAppearance();
      Object.defineProperty(hidden, extra, { value: true });
      expect(normalizeCharacterAppearance(hidden)).toBeNull();
      expect(isSaveAppearanceRequest({ appearance: value, [extra]: true })).toBe(false);
      const request = { appearance: value };
      Object.defineProperty(request, extra, { value: true });
      expect(isSaveAppearanceRequest(request)).toBe(false);
    }
  });

  it("requires own fields instead of accepting inherited choices or request wrappers", () => {
    const value = getDefaultCharacterAppearance();
    for (const role of roles) {
      expect(isCharacterLook(Object.create(value[role]))).toBe(false);
      const inherited = { ...value[role] } as Partial<CharacterLook>;
      delete inherited.bottoms;
      Object.setPrototypeOf(inherited, { bottoms: value[role].bottoms });
      expect(isCharacterLook(inherited)).toBe(false);
      expect(normalizeCharacterLook(inherited)).toBeNull();
    }
    expect(isCharacterAppearance(Object.create(value))).toBe(false);
    expect(isSaveAppearanceRequest(Object.create({ appearance: value }))).toBe(false);
  });

  it("requires the complete version-three envelope and a single appearance request field", () => {
    const value = getDefaultCharacterAppearance();
    for (const version of [undefined, null, 0, 1, 2, 4, "3", true]) {
      const wrongVersion = { ...value, version };
      expect(isCharacterAppearance(wrongVersion)).toBe(false);
      expect(normalizeCharacterAppearance(wrongVersion)).toBeNull();
    }
    for (const field of ["version", "runner", "pursuer"] as const) {
      const missing: Record<string, unknown> = { ...value };
      delete missing[field];
      expect(isCharacterAppearance(missing)).toBe(false);
      expect(normalizeCharacterAppearance(missing)).toBeNull();
    }
    for (const invalid of [null, undefined, [], true, "appearance", 1, {}, { version: 3 }, value]) {
      expect(isSaveAppearanceRequest(invalid)).toBe(false);
    }
    for (const role of roles) {
      for (const invalid of [null, [], {}, undefined]) {
        expect(normalizeCharacterAppearance({ ...value, [role]: invalid })).toBeNull();
      }
    }
    expect(isSaveAppearanceRequest({ appearance: value })).toBe(true);
  });
});

describe("lossless version-one and version-two read compatibility", () => {
  it.each([
    { name: "version one", saved: savedLegacyAppearance, defaults: legacy.getDefaultCharacterLook,
      additions: { eyeStyle: "default", bag: "none", bagColor: "black", bottoms: "trousers", bottomsColor: "navy" } },
    { name: "version two", saved: savedExpandedAppearance, defaults: expanded.getDefaultCharacterLook,
      additions: { bottoms: "trousers", bottomsColor: "navy" } },
  ])("preserves every non-default $name choice and only adds absent fields", ({ saved, defaults, additions }) => {
    const original = saved();
    const source = JSON.parse(JSON.stringify(original));
    for (const role of roles) {
      const oldLook = original[role];
      for (const field of Object.keys(oldLook) as (keyof typeof oldLook)[]) {
        expect(oldLook[field]).not.toBe(defaults(role)[field]);
      }
    }
    const result = normalizeCharacterAppearance(source)!;
    expect(result).toEqual({ version: 3,
      runner: { ...original.runner, ...additions }, pursuer: { ...original.pursuer, ...additions } });
    expect(isCharacterAppearance(result)).toBe(true);
    expect(isCharacterAppearance(source)).toBe(false);
    expect(isSaveAppearanceRequest({ appearance: source })).toBe(false);
    expect(source).toEqual(original);
    for (const role of roles) {
      expect(normalizeCharacterLook(original[role])).toEqual(result[role]);
      expect(resolveCharacterLook(original[role], role === "runner" ? "pursuer" : "runner")).toEqual(result[role]);
    }
    result.runner.hat = "none"; source.pursuer.outfit = "suit";
    expect(source.runner.hat).not.toBe("none");
    expect(result.pursuer.outfit).toBe(original.pursuer.outfit);
    expect(Object.isFrozen(source)).toBe(false);
  });

  it.each([
    { name: "version one", saved: savedLegacyAppearance, field: "hat" },
    { name: "version two", saved: savedExpandedAppearance, field: "bag" },
  ])("retains valid non-enumerable $name choices while copying", ({ saved, field }) => {
    const value = saved();
    Object.defineProperty(value.runner, field, { enumerable: false });
    const result = normalizeCharacterAppearance(value)!;
    expect(result.runner).toMatchObject(field === "hat" ? { hat: "cap" } : { bag: "crossbody" });
    expect(isCharacterAppearance(result)).toBe(true);
    expect(result.runner).not.toBe(value.runner);
  });

  it("recognizes exact old standalone looks but never repairs an incomplete declared version three", () => {
    const old = savedExpandedAppearance();
    expect(normalizeCharacterLook(old.runner)).toEqual({ ...old.runner, bottoms: "trousers", bottomsColor: "navy" });
    expect(normalizeCharacterAppearance({ ...old, version: 3 })).toBeNull();
    for (const role of roles) {
      const latest = getDefaultCharacterAppearance();
      for (const missingField of ["bottoms", "bottomsColor"] as const) {
        const partial: Record<string, unknown> = { ...latest[role] };
        delete partial[missingField];
        expect(Reflect.ownKeys(partial)).toHaveLength(14);
        expect(normalizeCharacterLook(partial)).toBeNull();
        expect(normalizeCharacterAppearance({ ...latest, [role]: partial })).toBeNull();
      }
    }
  });

  it("rejects mixed role schemas under every declared appearance version", () => {
    const values = [savedLegacyAppearance(), savedExpandedAppearance(), getDefaultCharacterAppearance()];
    for (const envelope of values) {
      for (const role of roles) {
        for (const other of values.filter(value => value.version !== envelope.version)) {
          expect(normalizeCharacterAppearance({ ...envelope, [role]: other[role] })).toBeNull();
        }
      }
    }
  });

  it("does not discard corrupt or unknown fields from old data to manufacture valid defaults", () => {
    const old = savedLegacyAppearance(), previous = savedExpandedAppearance();
    for (const value of [
      { ...old, runner: { ...old.runner, hairStyle: "long" } },
      { ...old, pursuer: { ...old.pursuer, bag: "none" } },
      { ...previous, runner: { ...previous.runner, eyeStyle: "unknown" } },
      { ...previous, pursuer: { ...previous.pursuer, bottoms: "trousers" } },
      { ...previous, runner: { ...previous.runner, bottomsColor: "navy" } },
      { ...previous, runner: { ...previous.runner, [Symbol("extra")]: true } },
      { ...previous, accountId: "another-account" },
      { ...previous, version: 4 },
    ]) {
      expect(normalizeCharacterAppearance(value)).toBeNull();
      expect(isSaveAppearanceRequest({ appearance: value })).toBe(false);
      expect(resolveCharacterAppearance(value)).toEqual(getDefaultCharacterAppearance());
    }
  });
});

describe("bottoms value isolation, defaults and comparison", () => {
  it("preserves original role defaults and supplies independent display-only fallbacks", () => {
    for (const role of roles) {
      expect(getDefaultCharacterLook(role)).toEqual({ ...expanded.getDefaultCharacterLook(role), bottoms: "trousers", bottomsColor: "navy" });
      const fallback = resolveCharacterLook(undefined, role);
      fallback.bottoms = "shorts"; fallback.bottomsColor = "white";
      expect(resolveCharacterLook(undefined, role)).toEqual(getDefaultCharacterLook(role));
    }
    const first = getDefaultCharacterAppearance(), second = getDefaultCharacterAppearance();
    expect(first.runner).not.toBe(first.pursuer);
    first.runner.bottoms = "skirt"; first.pursuer.bottomsColor = "beige";
    expect(second.runner.bottoms).toBe("trousers"); expect(second.pursuer.bottomsColor).toBe("navy");
    for (const invalid of [undefined, null, false, [], "appearance", {}, { version: 3 }]) {
      const fallback = resolveCharacterAppearance(invalid);
      expect(fallback).toEqual(second);
      fallback.runner.bottoms = "jeans";
      expect(resolveCharacterAppearance(invalid)).toEqual(second);
      expect(isSaveAppearanceRequest({ appearance: invalid })).toBe(false);
    }
  });

  it.each([
    { name: "clone", copy: cloneCharacterAppearance },
    { name: "normalize", copy: normalizeCharacterAppearance },
    { name: "resolve", copy: resolveCharacterAppearance },
  ])("$name retains every latest choice without sharing role objects", ({ copy }) => {
    const source: CharacterAppearance = {
      version: 3,
      runner: { ...savedExpandedAppearance().runner, bottoms: "skirt", bottomsColor: "beige" },
      pursuer: { ...savedExpandedAppearance().pursuer, bottoms: "shorts", bottomsColor: "white" },
    };
    Object.defineProperty(source.runner, "bottoms", { enumerable: false });
    Object.defineProperty(source.pursuer, "bottomsColor", { enumerable: false });
    const result = copy(source)!;
    expect(result).toEqual({ version: 3,
      runner: { ...savedExpandedAppearance().runner, bottoms: "skirt", bottomsColor: "beige" },
      pursuer: { ...savedExpandedAppearance().pursuer, bottoms: "shorts", bottomsColor: "white" } });
    expect(result).not.toBe(source);
    expect(result.runner).not.toBe(source.runner); expect(result.pursuer).not.toBe(source.pursuer);
    expect(isCharacterAppearance(result)).toBe(true);
    result.runner.bottomsColor = "brown"; source.pursuer.bottoms = "jeans";
    expect(source.runner.bottomsColor).toBe("beige"); expect(result.pursuer.bottoms).toBe("shorts");
    expect(Object.isFrozen(source)).toBe(false);
  });

  it("compares fields independently of property order while distinguishing appearance versions", () => {
    const original = getDefaultCharacterAppearance();
    const reordered: CharacterAppearance = { version: 3, pursuer: { ...original.pursuer },
      runner: Object.fromEntries(Object.entries(original.runner).reverse()) as unknown as CharacterLook };
    expect(areCharacterAppearancesEqual(original, reordered)).toBe(true);
    expect(areCharacterAppearancesEqual(original, { ...original, version: 4 } as unknown as CharacterAppearance)).toBe(false);
  });

  it.each(fields)("detects a change in %s on either role while preserving every other choice", field => {
    const original = getDefaultCharacterAppearance();
    for (const role of roles) {
      const different = APPEARANCE_OPTIONS[field].find(option => option.value !== original[role][field])!;
      const next = cloneCharacterAppearance(original);
      next[role] = { ...next[role], [field]: different.value };
      expect(areCharacterAppearancesEqual(original, next)).toBe(false);
      const unchanged = cloneCharacterAppearance(next);
      unchanged[role] = { ...unchanged[role], [field]: original[role][field] };
      expect(areCharacterAppearancesEqual(original, unchanged)).toBe(true);
      expect(next[role === "runner" ? "pursuer" : "runner"]).toEqual(original[role === "runner" ? "pursuer" : "runner"]);
    }
  });
});
