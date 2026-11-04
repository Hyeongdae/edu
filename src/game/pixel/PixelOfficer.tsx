import type { ReactElement } from "react";
import type { Direction } from "../types";
import { resolveCharacterLook } from "../../../shared/expandedCharacterAppearance";
import type { CharacterLook } from "../../../shared/expandedCharacterAppearance";
import { OfficerHeadArt, OfficerOutfitArt, OfficerShoeArt } from "./OfficerAppearanceParts";
import { OfficerBagBackArt, OfficerBagFrontArt } from "./OfficerBagArt";
import { getOfficerPalette } from "./officerPalette";
import type { OfficerAppearanceInput } from "./officerPalette";

export type OfficerVariant = "young" | "older";
export type OfficerPose = "idle" | "climb" | "fall" | "jump";
type OfficerFrame = "idle" | "run-a" | "run-b" | "stumble";

interface PixelOfficerProps {
  variant: OfficerVariant;
  direction: Direction;
  pose: OfficerPose;
  appearance?: OfficerAppearanceInput;
}

const FRAMES: readonly OfficerFrame[] = ["idle", "run-a", "run-b", "stumble"];

function OfficerFrameArt({ variant, frame, appearance }: { variant: OfficerVariant; frame: OfficerFrame; appearance: CharacterLook }): ReactElement {
  const older = variant === "older";
  const stumble = frame === "stumble";
  const palette = getOfficerPalette(appearance);
  const { skin } = palette;
  const sleeve = appearance.outfit === "vest" ? "#e6f2ed" : palette.cloth;
  const sleeveShade = appearance.outfit === "vest" ? "#b7cad1" : palette.clothShade;
  const female = appearance.gender === "female";
  const backX = (older ? 7 : 6) + (female ? 1 : 0);
  const frontX = (older ? 25 : 26) - (female ? 1 : 0);
  const armWidth = (older ? 3 : 4) - (female ? 1 : 0);

  return (
    <g className={`officer-frame officer-frame--${frame}`} data-officer-frame={frame}>
      {/* All four poses share the same head height and shoe baseline (y=40). */}
      <OfficerBagBackArt variant={variant} appearance={appearance} pose="normal" />
      <OfficerHeadArt variant={variant} appearance={appearance} expression={stumble ? "stumble" : "normal"} />
      <OfficerOutfitArt variant={variant} appearance={appearance} pose="normal" />
      <OfficerBagFrontArt variant={variant} appearance={appearance} pose="normal" />
      {frame === "idle" && (
        <g>
          <rect className="officer-arm-back officer-sleeve" x={backX} y="24" width={armWidth} height="8" fill={sleeveShade} />
          {female && <rect className="officer-sleeve" x="10" y="24" width="2" height="2" fill={sleeveShade} />}
          <rect className="officer-hand" x={older ? 7 : 6} y="31" width={older ? 3 : 4} height="4" fill={skin} />
          <rect className="officer-arm-front officer-sleeve" x={frontX} y="24" width={armWidth} height="8" fill={sleeve} />
          <rect className="officer-hand" x={older ? 25 : 26} y="31" width={older ? 3 : 4} height="4" fill={skin} />
          <rect x={older ? 13 : 12} y="34" width={older ? 4 : 5} height="5" fill="#2c3b59" />
          <rect x="21" y="34" width={older ? 4 : 5} height="5" fill="#354766" />
          <OfficerShoeArt appearance={appearance} x={older ? 11 : 10} y={38} width={older ? 7 : 8} />
          <OfficerShoeArt appearance={appearance} x={20} y={38} width={older ? 8 : 9} />
        </g>
      )}
      {frame === "run-a" && (
        <g>
          <rect className="officer-arm-back officer-sleeve" x={backX} y="23" width={armWidth} height="6" fill={sleeveShade} />
          {female && <rect className="officer-sleeve" x="10" y="23" width="2" height="2" fill={sleeveShade} />}
          <rect className="officer-sleeve" x={older ? 4 : 3} y="27" width={older ? 5 : 6} height="3" fill={sleeveShade} />
          <rect className="officer-hand" x={older ? 2 : 1} y="28" width={older ? 3 : 4} height="4" fill={skin} />
          <rect className="officer-arm-front officer-sleeve" x={frontX} y="24" width={armWidth} height="6" fill={sleeve} />
          {female && <rect className="officer-sleeve" x={frontX + armWidth} y="24" width={older ? 2 : 1} height="2" fill={sleeve} />}
          <rect className="officer-hand" x="27" y="22" width={older ? 3 : 4} height="5" fill={skin} />
          <rect x="11" y="33" width={older ? 5 : 6} height="4" fill="#2c3b59" />
          <rect x="7" y="35" width={older ? 5 : 6} height="4" fill="#2c3b59" />
          <rect x="21" y="33" width={older ? 4 : 5} height="4" fill="#354766" />
          <rect x="24" y="36" width={older ? 4 : 5} height="3" fill="#354766" />
          <OfficerShoeArt appearance={appearance} x={5} y={38} width={9} />
          <OfficerShoeArt appearance={appearance} x={24} y={38} width={8} />
        </g>
      )}
      {frame === "run-b" && (
        <g>
          <rect className="officer-arm-back officer-sleeve" x={backX} y="23" width={armWidth} height="6" fill={sleeveShade} />
          {female && <rect className="officer-sleeve" x="10" y="23" width="2" height="2" fill={sleeveShade} />}
          {(female || older) && <rect className="officer-sleeve" x={older ? 5 : 6} y="24" width={backX + armWidth - (older ? 5 : 6)} height="2" fill={sleeveShade} />}
          <rect className="officer-hand" x="3" y="21" width={older ? 3 : 4} height="5" fill={skin} />
          <rect className="officer-arm-front officer-sleeve" x={frontX} y="24" width={armWidth} height="7" fill={sleeve} />
          {female && <rect className="officer-sleeve" x={frontX + 1} y="29" width={28 - frontX} height="2" fill={sleeve} />}
          <rect className="officer-hand" x="28" y="29" width={older ? 3 : 4} height="4" fill={skin} />
          <rect x="12" y="33" width={older ? 4 : 5} height="4" fill="#2c3b59" />
          <rect x="10" y="36" width={older ? 4 : 5} height="3" fill="#2c3b59" />
          <rect x="20" y="33" width={older ? 5 : 6} height="4" fill="#354766" />
          <rect x="24" y="35" width={older ? 5 : 6} height="4" fill="#354766" />
          <OfficerShoeArt appearance={appearance} x={8} y={38} width={8} />
          <OfficerShoeArt appearance={appearance} x={24} y={38} width={8} />
        </g>
      )}
      {stumble && (
        <g>
          <rect className="officer-arm-back officer-sleeve" x={(older ? 4 : 3) + (female ? 1 : 0)} y="22" width={(older ? 6 : 7) - (female ? 1 : 0)} height="4" fill={sleeveShade} />
          {female && <>
            <rect className="officer-sleeve" x="10" y="23" width="2" height="2" fill={sleeveShade} />
            <rect className="officer-sleeve" x="3" y="22" width="3" height="2" fill={sleeveShade} />
          </>}
          <rect className="officer-hand" x="0" y="20" width="4" height="5" fill={skin} />
          <rect className="officer-arm-front officer-sleeve" x={frontX} y="22" width={armWidth} height="4" fill={sleeve} />
          {female && <rect className="officer-sleeve" x={frontX + 1} y="22" width={28 - frontX} height="2" fill={sleeve} />}
          <rect className="officer-hand" x="28" y="19" width="4" height="5" fill={skin} />
          <rect x={older ? 9 : 8} y="33" width={older ? 8 : 9} height="4" fill="#2c3b59" />
          <rect x={older ? 7 : 6} y="36" width={older ? 5 : 6} height="3" fill="#2c3b59" />
          <rect x="21" y="33" width={older ? 6 : 7} height="4" fill="#354766" />
          <rect x="25" y="36" width={older ? 4 : 5} height="3" fill="#354766" />
          <OfficerShoeArt appearance={appearance} x={older ? 4 : 3} y={38} width={older ? 9 : 10} />
          <OfficerShoeArt appearance={appearance} x={24} y={38} width={older ? 7 : 8} />
          <rect x="1" y="5" width="2" height="6" fill="#ffd27a" />
          <rect x="1" y="13" width="2" height="2" fill="#ffd27a" />
        </g>
      )}
    </g>
  );
}

export function PixelOfficer({ variant, direction, pose, appearance }: PixelOfficerProps): ReactElement {
  const look = resolveCharacterLook(appearance, variant === "young" ? "runner" : "pursuer");
  return (
    <g
      className="pixel-officer" data-officer-variant={variant} data-officer-pose={pose}
      transform={`scale(${direction === "right" ? 1 : -1} 1)`}
      shapeRendering="crispEdges" aria-hidden="true"
    >
      <g className="officer-body">
        <g transform="translate(-32 -80) scale(2)">
          {FRAMES.map((frame) => <OfficerFrameArt key={frame} variant={variant} frame={frame} appearance={look} />)}
        </g>
      </g>
    </g>
  );
}
