import type { ReactElement } from "react";
import type { Direction } from "../types";

interface PixelStairProps {
  face: "top" | "front";
  direction: Direction;
}

const TOP_OUTLINE = "M-4-24H4V-22H10V-20H16V-18H22V-16H28V-14H34V-10H28V-8H22V-6H16V-4H10V-2H4V0H-4V-2H-10V-4H-16V-6H-22V-8H-28V-10H-34V-14H-28V-16H-22V-18H-16V-20H-10V-22H-4Z";
const FRONT_OUTLINE = "M-34-12H-28V-10H-22V-8H-16V-6H-10V-4H-4V-2H4V-4H10V-6H16V-8H22V-10H28V-12H34V4H28V6H22V8H16V10H10V12H4V16H-4V12H-10V10H-16V8H-22V6H-28V4H-34Z";

export function PixelStair({ face, direction }: PixelStairProps): ReactElement {
  return (
    <g className={`pixel-stair pixel-stair--${face}`} shapeRendering="crispEdges" aria-hidden="true">
      {face === "top" ? (
        <>
          <path d={TOP_OUTLINE} fill="#617b95" />
          <path d="M-4-24H4V-22H10V-20H16V-18H22V-16H28V-14H34V-12H28V-14H22V-16H16V-18H10V-20H4V-22H-4V-20H-10V-18H-16V-16H-22V-14H-28V-12H-34V-14H-28V-16H-22V-18H-16V-20H-10V-22H-4Z" fill="#9eb6c9" />
          <rect x="-10" y="-15" width="20" height="2" fill="#758fa7" />
          <rect x="-18" y="-11" width="10" height="2" fill="#4c667e" />
          <rect x="10" y="-10" width="6" height="2" fill="#829caf" />
          <g transform={`translate(${direction === "right" ? 7 : -7} -14) scale(${direction === "right" ? 1 : -1} 1)`} fill="#d3ebee">
            <rect x="-3" y="-1" width="5" height="2" />
            <rect x="1" y="-3" width="2" height="6" />
          </g>
        </>
      ) : (
        <>
          <path d={FRONT_OUTLINE} fill="#111d32" />
          <path d="M-32-10H-28V-8H-22V-6H-16V-4H-10V-2H-4V0H0V13H-4V10H-10V8H-16V6H-22V4H-28V2H-32Z" fill="#32465e" />
          <path d="M0 0H4V-2H10V-4H16V-6H22V-8H28V-10H32V2H28V4H22V6H16V8H10V10H4V13H0Z" fill="#23364e" />
          <path d="M-34-12H-28V-10H-22V-8H-16V-6H-10V-4H-4V-2H4V-4H10V-6H16V-8H22V-10H28V-12H34V-10H28V-8H22V-6H16V-4H10V-2H4V0H-4V-2H-10V-4H-16V-6H-22V-8H-28V-10H-34Z" fill="#61e8e1" />
          <rect x="-23" y="-1" width="6" height="2" fill="#465971" />
          <rect x="14" y="2" width="7" height="2" fill="#304862" />
        </>
      )}
    </g>
  );
}
