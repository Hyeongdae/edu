# Task: T01 Infinite Pursuer Speed Scaling

## Status: done

## Goal
Increase Infinite Mode difficulty as score rises, keep a separate catch-up boost when the runner is far ahead, and show the effective movement interval in the Infinite Mode HUD. Preserve current score, bonus event, ranking, pause, restart, fall, and caught behavior. Do not add a survival timer.

## Decision Summary
- Infinite Mode base interval is `max(100, 250 - floor(score / 50) * 10)` milliseconds: 250 ms at 0-49 points, 240 ms at 50-99, and 100 ms from 750 points onward.
- The 2x event's actual score gains count toward the next 50-point threshold.
- When `pursuerDistance >= 10`, set catch-up active and use 100 ms regardless of score. Keep catch-up active while distance is greater than 6; return to the score-derived base interval at distance 6.
- Display effective interval to 2 decimal places as seconds per stair. Use 0.10 seconds while catch-up is active. Match the pursuer's movement animation duration and active movement window to that interval.
- This change applies only to Infinite Mode. Shared stage/descent pursuer thresholds and rules remain unchanged.

## Implementation

### I01. Infinite engine interval and catch-up rules
- Related Files:
  - `src/infinite/infiniteEngine.ts` :: `BASE_PURSUER_INTERVAL_MS`, `nextPursuerDeadline`, `startInfiniteGame`, `tickInfiniteGame`, `applyInfiniteInput`, `getInfinitePursuerMotionDurationMs` - calculate score-based intervals and use 10/6-stair hysteresis locally to Infinite Mode; modify.
  - `src/infinite/infiniteEngine.test.ts` :: `infinite score engine` - cover interval thresholds, scheduling, and catch-up transitions; modify.

#### Details
- Keep `InfiniteGameState` schema unchanged. Do not persist interval or timer fields; derive pace from `score` and `isPursuerCatchingUp`.
- Replace the fixed `BASE_PURSUER_INTERVAL_MS = 300` with these Infinite Mode constants:
  - `BASE_PURSUER_INTERVAL_MS = 250`
  - `MIN_PURSUER_INTERVAL_MS = 100`
  - `PURSUER_SPEED_SCORE_STEP = 50`
  - `PURSUER_INTERVAL_REDUCTION_MS = 10`
  - `INFINITE_CATCH_UP_START_DISTANCE = 10`
  - `INFINITE_CATCH_UP_END_DISTANCE = 6`
- Add and export the pure helper:
  ```ts
  export function getInfinitePursuerIntervalMs(
    state: Pick<InfiniteGameState, "score" | "isPursuerCatchingUp">
  ): number
  ```
  It returns 100 while `isPursuerCatchingUp`; otherwise return `Math.max(100, 250 - Math.floor(score / 50) * 10)`.
- Add an Infinite Mode-local catch-up helper (do not change `src/game/pursuitRules.ts`, which is shared by other modes): if already catching, continue when `distance > 6`; otherwise begin when `distance >= 10`.
- Make `nextPursuerDeadline` use `getInfinitePursuerIntervalMs` for the current state. `startInfiniteGame` schedules the first pursuer step at `nowMs + 250`.
- In `tickInfiniteGame`, compute the 10/6 catch-up state after each pursuer movement. At distance 6, schedule the following step at the score-derived base interval. During catch-up, continue scheduling every 100 ms.
- In `applyInfiniteInput`, compute the new score first, including 2 points for a bonus move. Use that score for the HUD and following pursuer interval. If a successful move activates catch-up at distance 10 or more, bring the next deadline forward to `Math.min(existingDeadline, nowMs + 100)`; do not delay an already scheduled pursuer move.
- `getInfinitePursuerMotionDurationMs` returns the same effective interval helper result. This ensures the HUD interval, pursuer animation duration, and step cadence use one source of truth.
- Do not edit shared pursuit rules or any stage/descent rules.

#### Execution Flow / Logic
1. Validate the state through existing `validateState` calls; keep score validation and existing status transitions unchanged.
2. Derive regular speed from integer 50-point score bands; clamp at 100 ms.
3. Apply the distance catch-up override at a 10-stair gap; retain it until the gap reaches 6.
4. Use the effective interval for game start, each pursuer deadline, motion duration, and screen movement lifetime.
5. Preserve fall/caught terminal state transitions and existing score submission.

### I02. Infinite HUD speed readout
- Related Files:
  - `src/infinite/InfiniteHud.tsx` :: `InfiniteHud` - display the current effective pursuer pace; modify.
  - `src/infinite/InfiniteHud.test.tsx` :: `InfiniteHud` - verify score-derived and catch-up pace labels; modify.

#### Details
- Call `getInfinitePursuerIntervalMs(state)`; display its value in seconds using ` (intervalMs / 1000).toFixed(2)`.
- Add a visible speed value to the existing pursuer-distance `stage-clock` panel, labelled `추격 속도` and formatted `{seconds}초/칸` (examples: `0.25초/칸`, `0.10초/칸`). This avoids adding another HUD card or changing the overall HUD grid.
- Keep score, stair distance, event gauge, event duration, and existing HUD accessibility roles intact. Give the speed value a stable test id `infinite-pursuer-speed` and an accessible label.
- Add tests for 0 points => 0.25, 50 points => 0.24, 750+ points => 0.10, and catch-up active => 0.10 regardless of score.

### I03. Pursuer animation synchronization
- Related Files:
  - `src/infinite/InfiniteModeScreen.tsx` :: `InfiniteModeScreen` render of `InfiniteStairScene` - derive effective motion duration and use it for the moving window; modify.
  - `src/infinite/InfiniteStairScene.tsx` :: `InfiniteStairScene` props and pursuer `<g>` - pass effective duration as a CSS custom property; modify.
  - `src/infinite/infinite-mode.css` :: `.infinite-pursuer.is-moving` - animate at the supplied effective interval; modify.
  - `src/infinite/InfiniteModeScreen.test.tsx` :: `InfiniteModeScreen` - assert displayed speed and updated animation timing after score/catch-up transitions; modify.
  - `src/infinite/InfiniteStairScene.test.tsx` :: `InfiniteStairScene` - assert the pursuer element uses the supplied CSS duration; modify.

#### Details
- In `InfiniteModeScreen`, calculate `motionDurationMs = getInfinitePursuerMotionDurationMs(gameState)` and define `isMoving` as a non-null last pursuer move with `nowMs < lastPursuerMove.atMs + motionDurationMs`.
- Add a required `motionDurationMs: number` prop to `InfiniteStairScene`; pass it to the pursuer SVG group using `--infinite-pursuer-step-duration: ${motionDurationMs}ms`.
- Set `.infinite-pursuer.is-moving` animation duration to `var(--infinite-pursuer-step-duration, 240ms)` while preserving its existing pixel-step easing and keyframe.
- Update both `InfiniteStairScene` test call sites to pass a deterministic duration. Keep player animation and stage-mode animation unchanged.
- Ensure test coverage confirms the speed readout shows 0.10 during catch-up and returns to the score-derived base speed when the distance reaches 6.

## Acceptance Criteria
- [x] Infinite Mode starts with a 250 ms pursuer interval.
- [x] Every 50 points lowers the base interval by 10 ms; reaching at least 750 points clamps it at 100 ms. Bonus points count toward thresholds.
- [x] Infinite Mode catch-up starts at a distance of 10 stairs and ends at distance 6, using 100 ms irrespective of score.
- [x] Stage-mode and descent catch-up behavior remain unchanged (15-stair start threshold).
- [x] HUD visibly shows effective pursuer speed in seconds per stair to two decimal places.
- [x] Pursuer animation and its moving state duration match the effective interval.
- [x] No survival timer is added; ranking, score rules, 2x event, pause/restart, and end presentations remain intact.

## Validation
- `npm run test -- --run src/infinite/infiniteEngine.test.ts src/infinite/InfiniteHud.test.tsx src/infinite/InfiniteModeScreen.test.tsx src/infinite/InfiniteStairScene.test.tsx`
- `npm run test -- --run --maxWorkers=2` — full suite: 59 files, 1,985 tests passed.
- `npm run lint` — passed.
- `npm run build` — passed; existing large JavaScript chunk warning remains.
- `git diff --check` — passed.

## Commit Message
```text
feat(infinite): scale pursuer speed with score

Plan: 2026-11-05-infinite-mode-pursuer-difficulty
Phase: P01-pursuer-scaling
Task: T01-pursuer-scaling

- Increase base pursuer speed every 50 points with a 0.10-second floor
- Add 10-stair catch-up threshold, speed HUD, and synchronized animation
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending
