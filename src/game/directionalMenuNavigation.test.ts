import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { handleDirectionalMenuNavigation } from "./directionalMenuNavigation";

function mount(markup: string): HTMLElement {
  document.body.innerHTML = markup;
  return document.body;
}

function button(name: string): HTMLButtonElement {
  const result = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .find((candidate) => candidate.textContent === name);
  if (!result) throw new Error(`Missing button: ${name}`);
  return result;
}

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}

function setRect(element: HTMLElement, rect: DOMRect): void {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect);
}

function createKeyEvent(target: HTMLElement, key: string, options: Partial<KeyboardEvent> = {}) {
  let defaultPrevented = options.defaultPrevented ?? false;
  const event = {
    key,
    target,
    defaultPrevented,
    altKey: options.altKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    preventDefault: () => { defaultPrevented = true; event.defaultPrevented = true; },
  } as unknown as ReactKeyboardEvent<HTMLElement>;
  return event;
}

function pressArrow(target: HTMLElement, key: string, options: Partial<KeyboardEvent> = {}) {
  const event = createKeyEvent(target, key, options);
  handleDirectionalMenuNavigation(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("directional menu navigation", () => {
  it.each([
    ["ArrowUp", "up", { left: 100, top: 60 }],
    ["ArrowDown", "down", { left: 100, top: 140 }],
    ["ArrowLeft", "left", { left: 60, top: 100 }],
    ["ArrowRight", "right", { left: 140, top: 100 }],
  ] as const)("moves %s to the nearest action in that direction", (key, direction, targetPosition) => {
    mount(`<div data-keyboard-menu>
      <button>Current</button>
      <button>Target ${direction}</button>
      <button>Farther</button>
    </div>`);
    const current = button("Current");
    const target = button(`Target ${direction}`);
    const farther = button("Farther");
    setRect(current, makeRect(100, 100, 20, 20));
    setRect(target, makeRect(targetPosition.left, targetPosition.top, 20, 20));
    setRect(farther, makeRect(
      direction === "left" ? 20 : direction === "right" ? 200 : 100,
      direction === "up" ? 20 : direction === "down" ? 200 : 100,
      20,
      20,
    ));
    current.focus();

    const event = pressArrow(current, key);

    expect(target).toHaveFocus();
    expect(event.defaultPrevented).toBe(true);
  });

  it("uses perpendicular distance to break equal directional distances", () => {
    mount(`<div data-keyboard-menu><button>Current</button><button>Farther across</button><button>Nearest across</button></div>`);
    const current = button("Current");
    const fartherAcross = button("Farther across");
    const nearestAcross = button("Nearest across");
    setRect(current, makeRect(100, 100, 20, 20));
    setRect(fartherAcross, makeRect(130, 155, 20, 20));
    setRect(nearestAcross, makeRect(130, 105, 20, 20));
    current.focus();

    pressArrow(current, "ArrowRight");

    expect(nearestAcross).toHaveFocus();
  });

  it("does not wrap at a boundary and prevents the page from scrolling", () => {
    mount(`<div data-keyboard-menu><button>Left</button><button>Current</button></div>`);
    const left = button("Left");
    const current = button("Current");
    setRect(left, makeRect(40, 100, 20, 20));
    setRect(current, makeRect(100, 100, 20, 20));
    current.focus();

    const event = pressArrow(current, "ArrowRight");

    expect(current).toHaveFocus();
    expect(event.defaultPrevented).toBe(true);
  });

  it("focuses the first enabled visible action when focus is outside the action list", () => {
    mount(`<button>Outside</button><div data-keyboard-menu><button disabled>Disabled</button><span><b>Menu text</b></span><button>First visible</button><button>Second</button></div>`);
    const outside = button("Outside");
    const firstVisible = button("First visible");
    const menuText = document.querySelector<HTMLElement>("[data-keyboard-menu] span")!;
    outside.focus();

    pressArrow(menuText, "ArrowDown");

    expect(firstVisible).toHaveFocus();
  });

  it("skips disabled, hidden, inert, and aria-hidden actions", () => {
    mount(`<div data-keyboard-menu>
      <button>Current</button>
      <button disabled>Disabled</button>
      <button hidden>Hidden</button>
      <div inert><button>Inert</button></div>
      <div aria-hidden="true"><button>Aria hidden</button></div>
      <button>Visible next</button>
    </div>`);
    const current = button("Current");
    const visibleNext = button("Visible next");
    setRect(current, makeRect(0, 0, 20, 20));
    setRect(visibleNext, makeRect(0, 40, 20, 20));
    current.focus();

    pressArrow(current, "ArrowDown");

    expect(visibleNext).toHaveFocus();
  });

  it("does nothing and leaves scrolling untouched when no menu actions exist", () => {
    const body = mount(`<div data-keyboard-menu><p>Empty menu</p></div>`);
    const emptyMenu = body.querySelector<HTMLElement>("p")!;

    const event = pressArrow(emptyMenu, "ArrowDown");

    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    ["text input", `<input type="text" aria-label="control">`],
    ["textarea", `<textarea aria-label="control"></textarea>`],
    ["select", `<select aria-label="control"><option>one</option></select>`],
    ["slider", `<div role="slider" aria-label="control" tabindex="0"></div>`],
    ["editable content", `<div contenteditable="true" aria-label="control"></div>`],
  ])("preserves native arrow behavior for %s", (_label, control) => {
    const body = mount(`<div data-keyboard-menu><button>Menu action</button>${control}</div>`);
    const target = body.querySelector<HTMLElement>('[aria-label="control"]')!;
    target.focus();

    const event = pressArrow(target, "ArrowDown");

    expect(target).toHaveFocus();
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    ["Alt", { altKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
  ] as const)("leaves %s+arrow combinations untouched", (_modifier, modifier) => {
    mount(`<div data-keyboard-menu><button>First</button><button>Second</button></div>`);
    const first = button("First");
    first.focus();

    const event = pressArrow(first, "ArrowDown", modifier);

    expect(first).toHaveFocus();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does not handle an event already handled by an inner control", () => {
    mount(`<div data-keyboard-menu><button>First</button><button>Second</button></div>`);
    const first = button("First");
    first.focus();

    const event = pressArrow(first, "ArrowDown", { defaultPrevented: true });

    expect(first).toHaveFocus();
    expect(event.defaultPrevented).toBe(true);
  });

  it("uses clamped DOM order when layout rectangles are unavailable", () => {
    mount(`<div data-keyboard-menu><button>First</button><button>Current</button><button>Last</button></div>`);
    const first = button("First");
    const current = button("Current");
    const last = button("Last");
    current.focus();

    pressArrow(current, "ArrowUp");
    expect(first).toHaveFocus();
    pressArrow(first, "ArrowLeft");
    expect(first).toHaveFocus();
    pressArrow(first, "ArrowDown");
    expect(current).toHaveFocus();
    pressArrow(last, "ArrowRight");
    expect(last).toHaveFocus();
  });
});
