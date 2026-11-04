import type { ReactElement } from "react";
import type { OfficerVariant } from "./PixelOfficer";
import { resolveCharacterLook } from "../../../shared/expandedCharacterAppearance";
import { OfficerHeadArt, OfficerOutfitArt, OfficerShoeArt } from "./OfficerAppearanceParts";
import { OfficerBagBackArt, OfficerBagFrontArt } from "./OfficerBagArt";
import { getOfficerPalette } from "./officerPalette";
import type { OfficerAppearanceInput } from "./officerPalette";

export type OvertimeOfficerPose = "standing" | "grabbing" | "dragged" | "seated";

export interface OvertimeOfficerProps {
  variant: OfficerVariant;
  pose: OvertimeOfficerPose;
  appearance?: OfficerAppearanceInput;
}

export function OvertimeOfficer({ variant, pose, appearance }: OvertimeOfficerProps): ReactElement {
  const older = variant === "older", seated = pose === "seated", dragged = pose === "dragged";
  const look = resolveCharacterLook(appearance, older ? "pursuer" : "runner");
  const palette = getOfficerPalette(look);
  const { skin, skinShade } = palette;
  const sleeve = look.outfit === "vest" ? "#e6f2ed" : palette.cloth;
  const shade = look.outfit === "vest" ? "#b7cad1" : palette.clothShade;
  const bagPose = dragged ? "dragged" : seated ? "seated" : "normal";
  const ink = "#10182c";
  const female = look.gender === "female";
  const backX = (older ? 7 : 6) + (female ? 1 : 0);
  const frontX = (older ? 25 : 26) - (female ? 1 : 0);
  const armWidth = (older ? 3 : 4) - (female ? 1 : 0);

  return (
    <g className="overtime-officer" data-officer-variant={variant} data-overtime-pose={pose}
      shapeRendering="crispEdges" aria-hidden="true">
      <g transform="translate(-32 -80) scale(2)">
        <OfficerBagBackArt variant={variant} appearance={look} pose={bagPose} />
        <g className="overtime-officer-head" transform={seated ? "translate(3 4)" : dragged ? "translate(-2 0)" : undefined}>
          <OfficerHeadArt variant={variant} appearance={look} expression={seated || dragged ? "weary" : "normal"} />
        </g>
        <rect x="16" y="21" width="6" height="4" fill={skin} />
        <OfficerOutfitArt variant={variant} appearance={look} pose={dragged ? "dragged" : "normal"} />
        <OfficerBagFrontArt variant={variant} appearance={look} pose={bagPose} />

        {pose === "grabbing" ? <g className="overtime-officer-grip">
          <path d={female ? older ? "M5 23H12V27H8V28H5Z" : "M4 23H12V27H8V28H4Z" : older ? "M4 23H10V29H7V27H4Z" : "M3 23H11V29H7V27H3Z"} fill={ink} />
          <path className="officer-arm-back officer-sleeve" d={female ? older ? "M6 24H12V26H8V27H6Z" : "M5 24H12V26H8V27H5Z" : older ? "M5 24H10V27H8V26H5Z" : "M4 24H11V27H8V26H4Z"} fill={shade} />
          <rect className="officer-hand" x={older ? 2 : 1} y="24" width={older ? 4 : 5} height="4" fill={skin} />
          <rect x={older ? 2 : 1} y="27" width={older ? 3 : 4} height="1" fill={skinShade} />
          <path className="officer-arm-front officer-sleeve" d={`M${frontX} 24H${frontX + armWidth}V32H${frontX}Z`} fill={sleeve} />
          <rect className="officer-hand" x={older ? 25 : 26} y="31" width={older ? 3 : 4} height="4" fill={skin} />
        </g> : dragged ? <>
          <path d={female ? older ? "M22 23H28V24H34V28H28V27H22Z" : "M23 23H30V24H37V28H30V27H23Z" : older ? "M23 23H29V24H34V28H28V27H23Z" : "M24 23H31V24H37V28H30V27H24Z"} fill={ink} />
          <path className="officer-arm-front officer-sleeve" d={female ? older ? "M22 24H28V25H32V27H27V26H22Z" : "M23 24H30V25H35V27H29V26H23Z" : older ? "M23 24H29V25H32V27H28V26H23Z" : "M24 24H31V25H35V27H30V26H24Z"} fill={sleeve} />
          <rect className="officer-hand" x={older ? 32 : 34} y="24" width={older ? 4 : 5} height="4" fill={skin} />
          <path className="officer-arm-back officer-sleeve" d={female ? older ? "M6 24H11V28H10V31H6V33H3V29H5V26H6Z" : "M5 24H10V28H9V31H5V33H2V29H4V26H5Z" : older ? "M5 24H9V31H6V33H3V29H5Z" : "M4 24H9V31H5V33H2V29H4Z"} fill={shade} />
          <rect className="officer-hand" x={older ? 2 : 1} y="31" width={older ? 4 : 5} height="4" fill={skin} />
        </> : seated ? <>
          <path className="officer-arm-front officer-sleeve" d={female ? older ? "M23 25H26V27H32V31H26V29H23Z" : "M24 25H28V27H35V31H27V29H24Z" : older ? "M24 25H27V27H32V31H26V29H24Z" : "M25 25H29V27H35V31H27V29H25Z"} fill={shade} />
          <rect className="officer-hand" x={older ? 30 : 32} y="27" width={older ? 5 : 6} height="4" fill={skin} />
          <path className="officer-arm-back officer-sleeve" d={female ? older ? "M9 25H13V27H11V32H9Z" : "M8 25H13V27H11V32H8Z" : older ? "M8 25H11V32H8Z" : "M7 25H11V32H7Z"} fill={shade} />
          <rect className="officer-hand" x={older ? 8 : 7} y="31" width={older ? 3 : 4} height="4" fill={skin} />
        </> : <>
          <rect className="officer-arm-back officer-sleeve" x={backX} y="24" width={armWidth} height="8" fill={shade} />
          {female && <rect className="officer-sleeve" x="10" y="24" width="2" height="2" fill={shade} />}
          <rect className="officer-hand" x={older ? 7 : 6} y="31" width={older ? 3 : 4} height="4" fill={skin} />
          <rect className="officer-arm-front officer-sleeve" x={frontX} y="24" width={armWidth} height="8" fill={sleeve} />
          <rect className="officer-hand" x={older ? 25 : 26} y="31" width={older ? 3 : 4} height="4" fill={skin} />
        </>}

        {seated ? <g className="overtime-officer-seated-legs">
          <path d={older ? "M13 33H28V36H24V35H13Z" : "M12 33H29V36H24V35H12Z"} fill="#2c3b59" />
          <path d={older ? "M19 32H30V34H32V39H28V35H19Z" : "M19 32H31V34H33V39H28V35H19Z"} fill="#354766" />
          <path d="M23 35H27V39H23Z" fill="#22304c" />
          <OfficerShoeArt appearance={look} x={21} y={38} width={8} />
          <OfficerShoeArt appearance={look} x={28} y={38} width={7} />
        </g> : <g className="overtime-officer-walking-legs">
          <g className="overtime-officer-leg-back">
            <path d={dragged
              ? older ? "M12 33H17V36H14V39H9V37H12Z" : "M11 33H17V36H13V39H8V37H11Z"
              : older ? "M13 33H17V39H13Z" : "M12 33H17V39H12Z"} fill="#2c3b59" />
            <OfficerShoeArt appearance={look} x={dragged ? (older ? 7 : 6) : (older ? 11 : 10)} y={38} width={older ? 7 : 8} />
          </g>
          <g className="overtime-officer-leg-front">
            <path d={dragged
              ? older ? "M21 33H25V36H28V39H24V37H21Z" : "M21 33H26V36H29V39H24V37H21Z"
              : older ? "M21 33H25V39H21Z" : "M21 33H26V39H21Z"} fill="#354766" />
            <OfficerShoeArt appearance={look} x={dragged ? 24 : 20} y={38} width={older ? 8 : 9} />
          </g>
        </g>}
      </g>
    </g>
  );
}
