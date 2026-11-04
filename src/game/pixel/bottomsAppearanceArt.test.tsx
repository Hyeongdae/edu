import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPEARANCE_OPTIONS, getDefaultCharacterLook, type CharacterLook } from "../../../shared/bottomsCharacterAppearance";
import * as expanded from "../../../shared/expandedCharacterAppearance";
import * as legacy from "../../../shared/legacyCharacterAppearance";
import { OfficerBottomsArt, type OfficerBottomsPose } from "./OfficerBottomsArt";
import { PixelOfficer, type OfficerVariant } from "./PixelOfficer";
import { OvertimeOfficer } from "./OvertimeOfficer";
import { getOfficerPalette } from "./officerPalette";

const variants = ["young", "older"] as const;
const genders = ["male", "female"] as const;
const poses: readonly OfficerBottomsPose[] = ["idle", "run-a", "run-b", "stumble", "standing", "grabbing", "dragged", "seated"];
const cases = variants.flatMap(variant => genders.flatMap(gender => poses.map(pose => ({ variant, gender, pose }))));

function look(variant: OfficerVariant, changes: Partial<CharacterLook> = {}): CharacterLook {
  return { ...getDefaultCharacterLook(variant === "young" ? "runner" : "pursuer"), ...changes };
}
function art(children: ReactNode): Element {
  const doc = new DOMParser().parseFromString(renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg">{children}</svg>), "image/svg+xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  return doc.documentElement;
}
function part(root: Element, selector: string): Element {
  const node = root.querySelector(selector);
  expect(node, selector).not.toBeNull();
  return node!;
}

// Sample opaque orthogonal SVG shapes at pixel centers, including inherited fills and clips.
// These helpers inspect the actual art rather than treating a class name as proof of a drawing.
function pixels(node: Element): Set<string> {
  const result = new Set<string>();
  if (node.tagName === "rect") {
    const x = Number(node.getAttribute("x")), y = Number(node.getAttribute("y"));
    for (let row = y; row < y + Number(node.getAttribute("height")); row++)
      for (let col = x; col < x + Number(node.getAttribute("width")); col++) result.add(`${col},${row}`);
    return result;
  }
  const polygons: [number, number][][] = [];
  const tokens = node.getAttribute("d")!.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g)!;
  let polygon: [number, number][] = [], x = 0, y = 0;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    if (command === "M") { polygon = []; x = Number(tokens[i++]); y = Number(tokens[i++]); }
    else if (command === "H") x = Number(tokens[i++]);
    else if (command === "V") y = Number(tokens[i++]);
    else if (command === "Z") { polygon.push(polygon[0]); polygons.push(polygon); continue; }
    else throw new Error(`Unsupported bottoms geometry: ${command}`);
    polygon.push([x, y]);
  }
  for (const points of polygons) {
    const ys = points.map(point => point[1]);
    for (let row = Math.min(...ys); row < Math.max(...ys); row++) {
      const edges: number[] = [];
      for (let i = 1; i < points.length; i++) {
        const [x1, y1] = points[i - 1], [x2, y2] = points[i];
        if (x1 === x2 && row + .5 >= Math.min(y1, y2) && row + .5 < Math.max(y1, y2)) edges.push(x1);
      }
      edges.sort((a, b) => a - b);
      for (let i = 0; i + 1 < edges.length; i += 2)
        for (let col = edges[i]; col < edges[i + 1]; col++) result.add(`${col},${row}`);
    }
  }
  return result;
}
function union(sets: Iterable<Set<string>>): Set<string> {
  return new Set([...sets].flatMap(set => [...set]));
}
function paint(root: Element): Map<string, string> {
  const output = new Map<string, string>();
  const clips = new Map([...root.querySelectorAll("clipPath")].map(node =>
    [node.id, union([...node.querySelectorAll("path,rect")].map(pixels))]));
  for (const node of root.querySelectorAll("path,rect")) {
    if (node.closest("defs")) continue;
    let fill: string | null = null;
    const appliedClips: Set<string>[] = [];
    for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
      fill ??= ancestor.getAttribute("fill");
      const reference = ancestor.getAttribute("clip-path");
      if (reference) {
        const clip = clips.get(reference.slice(5, -1));
        expect(clip, `Missing clip ${reference}`).toBeDefined();
        appliedClips.push(clip!);
      }
      if (ancestor === root) break;
    }
    if (fill === "none") continue;
    for (const point of pixels(node)) if (appliedClips.every(clip => clip.has(point))) output.set(point, fill ?? "#000000");
  }
  return output;
}
function geometry(root: Element): string {
  const nodes = [...(root.matches("path,rect") ? [root] : []), ...root.querySelectorAll("path,rect")];
  return JSON.stringify(nodes.filter(node => !node.closest("defs"))
    .map(node => [node.tagName, ...["d", "x", "y", "width", "height", "fill"].map(name => node.getAttribute(name))]));
}
function expectedShoes(variant: OfficerVariant, pose: OfficerBottomsPose): number[][] {
  const older = variant === "older";
  switch (pose) {
    case "idle": case "standing": case "grabbing": return [[older ? 11 : 10, 38, older ? 7 : 8, 2], [20, 38, older ? 8 : 9, 2]];
    case "run-a": return [[5, 38, 9, 2], [24, 38, 8, 2]];
    case "run-b": return [[8, 38, 8, 2], [24, 38, 8, 2]];
    case "stumble": return [[older ? 4 : 3, 38, older ? 9 : 10, 2], [24, 38, older ? 7 : 8, 2]];
    case "dragged": return [[older ? 7 : 6, 38, older ? 7 : 8, 2], [24, 38, older ? 8 : 9, 2]];
    case "seated": return [[21, 38, 8, 2], [28, 38, 7, 2]];
  }
}

describe("four distinct bottoms across all officer poses", () => {
  it.each(cases)("draws distinct pixel art without moving the feet for $variant/$gender/$pose", ({ variant, gender, pose }) => {
    const images: string[] = [];
    for (const { value: bottoms } of APPEARANCE_OPTIONS.bottoms) {
      const appearance = look(variant, { gender, bottoms, skinTone: "deep", shoes: "dress" });
      const before = structuredClone(appearance);
      const root = art(<OfficerBottomsArt variant={variant} pose={pose} appearance={appearance} />);
      const output = paint(root);
      expect(output.size).toBeGreaterThan(20);
      images.push(JSON.stringify([...output].sort()));
      const shoes = [...root.querySelectorAll(".officer-shoe-base")];
      expect(shoes.map(node => ["x", "y", "width", "height"].map(name => Number(node.getAttribute(name))))).toEqual(expectedShoes(variant, pose));
      for (const key of output.keys()) {
        const [x, y] = key.split(",").map(Number);
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(40);
        expect(y).toBeGreaterThanOrEqual(32); expect(y).toBeLessThan(40);
      }
      const colors = [...output.values()];
      expect(colors).toContain("#354766");
      if (bottoms === "shorts" || bottoms === "skirt") {
        expect(colors).toContain(getOfficerPalette(appearance).skin);
        for (const [point, color] of output) if (color === getOfficerPalette(appearance).skin)
          expect(Number(point.split(",")[1])).toBeGreaterThanOrEqual(bottoms === "shorts" ? 35 : 36);
      } else expect(root.querySelector(".officer-exposed-leg")).toBeNull();
      expect(appearance).toEqual(before);
    }
    expect(new Set(images).size).toBe(4);
  });

  it.each(variants.flatMap(variant => poses.map(pose => ({ variant, pose }))))("clips jeans seams and cuffs inside the original trousers for $variant/$pose", ({ variant, pose }) => {
    const trousers = art(<OfficerBottomsArt variant={variant} pose={pose} appearance={look(variant)} />);
    const jeans = art(<OfficerBottomsArt variant={variant} pose={pose} appearance={look(variant, { bottoms: "jeans" })} />);
    const original = paint(trousers), stitched = paint(jeans);
    expect(new Set(stitched.keys())).toEqual(new Set(original.keys()));
    const cloth = union([...trousers.querySelectorAll(".officer-bottoms-fabric path,.officer-bottoms-fabric rect")].map(pixels));
    const changed = [...stitched].filter(([point, color]) => original.get(point) !== color);
    expect(changed.length).toBeGreaterThan(0);
    for (const [point] of changed) expect(cloth.has(point)).toBe(true);
    expect(jeans.querySelectorAll(".officer-jeans-seam")).toHaveLength(2);
    expect(jeans.querySelectorAll(".officer-jeans-pocket")).toHaveLength(2);
    expect(jeans.querySelectorAll(".officer-jeans-cuff")).toHaveLength(2);
  });

  it.each(cases)("keeps the skirt waist and hem connected for $variant/$gender/$pose", ({ variant, gender, pose }) => {
    const root = art(<OfficerBottomsArt variant={variant} pose={pose} appearance={look(variant, { gender, bottoms: "skirt" })} />);
    const cloth = pixels(part(root, ".officer-skirt-fabric"));
    const queue = [[...cloth][0]], visited = new Set(queue);
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i].split(",").map(Number);
      for (const key of [`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`])
        if (cloth.has(key) && !visited.has(key)) { visited.add(key); queue.push(key); }
    }
    expect(visited).toEqual(cloth);
    expect([...cloth].some(key => key.endsWith(",33"))).toBe(true);
    expect([...cloth].some(key => key.endsWith(",35"))).toBe(true);
    const output = paint(root);
    expect([...output.values()]).toContain("#22304c");
  });
});

describe("bottoms colors, skin, shoes and surrounding art", () => {
  const shades = {
    black: ["#283247", "#161e2f", "#10182c"], navy: ["#354766", "#2c3b59", "#22304c"],
    gray: ["#788394", "#525f71", "#394657"], beige: ["#c8b38b", "#95815f", "#6f6048"],
    brown: ["#785039", "#4d3325", "#34251d"], white: ["#e6edf2", "#b1bfcc", "#8092a4"],
  };
  it.each(APPEARANCE_OPTIONS.bottomsColor)("applies $label with separate fabric and deep shades", ({ value: bottomsColor }) => {
    for (const { value: bottoms } of APPEARANCE_OPTIONS.bottoms) {
      for (const pose of ["standing", "seated"] as const) {
        const root = art(<OfficerBottomsArt variant="young" pose={pose} appearance={look("young", { bottoms, bottomsColor })} />);
        const colors = [...paint(root).values()];
        expect(colors).toContain(shades[bottomsColor][0]);
        if (bottoms === "trousers" || bottoms === "jeans") expect(colors).toContain(shades[bottomsColor][1]);
        if (bottoms === "jeans" || bottoms === "skirt" || (bottoms === "trousers" && pose === "seated"))
          expect(colors).toContain(shades[bottomsColor][2]);
      }
    }
  });

  it.each(APPEARANCE_OPTIONS.skinTone)("uses selected $label on exposed legs and paints boots over the skin", ({ value: skinTone, swatch }) => {
    for (const bottoms of ["shorts", "skirt"] as const) {
      for (const pose of ["run-a", "dragged", "seated"] as const) {
        const appearance = look("older", { bottoms, skinTone, shoes: "boots", shoeColor: "red" });
        const root = art(<OfficerBottomsArt variant="older" pose={pose} appearance={appearance} />);
        expect(part(root, ".officer-bottom-leg--front .officer-exposed-leg").getAttribute("fill")).toBe(swatch);
        const output = paint(root);
        for (const boot of root.querySelectorAll(".officer-boot-upper")) {
          const x = Number(boot.getAttribute("x")), y = Number(boot.getAttribute("y"));
          expect(y).toBe(35);
          expect(output.get(`${x},${y}`)).toBe(getOfficerPalette(appearance).shoeSole);
          expect(output.get(`${x},${y + 1}`)).toBe("#ab4f5f");
        }
      }
    }
  });

  it.each(variants)("shows identical default trousers for fixed v1/v2 and explicit v3 at age %s", variant => {
    const role = variant === "young" ? "runner" : "pursuer";
    for (const pose of poses) {
      const newest = paint(art(<OfficerBottomsArt variant={variant} pose={pose} appearance={look(variant)} />));
      for (const older of [legacy.getDefaultCharacterLook(role), expanded.getDefaultCharacterLook(role)]) {
        expect(paint(art(<OfficerBottomsArt variant={variant} pose={pose} appearance={older} />))).toEqual(newest);
        expect(getOfficerPalette(older)).toEqual(getOfficerPalette(look(variant)));
      }
    }
  });

  const outfitCases = variants.flatMap(variant => genders.flatMap(gender =>
    APPEARANCE_OPTIONS.outfit.map(({ value: outfit }) => ({ variant, gender, outfit }))));
  it.each(outfitCases)("preserves surrounding art and every bag for $variant/$gender/$outfit", ({ variant, gender, outfit }) => {
    for (const { value: bag } of APPEARANCE_OPTIONS.bag) {
      const original = look(variant, { gender, outfit, bag, bagColor: "beige", hairStyle: "long", glasses: "round", shoes: "boots" });
      const reference = art(<PixelOfficer variant={variant} pose="climb" direction="left" appearance={original} />);
      const changed = art(<PixelOfficer variant={variant} pose="climb" direction="left" appearance={{ ...original, bottoms: "skirt", bottomsColor: "white" }} />);
      for (const selector of [".officer-head-art", ".officer-outfit", ".officer-arm-front", ".officer-arm-back", ".officer-hand", ".officer-shoe"])
        expect(geometry(part(changed, selector))).toBe(geometry(part(reference, selector)));
      for (const selector of [".officer-bag-back", ".officer-bag-front"]) {
        const before = reference.querySelector(selector), after = changed.querySelector(selector);
        expect(Boolean(after)).toBe(Boolean(before));
        if (after && before) expect(geometry(after)).toBe(geometry(before));
      }
      expect(part(changed, ".pixel-officer").getAttribute("transform")).toBe("scale(-1 1)");
      expect(part(changed, '.officer-body > g').getAttribute("transform")).toBe("translate(-32 -80) scale(2)");
    }
  });

  it("keeps actual shoes and fabric inside animated overtime leg groups", () => {
    for (const variant of variants) for (const { value: bottoms } of APPEARANCE_OPTIONS.bottoms) {
      for (const pose of ["standing", "grabbing", "dragged"] as const) {
        const root = art(<OvertimeOfficer variant={variant} pose={pose} appearance={look(variant, { bottoms })} />);
        for (const side of ["back", "front"]) {
          const leg = part(root, `.overtime-officer-walking-legs .overtime-officer-leg-${side}`);
          expect(leg.querySelectorAll(".officer-shoe-base")).toHaveLength(1);
          expect(leg.querySelector(bottoms === "shorts" || bottoms === "skirt" ? ".officer-exposed-leg" : ".officer-bottoms-fabric")).not.toBeNull();
        }
      }
      const seated = art(<OvertimeOfficer variant={variant} pose="seated" appearance={look(variant, { bottoms })} />);
      expect(part(seated, ".overtime-officer-seated-legs").querySelectorAll(".officer-shoe-base")).toHaveLength(2);
      expect(seated.querySelector(".overtime-officer-leg-front")).toBeNull();
    }
  });

  it("assigns unique, locally resolved clip IDs to both officers and all four frames", () => {
    const root = art(<>
      <PixelOfficer variant="young" pose="jump" direction="right" appearance={look("young", { bottoms: "jeans" })} />
      <PixelOfficer variant="older" pose="fall" direction="left" appearance={look("older", { bottoms: "skirt" })} />
    </>);
    const ids = [...root.querySelectorAll("clipPath")].map(node => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(root.querySelectorAll(".officer-bottoms")).toHaveLength(8);
    for (const node of root.querySelectorAll("[clip-path]")) {
      const reference = node.getAttribute("clip-path")!.slice(5, -1);
      const target = [...root.querySelectorAll("clipPath")].find(clip => clip.id === reference);
      expect(target).toBeDefined();
      expect(target!.closest(".officer-bottoms")).toBe(node.closest(".officer-bottoms"));
    }
  });

  it("rejects unknown latest colors rather than returning a misleading default palette", () => {
    expect(() => getOfficerPalette({ ...look("young"), bottomsColor: "unknown" } as unknown as CharacterLook)).toThrow(RangeError);
  });
});
