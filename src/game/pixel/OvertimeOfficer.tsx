import type { ReactElement } from "react";
import type { OfficerVariant } from "./PixelOfficer";
import { getDefaultCharacterLook } from "../../../shared/characterAppearance";
import type { CharacterLook } from "../../../shared/characterAppearance";
import { OfficerHeadArt, OfficerOutfitArt, OfficerShoeArt } from "./OfficerAppearanceParts";
import { getOfficerPalette } from "./officerPalette";

export type OvertimeOfficerPose = "standing" | "grabbing" | "dragged" | "seated";

export interface OvertimeOfficerProps {
  variant: OfficerVariant;
  pose: OvertimeOfficerPose;
  appearance?: CharacterLook;
}

export function OvertimeOfficer({ variant, pose, appearance }: OvertimeOfficerProps): ReactElement {
  const older = variant === "older", seated = pose === "seated", dragged = pose === "dragged";
  const look = appearance ?? getDefaultCharacterLook(older ? "pursuer" : "runner");
  const { skin, skinShade, cloth: sleeve, clothShade: shade } = getOfficerPalette(look);
  const ink = "#10182c";

  return (
    <g className="overtime-officer" data-officer-variant={variant} data-overtime-pose={pose}
      shapeRendering="crispEdges" aria-hidden="true">
      <g transform="translate(-32 -80) scale(2)">
        <g className="overtime-officer-head" transform={seated ? "translate(3 4)" : dragged ? "translate(-2 0)" : undefined}>
          <OfficerHeadArt variant={variant} appearance={look} expression={seated || dragged ? "weary" : "normal"} />
        </g>
        <rect x="16" y="21" width="6" height="4" fill={skin} />
        <OfficerOutfitArt variant={variant} appearance={look} pose={dragged ? "dragged" : "normal"} />

        {pose === "grabbing" ? <g className="overtime-officer-grip">
          <path d={older ? "M4 23H10V29H7V27H4Z" : "M3 23H11V29H7V27H3Z"} fill={ink} />
          <path d={older ? "M5 24H10V27H8V26H5Z" : "M4 24H11V27H8V26H4Z"} fill={shade} />
          <rect x={older ? 2 : 1} y="24" width={older ? 4 : 5} height="4" fill={skin} />
          <rect x={older ? 2 : 1} y="27" width={older ? 3 : 4} height="1" fill={skinShade} />
          <path d={older ? "M25 24H28V32H25Z" : "M26 24H30V32H26Z"} fill={sleeve} />
          <rect x={older ? 25 : 26} y="31" width={older ? 3 : 4} height="4" fill={skin} />
        </g> : dragged ? <>
          <path d={older ? "M23 23H29V24H34V28H28V27H23Z" : "M24 23H31V24H37V28H30V27H24Z"} fill={ink} />
          <path d={older ? "M23 24H29V25H32V27H28V26H23Z" : "M24 24H31V25H35V27H30V26H24Z"} fill={sleeve} />
          <rect x={older ? 32 : 34} y="24" width={older ? 4 : 5} height="4" fill={skin} />
          <path d={older ? "M5 24H9V31H6V33H3V29H5Z" : "M4 24H9V31H5V33H2V29H4Z"} fill={shade} />
          <rect x={older ? 2 : 1} y="31" width={older ? 4 : 5} height="4" fill={skin} />
        </> : seated ? <>
          <path d={older ? "M24 25H27V27H32V31H26V29H24Z" : "M25 25H29V27H35V31H27V29H25Z"} fill={shade} />
          <rect x={older ? 30 : 32} y="27" width={older ? 5 : 6} height="4" fill={skin} />
          <path d={older ? "M8 25H11V32H8Z" : "M7 25H11V32H7Z"} fill={shade} />
          <rect x={older ? 8 : 7} y="31" width={older ? 3 : 4} height="4" fill={skin} />
        </> : <>
          <rect x={older ? 7 : 6} y="24" width={older ? 3 : 4} height="8" fill={shade} />
          <rect x={older ? 7 : 6} y="31" width={older ? 3 : 4} height="4" fill={skin} />
          <rect x={older ? 25 : 26} y="24" width={older ? 3 : 4} height="8" fill={sleeve} />
          <rect x={older ? 25 : 26} y="31" width={older ? 3 : 4} height="4" fill={skin} />
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
