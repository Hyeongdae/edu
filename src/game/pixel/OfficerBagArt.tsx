import type { ReactElement } from "react";
import type { CharacterLook as ExpandedLook } from "../../../shared/expandedCharacterAppearance";
import type { OfficerVariant } from "./PixelOfficer";
import { getOfficerPalette } from "./officerPalette";

export type OfficerBagPose = "normal" | "dragged" | "seated";
export interface OfficerBagArtProps {
  variant: OfficerVariant;
  appearance: ExpandedLook;
  pose: OfficerBagPose;
}

const INK = "#10182c";

function placement({ variant, appearance, pose }: OfficerBagArtProps): string {
  let x = variant === "older" ? -1 : 0;
  const y = pose === "seated" ? 1 : 0;
  // The briefcase follows the free hand when the other hand is being pulled or using the desk.
  if (appearance.bag === "briefcase") x -= 24;
  if (pose === "dragged") x -= 1;
  return `translate(${x} ${y})`;
}

export function OfficerBagBackArt(props: OfficerBagArtProps): ReactElement | null {
  const { appearance, pose } = props;
  if (appearance.bag === "none") return null;
  const palette = getOfficerPalette(appearance);
  return (
    <g className="officer-bag-back" data-bag-kind={appearance.bag} data-bag-pose={pose} transform={placement(props)}>
      {appearance.bag === "backpack" ? <>
        <path d="M5 22H9V24H11V34H9V35H2V25H4V23H5Z" fill={INK} />
        <path className="officer-bag-fill" d="M5 24H9V25H10V33H8V34H3V26H5Z" fill={palette.bag} />
        <path d="M3 29H9V33H3ZM5 23H8V24H5Z" fill={palette.bagShade} />
        <path d="M4 26H8V27H4ZM4 30H8V31H4Z" fill="#eef7ff" fillOpacity="0.35" />
      </> : appearance.bag === "briefcase" ? <>
        <path className="officer-bag-handle" d="M28 27H32V31H31V28H29V31H28Z" fill={INK} />
        <rect x="29" y="27" width="2" height="1" fill={palette.bagShade} />
      </> : <path d="M24 22H27V26H25V24H24Z" fill={palette.bagShade} />}
    </g>
  );
}

export function OfficerBagFrontArt(props: OfficerBagArtProps): ReactElement | null {
  const { appearance, pose } = props;
  if (appearance.bag === "none") return null;
  const palette = getOfficerPalette(appearance);
  return (
    <g className="officer-bag-front" data-bag-kind={appearance.bag} data-bag-pose={pose} transform={placement(props)}>
      {appearance.bag === "backpack" ? <>
        <path className="officer-bag-straps" d="M10 23H12V32H10ZM24 23H26V32H24Z" fill={palette.bagShade} />
        <path d="M11 24H12V30H11ZM25 24H26V30H25Z" fill={palette.bag} />
        <path d="M10 30H12V31H10ZM24 30H26V31H24Z" fill="#c3cbd2" />
      </> : appearance.bag === "laptop" ? <>
        <path className="officer-bag-straps" d="M24 23H26V28H28V30H26V29H24Z" fill={palette.bagShade} />
        <path className="officer-bag-case" d="M19 28H28V29H29V36H18V29H19Z" fill={INK} />
        <rect className="officer-bag-fill" x="19" y="30" width="9" height="5" fill={palette.bag} />
        <path d="M19 30H28V31H19ZM19 34H28V35H19Z" fill={palette.bagShade} />
        <rect x="20" y="31" width="1" height="2" fill="#d2dce2" />
      </> : appearance.bag === "crossbody" ? <>
        <path className="officer-bag-straps" d="M24 23H26V25H24V27H22V29H20V28H21V26H23V24H24Z" fill={palette.bagShade} />
        <path className="officer-bag-case" d="M19 28H25V29H26V33H25V34H18V33H17V29H19Z" fill={INK} />
        <path className="officer-bag-fill" d="M19 29H24V30H25V32H24V33H19V32H18V30H19Z" fill={palette.bag} />
        <path d="M19 29H24V31H19Z" fill={palette.bagShade} />
        <rect x="21" y="31" width="2" height="1" fill="#d2dce2" />
      </> : <>
        <path className="officer-bag-case" d="M27 30H32V31H33V36H32V37H26V36H25V31H27Z" fill={INK} />
        <rect className="officer-bag-fill" x="26" y="31" width="6" height="5" fill={palette.bag} />
        <rect x="26" y="34" width="6" height="1" fill={palette.bagShade} />
        <rect x="29" y="34" width="1" height="1" fill="#ffd27a" />
      </>}
    </g>
  );
}
