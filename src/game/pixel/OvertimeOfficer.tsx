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
        <g className="officer-straw-hat">
          <path d="M10 7V5H12V3H15V1H21V3H24V5H26V7H29V8H31V10H5V8H8V7Z" fill="#b9772d" />
          <path d="M11 6V4H14V2H22V4H25V7H11Z" fill="#f0c451" />
          <rect x="13" y="4" width="10" height="2" fill="#a85f2a" />
          <rect x="7" y="8" width="22" height="1" fill="#ffe18a" />
        </g>
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
        <path d={dragged
          ? older ? "M8 22H22V25H25V34H11V30H8Z" : "M7 22H23V25H27V34H10V30H7Z"
          : older ? "M10 22H26V34H10Z" : "M9 22H27V34H9Z"} fill={ink} />
        <path d={dragged
          ? older ? "M9 23H21V26H24V32H12V29H9Z" : "M8 23H22V26H26V32H11V29H8Z"
          : older ? "M11 23H25V32H11Z" : "M10 23H26V32H10Z"} fill={sleeve} />
        <rect x={older ? 11 : 10} y="24" width={older ? 2 : 3} height="8" fill={shade} />
        <rect x={older ? 16 : 16} y="23" width={older ? 7 : 8} height="9" fill="#e6f2ed" />
        <path d="M16 23H18V25H16ZM22 23H24V25H22Z" fill="#b7cad1" />
        <rect x="19" y="24" width="3" height="2" fill={older ? "#61e8e1" : "#f07c9f"} />
        <rect x="20" y="26" width="2" height="4" fill={older ? "#36a2aa" : "#c84e76"} />
        <rect x="13" y="24" width="1" height="4" fill="#ffd27a" />
        <rect x="12" y="27" width="4" height="5" fill={ink} />
        <rect x="13" y="28" width="2" height="3" fill="#eef7ff" />
        <rect x="13" y="28" width="2" height="1" fill="#61e8e1" />
        <rect x={older ? 12 : 11} y="32" width={older ? 13 : 15} height="2" fill={ink} />

        {pose === "grabbing" ? <g className="overtime-officer-grip">
          <path d={older ? "M4 23H10V29H7V27H4Z" : "M3 23H11V29H7V27H3Z"} fill={ink} />
          <path d={older ? "M5 24H10V27H8V26H5Z" : "M4 24H11V27H8V26H4Z"} fill={shade} />
          <rect x={older ? 2 : 1} y="24" width={older ? 4 : 5} height="4" fill={skin} />
          <rect x={older ? 2 : 1} y="27" width={older ? 3 : 4} height="1" fill="#b67d68" />
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
          <path d="M23 38H29V40H21V39H23ZM28 38H35V40H28Z" fill={ink} />
        </g> : <g className="overtime-officer-walking-legs">
          <g className="overtime-officer-leg-back">
            <path d={dragged
              ? older ? "M12 33H17V36H14V39H9V37H12Z" : "M11 33H17V36H13V39H8V37H11Z"
              : older ? "M13 33H17V39H13Z" : "M12 33H17V39H12Z"} fill="#2c3b59" />
            <rect x={dragged ? (older ? 7 : 6) : (older ? 11 : 10)} y="38" width={older ? 7 : 8} height="2" fill={ink} />
          </g>
          <g className="overtime-officer-leg-front">
            <path d={dragged
              ? older ? "M21 33H25V36H28V39H24V37H21Z" : "M21 33H26V36H29V39H24V37H21Z"
              : older ? "M21 33H25V39H21Z" : "M21 33H26V39H21Z"} fill="#354766" />
            <rect x={dragged ? (older ? 24 : 24) : 20} y="38" width={older ? 8 : 9} height="2" fill={ink} />
          </g>
        </g>}
      </g>
    </g>
  );
}
