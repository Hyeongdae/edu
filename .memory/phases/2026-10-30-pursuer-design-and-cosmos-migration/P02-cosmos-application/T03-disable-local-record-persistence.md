# Task: T03 Disable Local Record Persistence

## Status: done

## Goal
Keep local/demo gameplay usable without reading or writing browser-local rankings or stage-unlock records; only an authenticated deployed session uses the company record API/Cosmos-backed profile.

## Decision Summary
- Local play starts at stage 1 after a page load, maintains clears/unlocks in the current React game state, and does not store scores, profile progress, or ranking submissions in local storage.
- Preserve the deployed `CompanyRecordsGate`/`CompanyRecordStore` server-backed behavior and its pending-submit retry queue; that queue is a production delivery safeguard, not a local-demo leaderboard.

## Implementation

### I01. Local session profile and score-result handling

- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen` initial profile, `readKnownHighest`, stage-progress effect, result-save effect, leaderboard/save states — remove browser-local record reads/writes from the local branch; modify.
  - `src/game/GameScreen.test.tsx` :: local/demo and stage-selection/result tests — replace local-persistence expectations with no-persistence/session-progress assertions; modify.
  - `src/game/stageProgress.ts` and `src/leaderboard/leaderboard.ts` :: existing persistent repository helpers — read-only; leave general helpers and legacy/reset behavior unchanged for other call sites.
  - `src/company/CompanyRecordsGate.tsx` and `src/company/CompanyRecordStore.ts` :: hosted company-store path — read-only; preserve it.

#### Details
- **`GameScreen` state behavior**:
  - When `companyRecords` exists, keep current `entries`, `profile.highestClearedStage`, `submitResult`, and company-rank flow unchanged.
  - When `companyRecords` is `undefined`, initialize `{ entries: [], knownHighest: 0, progressAvailable: true }` without calling `readLeaderboard` or `readStageProgress`.
  - `readKnownHighest()` in local mode returns the maximum of `gameState.highestClearedStage` and the already initialized in-memory value; do not query browser storage.
  - Remove the local `saveStageProgress` effect and the local `saveBestScore` result write. A local `StageResult` does not create a ranking entry, display a false storage error, or queue an API request.
  - Keep stage clears in `GameState.highestClearedStage`; the user can continue/select unlocked stages within the current loaded game session. Reloading the page resets local unlocks to stage 1.
  - Keep local `leaderboard` empty after a game result. Do not remove old browser keys as part of this change; simply stop reading/writing them. Do not change audio preference storage or the production company pending queue.
- **UI copy**: In `src/leaderboard/LeaderboardPanel.tsx`, change only the browser/local empty state so it does not tell a player to make a record that local mode cannot save. Display a short message explaining that local play does not save rankings and that the deployed company game saves them after sign-in. Keep the company empty-state invitation and company TOP 10 rendering unchanged.
- **Tests**:
  - Render local/demo `GameScreen` with pre-populated local descent leaderboard/progress keys; verify those values are not read into the UI, no `setItem` is called for those record keys, the local leaderboard stays empty, and there is no save-failure alert after game over.
  - Clear stage 1 and verify stage 2 is selectable before reload using in-memory state; after remount with no `companyRecords`, verify stage 1 is selected and no unlock key was read/written.
  - Keep hosted company tests asserting profile/leaderboard/result API behavior and no local rank/progress import.

### I02. Scope guard

- Related Files:
  - `src/company/CompanyRecordStore.test.ts` :: authenticated hosted queue retry behavior — read-only; preserve local pending queue ACK/FIFO tests.
  - `src/leaderboard/leaderboard.test.ts` :: shared serialization helper tests — read-only except test imports required by removed GameScreen calls.

#### Details
- Do not delete localStorage data from users' browsers, rename storage keys, change account identity, change ranking rules, hide the title/stage leaderboard entry points, or change current-session game unlock rules.
- If a local leaderboard dialog is opened, its browser scope remains empty and uses the new local-only explanatory empty-state copy.

## Acceptance Criteria
- [x] Local/demo startup makes no local leaderboard/progress reads; result handling makes no local record writes and makes no `/api/results` request.
- [x] Local gameplay can still clear/select higher stages during the same in-memory session; reload starts at stage 1.
- [x] The local leaderboard clearly states that local records are not saved instead of promising a save.
- [x] Hosted company profile, unlock, submit, ranking, offline retry, and result-ACK behavior are unchanged.

## Validation
- `npm test -- --run src/game/GameScreen.test.tsx src/leaderboard/LeaderboardPanel.test.tsx src/company/CompanyRecordsGate.test.tsx src/company/CompanyRecordStore.test.ts` — 128 tests pass.
- `npm run lint` — passes.
- `npm run build` — TypeScript/Vite build passes (existing 500 kB chunk-size warning).

## Commit Message
```text
feat(game): keep local runs free of saved records

Plan: 2026-10-30-pursuer-design-and-cosmos-migration
Phase: P02-cosmos-application
Task: T03-disable-local-record-persistence

- Keep local rankings empty and skip browser progress persistence
- Preserve in-session stage unlocks and hosted company records
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `be80818`
