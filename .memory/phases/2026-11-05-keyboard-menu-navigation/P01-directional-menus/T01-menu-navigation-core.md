# Task: T01 Directional Menu Navigation Core

## Status: done

## Goal
Create a reusable browser-keyboard handler that moves focus between the visible, enabled actions in the nearest marked menu scope according to their on-screen positions. Keep the current focus at a boundary and leave Enter, Tab, Escape, game state, and gameplay input behavior to the browser or existing handlers.

## Decision Summary
- Use arrow keys to navigate visible enabled menu buttons, links, and tabs within the closest `[data-keyboard-menu]` scope. The nearest action in the requested visual direction receives focus; do not wrap at boundaries.
- Preserve native keyboard behavior for inputs, textareas, selects, sliders, editable content, gameplay, and already-handled events.
- Do not change game state or add persisted data. Enter activates a focused native button through normal browser behavior.

## Implementation

### I01. Shared spatial focus-navigation handler
- Related Files:
  - `src/game/directionalMenuNavigation.ts` :: `handleDirectionalMenuNavigation`, `getMenuActions`, and directional candidate selection - new.
  - `src/game/directionalMenuNavigation.test.ts` :: `directional menu navigation` - new.

#### Details
- Export this handler:
  ```ts
  export function handleDirectionalMenuNavigation(
    event: React.KeyboardEvent<HTMLElement>,
  ): void;
  ```
- Handle only `ArrowUp`, `ArrowDown`, `ArrowLeft`, and `ArrowRight`. Return without calling `preventDefault()` when `event.defaultPrevented`, an Alt/Ctrl/Meta modifier is held, the event target is an `input`, `textarea`, `select`, `[contenteditable="true"]`, or `[role="slider"]`, or the key is not an arrow.
- Resolve the menu scope with `(event.target as HTMLElement).closest<HTMLElement>("[data-keyboard-menu]")`. Return without changing the event if there is no scope. The event handler is attached to the screen root by T02; each individual menu/dialog element provides the marker.
- Query only enabled native actions in that scope: `button:not(:disabled)`, `a[href]`, and `[role="tab"]` that are not themselves disabled. Exclude elements with `hidden`, `aria-hidden="true"`, or an ancestor with `hidden`, `inert`, or `aria-hidden="true"`. Do not include range inputs or other form controls in this action list.
- If the active element is not one of the candidate actions, focus the first candidate in DOM order and prevent the page from scrolling. If there are no candidates, return without changing the event.
- For a focused action with non-zero layout rectangles, calculate candidate centers. A candidate is in the requested direction only when its center is strictly above/below/left/right of the current center. Sort candidates first by distance on the requested axis and then by absolute distance on the perpendicular axis. Focus the first candidate. If there is no candidate in that direction, keep focus at the boundary. Call `preventDefault()` for an arrow handled within a menu scope, including at a boundary, so the page does not scroll.
- When all candidate rectangles have zero width and height (for example, JSDOM), use the candidate DOM order deterministically: Up/Left moves to the previous item; Down/Right moves to the next item; clamp to the first/last item rather than wrapping. Keep DOM fallback isolated to zero-layout environments; browsers must use spatial geometry.
- Do not handle Enter explicitly. Native buttons and links already activate on Enter; avoiding a second synthetic click prevents duplicate actions in dialogs that already implement Enter confirmation.

#### Test Cases
- Each arrow direction focuses the nearest candidate in that direction, with perpendicular distance breaking equal-axis-distance ties.
- Focus does not wrap at any edge and handled arrows prevent default scrolling.
- A focused candidate outside the scope focuses the first enabled visible action.
- Disabled, hidden, inert, and aria-hidden actions are skipped; no-action scopes do nothing.
- Inputs, textareas, selects, sliders, editable content, modifier-arrow combinations, and `defaultPrevented` events are left untouched.
- Zero-layout DOM-order fallback is deterministic and clamped.

### I02. Task validation
- Related Files:
  - `package.json` :: existing `test` script - read-only.
- Run `npm run test -- --run src/game/directionalMenuNavigation.test.ts` — 19 tests passed. and `git diff --check` — passed..

## Acceptance Criteria
- [x] Arrow keys move focus spatially among enabled visible actions in the nearest menu scope.
- [x] Navigation stops at boundaries and prevents page scrolling while a menu action is focused.
- [x] Native inputs, sliders, Tab, Enter, Escape, gameplay, and handled arrow events keep their existing behavior.
- [x] Unit tests cover geometric selection, boundaries, ignored events, filtering, and zero-layout fallback.

## Validation
- `npm run test -- --run src/game/directionalMenuNavigation.test.ts` — 19 tests passed.
- `git diff --check` — passed.

## Commit Message
```text
feat(keyboard): add directional menu focus navigation

Plan: 2026-11-05-keyboard-menu-navigation
Phase: P01-directional-menus
Task: T01-menu-navigation-core

- Add spatial arrow-key focus movement for marked menu scopes
- Preserve native controls and stop navigation at menu boundaries
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: `98d959e`
