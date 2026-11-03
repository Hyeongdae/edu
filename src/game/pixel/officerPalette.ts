import { APPEARANCE_OPTIONS, normalizeCharacterLook } from "../../../shared/expandedCharacterAppearance";
import type { AppearanceOption, CharacterLook as ExpandedLook } from "../../../shared/expandedCharacterAppearance";
import type { CharacterLook as LegacyLook } from "../../../shared/legacyCharacterAppearance";

export type OfficerAppearanceInput = ExpandedLook | LegacyLook;

export interface OfficerPalette {
  skin: string;
  skinShade: string;
  skinHighlight: string;
  hair: string;
  hairHighlight: string;
  cloth: string;
  clothShade: string;
  shoe: string;
  shoeSole: string;
  bag: string;
  bagShade: string;
}

const SKIN_DETAILS = {
  light: { shade: "#d89579", highlight: "#f3c7a5" },
  peach: { shade: "#d89579", highlight: "#ffe0bd" },
  tan: { shade: "#9c653f", highlight: "#dfaa7b" },
  deep: { shade: "#623923", highlight: "#ad7654" },
};
const HAIR_HIGHLIGHTS = { black: "#41516c", brown: "#976346", gray: "#89909e", blond: "#efd07b", blue: "#81b4df", pink: "#e9a2cb" };
const CLOTH_SHADES = { ivory: "#91b6c6", navy: "#1e2e4e", purple: "#4b425f", teal: "#255357", rose: "#82475f",
  black: "#161e2f", sky: "#49849e", orange: "#965c2b", beige: "#95815f" };
const BAG_SHADES = { black: "#141d2f", brown: "#4d3325", navy: "#1e2e4e", beige: "#95815f" };

function swatch<T extends string>(options: readonly AppearanceOption<T>[], value: T): string {
  const color = options.find(option => option.value === value)?.swatch;
  if (!color) throw new RangeError("Unknown character color.");
  return color;
}

export function getOfficerPalette(input: OfficerAppearanceInput): OfficerPalette {
  const appearance = normalizeCharacterLook(input);
  if (!appearance) throw new RangeError("Unknown character appearance.");
  return {
    skin: swatch(APPEARANCE_OPTIONS.skinTone, appearance.skinTone),
    skinShade: SKIN_DETAILS[appearance.skinTone].shade,
    skinHighlight: SKIN_DETAILS[appearance.skinTone].highlight,
    hair: swatch(APPEARANCE_OPTIONS.hairColor, appearance.hairColor),
    hairHighlight: HAIR_HIGHLIGHTS[appearance.hairColor],
    cloth: swatch(APPEARANCE_OPTIONS.outfitColor, appearance.outfitColor),
    clothShade: CLOTH_SHADES[appearance.outfitColor],
    shoe: swatch(APPEARANCE_OPTIONS.shoeColor, appearance.shoeColor),
    shoeSole: appearance.shoeColor === "white" ? "#52617b" : "#748398",
    bag: swatch(APPEARANCE_OPTIONS.bagColor, appearance.bagColor),
    bagShade: BAG_SHADES[appearance.bagColor],
  };
}
