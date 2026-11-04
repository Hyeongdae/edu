import {
  APPEARANCE_OPTIONS as EXPANDED_APPEARANCE_OPTIONS,
  getDefaultCharacterLook as getDefaultExpandedLook,
  normalizeCharacterAppearance as normalizeExpandedAppearance,
  normalizeCharacterLook as normalizeExpandedLook,
} from "./expandedCharacterAppearance";
import type { AppearanceOption, CharacterRole, CharacterLook as ExpandedLook } from "./expandedCharacterAppearance";

export type { AppearanceOption, CharacterRole } from "./expandedCharacterAppearance";

export interface CharacterLook extends ExpandedLook {
  bottoms: "trousers" | "jeans" | "shorts" | "skirt";
  bottomsColor: "black" | "navy" | "gray" | "beige" | "brown" | "white";
}

export interface CharacterAppearance {
  version: 3;
  runner: CharacterLook;
  pursuer: CharacterLook;
}

const LOOK_FIELDS = [
  "gender", "hairStyle", "hairColor", "skinTone", "outfit", "outfitColor", "hat", "glasses", "shoes", "shoeColor",
  "eyeStyle", "bag", "bagColor", "bottoms", "bottomsColor",
] as const satisfies readonly (keyof CharacterLook)[];

const catalog: {
  readonly [K in keyof CharacterLook]: readonly AppearanceOption<CharacterLook[K]>[];
} = {
  ...EXPANDED_APPEARANCE_OPTIONS,
  bottoms: [
    { value: "trousers", label: "긴바지" },
    { value: "jeans", label: "청바지" },
    { value: "shorts", label: "반바지" },
    { value: "skirt", label: "치마" },
  ],
  bottomsColor: [
    { value: "black", label: "검정", swatch: "#283247" },
    { value: "navy", label: "남색", swatch: "#354766" },
    { value: "gray", label: "회색", swatch: "#788394" },
    { value: "beige", label: "베이지", swatch: "#c8b38b" },
    { value: "brown", label: "갈색", swatch: "#785039" },
    { value: "white", label: "흰색", swatch: "#e6edf2" },
  ],
};

for (const field of LOOK_FIELDS) {
  for (const option of catalog[field]) Object.freeze(option);
  Object.freeze(catalog[field]);
}
export const APPEARANCE_OPTIONS = Object.freeze(catalog);

function withDefaultBottoms(value: ExpandedLook): CharacterLook {
  return { ...value, bottoms: "trousers", bottomsColor: "navy" };
}

function copyLook(value: CharacterLook): CharacterLook {
  // Copy known fields explicitly so valid non-enumerable choices are retained.
  return {
    gender: value.gender, hairStyle: value.hairStyle, hairColor: value.hairColor, skinTone: value.skinTone,
    outfit: value.outfit, outfitColor: value.outfitColor, hat: value.hat, glasses: value.glasses,
    shoes: value.shoes, shoeColor: value.shoeColor, eyeStyle: value.eyeStyle, bag: value.bag, bagColor: value.bagColor,
    bottoms: value.bottoms, bottomsColor: value.bottomsColor,
  };
}

export function getDefaultCharacterLook(role: CharacterRole): CharacterLook {
  return withDefaultBottoms(getDefaultExpandedLook(role));
}

export function getDefaultCharacterAppearance(): CharacterAppearance {
  return { version: 3, runner: getDefaultCharacterLook("runner"), pursuer: getDefaultCharacterLook("pursuer") };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactOwnKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length && keys.every(key => typeof key === "string" && expected.includes(key));
}

export function isCharacterLook(value: unknown): value is CharacterLook {
  return isRecord(value) && hasExactOwnKeys(value, LOOK_FIELDS) &&
    LOOK_FIELDS.every(field => APPEARANCE_OPTIONS[field].some(option => option.value === value[field]));
}

export function isCharacterAppearance(value: unknown): value is CharacterAppearance {
  return isRecord(value) && hasExactOwnKeys(value, ["version", "runner", "pursuer"]) &&
    value.version === 3 && isCharacterLook(value.runner) && isCharacterLook(value.pursuer);
}

export function cloneCharacterAppearance(value: CharacterAppearance): CharacterAppearance {
  return { version: value.version, runner: copyLook(value.runner), pursuer: copyLook(value.pursuer) };
}

export function areCharacterAppearancesEqual(a: CharacterAppearance, b: CharacterAppearance): boolean {
  return a.version === b.version && LOOK_FIELDS.every(field =>
    a.runner[field] === b.runner[field] && a.pursuer[field] === b.pursuer[field]);
}

/** Read compatibility only: preserve exact older choices and add the two missing defaults. */
export function normalizeCharacterLook(value: unknown): CharacterLook | null {
  if (isCharacterLook(value)) return copyLook(value);
  const previous = normalizeExpandedLook(value);
  return previous ? withDefaultBottoms(previous) : null;
}

export function normalizeCharacterAppearance(value: unknown): CharacterAppearance | null {
  if (isCharacterAppearance(value)) return cloneCharacterAppearance(value);
  const previous = normalizeExpandedAppearance(value);
  return previous ? {
    version: 3, runner: withDefaultBottoms(previous.runner), pursuer: withDefaultBottoms(previous.pursuer),
  } : null;
}

/** Display-only fallbacks. Save requests must pass the strict version-three validator. */
export function resolveCharacterLook(value: unknown, role: CharacterRole): CharacterLook {
  return normalizeCharacterLook(value) ?? getDefaultCharacterLook(role);
}

export function resolveCharacterAppearance(value: unknown): CharacterAppearance {
  return normalizeCharacterAppearance(value) ?? getDefaultCharacterAppearance();
}

export interface SaveAppearanceRequest { appearance: CharacterAppearance }

export function isSaveAppearanceRequest(value: unknown): value is SaveAppearanceRequest {
  return isRecord(value) && hasExactOwnKeys(value, ["appearance"]) && isCharacterAppearance(value.appearance);
}
