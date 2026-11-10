# Plan: R Keyboard Hint

- Date: 2026-11-10
- Status: completed
- Decision: [R Keyboard Hint](../decisions/2026-11-10-r-keyboard-hint.md)

## Goal
Show players that R opens the restart confirmation in both stage and infinite mode, without changing restart behavior.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `completed` | Add and verify the R shortcut label in the existing mode-specific desktop control hints | [P01](../phases/2026-11-10-r-keyboard-hint/P01-control-hints/phase.md) |

## Tasks and Order
| Task | Observable outcome | Principal files |
| :--- | :--- | :--- |
| T01 | Both stage and infinite mode desktop hints show D, J, and `R Restart`; existing confirmation and mobile controls remain unchanged | `src/game/GameScreen.tsx`, `src/game/GameScreen.test.tsx`, `src/infinite/InfiniteModeScreen.tsx`, `src/infinite/InfiniteModeScreen.test.tsx` |

## Validation
- `npm run test -- --run src/game/GameScreen.test.tsx src/infinite/InfiniteModeScreen.test.tsx`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Progress
- done: 1/1
- Active: none
