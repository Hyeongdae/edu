# Plan: Infinite Mode Pursuer Difficulty

- Date: 2026-11-05
- Status: completed
- Decision: [Infinite Mode Pursuer Difficulty](../decisions/2026-11-05-infinite-mode-pursuer-difficulty.md)

## Goal
Make Infinite Mode harder over time with a score-scaled pursuer, retain the 10-stair lead catch-up rule, and show the effective pursuer pace in the HUD. Do not add a survival timer.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | Score-based pursuer pace, distance catch-up, HUD, and synchronized movement animation | [P01](../phases/2026-11-05-infinite-mode-pursuer-difficulty/P01-pursuer-scaling/phase.md) |

## Tasks and Order
| Task | Observable outcome | Principal files |
| :--- | :--- | :--- |
| T01 | Infinite pursuer starts at 0.25 s/stair, speeds up every 50 points to 0.10 s/stair, catches up at a 10-stair lead, and displays its effective speed | `src/infinite/infiniteEngine.ts`, `src/infinite/InfiniteHud.tsx`, `src/infinite/InfiniteModeScreen.tsx`, `src/infinite/InfiniteStairScene.tsx`, `src/infinite/infinite-mode.css` |

## Validation
- Run `npm run test -- --run src/infinite/infiniteEngine.test.ts src/infinite/InfiniteHud.test.tsx src/infinite/InfiniteModeScreen.test.tsx src/infinite/InfiniteStairScene.test.tsx`.
- Run `npm run test -- --run --maxWorkers=2`, `npm run lint`, `npm run build`, and `git diff --check`.
- Verify the existing stage-mode catch-up threshold remains 15 stairs and its speed behavior is unchanged.

## Progress
- done: 1/1
- Active: none
