import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPEARANCE_OPTIONS, getDefaultCharacterLook, normalizeCharacterLook, type CharacterLook } from "../../../shared/characterAppearance";
import { getDefaultCharacterLook as legacyLook } from "../../../shared/legacyCharacterAppearance";
import { OfficerHeadArt, type OfficerExpression } from "./OfficerAppearanceParts";
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
