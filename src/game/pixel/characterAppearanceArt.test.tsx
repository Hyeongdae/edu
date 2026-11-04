import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPEARANCE_OPTIONS, getDefaultCharacterLook } from "../../../shared/characterAppearance";
import type { CharacterLook } from "../../../shared/characterAppearance";
import { OfficerHeadArt, OfficerOutfitArt, OfficerShoeArt } from "./OfficerAppearanceParts";
import { OvertimeOfficer, type OvertimeOfficerPose } from "./OvertimeOfficer";
import { PixelOfficer, type OfficerPose, type OfficerVariant } from "./PixelOfficer";
import { getOfficerPalette } from "./officerPalette";

function art(children: ReactNode): Element {
  const markup = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg">{children}</svg>);
  const document = new DOMParser().parseFromString(markup, "image/svg+xml");
  expect(document.querySelector("parsererror")).toBeNull();
  return document.documentElement;
}

function customLook(): CharacterLook {
  return {
    gender: "female", hairStyle: "ponytail", hairColor: "blond", skinTone: "deep",
    outfit: "cardigan", outfitColor: "teal", hat: "cap", glasses: "round", shoes: "sneakers", shoeColor: "white", eyeStyle: "default", bag: "none", bagColor: "black", bottoms: "trousers", bottomsColor: "navy",
  };
}

function expectFill(root: Element, selector: string, fill: string): void {
  const element = root.querySelector(selector);
  expect(element, selector).not.toBeNull();
  expect(element!.getAttribute("fill"), selector).toBe(fill);
}

function expectFeet(root: Element, count: number): void {
  const shoes = root.querySelectorAll(".officer-shoe-base");
  expect(shoes).toHaveLength(count);
  for (const shoe of shoes) {
    expect(Number(shoe.getAttribute("y")) + Number(shoe.getAttribute("height"))).toBe(40);
  }
}

const variants = ["young", "older"] as const;
const directions = ["left", "right"] as const;
const poses: OfficerPose[] = ["idle", "climb", "fall", "jump"];
const overtimePoses: OvertimeOfficerPose[] = ["standing", "grabbing", "dragged", "seated"];

describe("shared pixel appearance parts", () => {
  it.each(variants)("changes the face contour without restricting hair, outfit or accessories for %s", variant => {
    const look = customLook();
    const female = art(<OfficerHeadArt variant={variant} appearance={look} expression="normal" />);
    const male = art(<OfficerHeadArt variant={variant} appearance={{ ...look, gender: "male" }} expression="normal" />);
    expect(female.querySelector(".officer-face-outline")!.getAttribute("d"))
      .not.toBe(male.querySelector(".officer-face-outline")!.getAttribute("d"));
    for (const root of [female, male]) {
      expect(root.querySelector(".officer-hair--ponytail path")).not.toBeNull();
      expect(root.querySelector(".officer-cap-hat path")).not.toBeNull();
      expect(root.querySelector(".officer-glasses--round path")).not.toBeNull();
      expect(Boolean(root.querySelector(".officer-age-lines"))).toBe(variant === "older");
    }
  });

  it("draws six different hair shapes, including visible long back hair", () => {
    const shapes = new Set<string>();
    for (const { value: hairStyle } of APPEARANCE_OPTIONS.hairStyle) {
      const root = art(<OfficerHeadArt variant="young" appearance={{ ...customLook(), hairStyle, hat: "none" }} expression="normal" />);
      shapes.add(root.querySelector(".officer-hair-front > path")!.getAttribute("d")!);
      expect(Boolean(root.querySelector(".officer-hair-back"))).toBe(hairStyle === "bob" || hairStyle === "ponytail" || hairStyle === "long");
      expect(root.querySelector(".officer-face-skin")).not.toBeNull();
    }
    expect(shapes.size).toBe(6);
  });

  it.each(APPEARANCE_OPTIONS.hairColor)("uses selected $label hair in the front and back layers", ({ value: hairColor, swatch }) => {
    const root = art(<OfficerHeadArt variant="older" appearance={{ ...customLook(), hairColor }} expression="normal" />);
    expectFill(root, ".officer-hair-front > path", swatch!);
    expectFill(root, ".officer-hair-back path:nth-child(2)", swatch!);
    expectFill(root, ".officer-hair-front > rect", getOfficerPalette({ ...customLook(), hairColor }).hairHighlight);
  });

  it.each(APPEARANCE_OPTIONS.skinTone)("applies $label skin to both the face and exposed hands", ({ value: skinTone, swatch }) => {
    const look = { ...customLook(), skinTone };
    const main = art(<PixelOfficer variant="young" direction="right" pose="idle" appearance={look} />);
    const overtime = art(<OvertimeOfficer variant="young" pose="grabbing" appearance={look} />);
    expectFill(main, ".officer-face-skin", swatch!);
    expectFill(main, '.officer-frame--idle rect[x="6"][y="31"]', swatch!);
    expectFill(overtime, ".officer-face-skin", swatch!);
    expectFill(overtime, '.overtime-officer-grip rect[x="1"][y="24"]', swatch!);
    expectFill(overtime, '.overtime-officer-grip rect[x="1"][y="27"]', getOfficerPalette(look).skinShade);
  });

  it.each(APPEARANCE_OPTIONS.outfitColor)("applies $label clothing to the torso and both arm shades", ({ value: outfitColor, swatch }) => {
    const look = { ...customLook(), outfitColor };
    for (const variant of variants) {
      const main = art(<PixelOfficer variant={variant} direction="right" pose="idle" appearance={look} />);
      const overtime = art(<OvertimeOfficer variant={variant} pose="standing" appearance={look} />);
      expectFill(main, ".officer-cloth", swatch!);
      expectFill(main, ".officer-frame--idle .officer-arm-front", swatch!);
      expectFill(main, ".officer-frame--idle .officer-arm-back", getOfficerPalette(look).clothShade);
      expectFill(overtime, ".officer-cloth", swatch!);
      expectFill(overtime, ".overtime-officer .officer-arm-front", swatch!);
    }
  });

  it("draws clothing-specific collars, lapels or button bands instead of changing only labels", () => {
    const details = new Set<string>();
    for (const { value: outfit } of APPEARANCE_OPTIONS.outfit) {
      const root = art(<OfficerOutfitArt variant="young" appearance={{ ...customLook(), outfit }} pose="normal" />);
      const detail = root.querySelector(`.officer-${outfit}-details`);
      expect(detail?.querySelector("path")).not.toBeNull();
      details.add(detail!.innerHTML);
    }
    expect(details.size).toBe(5);
  });

  it.each(variants)("removes preset hat and glasses for %s and draws each chosen accessory", variant => {
    const look = getDefaultCharacterLook(variant === "older" ? "pursuer" : "runner");
    const bare = art(<PixelOfficer variant={variant} direction="right" pose="climb" appearance={{ ...look, hat: "none", glasses: "none" }} />);
    expect(bare.querySelector(".officer-straw-hat, .officer-cap-hat, .officer-glasses")).toBeNull();
    const straw = art(<OfficerHeadArt variant={variant} appearance={{ ...look, hat: "straw" }} expression="normal" />);
    const cap = art(<OfficerHeadArt variant={variant} appearance={{ ...look, hat: "cap" }} expression="normal" />);
    expect(straw.querySelectorAll(".officer-straw-hat path")).toHaveLength(2);
    expect(cap.querySelectorAll(".officer-cap-hat path")).toHaveLength(3);
    const square = art(<OfficerHeadArt variant={variant} appearance={{ ...look, glasses: "square" }} expression="normal" />);
    const round = art(<OfficerHeadArt variant={variant} appearance={{ ...look, glasses: "round" }} expression="normal" />);
    expect(square.querySelector(".officer-glasses > path")!.getAttribute("d"))
      .not.toBe(round.querySelector(".officer-glasses > path")!.getAttribute("d"));
  });

  it.each(APPEARANCE_OPTIONS.shoeColor)("changes $label shoes without raising the foot baseline", ({ value: shoeColor, swatch }) => {
    for (const { value: shoes } of APPEARANCE_OPTIONS.shoes) {
      const root = art(<OfficerShoeArt appearance={{ ...customLook(), shoes, shoeColor }} x={8} y={38} width={9} />);
      expectFill(root, ".officer-shoe-base", swatch!);
      expectFeet(root, 1);
      if (shoes === "boots") expect(Number(root.querySelector(".officer-boot-upper")!.getAttribute("y"))).toBeLessThan(38);
      expect(Boolean(root.querySelector(".officer-shoe-sole"))).toBe(shoes === "sneakers");
      if (shoes === "sneakers") {
        expect(root.querySelector(".officer-shoe-sole")!.getAttribute("y")).toBe("39");
        expectFill(root, ".officer-shoe-sole", getOfficerPalette({ ...customLook(), shoeColor }).shoeSole);
      }
    }
  });
});

describe("appearance across gameplay and overtime poses", () => {
  const mainCases = variants.flatMap(variant => directions.flatMap(direction => poses.map(pose => [variant, direction, pose] as const)));
  it.each(mainCases)("keeps all chosen parts and motion coordinates for %s/%s/%s", (variant, direction, pose) => {
    const look = customLook();
    const root = art(<PixelOfficer variant={variant} direction={direction} pose={pose} appearance={look} />);
    expect(root.querySelectorAll(".officer-frame")).toHaveLength(4);
    expect([...root.querySelectorAll(".officer-frame")].map(frame => frame.getAttribute("data-officer-frame")))
      .toEqual(["idle", "run-a", "run-b", "stumble"]);
    expect(root.querySelector(".pixel-officer")!.getAttribute("transform")).toBe(`scale(${direction === "right" ? 1 : -1} 1)`);
    expect(root.querySelector(".officer-body > g")!.getAttribute("transform")).toBe("translate(-32 -80) scale(2)");
    for (const frame of root.querySelectorAll(".officer-frame")) {
      expect(frame.querySelector(".officer-hair--ponytail path")).not.toBeNull();
      expect(frame.querySelector(".officer-cardigan-details path")).not.toBeNull();
      expect(frame.querySelector(".officer-cap-hat path")).not.toBeNull();
      expect(frame.querySelector(".officer-glasses--round path")).not.toBeNull();
      const shoulder = frame.querySelector(".officer-cloth")!.getAttribute("d")!.match(/^M(\d+) 23H(\d+)/)!;
      expect(Number(shoulder[2]) - Number(shoulder[1])).toBe(variant === "older" ? 12 : 14);
      expectFill(frame, ".officer-face-skin", "#86533a");
      expectFeet(frame, 2);
    }
    expect(root.querySelectorAll(".officer-shoe-sole")).toHaveLength(8);
  });

  const overtimeCases = variants.flatMap(variant => overtimePoses.map((pose): [OfficerVariant, OvertimeOfficerPose] => [variant, pose]));
  it.each(overtimeCases)("uses the same selected parts for overtime %s/%s", (variant, pose) => {
    const root = art(<OvertimeOfficer variant={variant} pose={pose} appearance={customLook()} />);
    expect(root.querySelector(".overtime-officer > g")!.getAttribute("transform")).toBe("translate(-32 -80) scale(2)");
    expect(root.querySelector(".officer-hair--ponytail path")).not.toBeNull();
    expect(root.querySelector(".officer-cap-hat path")).not.toBeNull();
    expect(root.querySelector(".officer-glasses--round path")).not.toBeNull();
    expect(root.querySelector(".officer-cardigan-details path")).not.toBeNull();
    expectFill(root, ".officer-face-skin", "#86533a");
    expectFill(root, ".officer-cloth", "#397f82");
    expectFeet(root, 2);
    expect(root.querySelectorAll(".officer-shoe-sole")).toHaveLength(2);
    expect(root.querySelector(".overtime-officer-head")!.getAttribute("transform"))
      .toBe(pose === "seated" ? "translate(3 4)" : pose === "dragged" ? "translate(-2 0)" : null);
    expect(root.querySelector(pose === "seated" ? ".overtime-officer-seated-legs" : ".overtime-officer-leg-front")).not.toBeNull();
  });
});
