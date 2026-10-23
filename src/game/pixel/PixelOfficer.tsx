import type { ReactElement } from "react";
import type { Direction } from "../types";

export type OfficerVariant = "young" | "older";
export type OfficerPose = "idle" | "climb" | "fall" | "jump";
type OfficerFrame = "idle" | "run-a" | "run-b" | "stumble";

interface PixelOfficerProps {
  variant: OfficerVariant;
  direction: Direction;
  pose: OfficerPose;
}

const FRAMES: readonly OfficerFrame[] = ["idle", "run-a", "run-b", "stumble"];

function OfficerFrameArt({ variant, frame }: { variant: OfficerVariant; frame: OfficerFrame }): ReactElement {
  const older = variant === "older";
  const stumble = frame === "stumble";
  const skin = older ? "#e9b58b" : "#f5c49a";
  const sleeve = older ? "#746184" : "#e6f2f3";
  const sleeveShade = older ? "#4b425f" : "#91b6c6";
  const ink = "#10182c";

  return (
    <g className={`officer-frame officer-frame--${frame}`} data-officer-frame={frame}>
      {/* All four poses share the same head height and shoe baseline (y=40). */}
      <g fill={ink}>
        <rect x="10" y="2" width="15" height="2" />
        <rect x="7" y="4" width="21" height="15" />
        <rect x="10" y="19" width="15" height="3" />
        <rect x="9" y="22" width="18" height="11" />
      </g>
      <rect x="9" y="7" width="17" height="12" fill={skin} />
      <rect x="12" y="19" width="12" height="2" fill={skin} />
      <rect x="26" y="11" width="3" height="4" fill={skin} />
      <rect x="7" y="11" width="4" height="6" fill="#d89579" />
      <rect x="9" y="12" width="2" height="3" fill={skin} />
      <rect x="16" y="21" width="6" height="3" fill={skin} />
      <g fill={older ? "#52556a" : "#20283e"}>
        <rect x="10" y="3" width="15" height="3" />
        <rect x="8" y="5" width="11" height="4" />
        <rect x="8" y="8" width="3" height="4" />
        <rect x="23" y="5" width="4" height="3" />
      </g>
      <rect x="12" y="4" width="10" height="1" fill={older ? "#89909e" : "#41516c"} />
      {older && (
        <g fill="#abb1b9">
          <rect x="8" y="8" width="3" height="5" />
          <rect x="24" y="7" width="3" height="3" />
          <rect x="11" y="5" width="4" height="1" />
        </g>
      )}
      {older ? (
        <g>
          <rect x="12" y="10" width="7" height="6" fill={ink} />
          <rect x="21" y="10" width="7" height="6" fill={ink} />
          <rect x="19" y="11" width="2" height="2" fill={ink} />
          <rect x="13" y="11" width="5" height="3" fill="#d8e7de" />
          <rect x="22" y="11" width="5" height="3" fill="#d8e7de" />
          <rect x="16" y="12" width="2" height="2" fill={ink} />
          <rect x="25" y="12" width="2" height="2" fill={ink} />
        </g>
      ) : (
        <g fill={ink}>
          <rect x="14" y={stumble ? 10 : 11} width="3" height={stumble ? 5 : 3} />
          <rect x="23" y={stumble ? 10 : 11} width="3" height={stumble ? 5 : 3} />
          <rect x="13" y="9" width="4" height="1" />
          <rect x="23" y="9" width="4" height="1" />
        </g>
      )}
      <rect x="12" y="16" width="3" height="2" fill="#df9487" />
      <rect x="24" y="16" width="2" height="1" fill="#df9487" />
      <rect x="19" y="18" width={stumble ? 3 : 5} height={stumble ? 2 : 1} fill="#874e56" />
      {!stumble && <rect x="23" y="17" width="2" height="1" fill="#874e56" />}
      <rect x="10" y="23" width="16" height="9" fill={sleeve} />
      <rect x="10" y="24" width="3" height="8" fill={sleeveShade} />
      <rect x="16" y="23" width="8" height="9" fill="#e6f2ed" />
      <rect x="16" y="23" width="2" height="2" fill="#b7cad1" />
      <rect x="22" y="23" width="2" height="2" fill="#b7cad1" />
      <rect x="19" y="24" width="3" height="2" fill={older ? "#61e8e1" : "#f07c9f"} />
      <rect x="20" y="26" width="2" height="4" fill={older ? "#36a2aa" : "#c84e76"} />
      <rect x="13" y="24" width="1" height="4" fill="#ffd27a" />
      <rect x="12" y="27" width="4" height="5" fill={ink} />
      <rect x="13" y="28" width="2" height="3" fill="#eef7ff" />
      <rect x="13" y="28" width="2" height="1" fill="#61e8e1" />
      <rect x="11" y="32" width="15" height="2" fill={ink} />
      <rect x="19" y="32" width="2" height="1" fill="#b8c8d3" />
      {frame === "idle" && (
        <g>
          <rect x="6" y="24" width="4" height="8" fill={sleeveShade} />
          <rect x="6" y="31" width="4" height="4" fill={skin} />
          <rect x="26" y="24" width="4" height="8" fill={sleeve} />
          <rect x="26" y="31" width="4" height="4" fill={skin} />
          <rect x="12" y="34" width="5" height="5" fill="#2c3b59" />
          <rect x="21" y="34" width="5" height="5" fill="#354766" />
          <rect x="10" y="38" width="8" height="2" fill={ink} />
          <rect x="20" y="38" width="9" height="2" fill={ink} />
        </g>
      )}
      {frame === "run-a" && (
        <g>
          <rect x="6" y="23" width="4" height="6" fill={sleeveShade} />
          <rect x="3" y="27" width="6" height="3" fill={sleeveShade} />
          <rect x="1" y="28" width="4" height="4" fill={skin} />
          <rect x="26" y="24" width="4" height="6" fill={sleeve} />
          <rect x="27" y="22" width="4" height="5" fill={skin} />
          <rect x="11" y="33" width="6" height="4" fill="#2c3b59" />
          <rect x="7" y="35" width="6" height="4" fill="#2c3b59" />
          <rect x="21" y="33" width="5" height="4" fill="#354766" />
          <rect x="24" y="36" width="5" height="3" fill="#354766" />
          <rect x="5" y="38" width="9" height="2" fill={ink} />
          <rect x="24" y="38" width="8" height="2" fill={ink} />
        </g>
      )}
      {frame === "run-b" && (
        <g>
          <rect x="6" y="23" width="4" height="6" fill={sleeveShade} />
          <rect x="3" y="21" width="4" height="5" fill={skin} />
          <rect x="26" y="24" width="4" height="7" fill={sleeve} />
          <rect x="28" y="29" width="4" height="4" fill={skin} />
          <rect x="12" y="33" width="5" height="4" fill="#2c3b59" />
          <rect x="10" y="36" width="5" height="3" fill="#2c3b59" />
          <rect x="20" y="33" width="6" height="4" fill="#354766" />
          <rect x="24" y="35" width="6" height="4" fill="#354766" />
          <rect x="8" y="38" width="8" height="2" fill={ink} />
          <rect x="24" y="38" width="8" height="2" fill={ink} />
        </g>
      )}
      {stumble && (
        <g>
          <rect x="3" y="22" width="7" height="4" fill={sleeveShade} />
          <rect x="0" y="20" width="4" height="5" fill={skin} />
          <rect x="26" y="22" width="4" height="4" fill={sleeve} />
          <rect x="28" y="19" width="4" height="5" fill={skin} />
          <rect x="8" y="33" width="9" height="4" fill="#2c3b59" />
          <rect x="6" y="36" width="6" height="3" fill="#2c3b59" />
          <rect x="21" y="33" width="7" height="4" fill="#354766" />
          <rect x="25" y="36" width="5" height="3" fill="#354766" />
          <rect x="3" y="38" width="10" height="2" fill={ink} />
          <rect x="24" y="38" width="8" height="2" fill={ink} />
          <rect x="1" y="5" width="2" height="6" fill="#ffd27a" />
          <rect x="1" y="13" width="2" height="2" fill="#ffd27a" />
        </g>
      )}
    </g>
  );
}

export function PixelOfficer({ variant, direction, pose }: PixelOfficerProps): ReactElement {
  return (
    <g
      className="pixel-officer" data-officer-variant={variant} data-officer-pose={pose}
      transform={`scale(${direction === "right" ? 1 : -1} 1)`}
      shapeRendering="crispEdges" aria-hidden="true"
    >
      <g className="officer-body">
        <g transform="translate(-32 -80) scale(2)">
          {FRAMES.map((frame) => <OfficerFrameArt key={frame} variant={variant} frame={frame} />)}
        </g>
      </g>
    </g>
  );
}
