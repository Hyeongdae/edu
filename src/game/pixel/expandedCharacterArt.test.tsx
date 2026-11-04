import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPEARANCE_OPTIONS, getDefaultCharacterLook, normalizeCharacterLook } from "../../../shared/expandedCharacterAppearance";
import type { CharacterLook } from "../../../shared/expandedCharacterAppearance";
import * as current from "../../../shared/characterAppearance";
import * as legacy from "../../../shared/legacyCharacterAppearance";
import { OfficerEyeArt, OfficerHeadArt, OfficerOutfitArt, OfficerShoeArt } from "./OfficerAppearanceParts";
import { OfficerBagBackArt, OfficerBagFrontArt } from "./OfficerBagArt";
import { PixelOfficer, type OfficerPose } from "./PixelOfficer";
import { OvertimeOfficer, type OvertimeOfficerPose } from "./OvertimeOfficer";
import { getOfficerPalette } from "./officerPalette";

function art(children: ReactNode): Element {
  const markup = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg">{children}</svg>);
  const document = new DOMParser().parseFromString(markup, "image/svg+xml");
  expect(document.querySelector("parsererror")).toBeNull();
  return document.documentElement;
}
function look(overrides: Partial<CharacterLook> = {}): CharacterLook {
  return { ...getDefaultCharacterLook("runner"), gender: "female", hairStyle: "long", hairColor: "pink",
    outfit: "hoodie", outfitColor: "sky", glasses: "none", shoes: "boots", shoeColor: "navy",
    eyeStyle: "round", bag: "backpack", bagColor: "beige", ...overrides };
}
function geometry(root: Element): string {
  return JSON.stringify([...root.querySelectorAll("path, rect")].map(node => [node.tagName,
    ...["d", "x", "y", "width", "height", "fill"].map(name => node.getAttribute(name))]));
}
function precedes(first: Element, second: Element) {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}
function attribute(node: Element | null, name: string, expected: string | undefined) {
  expect(node).not.toBeNull();
  expect(node!.getAttribute(name)).toBe(expected);
}
function feetStayAtForty(root: Element, count: number) {
  const shoes = root.querySelectorAll(".officer-shoe-base");
  expect(shoes).toHaveLength(count);
  for (const shoe of shoes) expect(Number(shoe.getAttribute("y")) + Number(shoe.getAttribute("height"))).toBe(40);
}
function expectBag(root: Element, bag: CharacterLook["bag"], pose: string, color = "#c8b38b") {
  const back = root.querySelector(".officer-bag-back"), front = root.querySelector(".officer-bag-front");
  if (bag === "none") {
    expect(back).toBeNull(); expect(front).toBeNull(); expect(root.querySelector(".officer-bag-fill")).toBeNull();
    return;
  }
  attribute(back, "data-bag-kind", bag); attribute(front, "data-bag-pose", pose);
  attribute(root.querySelector(".officer-bag-fill"), "fill", color);
  expect(back!.querySelector("path")).not.toBeNull(); expect(front!.querySelector("path")).not.toBeNull();
  precedes(back!, root.querySelector(".officer-head-art")!);
  precedes(root.querySelector(".officer-outfit")!, front!);
  precedes(front!, root.querySelector(".officer-shoe-base")!);
  if (bag === "briefcase") expect(back!.querySelector(".officer-bag-handle")).not.toBeNull();
  else expect(front!.querySelector(".officer-bag-straps")).not.toBeNull();
}

const variants = ["young", "older"] as const;
const gamePoses: readonly OfficerPose[] = ["idle", "climb", "fall", "jump"];
const overtimePoses: readonly OvertimeOfficerPose[] = ["standing", "grabbing", "dragged", "seated"];

describe("selectable eyes and expression precedence", () => {
  it.each(["none", "square", "round"] as const)("draws five distinct normal eyes exactly once with %s glasses", glasses => {
    const shapes = new Set<string>();
    for (const { value: eyeStyle } of APPEARANCE_OPTIONS.eyeStyle) {
      const root = art(<OfficerHeadArt variant="young" appearance={look({ glasses, eyeStyle })} expression="normal" />);
      const eyes = root.querySelector(".officer-eyes")!;
      expect(root.querySelectorAll(".officer-eyes")).toHaveLength(1);
      attribute(eyes, "data-eye-style", eyeStyle); attribute(eyes, "data-expression", "normal");
      shapes.add(geometry(eyes));
      if (glasses !== "none") {
        expect(root.querySelector(".officer-glasses")!.contains(eyes)).toBe(true);
        precedes(root.querySelector(".officer-glasses > path")!, eyes);
      }
    }
    expect(shapes.size).toBe(5);
  });

  it.each(["stumble", "weary"] as const)("uses %s eyes temporarily and restores each normal selection", expression => {
    for (const glasses of ["none", "square", "round"] as const) {
      for (const variant of variants) {
        const temporary = new Set<string>(), normal = new Set<string>();
        for (const { value: eyeStyle } of APPEARANCE_OPTIONS.eyeStyle) {
          const appearance = look({ eyeStyle, glasses }); const before = structuredClone(appearance);
          const first = art(<OfficerHeadArt variant={variant} appearance={appearance} expression="normal" />);
          const during = art(<OfficerHeadArt variant={variant} appearance={appearance} expression={expression} />);
          const after = art(<OfficerHeadArt variant={variant} appearance={appearance} expression="normal" />);
          const actual = geometry(during.querySelector(".officer-eyes")!);
          attribute(during.querySelector(".officer-eyes"), "data-expression", expression);
          temporary.add(actual); normal.add(geometry(first.querySelector(".officer-eyes")!));
          expect(geometry(after.querySelector(".officer-eyes")!)).toBe(geometry(first.querySelector(".officer-eyes")!));
          expect(appearance).toEqual(before);
        }
        expect(temporary.size).toBe(1); expect(normal.size).toBe(5);
        expect(normal.has([...temporary][0])).toBe(false);
      }
    }
  });

  it("keeps the original framed default pupils and places opaque sunglasses in front of selected eyes", () => {
    const old = art(<OfficerEyeArt variant="older" appearance={look({ eyeStyle: "default", glasses: "square" })} expression="normal" />);
    attribute(old.querySelector(".officer-eye-shape > path"), "d", "M16 12H18V14H16ZM25 12H27V14H25Z");
    const root = art(<OfficerHeadArt variant="older" appearance={look({ glasses: "sunglasses", eyeStyle: "smile" })} expression="normal" />);
    expect(root.querySelectorAll(".officer-eyes")).toHaveLength(1);
    attribute(root.querySelector(".officer-eyes"), "data-eye-style", "smile");
    const lenses = root.querySelector(".officer-sunglass-lenses")!;
    attribute(lenses, "fill", "#263247"); precedes(root.querySelector(".officer-eyes")!, lenses);
  });
});

describe("expanded shapes and palettes", () => {
  it.each(variants)("distinguishes all six hair silhouettes and five outfits for %s", variant => {
    const hair = new Set<string>(), outfits = new Set<string>();
    for (const { value: hairStyle } of APPEARANCE_OPTIONS.hairStyle) {
      const root = art(<OfficerHeadArt variant={variant} appearance={look({ hairStyle })} expression="normal" />);
      hair.add(root.querySelector(".officer-hair-front > path")!.getAttribute("d")!);
      expect(Boolean(root.querySelector(".officer-hair-back"))).toBe(["bob", "ponytail", "long"].includes(hairStyle));
      attribute(root.querySelector(".officer-hair-front > path"), "fill", "#b96391");
    }
    expect(hair.size).toBe(6);
    for (const pose of ["normal", "dragged"] as const) {
      for (const { value: outfit } of APPEARANCE_OPTIONS.outfit) {
        const root = art(<OfficerOutfitArt variant={variant} appearance={look({ outfit })} pose={pose} />);
        const detail = root.querySelector(`.officer-${outfit}-details`)!;
        expect(detail.querySelector("path")).not.toBeNull(); outfits.add(geometry(detail));
        attribute(root.querySelector(".officer-cloth"), "fill", "#76b6d2");
      }
    }
    expect(outfits.size).toBe(5);
  });

  it("draws different colored beanie and beret shapes without changing the hair selection", () => {
    const shapes = new Set<string>();
    for (const hat of ["beanie", "beret"] as const) {
      const root = art(<OfficerHeadArt variant="young" appearance={look({ hat })} expression="normal" />);
      const actual = root.querySelector(`.officer-${hat}-hat`)!;
      shapes.add(geometry(actual));
      expect(actual.querySelector('[fill="#76b6d2"]')).not.toBeNull();
      expect(root.querySelector(".officer-hair--long")).not.toBeNull();
    }
    expect(shapes.size).toBe(2);
  });

  it.each(APPEARANCE_OPTIONS.hairColor)("uses $label hair and a valid highlight", ({ value: hairColor, swatch }) => {
    const root = art(<OfficerHeadArt variant="young" appearance={look({ hairColor })} expression="normal" />);
    attribute(root.querySelector(".officer-hair-front > path"), "fill", swatch);
    attribute(root.querySelector(".officer-hair-back path:nth-child(2)"), "fill", swatch);
    expect(root.querySelector(".officer-hair-front rect")?.getAttribute("fill")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(APPEARANCE_OPTIONS.outfitColor)("uses $label torso and matching hoodie sleeves", ({ value: outfitColor, swatch }) => {
    const root = art(<PixelOfficer variant="young" direction="right" pose="idle" appearance={look({ outfitColor })} />);
    attribute(root.querySelector(".officer-cloth"), "fill", swatch);
    attribute(root.querySelector(".officer-frame--idle .officer-arm-front"), "fill", swatch);
    expect(getOfficerPalette(look({ outfitColor })).clothShade).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(APPEARANCE_OPTIONS.shoeColor)("extends $label boots upward and leaves the sole at y40", ({ value: shoeColor, swatch }) => {
    const root = art(<OfficerShoeArt appearance={look({ shoeColor })} x={8} y={38} width={9} />);
    const shaft = root.querySelector(".officer-boot-upper")!;
    attribute(shaft, "fill", swatch); attribute(shaft, "y", "35");
    attribute(root.querySelector(".officer-boot-sole"), "y", "39"); feetStayAtForty(root, 1);
  });

  it("keeps vest shirtsleeves light while retaining the selected vest and bag colors", () => {
    const appearance = look({ outfit: "vest", outfitColor: "orange" });
    const main = art(<PixelOfficer variant="young" direction="right" pose="idle" appearance={appearance} />);
    const overtime = art(<OvertimeOfficer variant="young" pose="standing" appearance={appearance} />);
    for (const root of [main, overtime]) {
      attribute(root.querySelector(".officer-cloth"), "fill", "#d58b43");
      attribute(root.querySelector(".officer-bag-fill"), "fill", "#c8b38b");
    }
    attribute(main.querySelector(".officer-frame--idle .officer-arm-front"), "fill", "#e6f2ed");
    attribute(overtime.querySelector(".overtime-officer .officer-arm-front"), "fill", "#e6f2ed");
  });

  it("normalizes valid legacy looks while rejecting malformed palette input", () => {
    expect(current.getDefaultCharacterAppearance().version).toBe(2);
    for (const variant of variants) {
      const old = legacy.getDefaultCharacterLook(variant === "older" ? "pursuer" : "runner");
      const modern = normalizeCharacterLook(old)!;
      expect(getOfficerPalette(old)).toEqual(getOfficerPalette(modern));
      expect(renderToStaticMarkup(<PixelOfficer variant={variant} direction="right" pose="idle" appearance={old} />))
        .toBe(renderToStaticMarkup(<PixelOfficer variant={variant} direction="right" pose="idle" appearance={modern} />));
    }
    expect(() => getOfficerPalette({ ...look(), bagColor: "unknown" } as unknown as CharacterLook)).toThrow(RangeError);
  });
});

describe("layered bags across all poses", () => {
  const gameCases = variants.flatMap(variant => (["left", "right"] as const).flatMap(direction =>
    gamePoses.flatMap(pose => APPEARANCE_OPTIONS.bag.map(({ value: bag }) => [variant, direction, pose, bag] as const))));
  it.each(gameCases)("preserves feet and draw order for %s/%s/%s/%s", (variant, direction, pose, bag) => {
    const appearance = look({ bag }); const before = structuredClone(appearance);
    const root = art(<PixelOfficer variant={variant} direction={direction} pose={pose} appearance={appearance} />);
    attribute(root.querySelector(".pixel-officer"), "transform", `scale(${direction === "right" ? 1 : -1} 1)`);
    attribute(root.querySelector(".officer-body > g"), "transform", "translate(-32 -80) scale(2)");
    expect(root.querySelectorAll(".officer-frame")).toHaveLength(4);
    for (const frame of root.querySelectorAll(".officer-frame")) { expectBag(frame, bag, "normal"); feetStayAtForty(frame, 2); }
    expect(appearance).toEqual(before);
  });

  const overtimeCases = variants.flatMap(variant => overtimePoses.flatMap(pose =>
    APPEARANCE_OPTIONS.bag.map(({ value: bag }) => [variant, pose, bag] as const)));
  it.each(overtimeCases)("uses the same bag and stable feet for overtime %s/%s/%s", (variant, pose, bag) => {
    const root = art(<OvertimeOfficer variant={variant} pose={pose} appearance={look({ bag })} />);
    attribute(root.querySelector(".overtime-officer > g"), "transform", "translate(-32 -80) scale(2)");
    expectBag(root, bag, pose === "standing" || pose === "grabbing" ? "normal" : pose); feetStayAtForty(root, 2);
    attribute(root.querySelector(".officer-eyes"), "data-expression", pose === "dragged" || pose === "seated" ? "weary" : "normal");
  });

  it.each(APPEARANCE_OPTIONS.bagColor)("uses independent $label bag colors for every bag and body shape", ({ value: bagColor, swatch }) => {
    for (const variant of variants) for (const { value: bag } of APPEARANCE_OPTIONS.bag) {
      const appearance = look({ bag, bagColor });
      const main = art(<PixelOfficer variant={variant} direction="right" pose="idle" appearance={appearance} />);
      for (const frame of main.querySelectorAll(".officer-frame")) expectBag(frame, bag, "normal", swatch);
      const changed = art(<OvertimeOfficer variant={variant} pose="standing" appearance={{ ...appearance, gender: "male", outfit: "vest" }} />);
      expectBag(changed, bag, "normal", swatch);
      attribute(changed.querySelector(".officer-cloth"), "fill", "#76b6d2");
    }
  });

  it("uses different actual geometry for each bag and carries the briefcase beside the free hand", () => {
    const shapes = new Set<string>();
    for (const { value: bag } of APPEARANCE_OPTIONS.bag) {
      const props = { variant: "young" as const, appearance: look({ bag }), pose: "normal" as const };
      const root = art(<><OfficerBagBackArt {...props} /><OfficerBagFrontArt {...props} /></>);
      shapes.add(geometry(root));
    }
    expect(shapes.size).toBe(5);
    const normal = art(<OvertimeOfficer variant="young" pose="standing" appearance={look({ bag: "briefcase" })} />);
    const dragged = art(<OvertimeOfficer variant="young" pose="dragged" appearance={look({ bag: "briefcase" })} />);
    expect(normal.querySelector(".officer-bag-front")!.getAttribute("transform"))
      .not.toBe(dragged.querySelector(".officer-bag-front")!.getAttribute("transform"));
  });
});
