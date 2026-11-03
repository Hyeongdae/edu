export type CharacterRole = "runner" | "pursuer";

export interface CharacterLook {
  gender: "male" | "female";
  hairStyle: "short" | "side-part" | "bob" | "ponytail";
  hairColor: "black" | "brown" | "gray" | "blond";
  skinTone: "light" | "peach" | "tan" | "deep";
  outfit: "shirt" | "suit" | "cardigan";
  outfitColor: "ivory" | "navy" | "purple" | "teal" | "rose";
  hat: "none" | "straw" | "cap";
  glasses: "none" | "square" | "round";
  shoes: "dress" | "sneakers";
  shoeColor: "black" | "brown" | "white";
}

export interface CharacterAppearance {
  version: 1;
  runner: CharacterLook;
  pursuer: CharacterLook;
}

export interface AppearanceOption<T extends string> {
  value: T;
  label: string;
  swatch?: string;
}

const LOOK_FIELDS = [
  "gender", "hairStyle", "hairColor", "skinTone", "outfit", "outfitColor", "hat", "glasses", "shoes", "shoeColor",
] as const satisfies readonly (keyof CharacterLook)[];

const catalog: {
  readonly [K in keyof CharacterLook]: readonly AppearanceOption<CharacterLook[K]>[];
} = {
  gender: [
    { value: "male", label: "남성" },
    { value: "female", label: "여성" },
  ],
  hairStyle: [
    { value: "short", label: "짧은 머리" },
    { value: "side-part", label: "가르마" },
    { value: "bob", label: "단발" },
    { value: "ponytail", label: "묶은 머리" },
  ],
  hairColor: [
    { value: "black", label: "검정", swatch: "#20283e" },
    { value: "brown", label: "갈색", swatch: "#6d412c" },
    { value: "gray", label: "회색", swatch: "#52556a" },
    { value: "blond", label: "금색", swatch: "#c79843" },
  ],
  skinTone: [
    { value: "light", label: "밝은 피부", swatch: "#e9b58b" },
    { value: "peach", label: "살구빛 피부", swatch: "#f5c49a" },
    { value: "tan", label: "구릿빛 피부", swatch: "#c88e60" },
    { value: "deep", label: "짙은 피부", swatch: "#86533a" },
  ],
  outfit: [
    { value: "shirt", label: "셔츠" },
    { value: "suit", label: "정장" },
    { value: "cardigan", label: "카디건" },
  ],
  outfitColor: [
    { value: "ivory", label: "아이보리", swatch: "#e6f2f3" },
    { value: "navy", label: "남색", swatch: "#30466d" },
    { value: "purple", label: "보라", swatch: "#746184" },
    { value: "teal", label: "청록", swatch: "#397f82" },
    { value: "rose", label: "장밋빛", swatch: "#b66a87" },
  ],
  hat: [
    { value: "none", label: "없음" },
    { value: "straw", label: "밀짚모자" },
    { value: "cap", label: "캡 모자" },
  ],
  glasses: [
    { value: "none", label: "없음" },
    { value: "square", label: "사각 안경" },
    { value: "round", label: "둥근 안경" },
  ],
  shoes: [
    { value: "dress", label: "구두" },
    { value: "sneakers", label: "운동화" },
  ],
  shoeColor: [
    { value: "black", label: "검정", swatch: "#10182c" },
    { value: "brown", label: "갈색", swatch: "#6f4935" },
    { value: "white", label: "흰색", swatch: "#e6ecef" },
  ],
};

// The catalog is also the allowlist used at the API boundary.
for (const field of LOOK_FIELDS) {
  for (const option of catalog[field]) Object.freeze(option);
  Object.freeze(catalog[field]);
}
export const APPEARANCE_OPTIONS = Object.freeze(catalog);

export function getDefaultCharacterLook(role: CharacterRole): CharacterLook {
  if (role === "runner") {
    return {
      gender: "male", hairStyle: "short", hairColor: "black", skinTone: "peach",
      outfit: "shirt", outfitColor: "ivory", hat: "none", glasses: "none", shoes: "dress", shoeColor: "black",
    };
  }
  return {
    gender: "male", hairStyle: "side-part", hairColor: "gray", skinTone: "light",
    outfit: "suit", outfitColor: "purple", hat: "straw", glasses: "square", shoes: "dress", shoeColor: "black",
  };
}

export function getDefaultCharacterAppearance(): CharacterAppearance {
  return { version: 1, runner: getDefaultCharacterLook("runner"), pursuer: getDefaultCharacterLook("pursuer") };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactOwnKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length &&
    keys.every((key) => typeof key === "string" && expected.includes(key));
}

export function isCharacterLook(value: unknown): value is CharacterLook {
  return isRecord(value) && hasExactOwnKeys(value, LOOK_FIELDS) &&
    LOOK_FIELDS.every((field) => APPEARANCE_OPTIONS[field].some((option) => option.value === value[field]));
}

export function isCharacterAppearance(value: unknown): value is CharacterAppearance {
  return isRecord(value) && hasExactOwnKeys(value, ["version", "runner", "pursuer"]) &&
    value.version === 1 && isCharacterLook(value.runner) && isCharacterLook(value.pursuer);
}

export function cloneCharacterAppearance(value: CharacterAppearance): CharacterAppearance {
  return { version: value.version, runner: { ...value.runner }, pursuer: { ...value.pursuer } };
}

/** Display/legacy-data fallback only. Save requests must pass the strict validator. */
export function resolveCharacterAppearance(value: unknown): CharacterAppearance {
  return isCharacterAppearance(value) ? cloneCharacterAppearance(value) : getDefaultCharacterAppearance();
}

export function areCharacterAppearancesEqual(a: CharacterAppearance, b: CharacterAppearance): boolean {
  return a.version === b.version && LOOK_FIELDS.every((field) =>
    a.runner[field] === b.runner[field] && a.pursuer[field] === b.pursuer[field]);
}

export interface SaveAppearanceRequest { appearance: CharacterAppearance }

export function isSaveAppearanceRequest(value: unknown): value is SaveAppearanceRequest {
  return isRecord(value) && hasExactOwnKeys(value, ["appearance"]) && isCharacterAppearance(value.appearance);
}
