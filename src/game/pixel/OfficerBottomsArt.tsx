import { useId, type ReactElement } from "react";
import { resolveCharacterLook } from "../../../shared/bottomsCharacterAppearance";
import { OfficerShoeArt } from "./OfficerAppearanceParts";
import { getOfficerPalette, type OfficerAppearanceInput } from "./officerPalette";
import type { OfficerVariant } from "./PixelOfficer";

export type OfficerBottomsPose = "idle" | "run-a" | "run-b" | "stumble"
  | "standing" | "grabbing" | "dragged" | "seated";
export interface OfficerBottomsArtProps {
  variant: OfficerVariant;
  appearance: OfficerAppearanceInput;
  pose: OfficerBottomsPose;
}

type PixelRect = readonly [x: number, y: number, width: number, height: number];
interface LegGeometry {
  rects?: readonly PixelRect[];
  path?: string;
  shoe: readonly [x: number, width: number];
  seamX: number;
}
interface Legs { back: LegGeometry; front: LegGeometry }

function legsFor(older: boolean, pose: OfficerBottomsPose): Legs {
  switch (pose) {
    case "idle": return {
      back: { rects: [[older ? 13 : 12, 34, older ? 4 : 5, 5]], shoe: [older ? 11 : 10, older ? 7 : 8], seamX: 14 },
      front: { rects: [[21, 34, older ? 4 : 5, 5]], shoe: [20, older ? 8 : 9], seamX: 22 },
    };
    case "run-a": return {
      back: { rects: [[11, 33, older ? 5 : 6, 4], [7, 35, older ? 5 : 6, 4]], shoe: [5, 9], seamX: 12 },
      front: { rects: [[21, 33, older ? 4 : 5, 4], [24, 36, older ? 4 : 5, 3]], shoe: [24, 8], seamX: 22 },
    };
    case "run-b": return {
      back: { rects: [[12, 33, older ? 4 : 5, 4], [10, 36, older ? 4 : 5, 3]], shoe: [8, 8], seamX: 13 },
      front: { rects: [[20, 33, older ? 5 : 6, 4], [24, 35, older ? 5 : 6, 4]], shoe: [24, 8], seamX: 24 },
    };
    case "stumble": return {
      back: { rects: [[older ? 9 : 8, 33, older ? 8 : 9, 4], [older ? 7 : 6, 36, older ? 5 : 6, 3]],
        shoe: [older ? 4 : 3, older ? 9 : 10], seamX: 10 },
      front: { rects: [[21, 33, older ? 6 : 7, 4], [25, 36, older ? 4 : 5, 3]], shoe: [24, older ? 7 : 8], seamX: 26 },
    };
    case "standing":
    case "grabbing": return {
      back: { path: older ? "M13 33H17V39H13Z" : "M12 33H17V39H12Z", shoe: [older ? 11 : 10, older ? 7 : 8], seamX: 14 },
      front: { path: older ? "M21 33H25V39H21Z" : "M21 33H26V39H21Z", shoe: [20, older ? 8 : 9], seamX: 22 },
    };
    case "dragged": return {
      back: { path: older ? "M12 33H17V36H14V39H9V37H12Z" : "M11 33H17V36H13V39H8V37H11Z",
        shoe: [older ? 7 : 6, older ? 7 : 8], seamX: 13 },
      front: { path: older ? "M21 33H25V36H28V39H24V37H21Z" : "M21 33H26V36H29V39H24V37H21Z",
        shoe: [24, older ? 8 : 9], seamX: 24 },
    };
    case "seated": return {
      back: { path: older ? "M13 33H28V36H24V35H13Z" : "M12 33H29V36H24V35H12Z", shoe: [21, 8], seamX: 23 },
      front: { path: older ? "M19 32H30V34H32V39H28V35H19Z" : "M19 32H31V34H33V39H28V35H19Z",
        shoe: [28, 7], seamX: 29 },
    };
  }
}

function LegShape({ leg }: { leg: LegGeometry }): ReactElement {
  return <>{leg.rects?.map(([x, y, width, height], index) =>
    <rect key={index} x={x} y={y} width={width} height={height} />)}{leg.path && <path d={leg.path} />}</>;
}

const SKIRTS: Record<OfficerBottomsPose, string> = {
  idle: "M11 33H27V34H28V36H10V34H11Z",
  "run-a": "M11 33H26V34H28V36H9V35H11Z",
  "run-b": "M12 33H26V34H29V36H9V35H12Z",
  stumble: "M8 33H28V34H29V36H6V35H8Z",
  standing: "M11 33H27V34H28V36H10V34H11Z",
  grabbing: "M11 33H27V34H28V36H10V34H11Z",
  dragged: "M11 33H26V34H29V36H8V35H11Z",
  seated: "M12 33H29V34H31V36H23V35H12Z",
};

export function OfficerBottomsArt({ variant, appearance: input, pose }: OfficerBottomsArtProps): ReactElement {
  const id = useId();
  const appearance = resolveCharacterLook(input, variant === "older" ? "pursuer" : "runner");
  const palette = getOfficerPalette(appearance);
  const legs = legsFor(variant === "older", pose);
  const skirt = appearance.bottoms === "skirt", shorts = appearance.bottoms === "shorts";
  const exposed = skirt || shorts, seated = pose === "seated";
  const overtime = seated || pose === "standing" || pose === "grabbing" || pose === "dragged";
  const skirtPath = variant === "older" || appearance.gender === "female"
    ? SKIRTS[pose].replace(/([MH])(\d+)/g, (_, command: string, value: string) =>
      command + (Number(value) + (Number(value) < 19 ? 1 : -1))) : SKIRTS[pose];
  const skinTop = skirt ? 36 : 35;
  const skinClip = `${id}-skin`, skirtClip = `${id}-skirt`;

  function shoe(leg: LegGeometry) {
    return <OfficerShoeArt appearance={appearance} x={leg.shoe[0]} y={38} width={leg.shoe[1]} />;
  }

  function leg(side: keyof Legs) {
    const geometry = legs[side], back = side === "back", clip = `${id}-${side}`;
    return <g key={side} className={`officer-bottom-leg officer-bottom-leg--${side}${overtime && !seated ? ` overtime-officer-leg-${side}` : ""}`}>
      {exposed ? <>
        <g className="officer-exposed-leg" fill={back ? palette.skinShade : palette.skin} clipPath={`url(#${skinClip})`}>
          <LegShape leg={geometry} />
        </g>
        {shorts && <g className="officer-bottoms-fabric" clipPath={`url(#${clip})`} fill={back ? palette.bottomsShade : palette.bottoms}>
          <rect x="0" y="32" width="40" height="3" />
        </g>}
      </> : <>
        <g className="officer-bottoms-fabric" fill={back ? palette.bottomsShade : palette.bottoms}><LegShape leg={geometry} /></g>
        {appearance.bottoms === "jeans" && <g className="officer-jeans-details" clipPath={`url(#${clip})`} fill={palette.bottomsDeepShade}>
          <rect className="officer-jeans-seam" x={geometry.seamX} y="33" width="1" height="5" />
          <rect className="officer-jeans-pocket" x={geometry.seamX} y="34" width="2" height="1" />
          <rect className="officer-jeans-cuff" x="0" y="37" width="40" height="1" fill={back ? palette.bottoms : palette.bottomsShade} />
        </g>}
      </>}
      {!seated && shoe(geometry)}
    </g>;
  }

  return <g className={`officer-bottoms officer-bottoms--${appearance.bottoms}${overtime ? seated ? " overtime-officer-seated-legs" : " overtime-officer-walking-legs" : ""}`}
    data-bottoms-kind={appearance.bottoms} data-bottoms-color={appearance.bottomsColor} data-bottoms-pose={pose}>
    {(exposed || appearance.bottoms === "jeans") && <defs>
      {!skirt && <>
        <clipPath id={`${id}-back`} clipPathUnits="userSpaceOnUse"><LegShape leg={legs.back} /></clipPath>
        <clipPath id={`${id}-front`} clipPathUnits="userSpaceOnUse"><LegShape leg={legs.front} /></clipPath>
      </>}
      {exposed && <clipPath id={skinClip} clipPathUnits="userSpaceOnUse"><rect x="0" y={skinTop} width="40" height={40 - skinTop} /></clipPath>}
      {skirt && <clipPath id={skirtClip} clipPathUnits="userSpaceOnUse"><path d={skirtPath} /></clipPath>}
    </defs>}
    {skirt && <g className="officer-skirt">
      <path className="officer-skirt-fabric" d={skirtPath} fill={palette.bottoms} />
      <g clipPath={`url(#${skirtClip})`}>
        <rect x="0" y="33" width="14" height="3" fill={palette.bottomsShade} />
        <rect className="officer-skirt-hem" x="0" y="35" width="40" height="1" fill={palette.bottomsDeepShade} />
      </g>
    </g>}
    {leg("back")}{leg("front")}
    {seated && <>
      <path className="officer-bottoms-depth" d="M23 35H27V39H23Z" fill={exposed ? palette.skinShade : palette.bottomsDeepShade}
        clipPath={exposed ? `url(#${skinClip})` : undefined} />
      {shoe(legs.back)}{shoe(legs.front)}
    </>}
  </g>;
}
