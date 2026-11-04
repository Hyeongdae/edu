import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPEARANCE_OPTIONS, getDefaultCharacterLook, normalizeCharacterLook, type CharacterLook } from "../../../shared/characterAppearance";
import { getDefaultCharacterLook as legacyLook } from "../../../shared/legacyCharacterAppearance";
import { OfficerHeadArt, OfficerOutfitArt, type OfficerExpression } from "./OfficerAppearanceParts";
import { OvertimeOfficer } from "./OvertimeOfficer";
import { PixelOfficer, type OfficerVariant } from "./PixelOfficer";
import { getOfficerPalette } from "./officerPalette";

const variants = ["young", "older"] as const;
const genders = ["male", "female"] as const;
const clearGlasses = ["none", "square", "round"] as const;

function look(variant: OfficerVariant, overrides: Partial<CharacterLook> = {}): CharacterLook {
  return { ...getDefaultCharacterLook(variant === "young" ? "runner" : "pursuer"),
    hairStyle: "short", hat: "none", glasses: "none", ...overrides };
}
function art(children: ReactNode): Element {
  const markup = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg">{children}</svg>);
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  return doc.documentElement;
}
function part(root: Element, selector: string): Element {
  const node = root.querySelector(selector);
  expect(node, selector).not.toBeNull();
  return node!;
}
function geometry(root: Element): string {
  return JSON.stringify([...root.querySelectorAll("path,rect")].map(node => [node.tagName,
    ...["d", "x", "y", "width", "height", "fill"].map(name => node.getAttribute(name))]));
}

// Scan the actual rectilinear polygon at a chin/neck row, independent of its SVG spelling.
function spanAt(node: Element, y: number): readonly [number, number] | null {
  if (node.tagName === "rect") {
    const top = Number(node.getAttribute("y")), height = Number(node.getAttribute("height"));
    if (y < top || y >= top + height) return null;
    const left = Number(node.getAttribute("x"));
    return [left, left + Number(node.getAttribute("width"))];
  }
  const tokens = node.getAttribute("d")!.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g)!;
  const points: [number, number][] = [];
  let x = 0, top = 0;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    if (command === "M") { x = Number(tokens[i++]); top = Number(tokens[i++]); }
    else if (command === "H") x = Number(tokens[i++]);
    else if (command === "V") top = Number(tokens[i++]);
    else if (command === "Z") { points.push(points[0]); continue; }
    else throw new Error(`Unsupported contour command: ${command}`);
    points.push([x, top]);
  }
  const crossings: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1], [x2, y2] = points[i];
    if (x1 === x2 && y >= Math.min(y1, y2) && y < Math.max(y1, y2)) crossings.push(x1);
  }
  return crossings.length ? [Math.min(...crossings), Math.max(...crossings)] : null;
}

describe("gender-specific face contours", () => {
  it.each(variants)("narrows the actual lower face and skin while keeping the neck attached for %s", variant => {
    const maleLook = look(variant), femaleLook = { ...maleLook, gender: "female" as const };
    const male = art(<OfficerHeadArt variant={variant} appearance={maleLook} expression="normal" />);
    const female = art(<OfficerHeadArt variant={variant} appearance={femaleLook} expression="normal" />);
    for (const selector of [".officer-face-outline", ".officer-jaw-skin"]) {
      const row = selector === ".officer-face-outline" ? 20.5 : 19.5;
      const m = spanAt(part(male, selector), row)!, f = spanAt(part(female, selector), row)!;
      expect(f[1] - f[0]).toBeLessThan(m[1] - m[0]);
    }
    const skin = getOfficerPalette(femaleLook).skin;
    const filledChin = [...female.querySelectorAll("path,rect")]
      .filter(node => node.getAttribute("fill") === skin).map(node => spanAt(node, 20.5)).filter(value => value !== null);
    expect(filledChin.length).toBeGreaterThan(0);
    // A leftover wide skin patch must not undo the tapered chin.
    expect(Math.min(...filledChin.map(span => span[0]))).toBeGreaterThanOrEqual(15);
    expect(Math.max(...filledChin.map(span => span[1]))).toBeLessThanOrEqual(22);
    expect(spanAt(part(female, ".officer-neck-skin"), 23.5)).toEqual([16, 22]);
    expect(spanAt(part(male, ".officer-neck-skin"), 23.5)).toEqual([16, 22]);
    expect(geometry(part(female, ".officer-hair-front"))).toBe(geometry(part(male, ".officer-hair-front")));
    expect(Boolean(female.querySelector(".officer-age-lines"))).toBe(variant === "older");
  });

  it.each(variants)("preserves selected skin hair and accessories for either gender at age %s", variant => {
    for (const { value: skinTone, swatch } of APPEARANCE_OPTIONS.skinTone) {
      for (const gender of genders) {
        const appearance = look(variant, { gender, skinTone, hairStyle: "long", hairColor: "blue", hat: "beret", glasses: "round" });
        const before = structuredClone(appearance);
        const root = art(<OfficerHeadArt variant={variant} appearance={appearance} expression="normal" />);
        expect(part(root, ".officer-face-skin").getAttribute("fill")).toBe(swatch);
        expect(part(root, ".officer-hair--long > path").getAttribute("fill")).not.toBeNull();
        expect(part(root, ".officer-hair-front > path").getAttribute("fill")).toBe("#386da8");
        expect(root.querySelector(".officer-beret-hat")).not.toBeNull();
        expect(root.querySelector(".officer-glasses--round")).not.toBeNull();
        expect(Boolean(root.querySelector(".officer-age-lines"))).toBe(variant === "older");
        expect(appearance).toEqual(before);
      }
    }
  });
});

describe("selected eyes with gender details", () => {
  const cases = variants.flatMap(variant => genders.flatMap(gender => clearGlasses.map(glasses => ({ variant, gender, glasses }))));
  it.each(cases)("retains five single eye shapes with distinct brows for $variant/$gender/$glasses", ({ variant, gender, glasses }) => {
    const shapes = new Set<string>();
    for (const { value: eyeStyle } of APPEARANCE_OPTIONS.eyeStyle) {
      const appearance = look(variant, { gender, glasses, eyeStyle });
      const root = art(<OfficerHeadArt variant={variant} appearance={appearance} expression="normal" />);
      const other = art(<OfficerHeadArt variant={variant} appearance={{ ...appearance, gender: gender === "female" ? "male" : "female" }} expression="normal" />);
      expect(root.querySelectorAll(".officer-eyes")).toHaveLength(1);
      expect(root.querySelectorAll(".officer-eye-shape")).toHaveLength(1);
      expect(root.querySelectorAll(".officer-eyebrows")).toHaveLength(1);
      const eyes = part(root, ".officer-eyes");
      expect(eyes.getAttribute("data-eye-style")).toBe(eyeStyle);
      shapes.add(geometry(part(root, ".officer-eye-shape")));
      expect(geometry(part(root, ".officer-eyebrows"))).not.toBe(geometry(part(other, ".officer-eyebrows")));
      expect(part(root, ".officer-eyebrows path").getAttribute("d")).toBeTruthy();
      expect(Boolean(root.querySelector(".officer-eyelashes"))).toBe(gender === "female");
      if (gender === "female") expect(part(root, ".officer-eyelashes path").getAttribute("d")).toBeTruthy();
      if (glasses !== "none") {
        const frame = part(root, ".officer-glasses");
        expect(frame.contains(eyes)).toBe(true);
        expect(part(frame, "path").compareDocumentPosition(eyes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    }
    expect(shapes.size).toBe(5);
  });

  it.each(cases)("restores each eye selection after temporary expressions for $variant/$gender/$glasses", ({ variant, gender, glasses }) => {
    for (const expression of ["stumble", "weary"] satisfies OfficerExpression[]) {
      const temporary = new Set<string>(), normal = new Set<string>();
      for (const { value: eyeStyle } of APPEARANCE_OPTIONS.eyeStyle) {
        const appearance = look(variant, { gender, glasses, eyeStyle }), before = structuredClone(appearance);
        const draw = (value: OfficerExpression) => art(<OfficerHeadArt variant={variant} appearance={appearance} expression={value} />);
        const first = draw("normal"), during = draw(expression), after = draw("normal");
        normal.add(geometry(part(first, ".officer-eye-shape")));
        temporary.add(geometry(part(during, ".officer-eyes")));
        expect(part(during, ".officer-eyes").getAttribute("data-expression")).toBe(expression);
        expect(geometry(part(after, ".officer-eyes"))).toBe(geometry(part(first, ".officer-eyes")));
        expect(appearance).toEqual(before);
      }
      expect(normal.size).toBe(5); expect(temporary.size).toBe(1);
    }
  });

  it.each(genders)("keeps opaque sunglasses above one selected eye group for %s", gender => {
    const root = art(<OfficerHeadArt variant="older" appearance={look("older", { gender, glasses: "sunglasses", eyeStyle: "smile" })} expression="normal" />);
    expect(root.querySelectorAll(".officer-eyes")).toHaveLength(1);
    const eyes = part(root, ".officer-eyes"), lenses = part(root, ".officer-sunglass-lenses");
    expect(eyes.getAttribute("data-eye-style")).toBe("smile");
    expect(eyes.compareDocumentPosition(lenses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lenses.getAttribute("fill")).toBe("#263247");
  });
});

it.each(variants)("uses unchanged legacy and missing-look fallbacks for %s", variant => {
  const role = variant === "young" ? "runner" : "pursuer";
  const legacy = legacyLook(role), normalized = normalizeCharacterLook(legacy)!;
  const fromOld = art(<OfficerHeadArt variant={variant} appearance={legacy} expression="normal" />);
  const fromNew = art(<OfficerHeadArt variant={variant} appearance={normalized} expression="normal" />);
  expect(geometry(fromOld)).toBe(geometry(fromNew));
  const missing = art(<PixelOfficer variant={variant} direction="right" pose="idle" />);
  const explicit = art(<PixelOfficer variant={variant} direction="right" pose="idle" appearance={getDefaultCharacterLook(role)} />);
  expect(geometry(missing)).toBe(geometry(explicit));
});

// Pixel coverage makes gaps observable even when the surrounding bounding boxes overlap.
function pixels(node: Element, dx = 0, dy = 0): Set<string> {
  const result = new Set<string>();
  if (node.tagName === "rect") {
    const x = Number(node.getAttribute("x")), y = Number(node.getAttribute("y"));
    for (let row = y; row < y + Number(node.getAttribute("height")); row++)
      for (let col = x; col < x + Number(node.getAttribute("width")); col++) result.add(`${col + dx},${row + dy}`);
    return result;
  }
  const polygons: [number, number][][] = [];
  let current: [number, number][] = [], x = 0, y = 0;
  const tokens = node.getAttribute("d")!.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g)!;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    if (command === "M") { current = []; x = Number(tokens[i++]); y = Number(tokens[i++]); }
    else if (command === "H") x = Number(tokens[i++]);
    else if (command === "V") y = Number(tokens[i++]);
    else if (command === "Z") { current.push(current[0]); polygons.push(current); continue; }
    else throw new Error(`Unsupported coverage command: ${command}`);
    current.push([x, y]);
  }
  for (const polygon of polygons) {
    const ys = polygon.map(point => point[1]);
    for (let row = Math.min(...ys); row < Math.max(...ys); row++) {
      const edges: number[] = [];
      for (let i = 1; i < polygon.length; i++) {
        const [x1, y1] = polygon[i - 1], [x2, y2] = polygon[i];
        if (x1 === x2 && row + .5 >= Math.min(y1, y2) && row + .5 < Math.max(y1, y2)) edges.push(x1);
      }
      edges.sort((a, b) => a - b);
      for (let i = 0; i + 1 < edges.length; i += 2)
        for (let col = edges[i]; col < edges[i + 1]; col++) result.add(`${col + dx},${row + dy}`);
    }
  }
  return result;
}
function combine(sets: Iterable<Set<string>>): Set<string> {
  return new Set([...sets].flatMap(set => [...set]));
}
function neighbours(key: string): string[] {
  const [x, y] = key.split(",").map(Number);
  return [`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`];
}
function reachable(all: Set<string>, start: string): Set<string> {
  const visited = new Set([start]), queue = [start];
  for (let i = 0; i < queue.length; i++) for (const next of neighbours(queue[i])) {
    if (all.has(next) && !visited.has(next)) { visited.add(next); queue.push(next); }
  }
  return visited;
}
function bagPixels(node: Element): Set<string> {
  const group = node.closest(".officer-bag-front,.officer-bag-back")!;
  const offset = group.getAttribute("transform")!.match(/translate\((-?\d+) (-?\d+)\)/)!;
  return pixels(node, Number(offset[1]), Number(offset[2]));
}

describe("gender body shapes and connected poses", () => {
  const clothing = variants.flatMap(variant => ["normal", "dragged"].flatMap(pose =>
    APPEARANCE_OPTIONS.outfit.map(({ value: outfit }) => ({ variant, pose: pose as "normal" | "dragged", outfit }))));
  it.each(clothing)("keeps $variant/$pose/$outfit inside a narrower female outline", ({ variant, pose, outfit }) => {
    const appearance = look(variant, { outfit, gender: "female" }), before = structuredClone(appearance);
    const female = art(<OfficerOutfitArt variant={variant} pose={pose} appearance={appearance} />);
    const male = art(<OfficerOutfitArt variant={variant} pose={pose} appearance={{ ...appearance, gender: "male" }} />);
    for (const selector of [".officer-torso-outline", ".officer-cloth"]) {
      const f = spanAt(part(female, selector), 30.5)!, m = spanAt(part(male, selector), 30.5)!;
      expect(f[1] - f[0]).toBeLessThan(m[1] - m[0]);
    }
    const silhouette = pixels(part(female, ".officer-torso-outline"));
    const visible = combine([...female.querySelectorAll("path,rect")].map(node => pixels(node)));
    expect([...visible].filter(key => !silhouette.has(key))).toEqual([]);
    expect(part(female, `.officer-${outfit}-details path`).getAttribute("d")).toBeTruthy();
    expect(part(female, ".officer-cloth").getAttribute("fill")).toBe(getOfficerPalette(appearance).cloth);
    expect(appearance).toEqual(before);
  });

  const bodies = variants.flatMap(variant => genders.map(gender => ({ variant, gender })));
  it.each(bodies)("connects both hands to the torso with fixed feet for game $variant/$gender", ({ variant, gender }) => {
    const appearance = look(variant, { gender, outfit: "vest" }), before = structuredClone(appearance);
    const root = art(<PixelOfficer variant={variant} direction="left" pose="climb" appearance={appearance} />);
    expect(part(root, ".officer-body > g").getAttribute("transform")).toBe("translate(-32 -80) scale(2)");
    expect(part(root, ".pixel-officer").getAttribute("transform")).toBe("scale(-1 1)");
    const expectedHands: Record<string, number[][]> = {
      idle: [[variant === "older" ? 7 : 6, 31], [variant === "older" ? 25 : 26, 31]],
      "run-a": [[variant === "older" ? 2 : 1, 28], [27, 22]],
      "run-b": [[3, 21], [28, 29]],
      stumble: [[0, 20], [28, 19]],
    };
    for (const frame of root.querySelectorAll(".officer-frame")) {
      const torso = pixels(part(frame, ".officer-torso-outline"));
      const sleeves = [...frame.querySelectorAll(".officer-sleeve")];
      const hands = [...frame.querySelectorAll(".officer-hand")];
      expect(hands).toHaveLength(2);
      expect(hands.map(node => [Number(node.getAttribute("x")), Number(node.getAttribute("y"))])).toEqual(expectedHands[frame.getAttribute("data-officer-frame")!]);
      const all = combine([torso, ...sleeves.map(node => pixels(node)), ...hands.map(node => pixels(node))]);
      const attached = reachable(all, [...torso][0]);
      for (const hand of hands) expect([...pixels(hand)].every(key => attached.has(key)), `${frame.getAttribute("data-officer-frame")} detached hand ${hand.outerHTML}`).toBe(true);
      expect(part(frame, ".officer-arm-front").getAttribute("fill")).toBe("#e6f2ed");
      expect(part(frame, ".officer-arm-back").getAttribute("fill")).toBe("#b7cad1");
      for (const shoe of frame.querySelectorAll(".officer-shoe-base")) expect(Number(shoe.getAttribute("y")) + Number(shoe.getAttribute("height"))).toBe(40);
    }
    expect(appearance).toEqual(before);
  });

  it.each(bodies)("connects both hands without moving pose anchors for overtime $variant/$gender", ({ variant, gender }) => {
    const appearance = look(variant, { gender });
    const expected = {
      standing: [[variant === "older" ? 7 : 6, 31], [variant === "older" ? 25 : 26, 31]],
      grabbing: [[variant === "older" ? 2 : 1, 24], [variant === "older" ? 25 : 26, 31]],
      dragged: [[variant === "older" ? 32 : 34, 24], [variant === "older" ? 2 : 1, 31]],
      seated: [[variant === "older" ? 30 : 32, 27], [variant === "older" ? 8 : 7, 31]],
    };
    for (const pose of ["standing", "grabbing", "dragged", "seated"] as const) {
      const root = art(<OvertimeOfficer variant={variant} pose={pose} appearance={appearance} />);
      const torso = pixels(part(root, ".officer-torso-outline"));
      const hands = [...root.querySelectorAll(".officer-hand")];
      const all = combine([torso, ...[...root.querySelectorAll(".officer-sleeve")].map(node => pixels(node)), ...hands.map(node => pixels(node))]);
      const attached = reachable(all, [...torso][0]);
      expect(hands.map(node => [Number(node.getAttribute("x")), Number(node.getAttribute("y"))])).toEqual(expected[pose]);
      for (const hand of hands) expect([...pixels(hand)].every(key => attached.has(key)), `${pose} detached hand ${hand.outerHTML}`).toBe(true);
      expect(part(root, ".overtime-officer > g").getAttribute("transform")).toBe("translate(-32 -80) scale(2)");
      for (const shoe of root.querySelectorAll(".officer-shoe-base")) expect(Number(shoe.getAttribute("y")) + Number(shoe.getAttribute("height"))).toBe(40);
    }
  });

  it.each(bodies)("retains bag cases and attaches straps on $variant/$gender", ({ variant, gender }) => {
    for (const bag of ["none", "backpack", "laptop", "crossbody", "briefcase"] as const) {
      for (const pose of ["standing", "dragged", "seated"] as const) {
        const appearance = look(variant, { gender, bag, bagColor: "beige" });
        const before = structuredClone(appearance);
        const root = art(<OvertimeOfficer variant={variant} pose={pose} appearance={appearance} />);
        if (bag === "none") expect(root.querySelector("[data-bag-kind]")).toBeNull();
        else {
          expect(part(root, ".officer-bag-fill").getAttribute("fill")).toBe("#c8b38b");
          if (gender === "female") {
            const other = art(<OvertimeOfficer variant={variant} pose={pose} appearance={{ ...appearance, gender: "male" }} />);
            expect(part(root, ".officer-bag-fill").outerHTML).toBe(part(other, ".officer-bag-fill").outerHTML);
            expect(part(root, ".officer-bag-front").getAttribute("transform")).toBe(part(other, ".officer-bag-front").getAttribute("transform"));
          }
          if (bag !== "briefcase") {
            const torso = pixels(part(root, ".officer-torso-outline"));
            const straps = bagPixels(part(root, ".officer-bag-straps"));
            const all = combine([torso, straps]);
            const attached = reachable(all, [...torso][0]);
            expect([...straps].every(key => attached.has(key)), `${pose}/${bag} floating straps`).toBe(true);
            if (bag === "backpack") {
              const back = combine([...part(root, ".officer-bag-back").querySelectorAll("path,rect")].map(node => bagPixels(node)));
              const wearable = reachable(combine([torso, straps, back]), [...torso][0]);
              expect([...back].every(key => wearable.has(key)), `${pose} floating backpack`).toBe(true);
            }
          }
        }
        expect(appearance).toEqual(before);
      }
    }
  });
});
