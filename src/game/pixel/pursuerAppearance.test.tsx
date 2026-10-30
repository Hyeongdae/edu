import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OvertimeOfficer, type OvertimeOfficerPose } from "./OvertimeOfficer";
import { PixelOfficer } from "./PixelOfficer";

function renderSvg(children: ReactNode): string {
  return renderToStaticMarkup(createElement("svg", null, children));
}

function countHatGroups(markup: string): number {
  return (markup.match(/class="officer-straw-hat"/g) ?? []).length;
}

describe("pursuer appearance", () => {
  it("adds the straw hat to every shared chase frame without changing the young officer", () => {
    const older = renderSvg(createElement(PixelOfficer, {
      variant: "older",
      direction: "right",
      pose: "climb",
    }));
    const young = renderSvg(createElement(PixelOfficer, {
      variant: "young",
      direction: "right",
      pose: "climb",
    }));

    expect(countHatGroups(older)).toBe(4);
    expect(older).toContain('data-officer-variant="older"');
    expect(older).toContain('data-officer-pose="climb"');
    expect(older).toContain('data-officer-frame="idle"');
    expect(older).toContain('data-officer-frame="run-a"');
    expect(older).toContain('data-officer-frame="run-b"');
    expect(older).toContain('data-officer-frame="stumble"');
    expect(older).toContain('x="11" y="23" width="14" height="9"');
    expect(older).toContain('y="38" width="7" height="2"');
    expect(young).toContain('data-officer-variant="young"');
    expect(countHatGroups(young)).toBe(0);
    expect(young).toContain('x="10" y="23" width="16" height="9"');
  });

  it("matches the older overtime officer across all capture poses and leaves the young art unchanged", () => {
    const poses: OvertimeOfficerPose[] = ["standing", "grabbing", "dragged", "seated"];

    for (const pose of poses) {
      const older = renderSvg(createElement(OvertimeOfficer, { variant: "older", pose }));
      const young = renderSvg(createElement(OvertimeOfficer, { variant: "young", pose }));

      expect(countHatGroups(older)).toBe(1);
      expect(older).toContain('data-officer-variant="older"');
      expect(older).toContain(`data-overtime-pose="${pose}"`);
      expect(older).toContain('width="22" height="1"');
      expect(young).toContain('data-officer-variant="young"');
      expect(young).toContain(`data-overtime-pose="${pose}"`);
      expect(countHatGroups(young)).toBe(0);
    }

    const youngStanding = renderSvg(createElement(OvertimeOfficer, {
      variant: "young",
      pose: "standing",
    }));
    expect(youngStanding).toContain('d="M9 22H27V34H9Z"');
    expect(youngStanding).toContain('width="8" height="9" fill="#e6f2ed"');
  });
});
