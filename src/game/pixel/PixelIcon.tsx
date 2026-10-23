import type { ReactElement } from "react";

export type PixelIconName = "forward" | "turn" | "jump" | "settings" | "close"
  | "heart" | "flag" | "restart" | "stair";

interface PixelIconProps {
  name: PixelIconName;
  size?: number;
  className?: string;
}

const ICON_PATHS: Record<PixelIconName, string> = {
  jump: "M7 1h2v2h2v2h2v2H9v5H7V7H3V5h2V3h2ZM1 14h14v2H1Z",
  forward: "M7 1h2v2h2v2h2v2h2v2h-4V7H9v8H7V7H5v2H1V7h2V5h2V3h2Z",
  turn: "M3 1h2v2h6v2h2v2h2v6h-2v2H7v-2h6V7h-2V5H5v2H3V5H1V3h2Z",
  settings: "M6 0h4v2h2v2h2v2h2v4h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V6h2V4h2V2h2Zm0 5v1H5v4h1v1h4v-1h1V6h-1V5Z",
  close: "M2 1h2v2h2v2h4V3h2V1h2v3h-2v2h-2v4h2v2h2v3h-2v-2h-2v-2H6v2H4v2H2v-3h2v-2h2V6H4V4H2Z",
  heart: "M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2Z",
  flag: "M2 0h2v1h10v8H4v7H2Zm2 3v2h2V3Zm4 0v2h2V3Zm4 0v2h2V3ZM6 5v2h2V5Zm4 0v2h2V5Z",
  restart: "M6 1h6v2h2v2h2v6h-2v2h-2v2H6v-2H4v-2H2V9h2v2h2v2h6v-2h2V5h-2V3H6v2h2v2H0V0h2v3h2V1Z",
  stair: "M10 1h5v4h-4v4H7v4H3v2H1v-4h4V7h4V3h1Z",
};

export function PixelIcon({ name, size = 24, className = "" }: PixelIconProps): ReactElement {
  return (
    <svg
      className={`pixel-icon${className ? ` ${className}` : ""}`} width={size} height={size}
      viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges"
      aria-hidden="true" focusable="false"
    >
      <path d={ICON_PATHS[name]} fillRule="evenodd" />
    </svg>
  );
}
