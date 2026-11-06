# Decisions: Infinite Mode Pursuer Speed

- Date: 2026-11-06
- Status: Confirmed

## D01. Infinite mode base pursuer speed
- **Chosen**: Change the starting pursuer interval from 0.25 seconds per stair to 0.20 seconds per stair.
- **Rationale**: The user explicitly requested a faster initial chase while keeping the remaining rules unchanged.

## D02. Preserve existing difficulty and mode behavior
- **Chosen**: Keep all other rules as they are: reduce the interval by 0.01 seconds per 50 points, stop score-based acceleration at 0.10 seconds, and use the existing 0.10-second catch-up interval when the pursuer is at least 10 stairs behind until the gap is back to 6 stairs or less. Keep score, event, ranking, saving, and HUD behavior unchanged.
- **Rationale**: “나머진 동일” means retain the current infinite-mode rules and change only the base interval.

## Codebase findings
- The base interval is currently `250` ms in `src/infinite/infiniteEngine.ts`.
- Score-based acceleration and the 100 ms floor are already implemented and covered by `src/infinite/infiniteEngine.test.ts`.
- The catch-up gap thresholds and 100 ms chase interval come from the existing pursuit rules; the HUD already displays the effective interval in seconds per stair.
