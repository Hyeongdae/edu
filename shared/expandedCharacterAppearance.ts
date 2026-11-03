import {
  APPEARANCE_OPTIONS as LEGACY_APPEARANCE_OPTIONS,
  getDefaultCharacterLook as getDefaultLegacyCharacterLook,
  isCharacterAppearance as isLegacyCharacterAppearance,
  isCharacterLook as isLegacyCharacterLook,
} from "./legacyCharacterAppearance";
import type { AppearanceOption, CharacterRole, CharacterLook as LegacyCharacterLook } from "./legacyCharacterAppearance";

export type { AppearanceOption, CharacterRole } from "./legacyCharacterAppearance";

export interface CharacterLook {
  gender: "male" | "female";
  hairStyle: "short" | "side-part" | "bob" | "ponytail" | "long" | "curly";
  hairColor: "black" | "brown" | "gray" | "blond" | "blue" | "pink";
  skinTone: "light" | "peach" | "tan" | "deep";
  outfit: "shirt" | "suit" | "cardigan" | "hoodie" | "vest";
  outfitColor: "ivory" | "navy" | "purple" | "teal" | "rose" | "black" | "sky" | "orange" | "beige";
  hat: "none" | "straw" | "cap" | "beanie" | "beret";
  glasses: "none" | "square" | "round" | "sunglasses";
  shoes: "dress" | "sneakers" | "boots";
  shoeColor: "black" | "brown" | "white" | "navy" | "red" | "beige";
  eyeStyle: "default" | "round" | "smile" | "sleepy" | "sharp";
  bag: "none" | "backpack" | "laptop" | "crossbody" | "briefcase";
  bagColor: "black" | "brown" | "navy" | "beige";
}

export interface CharacterAppearance {
  version: 2;
  runner: CharacterLook;
  pursuer: CharacterLook;
}

const LOOK_FIELDS = [
  "gender", "hairStyle", "hairColor", "skinTone", "outfit", "outfitColor", "hat", "glasses", "shoes", "shoeColor",
  "eyeStyle", "bag", "bagColor",
] as const satisfies readonly (keyof CharacterLook)[];

const catalog: {
  readonly [K in keyof CharacterLook]: readonly AppearanceOption<CharacterLook[K]>[];
} = {
  ...LEGACY_APPEARANCE_OPTIONS,
  hairStyle: [
    ...LEGACY_APPEARANCE_OPTIONS.hairStyle,
    { value: "long", label: "장발" },
    { value: "curly", label: "곱슬머리" },
  ],
  hairColor: [
    ...LEGACY_APPEARANCE_OPTIONS.hairColor,
    { value: "blue", label: "파랑", swatch: "#386da8" },
    { value: "pink", label: "분홍", swatch: "#b96391" },
  ],
  outfit: [
    ...LEGACY_APPEARANCE_OPTIONS.outfit,
    { value: "hoodie", label: "후드티" },
    { value: "vest", label: "조끼" },
  ],
  outfitColor: [
    ...LEGACY_APPEARANCE_OPTIONS.outfitColor,
    { value: "black", label: "검정", swatch: "#283247" },
    { value: "sky", label: "하늘색", swatch: "#76b6d2" },
    { value: "orange", label: "주황", swatch: "#d58b43" },
    { value: "beige", label: "베이지", swatch: "#c8b38b" },
  ],
  hat: [
    ...LEGACY_APPEARANCE_OPTIONS.hat,
    { value: "beanie", label: "비니" },
    { value: "beret", label: "베레모" },
  ],
  glasses: [
    ...LEGACY_APPEARANCE_OPTIONS.glasses,
    { value: "sunglasses", label: "선글라스" },
  ],
  shoes: [
    ...LEGACY_APPEARANCE_OPTIONS.shoes,
    { value: "boots", label: "부츠" },
  ],
  shoeColor: [
    ...LEGACY_APPEARANCE_OPTIONS.shoeColor,
    { value: "navy", label: "남색", swatch: "#2a4168" },
    { value: "red", label: "빨강", swatch: "#ab4f5f" },
    { value: "beige", label: "베이지", swatch: "#c5b38a" },
  ],
  eyeStyle: [
    { value: "default", label: "기본" },
    { value: "round", label: "동그란 눈" },
    { value: "smile", label: "웃는 눈" },
    { value: "sleepy", label: "졸린 눈" },
    { value: "sharp", label: "날카로운 눈" },
  ],
  bag: [
    { value: "none", label: "없음" },
    { value: "backpack", label: "백팩" },
    { value: "laptop", label: "노트북 가방" },
    { value: "crossbody", label: "크로스백" },
    { value: "briefcase", label: "서류가방" },
  ],
  bagColor: [
    { value: "black", label: "검정", swatch: "#263247" },
    { value: "brown", label: "갈색", swatch: "#785039" },
    { value: "navy", label: "남색", swatch: "#30466d" },
    { value: "beige", label: "베이지", swatch: "#c8b38b" },
  ],
};

for (const field of LOOK_FIELDS) {
  for (const option of catalog[field]) Object.freeze(option);
  Object.freeze(catalog[field]);
}
export const APPEARANCE_OPTIONS = Object.freeze(catalog);

type BaseLook = Pick<CharacterLook, keyof LegacyCharacterLook>;

function copyBaseLook(value: BaseLook): BaseLook {
  return {
    gender: value.gender, hairStyle: value.hairStyle, hairColor: value.hairColor, skinTone: value.skinTone,
    outfit: value.outfit, outfitColor: value.outfitColor, hat: value.hat, glasses: value.glasses,
    shoes: value.shoes, shoeColor: value.shoeColor,
  };
}

function upgradeLegacyLook(value: LegacyCharacterLook): CharacterLook {
  return { ...copyBaseLook(value), eyeStyle: "default", bag: "none", bagColor: "black" };
}

function copyLook(value: CharacterLook): CharacterLook {
  return { ...copyBaseLook(value), eyeStyle: value.eyeStyle, bag: value.bag, bagColor: value.bagColor };
}

export function getDefaultCharacterLook(role: CharacterRole): CharacterLook {
  return upgradeLegacyLook(getDefaultLegacyCharacterLook(role));
}

export function getDefaultCharacterAppearance(): CharacterAppearance {
  return { version: 2, runner: getDefaultCharacterLook("runner"), pursuer: getDefaultCharacterLook("pursuer") };
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
    value.version === 2 && isCharacterLook(value.runner) && isCharacterLook(value.pursuer);
}

export function cloneCharacterAppearance(value: CharacterAppearance): CharacterAppearance {
  return { version: value.version, runner: copyLook(value.runner), pursuer: copyLook(value.pursuer) };
}

export function areCharacterAppearancesEqual(a: CharacterAppearance, b: CharacterAppearance): boolean {
  return a.version === b.version && LOOK_FIELDS.every(field =>
    a.runner[field] === b.runner[field] && a.pursuer[field] === b.pursuer[field]);
}

/** Read boundary: invalid data stays invalid; only the exact legacy schema is upgraded. */
export function normalizeCharacterLook(value: unknown): CharacterLook | null {
  if (isCharacterLook(value)) return copyLook(value);
  return isLegacyCharacterLook(value) ? upgradeLegacyLook(value) : null;
}

export function normalizeCharacterAppearance(value: unknown): CharacterAppearance | null {
  if (isCharacterAppearance(value)) return cloneCharacterAppearance(value);
  if (!isLegacyCharacterAppearance(value)) return null;
  return { version: 2, runner: upgradeLegacyLook(value.runner), pursuer: upgradeLegacyLook(value.pursuer) };
}

/** Display-only defaults. Save requests must pass the strict version-two validator. */
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
