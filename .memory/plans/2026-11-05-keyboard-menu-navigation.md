# Plan: Keyboard Menu Navigation

- Date: 2026-11-05
- Status: in_progress
- Decision: [Keyboard Menu Navigation](../decisions/2026-11-05-keyboard-menu-navigation.md)

## Goal
Allow keyboard users to navigate all game menus and dialogs with arrow keys and activate the focused action with Enter, while preserving gameplay keys, Tab navigation, Escape behavior, and native sound/input controls.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | Shared directional focus navigation and integration across stage and infinite mode menus | [P01](../phases/2026-11-05-keyboard-menu-navigation/P01-directional-menus/phase.md) |

## Tasks and Order
| Task | Observable outcome | Principal files |
| :--- | :--- | :--- |
| T01 | A tested shared handler moves focus spatially among enabled menu buttons using arrow keys and stops at boundaries | `src/game/directionalMenuNavigation.ts`, `src/game/directionalMenuNavigation.test.ts` |
| T02 | All title, selection, dialog, pause, checkpoint, result, and customization menus expose directional focus and Enter activation with predictable initial focus | `src/game/GameScreen.tsx`, game menu components, `src/character/CharacterCustomizationDialog.tsx`, `src/leaderboard/LeaderboardDialog.tsx`, `src/infinite/InfiniteModeScreen.tsx` |

## Validation
- Run `npm run test -- --run src/game/directionalMenuNavigation.test.ts` after T01.
- Run focused component tests for every modified menu and dialog after T02.
- Run `npm run test -- --run --maxWorkers=2`, `npm run lint`, `npm run build`, and `git diff --check` before completion.

## Progress
- done: 1/2
- Active: P01-T02
