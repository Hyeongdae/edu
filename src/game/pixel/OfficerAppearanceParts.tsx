import type { ReactElement } from "react";
import { resolveCharacterLook } from "../../../shared/expandedCharacterAppearance";
import type { CharacterLook as ExpandedLook } from "../../../shared/expandedCharacterAppearance";
import type { OfficerVariant } from "./PixelOfficer";
import { getOfficerPalette } from "./officerPalette";
import type { OfficerAppearanceInput } from "./officerPalette";

export type OfficerExpression = "normal" | "stumble" | "weary";
const INK = "#10182c";

const FRONT_HAIR = {
  short: "M10 3H25V6H27V8H23V6H19V9H11V12H8V5H10Z",
  "side-part": "M10 3H25V6H27V9H24V6H21V5H19V7H16V9H11V12H8V5H10Z",
  bob: "M10 3H25V6H27V11H24V7H21V9H14V7H11V13H8V5H10Z",
  ponytail: "M11 3H25V6H27V8H24V6H12V9H9V12H7V6H9V4H11Z",
  long: "M9 3H25V5H27V12H25V9H22V6H19V8H14V7H11V13H8V5H9Z",
  curly: "M9 2H13V1H18V2H23V3H27V6H29V9H26V7H23V9H20V7H17V9H14V7H11V11H7V7H6V4H9Z",
};

const NORMAL_LASHES = {
  default: "M13 10H14V11H15V12H13ZM24 11H25V10H26V12H24Z",
  round: "M12 10H14V12H13V11H12ZM26 10H28V11H27V12H26Z",
  smile: "M12 11H13V12H14V13H13V12H12ZM26 12H27V11H28V12H27V13H26Z",
  sleepy: "M12 11H14V13H13V12H12ZM26 11H28V12H27V13H26Z",
  sharp: "M14 11H16V13H15V12H14ZM26 11H28V12H27V13H26Z",
};

export function OfficerEyeArt({ variant, appearance, expression }: {
  variant: OfficerVariant;
  appearance: ExpandedLook;
  expression: OfficerExpression;
}): ReactElement {
  const female = appearance.gender === "female";
  const framed = appearance.glasses === "square" || appearance.glasses === "round";
  let eyes: ReactElement;
  if (expression === "weary") {
    eyes = <path d={framed ? "M14 13H18V14H14ZM23 13H27V14H23Z" : "M13 12H18V13H13ZM22 13H27V14H22Z"} />;
  } else if (expression === "stumble") {
    eyes = <>
      <rect x={framed ? 15 : 14} y={10} width={framed || female ? 2 : 3} height={framed ? 4 : 5} />
      <rect x={framed ? 24 : 23} y={10} width={framed || female ? 2 : 3} height={framed ? 4 : 5} />
    </>;
  } else if (appearance.eyeStyle === "round") {
    eyes = <>{[13, 22].map(x => <g key={x}>
      <path d={`M${x + 1} 10h3v1h1v3h-1v1h-3v-1h-1v-3h1Z`} />
      <rect x={x + 1} y="11" width="3" height="3" fill="#eef7ff" />
      <rect x={x + 2} y="12" width="2" height="2" />
    </g>)}</>;
  } else if (appearance.eyeStyle === "smile") {
    eyes = <path d="M13 13H14V12H17V13H18V14H16V13H15V14H13ZM22 13H23V12H26V13H27V14H25V13H24V14H22Z" />;
  } else if (appearance.eyeStyle === "sleepy") {
    eyes = <>
      <path d="M13 12H18V13H13ZM22 12H27V13H22Z" />
      <path d="M14 14H18V15H14ZM23 14H27V15H23Z" fill={getOfficerPalette(appearance).skinShade} />
    </>;
  } else if (appearance.eyeStyle === "sharp") {
    eyes = <path d="M15 12H18V13H15ZM24 12H27V13H24Z" />;
  } else if (framed) {
    eyes = <path d="M16 12H18V14H16ZM25 12H27V14H25Z" />;
  } else {
    eyes = <>
      <rect x="14" y="11" width={female ? 2 : 3} height="3" />
      <rect x="23" y="11" width={female ? 2 : 3} height="3" />
    </>;
  }
  // Brows are separate from the selected pupils, including the sharp eye style.
  const brows = expression === "stumble"
    ? female ? "M13 7H17V8H13ZM23 7H27V8H23Z" : "M13 7H18V9H13ZM23 7H28V9H23Z"
    : expression === "weary"
      ? female ? "M13 9H16V10H18V11H16V10H13ZM22 10H24V9H27V10H24V11H22Z"
        : "M13 8H16V9H18V11H15V10H13ZM22 9H24V8H28V10H25V11H22Z"
      : appearance.eyeStyle === "sharp"
        ? female ? "M13 9H15V10H18V11H16V10H13ZM22 10H25V9H27V10H26V11H22Z"
          : "M13 8H15V9H18V11H16V10H13ZM22 9H25V8H28V10H26V11H22Z"
        : female ? "M13 8H17V9H13ZM23 8H27V9H23Z" : "M13 8H18V10H13ZM23 8H28V10H23Z";
  const lashes = expression === "weary"
    ? framed ? "M13 12H15V14H14V13H13ZM26 12H28V13H27V14H26Z"
      : "M12 11H14V13H13V12H12ZM26 12H28V13H27V14H26Z"
    : expression === "stumble"
      ? framed ? "M14 9H16V11H15V10H14ZM25 9H27V10H26V11H25Z"
        : "M13 9H15V11H14V10H13ZM24 9H26V10H25V11H24Z"
      : appearance.eyeStyle === "default" && framed
        ? "M15 11H17V13H16V12H15ZM26 11H28V12H27V13H26Z" : NORMAL_LASHES[appearance.eyeStyle];
  return <g className="officer-eyes" data-eye-style={appearance.eyeStyle} data-expression={expression}
    data-eye-variant={variant} data-appearance-gender={appearance.gender} fill={INK}>
    <g className="officer-eye-shape">{eyes}</g>
    <g className="officer-eyebrows"><path d={brows} /></g>
    {female && <g className="officer-eyelashes"><path d={lashes} /></g>}
  </g>;
}

export function OfficerHeadArt({ variant, appearance: input, expression }: {
  variant: OfficerVariant;
  appearance: OfficerAppearanceInput;
  expression: OfficerExpression;
}): ReactElement {
  const appearance = resolveCharacterLook(input, variant === "older" ? "pursuer" : "runner");
  const palette = getOfficerPalette(appearance);
  const female = appearance.gender === "female", older = variant === "older";
  const stumble = expression === "stumble", weary = expression === "weary";
  return (
    <g className="officer-head-art" data-appearance-gender={appearance.gender}>
      {appearance.hairStyle === "bob" && <g className="officer-hair-back officer-hair--bob">
        <path d="M8 4H27V7H29V22H26V24H8V22H6V7H8Z" fill={INK} />
        <path d="M8 8H27V21H25V23H9V21H8Z" fill={palette.hair} />
      </g>}
      {appearance.hairStyle === "ponytail" && <g className="officer-hair-back officer-hair--ponytail">
        <path d="M4 7H9V13H8V18H6V23H1V17H3V11H2V8H4Z" fill={INK} />
        <path d="M4 9H8V12H6V17H5V21H2V18H4Z" fill={palette.hair} />
        <rect x="5" y="10" width="3" height="2" fill={palette.cloth} />
      </g>}
      {appearance.hairStyle === "long" && <g className="officer-hair-back officer-hair--long">
        <path d="M8 3H26V6H28V27H30V30H24V28H9V31H4V27H6V7H8Z" fill={INK} />
        <path d="M8 8H26V25H27V29H25V26H8V29H5V28H7V10H8Z" fill={palette.hair} />
        <path d="M8 17H9V27H8ZM25 15H26V25H25Z" fill={palette.hairHighlight} />
      </g>}
      <path className="officer-face-outline" d={female
        ? "M10 2H24V4H27V16H26V18H24V20H22V21H21V22H15V21H13V20H11V18H9V16H7V5H10Z"
        : "M10 2H25V4H28V19H25V22H10V19H7V4H10Z"} fill={INK} />
      {female ? <path className="officer-face-skin" d="M9 7H26V15H25V17H23V19H21V20H15V19H13V18H11V16H9Z" fill={palette.skin} />
        : <rect className="officer-face-skin" x="9" y="7" width="17" height="12" fill={palette.skin} />}
      {female ? <path className="officer-jaw-skin" d="M15 19H22V20H21V21H16V20H15Z" fill={palette.skin} />
        : <rect className="officer-jaw-skin" x="12" y="19" width="12" height="2" fill={palette.skin} />}
      <rect x="26" y="11" width={female ? 2 : 3} height={female ? 3 : 4} fill={palette.skin} />
      <rect x="7" y="11" width={female ? 3 : 4} height={female ? 4 : 6} fill={palette.skinShade} />
      <rect x="9" y="12" width={female ? 1 : 2} height={female ? 2 : 3} fill={palette.skin} />
      {female ? <path className="officer-neck-skin" d="M17 21H21V22H22V24H16V22H17Z" fill={palette.skin} />
        : <rect className="officer-neck-skin" x="16" y="21" width="6" height="3" fill={palette.skin} />}
      <g className={`officer-hair-front officer-hair--${appearance.hairStyle}`}>
        <path d={FRONT_HAIR[appearance.hairStyle]} fill={palette.hair} />
        <rect x={appearance.hairStyle === "side-part" ? 11 : 12} y="4" width={appearance.hairStyle === "side-part" ? 7 : 10} height="1" fill={palette.hairHighlight} />
        {appearance.hairStyle === "side-part" && <rect x="20" y="4" width="1" height="3" fill={palette.hairHighlight} />}
      </g>
      {older && <g className="officer-age-lines" fill={palette.skinShade}>
        <path d="M10 15H12V16H10ZM25 16H27V17H25ZM16 8H21V9H16Z" />
      </g>}
      {(appearance.glasses === "none" || appearance.glasses === "sunglasses") &&
        <OfficerEyeArt variant={variant} appearance={appearance} expression={expression} />}
      <rect x="12" y="16" width={female ? 2 : 3} height={female ? 1 : 2} fill={palette.skinShade} fillOpacity="0.5" />
      <rect x={female ? 23 : 24} y="16" width="2" height="1" fill={palette.skinHighlight} />
      <path className="officer-mouth" d={female
        ? weary ? "M18 19H21V20H18Z" : stumble ? "M19 18H21V20H19Z" : "M18 18H22V19H18ZM22 17H23V18H22Z"
        : weary ? "M18 19H23V20H18Z" : stumble ? "M19 18H22V20H19Z" : "M19 18H24V19H19ZM23 17H25V18H23Z"} fill="#874e56" />
      {(appearance.glasses === "square" || appearance.glasses === "round") && <g className={`officer-glasses officer-glasses--${appearance.glasses}`}>
        {appearance.glasses === "square" ? <>
          <path d="M12 10H19V16H12ZM21 10H28V16H21Z" fill={INK} />
          <path d="M13 11H18V14H13ZM22 11H27V14H22Z" fill="#d8e7de" />
        </> : <>
          <path d="M13 10H18V11H19V15H18V16H13V15H12V11H13ZM22 10H27V11H28V15H27V16H22V15H21V11H22Z" fill={INK} />
          <path d="M14 11H17V12H18V14H17V15H14V14H13V12H14ZM23 11H26V12H27V14H26V15H23V14H22V12H23Z" fill="#d8e7de" />
        </>}
        <rect x="19" y="11" width="2" height="2" fill={INK} />
        <OfficerEyeArt variant={variant} appearance={appearance} expression={expression} />
      </g>}
      {appearance.glasses === "sunglasses" && <g className="officer-glasses officer-glasses--sunglasses">
        <path d="M11 10H28V11H29V15H27V17H22V15H20V12H19V15H17V17H12V15H11Z" fill={INK} />
        <path className="officer-sunglass-lenses" d="M12 11H18V14H17V16H13V14H12ZM21 11H28V14H27V16H23V14H21Z" fill="#263247" />
        <path d="M13 11H16V12H13ZM23 11H26V12H23Z" fill="#7fa5b4" />
      </g>}
      {appearance.hat === "straw" && <g className="officer-straw-hat">
        <path d="M10 7V5H12V3H15V1H21V3H24V5H26V7H29V8H31V10H5V8H8V7Z" fill="#b9772d" />
        <path d="M11 6V4H14V2H22V4H25V7H11Z" fill="#f0c451" />
        <rect x="13" y="4" width="10" height="2" fill="#a85f2a" />
        <rect x="7" y="8" width="22" height="1" fill="#ffe18a" />
      </g>}
      {appearance.hat === "cap" && <g className="officer-cap-hat">
        <path d="M10 2H24V4H27V7H32V10H8V5H10Z" fill={INK} />
        <path d="M11 3H23V5H26V8H9V6H11Z" fill={palette.cloth} />
        <path d="M22 8H31V9H22ZM12 4H17V5H12Z" fill={palette.clothShade} />
      </g>}
      {appearance.hat === "beanie" && <g className="officer-beanie-hat">
        <path d="M11 0H23V2H26V4H28V9H7V4H9V2H11Z" fill={INK} />
        <path d="M12 1H22V3H25V5H26V7H9V5H10V3H12Z" fill={palette.cloth} />
        <path d="M8 6H27V9H8Z" fill={palette.clothShade} />
        <path d="M12 2H13V5H12ZM17 1H18V5H17ZM22 3H23V5H22Z" fill="#eef7ff" fillOpacity="0.25" />
      </g>}
      {appearance.hat === "beret" && <g className="officer-beret-hat">
        <path d="M17 0H19V2H25V3H29V5H30V8H27V10H8V8H5V5H8V3H13V2H17Z" fill={INK} />
        <path d="M13 3H25V4H28V6H29V7H26V9H9V7H6V6H9V4H13Z" fill={palette.cloth} />
        <path d="M9 8H26V10H9ZM17 1H18V3H17Z" fill={palette.clothShade} />
      </g>}
    </g>
  );
}

export function OfficerOutfitArt({ variant, appearance: input, pose }: {
  variant: OfficerVariant;
  appearance: OfficerAppearanceInput;
  pose: "normal" | "dragged";
}): ReactElement {
  const older = variant === "older", dragged = pose === "dragged";
  const appearance = resolveCharacterLook(input, older ? "pursuer" : "runner");
  const palette = getOfficerPalette(appearance);
  const female = appearance.gender === "female";
  const femaleOutline = dragged
    ? older ? "M9 22H21V25H24V29H23V32H24V34H12V32H13V29H10V26H9Z"
      : "M8 22H22V25H25V29H24V32H25V34H11V32H12V29H9V26H8Z"
    : older ? "M11 22H25V25H24V29H23V32H24V34H12V32H13V29H12V25H11Z"
      : "M10 22H26V25H25V29H24V32H25V34H11V32H12V29H11V25H10Z";
  const femaleCloth = dragged
    ? older ? "M10 23H20V26H23V29H22V32H23V33H13V32H14V29H11V26H10Z"
      : "M9 23H21V26H24V29H23V32H24V33H12V32H13V29H10V26H9Z"
    : older ? "M12 23H24V25H23V29H22V32H23V33H13V32H14V29H13V25H12Z"
      : "M11 23H25V25H24V29H23V32H24V33H12V32H13V29H12V25H11Z";
  return (
    <g className={`officer-outfit officer-outfit--${appearance.outfit}`} data-appearance-gender={appearance.gender}>
      <path className="officer-torso-outline" d={female ? femaleOutline : dragged
        ? older ? "M8 22H22V25H25V34H11V30H8Z" : "M7 22H23V25H27V34H10V30H7Z"
        : older ? "M10 22H26V34H10Z" : "M9 22H27V34H9Z"} fill={INK} />
      {female ? <path className="officer-cloth" d={femaleCloth} fill={palette.cloth} />
        : dragged ? <path className="officer-cloth" d={older ? "M9 23H21V26H24V32H12V29H9Z" : "M8 23H22V26H26V32H11V29H8Z"} fill={palette.cloth} />
        : <rect className="officer-cloth" x={older ? 11 : 10} y="23" width={older ? 14 : 16} height="9" fill={palette.cloth} />}
      {female ? <path d={`M${older ? 12 : 11} 24H14V26H15V29H16V32H14V29H13V26H${older ? 12 : 11}Z`} fill={palette.clothShade} />
        : <rect x={older ? 11 : 10} y="24" width={older ? 2 : 3} height="8" fill={palette.clothShade} />}
      <rect x={female && dragged ? 15 : 16} y="23" width={female ? older ? 5 : 6 : older ? 7 : 8} height="9" fill={appearance.outfit === "hoodie" ? palette.cloth : "#e6f2ed"} />
      {appearance.outfit === "shirt" && <g className="officer-shirt-details">
        <path d={female ? "M15 23H17V24H18V25H16V24H15ZM19 23H21V24H20V25H19Z" : "M16 23H18V25H16ZM22 23H24V25H22Z"} fill="#b7cad1" />
        <path d="M20 26H21V27H20ZM20 29H21V30H20ZM20 31H21V32H20Z" fill={INK} />
      </g>}
      {appearance.outfit === "suit" && <g className="officer-suit-details">
        <path d={female ? "M14 23H16V25H18V27H19V29H17V30H15V28H16V26H14ZM19 23H21V25H22V27H21V29H20V27H19Z" : "M14 23H16V25H19V28H18V29H16V30H14V28H16V26H14ZM24 23H25V27H23V29H21V27H23V25H24Z"} fill={palette.clothShade} />
        <rect x={female ? 18 : 19} y="24" width={female ? 2 : 3} height="2" fill={older ? "#61e8e1" : "#f07c9f"} />
        <rect x={female ? 19 : 20} y="26" width={female ? 1 : 2} height="4" fill={older ? "#36a2aa" : "#c84e76"} />
      </g>}
      {appearance.outfit === "cardigan" && <g className="officer-cardigan-details">
        <path d={female ? "M14 23H16V25H18V27H20V32H18V28H16V26H14ZM19 23H21V25H22V27H21V32H20V27H19Z" : "M14 23H16V25H18V27H20V32H17V28H15V26H14ZM23 23H25V26H23V28H21V32H20V27H21V25H23Z"} fill={palette.clothShade} />
        <path d="M19 28H20V29H19ZM19 30H20V31H19Z" fill="#ffd27a" />
      </g>}
      {appearance.outfit === "hoodie" && <g className="officer-hoodie-details">
        <path d={female ? "M14 22H16V24H19V22H21V24H20V26H16V24H14ZM16 28H22V31H16Z" : "M14 22H17V24H22V22H25V24H23V26H16V24H14ZM17 28H24V31H17Z"} fill={palette.clothShade} />
        <path d={female ? "M16 25H17V28H16ZM20 25H21V28H20Z" : "M17 25H18V28H17ZM22 25H23V28H22Z"} fill="#e6f2ed" />
        <path d="M19 29H22V30H19Z" fill={palette.cloth} />
      </g>}
      {appearance.outfit === "vest" && <g className="officer-vest-details">
        <path d={female ? "M14 23H16V25H18V27H19V32H15V30H14ZM19 23H21V25H22V30H21V32H20V27H19Z" : "M14 23H16V25H18V27H20V32H15V31H14ZM24 23H25V31H23V32H21V27H22V25H24Z"} fill={palette.clothShade} />
        <path d="M20 28H21V29H20ZM20 30H21V31H20Z" fill="#ffd27a" />
      </g>}
      <rect x={female ? 14 : 13} y="24" width="1" height="4" fill="#ffd27a" />
      <rect x={female ? 13 : 12} y="27" width="4" height="5" fill={INK} />
      <rect x={female ? 14 : 13} y="28" width="2" height="3" fill="#eef7ff" />
      <rect x={female ? 14 : 13} y="28" width="2" height="1" fill="#61e8e1" />
      <rect x={female ? older ? 13 : 12 : older ? 12 : 11} y="32" width={female ? older ? 10 : 12 : older ? 13 : 15} height="2" fill={INK} />
      <rect x="19" y="32" width="2" height="1" fill="#b8c8d3" />
    </g>
  );
}

export function OfficerShoeArt({ appearance, x, y, width }: {
  appearance: OfficerAppearanceInput;
  x: number;
  y: number;
  width: number;
}): ReactElement {
  const palette = getOfficerPalette(appearance);
  return (
    <g className={`officer-shoe officer-shoe--${appearance.shoes}`}>
      {appearance.shoes === "boots" && <>
        <rect className="officer-boot-upper" x={x + 1} y={y - 3} width={width - 2} height="3" fill={palette.shoe} />
        <rect x={x + 1} y={y - 3} width={width - 2} height="1" fill={palette.shoeSole} />
      </>}
      <rect className="officer-shoe-base" x={x} y={y} width={width} height="2" fill={palette.shoe} />
      {appearance.shoes === "boots" ? <rect className="officer-boot-sole" x={x} y={y + 1} width={width} height="1" fill={palette.shoeSole} /> : appearance.shoes === "sneakers" ? <>
        <rect className="officer-shoe-sole" x={x} y={y + 1} width={width} height="1" fill={palette.shoeSole} />
        <rect x={x + 2} y={y} width="2" height="1" fill={palette.shoeSole} />
      </> : <rect x={x + width - 2} y={y} width="1" height="1" fill={palette.shoeSole} fillOpacity="0.4" />}
    </g>
  );
}
