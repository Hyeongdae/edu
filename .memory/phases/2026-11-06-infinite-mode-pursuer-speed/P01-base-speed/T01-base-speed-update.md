# Task: T01 Infinite Mode Base Speed Update

## Status: done

## Goal
Change only the infinite-mode base pursuer interval from 250 ms to 200 ms per stair, update exact engine and HUD expectations, and prove the existing score acceleration and catch-up rules still work as decided.

## Decision Summary
- Base interval is 200 ms (0.20 seconds) per stair.
- Keep score acceleration at 10 ms faster for each complete 50-point band; keep the 100 ms minimum.
- Keep the existing 100 ms catch-up interval at a pursuer gap of 10 or more stairs; return to the score-derived interval when the gap reaches 6 or less.
- Do not change score/event rules, movement input, ranking/saving, visual animation timing, or the HUD format; the HUD should display the resulting effective interval.

## Implementation

### I01. Update the interval constant and engine expectations
- Related Files:
  - `src/infinite/infiniteEngine.ts` :: `BASE_PURSUER_INTERVAL_MS`, `getInfinitePursuerIntervalMs`, and `startInfiniteGame` - set only the base interval constant to `200`; retain `MIN_PURSUER_INTERVAL_MS = 100`, `PURSUER_SPEED_SCORE_STEP = 50`, `PURSUER_INTERVAL_REDUCTION_MS = 10`, and all catch-up constants/logic.
  - `src/infinite/infiniteEngine.test.ts` :: `infinite score engine` - update assertions whose expected time is derived from the base interval and retain assertions for explicit catch-up timing and unrelated terminal fixtures.
  - `src/infinite/infiniteSceneModel.test.ts` :: `buildInfiniteSceneModel` - update the expected pursuer motion timestamp from 250 ms to 200 ms because scene motion uses the engine's actual move timestamp.

#### Details
- **Signatures & Types**: Keep these existing signatures unchanged:
  ```ts
  export function getInfinitePursuerIntervalMs(
    state: Pick<InfiniteGameState, "score" | "isPursuerCatchingUp">,
  ): number;
  export function getInfinitePursuerMotionDurationMs(
    state: Pick<InfiniteGameState, "score" | "isPursuerCatchingUp">,
  ): number;
  ```
- **Constants and expected values**:
  - `BASE_PURSUER_INTERVAL_MS = 200`.
  - `MIN_PURSUER_INTERVAL_MS = 100` remains unchanged.
  - `PURSUER_SPEED_SCORE_STEP = 50` and `PURSUER_INTERVAL_REDUCTION_MS = 10` remain unchanged.
  - Score 0–49: 200 ms; score 50–99: 190 ms; score 450–499: 110 ms; score 500 and above: 100 ms.
  - When `isPursuerCatchingUp` is true, effective interval stays `PURSUER_CATCH_UP_INTERVAL_MS` (100 ms), regardless of score.
  - Starting at timestamp 100 schedules the first pursuer move for 300. Starting at timestamp 0 schedules the first move for 200; ticking at 199 leaves state unchanged, and ticking at 200 moves the pursuer and schedules its next base move at 400.
  - When a catch-up chase ends at gap 6, use the current score-derived interval for the next deadline. At score 0 with a test tick at 100, that deadline is 300.
- **Execution Flow / Logic**:
  1. Change the base interval constant; do not add a new mode flag or alter interval calculation.
  2. Update engine unit-test expectations for start deadlines, first base move, score bands, event score threshold, and return from catch-up.
  3. Keep explicit 100 ms catch-up deadline assertions and terminal tests with manually supplied timestamps intact unless they directly depend on the base interval.
  4. Preserve the HUD implementation: it formats `getInfinitePursuerIntervalMs(state) / 1000` to two decimal places.

### I02. Verify the displayed speed in the HUD
- Related Files:
  - `src/infinite/InfiniteHud.test.tsx` :: `InfiniteHud` - update base-speed and score-50 display assertions while retaining minimum-speed and catch-up display assertions.

#### Details
- Expected text at score 49 and no catch-up: `0.20초/칸`.
- Expected text at score 50 and no catch-up: `0.19초/칸`.
- Expected text at score 750 and catch-up: `0.10초/칸`.
- Keep the accessible name aligned with the displayed effective speed. Do not change `InfiniteHud.tsx` unless a test reveals it fails to format the existing engine value correctly.

## Acceptance Criteria
- [x] Infinite mode schedules its initial pursuer step after 200 ms.
- [x] Score 50 begins the existing 10 ms acceleration, and score 500 reaches the unchanged 100 ms floor.
- [x] The 10-stair catch-up threshold, 6-stair recovery threshold, and 100 ms catch-up interval remain unchanged.
- [x] HUD shows `0.20초/칸` at score 0–49 and `0.19초/칸` at score 50–99; catch-up/minimum still shows `0.10초/칸`.
- [x] Focused tests, full suite, lint, build, and diff check pass.

## Validation
- Focused tests: `npm run test -- --run src/infinite/infiniteEngine.test.ts src/infinite/InfiniteHud.test.tsx src/infinite/infiniteSceneModel.test.ts` — 3 files, 21 tests passed. The initial two-file run also passed (16 tests).
- Full suite: `npm run test -- --run --maxWorkers=2` — 60 files, 2012 tests passed.
- `npm run lint` — passed.
- `npm run build` — passed; the existing >500 kB chunk-size warning remains.
- `git diff --check` — passed.

## Commit Message
```text
feat(infinite): speed up the starting pursuer interval

Plan: 2026-11-06-infinite-mode-pursuer-speed
Phase: P01-base-speed
Task: T01-base-speed-update

- Set the infinite-mode base pursuer interval to 200 ms
- Preserve score acceleration and catch-up behavior
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending
