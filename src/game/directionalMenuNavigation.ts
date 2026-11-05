import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const MENU_ACTION_SELECTOR = 'button:not(:disabled), a[href], [role="tab"]';
const ARROW_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

interface Point {
  x: number;
  y: number;
}

function isMenuActionVisible(element: HTMLElement): boolean {
  if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;

  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = window.getComputedStyle(ancestor);
    if (style.display === "none" || style.visibility === "hidden" || style.contentVisibility === "hidden") return false;
  }
  return true;
}

function getMenuActions(scope: HTMLElement): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(MENU_ACTION_SELECTOR)).filter(isMenuActionVisible);
}

function getCenter(element: HTMLElement): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function isInDirection(origin: Point, candidate: Point, key: ArrowKey): boolean {
  switch (key) {
    case "ArrowUp": return candidate.y < origin.y;
    case "ArrowDown": return candidate.y > origin.y;
    case "ArrowLeft": return candidate.x < origin.x;
    case "ArrowRight": return candidate.x > origin.x;
  }
}

function getDirectionalDistance(origin: Point, candidate: Point, key: ArrowKey): number {
  if (key === "ArrowUp" || key === "ArrowDown") return Math.abs(candidate.y - origin.y);
  return Math.abs(candidate.x - origin.x);
}

function getCrossAxisDistance(origin: Point, candidate: Point, key: ArrowKey): number {
  if (key === "ArrowUp" || key === "ArrowDown") return Math.abs(candidate.x - origin.x);
  return Math.abs(candidate.y - origin.y);
}

function getNextAction(actions: HTMLElement[], current: HTMLElement, key: ArrowKey): HTMLElement | undefined {
  const rects = actions.map((action) => action.getBoundingClientRect());
  const hasLayout = rects.some((rect) => rect.width > 0 || rect.height > 0);
  const currentIndex = actions.indexOf(current);

  if (!hasLayout) {
    const increment = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
    return actions[Math.max(0, Math.min(actions.length - 1, currentIndex + increment))];
  }

  const origin = getCenter(current);
  return actions
    .filter((action) => action !== current)
    .map((action, domIndex) => ({ action, point: getCenter(action), domIndex }))
    .filter(({ point }) => isInDirection(origin, point, key))
    .sort((a, b) => getDirectionalDistance(origin, a.point, key) - getDirectionalDistance(origin, b.point, key)
      || getCrossAxisDistance(origin, a.point, key) - getCrossAxisDistance(origin, b.point, key)
      || a.domIndex - b.domIndex)[0]?.action;
}

/** Move focus to the nearest visible menu action in the pressed arrow's direction. */
export function handleDirectionalMenuNavigation(event: ReactKeyboardEvent<HTMLElement>): void {
  if (event.defaultPrevented || !ARROW_KEYS.has(event.key)
    || event.altKey || event.ctrlKey || event.metaKey) return;

  const target = event.target;
  if (!(target instanceof HTMLElement)
    || target.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;

  const scope = target.closest<HTMLElement>("[data-keyboard-menu]");
  if (!scope) return;

  const actions = getMenuActions(scope);
  if (actions.length === 0) return;

  const activeElement = document.activeElement;
  const current = activeElement instanceof HTMLElement && actions.includes(activeElement)
    ? activeElement
    : undefined;

  if (!current) {
    actions[0].focus();
    event.preventDefault();
    return;
  }

  const next = getNextAction(actions, current, event.key as ArrowKey);
  next?.focus();
  event.preventDefault();
}
