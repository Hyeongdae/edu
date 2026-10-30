# Task: T01 Cap Stage Scores

## Status: done

## Goal
Make every new run end at its exact stage target, so bonus scoring cannot create new records such as 351 points in stage five.

## Decision Summary
- Targets are stage 1–5: 150, 200, 250, 300, 350. Cap both the state score and credited move gain at the target.
- Do not rewrite existing Cosmos records. The user will manually correct any previously saved over-target records before deploying the stricter API validation.

## Implementation

### I01. Cap engine scoring and the displayed move gain

- Related Files:
  - `src/game/gameEngine.ts` :: `applyInput` — cap a successful move's credited score at the remaining distance to the stage target; modify.
  - `src/game/types.ts` :: `GameMove.scoreGain` — include a capped three-point jump gain; modify.
  - `src/game/stageResult.ts` :: `isStageResult` — reject result snapshots above their stage target; modify.
  - `src/game/gameEngine.test.ts` :: score threshold and jump scoring cases — cover all targets and overshoot paths; modify.
  - `src/game/stageResult.test.ts`, `src/game/GameHud.test.tsx`, `src/game/timedPursuit.test.ts`, `src/game/GameScreen.test.tsx` :: update over-target fixtures and result boundaries; modify.
  - `src/descent/descentEngine.test.ts`, `src/descent/DescentGameScreen.test.tsx` :: update expected behavior because the local descent experiment reuses the same engine; modify.

#### Details
- **Signatures & Types**:
  ```typescript
  export interface GameMove {
    kind: "climb" | "jump";
    fromIndex: number;
    toIndex: number;
    scoreGain: 1 | 2 | 3 | 4;
    isBonus: boolean;
  }
  ```
- **Execution Flow / Logic**:
  1. Preserve physical movement distance: a normal input moves one stair; a successful jump moves two.
  2. Compute raw gain as `distance * (eventIsActive ? 2 : 1)`.
  3. Credit `Math.min(rawGain, getStageTargetScore(currentState.stage) - currentState.score)` points. Use that credited amount for `GameState.score` and `lastMove.scoreGain`, so both the total and floating gain display stop at the target.
  4. Keep the existing clear transition when the capped score reaches the stage target; stage result, checkpoint, unlock, and leaderboard submission must carry the capped score.
  5. A playing state must remain below its stage target; do not permit negative remaining points or additional scoring after checkpoint/game-over.

### I02. Enforce the same maximum at the shared and Cosmos API boundaries

- Related Files:
  - `shared/companyRecords.ts` :: `validateResultForProfile` — reject scores greater than `getStageRule(result.stage).scoreRequired`; modify.
  - `shared/companyRecords.test.ts` :: per-stage maximum score validation — update tests to accept exactly the target and reject target + 1; modify.
  - `src/company/recordApi.ts` :: `isSharedBest` — reject company ranking responses above the stage target; modify.
  - `src/company/recordApi.test.ts` :: malformed over-target profile and leaderboard response cases; modify.
  - `api/src/playerRepository.ts` :: `decodeDocument` — validate stored `bestScore` against the exact stage target; modify.
  - `api/src/playerRepository.test.ts` :: persisted score bounds and leaderboard records — update tests for exact target maximum; modify.
  - `api/test/playerRepository.integration.test.ts` :: valid concurrent create scores and expectations; modify.

#### Details
- **Data & Schema Fields**:
  - `SubmitResultRequest.result.score`: non-negative safe integer, no greater than that stage's `scoreRequired`.
  - Cosmos `PlayerDocument.bestScore`: integer from 0 through `getStageRule(bestStage).scoreRequired`.
- **Execution Flow / Logic**:
  1. Retain existing outcome validation: `cleared` iff score is at least the stage target; `time-limit` still requires zero remaining time.
  2. Replace the prior `scoreRequired + 3` upper-bound checks with the exact stage target in both shared request validation and Cosmos document decoding.
  3. Do not mutate, migrate, or silently normalize Cosmos player documents. A pre-existing over-target document will fail strict decoding; the user must correct it before deploying this API change.
  4. Preserve stage, remaining-time, achieved-at, and account tie-break ranking order.

## Acceptance Criteria
- [x] A normal move or bonus move that crosses the target stores exactly the target score and shows only the credited points.
- [x] This behavior holds for all five stage targets and for two-stair jumps.
- [x] Shared API validation and Cosmos document validation reject scores above the stage target and accept scores at the target.
- [x] No existing records are changed by application code.

## Validation
- `npm test -- --run src/game/gameEngine.test.ts shared/companyRecords.test.ts --maxWorkers=2` — engine and shared rule cases pass.
- `npm test -- --run src/game/stageResult.test.ts src/game/GameHud.test.tsx src/game/timedPursuit.test.ts src/company/recordApi.test.ts --maxWorkers=2` — result and client response boundaries pass.
- `npm test -- --run src/game/GameScreen.test.tsx src/descent/descentEngine.test.ts src/descent/DescentGameScreen.test.tsx --maxWorkers=2` — main screen and shared-engine descent behavior pass.
- `npm --prefix api test -- src/playerRepository.test.ts` — Cosmos repository validation cases pass.
- `npm --prefix api test -- playerRepository.integration.test.ts` — Cosmos emulator integration cases pass when `GAME_RECORDS_COSMOS_CONNECTION_STRING` is configured.
- `npm run lint` — no lint errors.
- `npm run build` — type check and production bundle pass.

## Commit Message
```text
fix(game): cap each stage score at its target

Plan: 2026-10-30-score-cap-stage-countdown-bgm
Phase: P01-gameplay-polish
Task: T01-cap-stage-scores

- Cap score totals and credited move gains at stage targets
- Align shared and Cosmos record validation with the exact target
```

## Progress
- [x] Implementation complete
- [x] Validation passed (594 web tests, 51 API tests, lint, web build, API build)
- Cosmos emulator integration test skipped because `GAME_RECORDS_COSMOS_CONNECTION_STRING` is not configured.
- commit: pending
