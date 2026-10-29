import type { ReactElement } from "react";
import type { OfficerVariant } from "./PixelOfficer";

export type OvertimeOfficerPose = "standing" | "grabbing" | "dragged" | "seated";

export interface OvertimeOfficerProps {
  variant: OfficerVariant;
  pose: OvertimeOfficerPose;
}

function OfficerHead({ older, weary }: { older: boolean; weary: boolean }): ReactElement {
  const ink = "#10182c", skin = older ? "#e9b58b" : "#f5c49a";
  return (
    <g>
      <path d="M10 2H25V4H28V19H25V22H10V19H7V4H10Z" fill={ink} />
      <rect x="9" y="7" width="17" height="12" fill={skin} />
      <rect x="12" y="19" width="12" height="2" fill={skin} />
      <rect x="26" y="11" width="3" height="4" fill={skin} />
      <rect x="7" y="11" width="4" height="6" fill="#d89579" />
      <rect x="9" y="12" width="2" height="3" fill={skin} />
      <path d="M10 3H25V6H27V8H23V6H19V9H11V12H8V5H10Z" fill={older ? "#52556a" : "#20283e"} />
      <rect x="12" y="4" width="10" height="1" fill={older ? "#89909e" : "#41516c"} />
      {older ? <>
        <path d="M8 8H11V13H8ZM24 7H27V10H24ZM11 5H15V6H11Z" fill="#abb1b9" />
        <path d="M12 10H19V11H21V10H28V16H21V13H19V16H12Z" fill={ink} />
        <path d="M13 11H18V14H13ZM22 11H27V14H22Z" fill="#d8e7de" />
        <path d="M16 12H18V14H16ZM25 12H27V14H25Z" fill={ink} />
      </> : <g fill={ink}>
        <rect x="13" y={weary ? 12 : 9} width="5" height="1" />
        <rect x="22" y={weary ? 13 : 9} width="5" height="1" />
        {!weary && <path d="M14 11H17V14H14ZM23 11H26V14H23Z" />}
      </g>}
      <rect x="12" y="16" width="3" height="2" fill="#df9487" />
      <rect x="24" y="16" width="2" height="1" fill="#df9487" />
      <path d={weary ? "M18 19H23V20H18Z" : "M19 18H24V19H19Z"} fill="#874e56" />
    </g>
  );
}

export function OvertimeOfficer({ variant, pose }: OvertimeOfficerProps): ReactElement {
  const older = variant === "older", seated = pose === "seated", dragged = pose === "dragged";
  const skin = older ? "#e9b58b" : "#f5c49a";
  const sleeve = older ? "#746184" : "#e6f2f3";
  const shade = older ? "#4b425f" : "#91b6c6";
  const ink = "#10182c";

  return (
    <g className="overtime-officer" data-officer-variant={variant} data-overtime-pose={pose}
      shapeRendering="crispEdges" aria-hidden="true">
      <g transform="translate(-32 -80) scale(2)">
        <g className="overtime-officer-head" transform={seated ? "translate(3 4)" : dragged ? "translate(-2 0)" : undefined}>
          <OfficerHead older={older} weary={seated || dragged} />
        </g>
        <rect x="16" y="21" width="6" height="4" fill={skin} />
        <path d={dragged ? "M7 22H23V25H27V34H10V30H7Z" : "M9 22H27V34H9Z"} fill={ink} />
        <path d={dragged ? "M8 23H22V26H26V32H11V29H8Z" : "M10 23H26V32H10Z"} fill={sleeve} />
        <rect x="10" y="24" width="3" height="8" fill={shade} />
        <rect x="16" y="23" width="8" height="9" fill="#e6f2ed" />
        <path d="M16 23H18V25H16ZM22 23H24V25H22Z" fill="#b7cad1" />
        <rect x="19" y="24" width="3" height="2" fill={older ? "#61e8e1" : "#f07c9f"} />
        <rect x="20" y="26" width="2" height="4" fill={older ? "#36a2aa" : "#c84e76"} />
        <rect x="13" y="24" width="1" height="4" fill="#ffd27a" />
        <rect x="12" y="27" width="4" height="5" fill={ink} />
        <rect x="13" y="28" width="2" height="3" fill="#eef7ff" />
        <rect x="13" y="28" width="2" height="1" fill="#61e8e1" />
        <rect x="11" y="32" width="15" height="2" fill={ink} />

        {pose === "grabbing" ? <g className="overtime-officer-grip">
          <path d="M3 23H11V29H7V27H3Z" fill={ink} />
          <path d="M4 24H11V27H8V26H4Z" fill={shade} />
          <rect x="1" y="24" width="5" height="4" fill={skin} />
          <rect x="1" y="27" width="4" height="1" fill="#b67d68" />
          <path d="M26 24H30V32H26Z" fill={sleeve} />
          <rect x="26" y="31" width="4" height="4" fill={skin} />
        </g> : dragged ? <>
          <path d="M24 23H31V24H37V28H30V27H24Z" fill={ink} />
          <path d="M24 24H31V25H35V27H30V26H24Z" fill={sleeve} />
          <rect x="34" y="24" width="5" height="4" fill={skin} />
          <path d="M4 24H9V31H5V33H2V29H4Z" fill={shade} />
          <rect x="1" y="31" width="5" height="4" fill={skin} />
        </> : seated ? <>
          <path d="M25 25H29V27H35V31H27V29H25Z" fill={shade} />
          <rect x="32" y="27" width="6" height="4" fill={skin} />
          <path d="M7 25H11V32H7Z" fill={shade} />
          <rect x="7" y="31" width="4" height="4" fill={skin} />
        </> : <>
          <rect x="6" y="24" width="4" height="8" fill={shade} />
          <rect x="6" y="31" width="4" height="4" fill={skin} />
          <rect x="26" y="24" width="4" height="8" fill={sleeve} />
          <rect x="26" y="31" width="4" height="4" fill={skin} />
        </>}

        {seated ? <g className="overtime-officer-seated-legs">
          <path d="M12 33H29V36H24V35H12Z" fill="#2c3b59" />
          <path d="M19 32H31V34H33V39H28V35H19Z" fill="#354766" />
          <path d="M23 35H27V39H23Z" fill="#22304c" />
          <path d="M23 38H29V40H21V39H23ZM28 38H35V40H28Z" fill={ink} />
        </g> : <g className="overtime-officer-walking-legs">
          <g className="overtime-officer-leg-back">
            <path d={dragged ? "M11 33H17V36H13V39H8V37H11Z" : "M12 33H17V39H12Z"} fill="#2c3b59" />
            <rect x={dragged ? 6 : 10} y="38" width="8" height="2" fill={ink} />
          </g>
          <g className="overtime-officer-leg-front">
            <path d={dragged ? "M21 33H26V36H29V39H24V37H21Z" : "M21 33H26V39H21Z"} fill="#354766" />
            <rect x={dragged ? 24 : 20} y="38" width="9" height="2" fill={ink} />
          </g>
        </g>}
      </g>
    </g>
  );
}
