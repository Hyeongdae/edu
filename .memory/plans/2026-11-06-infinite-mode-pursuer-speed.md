# Plan: Infinite Mode Pursuer Speed

- Date: 2026-11-06
- Status: completed
- Decision: [Infinite Mode Pursuer Speed](../decisions/2026-11-06-infinite-mode-pursuer-speed.md)

## Goal
Make the infinite-mode pursuer begin moving once every 200 ms (0.20 seconds) instead of 250 ms, while preserving score acceleration, the 100 ms minimum/catch-up interval, and all other gameplay and ranking behavior.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `completed` | Update the infinite-mode base interval and its behavior/HUD regression coverage | [P01](../phases/2026-11-06-infinite-mode-pursuer-speed/P01-base-speed/phase.md) |

## Tasks and Order
| Task | Observable outcome | Principal files |
| :--- | :--- | :--- |
| T01 | Infinite mode starts at 200 ms per stair; every 50 points still reduces the interval by 10 ms to the unchanged 100 ms floor; the 10-stair catch-up rule remains unchanged; HUD reports the effective interval | `src/infinite/infiniteEngine.ts`, `src/infinite/infiniteEngine.test.ts`, `src/infinite/InfiniteHud.test.tsx` |

## Validation
- Run focused engine and HUD tests: `npm run test -- --run src/infinite/infiniteEngine.test.ts src/infinite/InfiniteHud.test.tsx`.
- Run full suite: `npm run test -- --run --maxWorkers=2`.
- Run `npm run lint`, `npm run build`, and `git diff --check`.

## Progress
- done: 1/1
- Active: none
