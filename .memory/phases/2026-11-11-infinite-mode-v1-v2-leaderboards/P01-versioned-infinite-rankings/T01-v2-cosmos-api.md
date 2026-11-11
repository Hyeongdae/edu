# Task: T01 Add v2 Cosmos Fields and API

## Status: done

## Goal
Add a second, empty-at-launch infinite-mode best-score field and ranking API in the existing Cosmos `stair-climb/players` container. Keep every existing v1 score, ranking query, and v1 submission route available for legacy queued results.

## Decision Summary
- Preserve v1 as `infiniteBest` / `infiniteBestScore` / `infiniteAchievedAt`.
- Add v2 independently as `infiniteV2Best` / `infiniteV2BestScore` / `infiniteV2AchievedAt`.
- Missing v2 fields in existing Cosmos documents decode as `infiniteV2Best: null`; do not migrate/copy a v1 score.
- Keep the existing per-account partition key and container. V2 order is score descending, achievement time ascending, then accountId ascending; the UI assigns shared rank numbers to equal scores.
- Keep current `/api/infinite-leaderboard` and `/api/infinite-results` behavior for v1. Add `/api/infinite-v2-leaderboard` and `/api/infinite-v2-results` for v2.

## Implementation

### I01. Extend shared profile and versioned score merge contracts
- Related files:
  - `shared/companyRecords.ts` :: `SharedProfile`, `mergeSharedInfiniteScore`, and score comparators/queries - modify.
  - `shared/companyRecords.test.ts` :: infinite score contract/ranking tests - modify.
- Details:
  - `SharedProfile.infiniteV2Best` is `SharedInfiniteBest | null`; keep `infiniteBest` unchanged for v1.
  - Add `mergeSharedInfiniteV2Score(previous, actor, input, serverNowIso)` returning `{ profile: SharedProfile; changed: boolean }` with the same validation, score-only improvement rule, timestamp format, account ownership check, and display-name refresh semantics as `mergeSharedInfiniteScore`, but it may read/write only `infiniteV2Best`.
  - Ensure v1 and v2 merge functions preserve each other's fields and the stage best, highest-cleared stage, and appearance.
  - Use `compareSharedInfiniteScore` and `getSharedTopInfiniteScores` for both lists so equal scores share a rank at presentation and deterministic timestamp/account ordering remains consistent.
  - Add tests proving a v2 submission never changes v1, a v1 submission never changes v2, stage merges preserve both, lower/equal scores preserve best timestamps, and sorting/deduplication stays score-descending.

### I02. Encode/decode v2 in Cosmos player documents and query v2 bests
- Related files:
  - `api/src/playerRepository.ts` :: `PlayerRepository`, `PlayerDocument`, ranking query constants, `decodeDocument`, `encodeDocument`, `createPlayerRepository` - modify.
  - `api/src/playerRepository.test.ts` :: decode/encode, query, upsert, conflict and preservation cases - modify.
  - `api/test/playerRepository.integration.test.ts` :: emulator persistence integration - modify.
- Data fields:
  - Existing V1: `infiniteBestScore?: number`, `infiniteAchievedAt?: string`.
  - New V2: `infiniteV2BestScore?: number`, `infiniteV2AchievedAt?: string`.
  - Each score/timestamp pair must be both present or both absent. Scores are non-negative safe integers; timestamps must be canonical UTC ISO strings.
  - Canonical profile fields are `infiniteBest: SharedInfiniteBest | null` and `infiniteV2Best: SharedInfiniteBest | null`.
- Details:
  - Add `listTopInfiniteV2Scores()` and `submitInfiniteV2Score(actor, input)` to `PlayerRepository`.
  - Add v2 top query: `SELECT TOP 10 * FROM c WHERE IS_DEFINED(c.infiniteV2BestScore) ORDER BY c.infiniteV2BestScore DESC, c.infiniteV2AchievedAt ASC, c.accountId ASC` with the existing top-10 query options.
  - Decode old documents without v2 properties to canonical `infiniteV2Best: null`. Reject a one-sided or malformed v2 field pair as `storage-unavailable` using current strict document validation.
  - Encode v1 and v2 fields separately and omit each absent score/timestamp pair. Preserve both in every replace path, including stage submission and appearance save.
  - Use the existing ETag `IfMatch` retry and create-conflict retry behavior for v2 upserts. Only a strictly higher score replaces a personal best.
  - Emulator tests must demonstrate old-document compatibility and independent v1/v2 persistence in one account document.

### I03. Add authenticated v2 HTTP handlers and routes
- Related files:
  - `api/src/handlers.ts` :: handler dependency type, `infiniteLeaderboard`, `infiniteResults`, and `createRecordHandlers` - modify/add version-specific handlers.
  - `api/src/index.ts` :: repository adapter and `app.http` registrations - modify.
  - `api/src/handlers.test.ts` :: auth, invalid body, v1 compatibility, and v2 routes - modify.
  - `api/src/index.test.ts` or the existing route-registration test file :: function names/routes - modify if route registrations are covered there.
- HTTP contract:
  - `GET /api/infinite-v2-leaderboard` returns `{ entries: SharedInfiniteBest[] }`.
  - `POST /api/infinite-v2-results` accepts the existing exact request shape `{ submissionId: UUID, result: { score: nonnegative safe integer } }` and returns `{ submissionId, profile, entries }` for the v2 list.
  - Require the same existing authenticated actor resolution and same-origin mutation checks as the v1 routes. Do not introduce a client-supplied account ID or unauthenticated write path.
- Details:
  - Add distinct v2 handler dependencies that call `listTopInfiniteV2Scores` and `submitInfiniteV2Score`.
  - Leave old v1 routes bound to old repository methods so old offline queue records remain valid.
  - Add Azure Functions registrations named `infinite-v2-leaderboard` and `infinite-v2-results` with routes `infinite-v2-leaderboard` and `infinite-v2-results`.
  - Test that unauthenticated/invalid requests do not call the repository, v1 endpoints still target v1 methods, and v2 endpoints only target v2 methods and return v2 entries.

## Acceptance Criteria
- [x] Existing Cosmos documents and v1 records remain readable and unchanged when no v2 score exists.
- [x] V2 scores are stored and ranked independently in the same account document/container.
- [x] V1 and v2 writes preserve the other version's score plus stage and appearance data.
- [x] Only authenticated v2 GET/POST paths can read/write the v2 leaderboard; old v1 paths remain functional.
- [ ] Cosmos emulator integration test passed.

## Validation
- `npm run test -- --run shared/companyRecords.test.ts api/src/handlers.test.ts api/src/playerRepository.test.ts api/test/playerRepository.integration.test.ts`
- If route registration tests are in `api/src/index.test.ts`, include that path in the focused command.
- `npm --prefix api run build`
- `git diff --check`

## Commit Message
```text
feat(records): add independent infinite v2 storage and API

Plan: 2026-11-11-infinite-mode-v1-v2-leaderboards
Phase: P01-versioned-infinite-rankings
Task: T01-v2-cosmos-api

- Store v2 personal bests beside preserved v1 records
- Add authenticated v2 leaderboard and score routes
```

## Progress
- [x] Implementation complete
- [x] Validation passed for available unit tests, API build, lint, and diff check.
- commit: pending

## Validation Notes (2026-11-11)
- Passed: `npm run test -- --run shared/companyRecords.test.ts` (151 tests).
- Passed: `npm --prefix api test -- --run src/handlers.test.ts src/playerRepository.test.ts` (189 tests).
- Passed: `npm --prefix api run build`, `npm run lint`, and `git diff --check`.
- Pending: Cosmos integration test. `npm --prefix api run test:integration -- test/playerRepository.integration.test.ts` cannot start without `COSMOS_EMULATOR_ENDPOINT`; no emulator was running, and Docker was not started.
- Cosmos persistence integration remains unverified because the emulator endpoint is not configured. At the user's direction, proceed to T02 with this validation exception documented; do not report the integration test as passed.
