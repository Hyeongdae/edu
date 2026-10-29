# Task: T01 Stage Pursuer Speed

## Status: done

## Goal

Set the stage-based pursuer to move once every 500/400/350/300/280ms in stages 1–5, update player-facing speed help, and preserve catch-up and fall pursuit rules.

## Decision Summary

- Stage intervals are 500, 400, 350, 300, and 280 milliseconds per stair. Convert to seconds in help text as 0.5/0.4/0.35/0.3/0.28.
- Keep catch-up hysteresis (starts at distance >=15, ends at <=6) and its 100ms interval; keep fall interval at 250ms and motion animation at 240ms.
- The single-stage local descent demo follows stage 1 and therefore changes from 600ms to 500ms.

## Implementation

### I01. Update shared stage intervals and user-facing help

- Related Files:
  - `src/game/stageRules.ts` :: `STAGE_RULES` — update only `pursuerStepIntervalMs`; modify
  - `src/game/GameScreen.tsx` :: settings help paragraph — update five-stage interval list; modify
  - `src/descent/DescentGameScreen.tsx` :: local descent help paragraph — update stage-one interval; modify

#### Details

- **Types and fields**: Preserve `StageRule.pursuerStepIntervalMs: number`; no state, storage, or API schema changes.
- **Values**:
  | Stage | Milliseconds per stair | Help text |
  | :--- | ---: | ---: |
  | 1 | 500 | 0.5초 |
  | 2 | 400 | 0.4초 |
  | 3 | 350 | 0.35초 |
  | 4 | 300 | 0.3초 |
  | 5 | 280 | 0.28초 |
- **Logic constraints**: Do not alter `PURSUER_CATCH_UP_*`, `FALL_PURSUER_INTERVAL_MS`, animation durations, stage duration/score/obstacle settings, or standalone route generation.

### I02. Update regression expectations for the new base intervals

- Related Files:
  - `src/game/stageRules.test.ts` :: complete expected `STAGE_RULES`; modify
  - `src/game/pursuerCatchUp.test.ts` :: stage-one start interval and standalone base interval; modify
  - `src/game/timedPursuit.test.ts` :: stage-one pending pursuit deadlines; modify only expectations affected by the changed interval
  - `src/descent/descentEngine.test.ts` :: stage-one start deadline; modify

#### Details

- Assert the complete five-stage map is exactly 500/400/350/300/280ms.
- Assert stage-one start/resume and the standalone experiment use 500ms, while catch-up still schedules at 100ms and fall pursuit still uses 250ms.
- Update only expected timestamps or names that encode the old stage-one interval; retain test scenarios and boundary order.
- Do not alter past decision/history records; they document the earlier rules.

## Acceptance Criteria

- [x] Shared stage rules use exactly 500/400/350/300/280ms.
- [x] Both help screens describe the matching current interval.
- [x] Catch-up remains 100ms with existing 15/6 hysteresis; fall pursuit remains 250ms.
- [x] Stage setup, pause/resume, timed movement, and local single-stage descent tests pass.

## Validation

- `npm.cmd test -- src/game/stageRules.test.ts src/game/pursuerCatchUp.test.ts src/game/timedPursuit.test.ts src/descent/descentEngine.test.ts src/game/GameScreen.test.tsx` — rules, speed transitions, and main/local timing regression tests pass.
- `npm.cmd run lint` — no lint errors.
- `npm.cmd run build` — TypeScript and Vite build pass.

## Commit Message

```text
fix(pursuit): update stage chase intervals

Plan: 2026-10-29-stage-pursuer-speed-adjustment
Phase: P01-stage-pursuer-speed
Task: T01-stage-pursuer-speed

- Set stage pursuit intervals to 500/400/350/300/280ms
- Synchronize help text and preserve catch-up behavior
```

## Progress

- [x] Implementation complete
- [x] Validation passed (5 files, 294 tests; lint and build passed; existing Vite bundle-size warning remains)
- commit: pending
