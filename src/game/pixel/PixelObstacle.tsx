import type { ReactElement } from "react";

export function PixelObstacle(): ReactElement {
  return (
    <g aria-hidden="true" shapeRendering="crispEdges">
      <path d="M-12-34H12V-12H-12Z" fill="#151d32" />
      <path d="M-10-32H10V-14H-10Z" fill="#e29b58" />
      <path d="M-10-32H10V-26H-10Z" fill="#ffd27a" />
      <path d="M-2-32H2V-14H-2Z" fill="#fff0bc" />
      <path d="M-10-26H-2V-24H-10ZM2-26H10V-24H2Z" fill="#151d32" />
      <rect x="5" y="-20" width="3" height="4" fill="#ffd27a" />
    </g>
  );
}
