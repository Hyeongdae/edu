# Task: T02 Route Client Records and Preserve v1 Queue

## Status: done

## Goal
Make new infinite-mode runs submit to the v2 API and load v2 rankings, while ensuring any pre-deployment offline infinite score already queued under the old `infinite` discriminator is retried only through the v1 API.

## Decision Summary
- Keep v1 available only for existing queued writes and historical leaderboard reads; do not enqueue new v1 runs.
- Tag new queued infinite results as v2. Interpret persisted legacy `mode: "infinite"` as v1.
- Return separate v1 and v2 lists/profile records to the UI. Do not copy, merge, or display one version's score in the other.
- A deployed server profile missing the v2 property during compatibility rollout is normalized to `infiniteV2Best: null`; invalid non-null values fail closed.

## Implementation

### I01. Add v2 client HTTP contract and profile compatibility
- Related files:
  - `src/company/recordApi.ts` :: `isSharedProfile`, `normalizeSharedProfile`, `fetchInfiniteLeaderboard`, `postInfiniteResult`, `CompanyRecordApi` - modify/add.
  - `src/company/recordApi.test.ts` :: profile normalization and HTTP request/response tests - modify.
  - `shared/companyRecords.ts` :: shared v2 response types if required by Task T01 API contract - read/update only if T01 did not complete the exported type.
- Details:
  - Add `fetchInfiniteV2Leaderboard(signal)` calling `GET /api/infinite-v2-leaderboard` and validate at most 10 unique valid entries.
  - Add `postInfiniteV2Result(accountId, payload, signal)` calling `POST /api/infinite-v2-results`; validate submissionId, profile, and unique v2 response entries exactly as for v1.
  - Keep `fetchInfiniteLeaderboard` and `postInfiniteResult` pointed at the existing v1 endpoints for historical list fetch and legacy pending writes.
  - Canonical `SharedProfile` always includes nullable `infiniteV2Best`. In `normalizeSharedProfile`, normalize an absent wire property to null for old server/profile fixtures; if present, require either null or a valid account-owned `SharedInfiniteBest`.
  - Add v2 methods to `CompanyRecordApi` and the default API adapter; inject mocks in tests.

### I02. Version the pending queue and route retries without reclassification
- Related files:
  - `src/company/types.ts` :: `CompanyRecordBinding`, `PendingInfiniteResult`, `PendingResult` - modify.
  - `src/company/CompanyRecordStore.ts` :: `submitInfiniteScore`, `loadQueue`, `acceptProfile`, `publish`, `run` - modify.
  - `src/infinite/InfiniteModeScreen.tsx` :: game-over record submission call - modify.
  - `src/company/CompanyRecordStore.test.ts` :: queue migration, requests, refresh, and profile preservation - modify.
  - `src/company/CompanyRecordsGate.test.tsx`, `src/infinite/InfiniteModeScreen.test.tsx`, and company binding fixtures - modify for the added v2 API and binding members.
- Data and signatures:
  - Binding: `infiniteEntries: SharedInfiniteBest[]` (v1), `infiniteV2Entries: SharedInfiniteBest[]` (v2), and canonical `profile.infiniteBest` / `profile.infiniteV2Best`.
  - Pending stage remains `{ mode: "stage", submissionId, createdAt, result }`.
  - Pending V1 is represented internally as `{ mode: "infinite-v1", submissionId, createdAt, result }`.
  - Pending V2 is `{ mode: "infinite-v2", submissionId, createdAt, result }`.
  - Public binding submission becomes `submitInfiniteV2Score(result: InfiniteScoreInput): void`; update `InfiniteModeScreen` to call it when a new infinite-mode run ends.
- Details:
  - Keep queue key `stair-descent:company:production:pending:v1:<encoded-accountId>` and accept persisted queue container versions 1 and 2.
  - While decoding, map legacy item `mode: "infinite"` to internal `infinite-v1`; do not map it to v2. Continue supporting v1 queue entries with omitted mode as the current stage compatibility rule specifies.
  - Persist canonical queued v1/v2 discriminators after reading; preserve submission IDs, order, timestamps, and result payloads.
  - New `submitInfiniteV2Score` calls enqueue only `infinite-v2` and use `postInfiniteV2Result` during processing.
  - Pending `infinite-v1` uses existing `postInfiniteResult`; stage remains on `postResult`.
  - On initial load, fetch profile, stage leaderboard, v1 leaderboard, and v2 leaderboard. Merge each account's local profile best only into its matching version's list.
  - On response, update only the corresponding version list/profile field; never allow a V1 response to overwrite V2 or vice versa.
  - Preserve retry/backoff, same-account isolation, and account-scoped queue behavior.
- Required cases:
  1. Load a real old queue fixture with `mode: "infinite"`; assert it is posted to v1 and removed only after v1 acknowledgment.
  2. Start a new infinite result; assert persisted discriminator is v2 and only the v2 post method is called.
  3. Mixed stage/v1/v2 queue preserves FIFO and routes each item to its own API.
  4. Refresh and successful writes keep account profile v1/v2 bests distinct and combine each with only its matching TOP 10 list.
  5. Absent v2 profile property normalizes to null; malformed or cross-account v2 data is rejected.

## Acceptance Criteria
- [x] New infinite submissions are queued and sent only as v2.
- [x] Pre-existing v1 queue entries are retried only via the legacy v1 endpoint.
- [x] The store exposes independent v1 and v2 rankings and profile bests.
- [x] Profile refresh and retries retain all existing stage records, appearances, and queue semantics.
- [x] Focused client/store tests pass.

## Validation
- `npm run test -- --run src/company/recordApi.test.ts src/company/CompanyRecordStore.test.ts src/company/CompanyRecordsGate.test.tsx`
- `npm run test -- --run src/company/recordApi.test.ts src/company/CompanyRecordStore.test.ts src/company/CompanyRecordsGate.test.tsx src/infinite/InfiniteModeScreen.test.tsx`
- `npm run lint`
- `git diff --check`

## Commit Message
```text
feat(records): route new infinite results to v2

Plan: 2026-11-11-infinite-mode-v1-v2-leaderboards
Phase: P01-versioned-infinite-rankings
Task: T02-client-store-and-queue

- Submit new infinite runs to the v2 API
- Preserve legacy queued scores on the v1 path
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: `07586a8`

## Validation Notes (2026-11-11)
- Passed focused record API/store/gate/infinite/game/notice tests: 240 tests.
- Passed app/character/game regression tests when run as a focused group: 138 tests.
- Passed `npm run lint`, `npm run build`, and `git diff --check`.
- Full-suite run under parallel worker load hit four existing 5-second UI-test timeouts; the affected App, character editor, and game screen files passed in the isolated focused run.
- T01's Cosmos emulator integration remains separately unverified; its exception is documented in T01.
