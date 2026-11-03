# Task: T02 Infinite Ranking API and Cosmos Record

## Status: done

## Goal
Persist and return one infinite-mode personal-best score per signed-in company account in the existing stair-climb/players Cosmos container, without changing stage best-score ordering or unlock progress.

## Decision Summary
- Add an independent infinite best to each existing account profile/document. Keep the existing /accountId partition and container; do not create a container or migrate ranking data.
- Rank only by infinite score descending, return at most 10 entries, and do not mix this list with stage rankings.
- Accept the client-submitted safe integer under the selected current trust model; defer move-log replay validation.

## Implementation

### I01. Extend shared records and backward-compatible player profile

- Related Files:
  - shared/companyRecords.ts :: SharedProfile, SharedInfiniteBest, infinite request/response validation, ranking comparator and merge; modify.
  - shared/companyRecords.test.ts :: wire contract, sorting, merge, and profile-preservation tests; modify.
  - src/company/recordApi.ts :: infinite request/response validation and fetch/post calls; modify.
  - src/company/recordApi.test.ts :: new endpoint request and response tests; modify.

#### Details
- Types:
  ~~~typescript
  export interface SharedInfiniteBest {
    accountId: string;
    displayName: string;
    bestScore: number;
    achievedAt: string;
  }
  export interface SharedProfile {
    accountId: string;
    displayName: string;
    highestClearedStage: ClearedStage;
    best: SharedBest | null;
    infiniteBest: SharedInfiniteBest | null;
  }
  export interface InfiniteScoreInput { score: number; }
  export interface SubmitInfiniteScoreRequest {
    submissionId: string;
    result: InfiniteScoreInput;
  }
  export interface SubmitInfiniteScoreResponse {
    submissionId: string;
    profile: SharedProfile;
    entries: SharedInfiniteBest[];
  }
  export function isSubmitInfiniteScoreRequest(value: unknown): value is SubmitInfiniteScoreRequest;
  export function validateInfiniteScoreInput(value: unknown): value is InfiniteScoreInput;
  export function compareInfinitePerformance(a: SharedInfiniteBest, b: SharedInfiniteBest): number;
  export function getSharedTopInfiniteScores(
    entries: readonly SharedInfiniteBest[], limit?: number,
  ): SharedInfiniteBest[];
  export function mergeSharedInfiniteScore(
    previous: SharedProfile | null,
    actor: AuthenticatedActor,
    input: InfiniteScoreInput,
    serverNowIso: string,
  ): { profile: SharedProfile; changed: boolean };
  ~~~
  - SharedInfiniteBest = { accountId: string; displayName: string; bestScore: number; achievedAt: string }.
  - SharedProfile gains infiniteBest: SharedInfiniteBest | null. Every API profile response includes the field; old Cosmos rows without it decode to null.
  - InfiniteScoreInput = { score: number }.
  - SubmitInfiniteScoreRequest = { submissionId: string; result: InfiniteScoreInput }.
  - SubmitInfiniteScoreResponse = { submissionId: string; profile: SharedProfile; entries: SharedInfiniteBest[] }.
  - Export isSubmitInfiniteScoreRequest, validateInfiniteScoreInput, compareInfinitePerformance, getSharedTopInfiniteScores, and mergeSharedInfiniteScore.
- Exact request validation:
  1. Require an exact top-level key set of submissionId/result and an exact result key set of score.
  2. Require a UUID submissionId and a non-negative Number.isSafeInteger score. Do not use a stage cap.
  3. Validate server timestamp as the same canonical UTC ISO timestamp used by mergeSharedResult.
- Merge and ranking:
  - Compare only bestScore descending. Return top 10 after de-duplicating by accountId. Use achievedAt ascending then accountId ascending only as deterministic row ordering for equal score; visible ranks are assigned by UI.
  - For account merge, a strictly greater score replaces that account's record. Lower or equal score preserves bestScore/achievedAt. Update displayName on an existing record if the signed-in name changed.
  - Preserve stage best and highestClearedStage exactly. Conversely, update mergeSharedResult and all default/fallback profile constructors so they preserve infiniteBest.
  - Add validators for infinite profile entries and endpoint envelopes. Require a valid canonical ISO timestamp, unique account IDs, and at most 10 ranking entries. Preserve same-origin credentials, abort/timeout handling, X-Game-Account identity precondition, fixed error parsing, and cache:no-store.
- API client exports:
  - fetchInfiniteLeaderboard(signal: AbortSignal): Promise<SharedInfiniteBest[]> calls GET /api/infinite-leaderboard.
  - postInfiniteResult(accountId: string, payload: SubmitInfiniteScoreRequest, signal: AbortSignal): Promise<SubmitInfiniteScoreResponse> calls POST /api/infinite-results and validates submission id, profile, and entries.

### I02. Store infinite score in the existing Cosmos player item

- Related Files:
  - api/src/playerRepository.ts :: PlayerRepository, PlayerDocument, decodeDocument, encodeDocument, queries and CAS save; modify.
  - api/src/playerRepository.test.ts :: Cosmos mock rows, ranking query, merge and conflict tests; modify.
  - api/src/cosmosEmulatorHarness.test.ts :: shared emulator repository contract; modify only if it directly enumerates repository methods/results.

#### Details
- PlayerDocument keeps existing id/accountId/schemaVersion/displayName/highestClearedStage and stage best fields. Add optional infiniteBestScore and infiniteAchievedAt.
- The infinite fields are an all-or-none pair. Missing pair means infiniteBest=null. Reject partial pair, unsafe/negative score, or non-canonical timestamp as storage-unavailable. Keep schemaVersion 1 because fields are optional and old records remain readable.
- Keep getPlayerRowKey(accountId), the one-item-per-account model, and /accountId container partition. When encoding a profile, write the pair only when infiniteBest is not null; never erase stage bests or unlocks during an infinite update.
- Add repository methods listTopInfiniteScores() and submitInfiniteScore(actor, input). Top query:
  SELECT TOP 10 * FROM c WHERE IS_DEFINED(c.infiniteBestScore) ORDER BY c.infiniteBestScore DESC, c.infiniteAchievedAt ASC, c.accountId ASC
- listTopInfiniteScores validates/decodes all returned docs, projects only accountId/displayName/bestScore/achievedAt, and applies getSharedTopInfiniteScores.
- submitInfiniteScore uses the existing bounded five-attempt ETag compare-and-swap: reread profile, merge the independent field, replace with IfMatch or create the first item, and retry create 409 / replace 412. Keep storage-boundary mapping and do not change stage validation/query behavior.

### I03. Add authenticated routes and durable client submission queue

- Related Files:
  - api/src/handlers.ts :: repository dependency type, authenticated wrappers, result-body parser, infinite handlers; modify.
  - api/src/index.ts :: register GET infinite-leaderboard and POST infinite-results; modify.
  - api/src/handlers.test.ts :: authentication-before-storage and route/request validation; modify.
  - src/company/types.ts :: CompanyRecordBinding and pending queue union; modify.
  - src/company/CompanyRecordStore.ts :: submitInfiniteScore, queue load/persist/dispatch and merge; modify.
  - src/company/CompanyRecordStore.test.ts :: old queue compatibility, retry, account isolation, and independent profile updates; modify.

#### Details
- Route contracts:
  - GET /api/infinite-leaderboard returns { entries: SharedInfiniteBest[] }.
  - POST /api/infinite-results accepts the exact infinite result request and returns { submissionId, profile, entries }.
  - Reuse the current principal authentication, expected account header, content-type and X-Game-Request checks, 8 KiB body cap, no-store JSON response, and fixed RecordServiceError messages. Register routes as authLevel anonymous and keep the authenticated wrapper as the authorization boundary.
  - Extend PlayerRepository handler dependency with listTopInfiniteScores/submitInfiniteScore. Authenticate before repository access. Never expose Cosmos SDK errors or accept an account ID as the identity source.
- Pending queue:
  - Internal pending union is either { mode: "stage", submissionId, createdAt, result: ResultInput } or { mode: "infinite", submissionId, createdAt, result: InfiniteScoreInput }.
  - Continue reading the current version-1 queue: normalize each old stage-only item to mode:"stage". Persist as version 2. Validate each item with the matching exact submit validator before upload; corrupt/unavailable queues retain the existing warning/fail-closed behavior.
  - CompanyRecordBinding adds infiniteEntries: SharedInfiniteBest[] and submitInfiniteScore(input: InfiniteScoreInput): void. Keep stage entries, submitResult, progress, retry, and refresh API intact.
  - Dispatch queue items to postResult or postInfiniteResult. Persist before networking; preserve retry/backoff, abort/unmount, online handling, expected-account protection, and per-account local pending key.
  - On refresh/acknowledgement update stage and infinite lists independently. Never let a lower/equal infinite result regress the stored personal best or a stage submission clear infiniteBest.
  - Local demo has no CompanyRecordBinding and continues to store no local leaderboard history.

### I04. Verify compatibility and failure boundaries

- Related Files:
  - shared/companyRecords.test.ts, api/src/playerRepository.test.ts, api/src/handlers.test.ts, src/company/recordApi.test.ts, src/company/CompanyRecordStore.test.ts; modify.

#### Details
- Old stage-only Cosmos rows load with infiniteBest null; malformed partial/new fields fail closed.
- Stage and infinite writes in either order preserve both fields and highestClearedStage across ETag 412 retry.
- Infinite ranking sorts by score, de-duplicates account, and returns top 10. Equal score uses deterministic order but the UI may assign equal visible rank.
- Lower/equal score does not replace personal best; greater score does. Equal-score display-name change does not change achievedAt.
- Both API endpoints authenticate before storage access and reject invalid JSON, content/request headers, account mismatch, oversized body, invalid score, invalid UUID, and unexpected payload keys.
- Version-1 queued stage items load and flush after persistence switches to version 2. Infinite queued items retry and only the acknowledged submission ID is removed. Account switch/unmount cannot upload another account's work.

## Acceptance Criteria
- [ ] Existing stage profile, progress, ranking order, APIs, and Cosmos documents remain compatible.
- [ ] Infinite personal best is stored independently in the same player item and queried as a separate top-10 list.
- [ ] Only authenticated company accounts can read/write cloud infinite ranking; local demo writes no ranking history.
- [ ] Pending stage queue v1 remains readable and infinite submissions retry without data loss.

## Validation
- npm run test -- --run shared/companyRecords.test.ts src/company/recordApi.test.ts src/company/CompanyRecordStore.test.ts --maxWorkers=2 — shared/client/store tests pass.
- npm --prefix api test -- src/playerRepository.test.ts src/handlers.test.ts — focused Cosmos mock/handler tests pass.
- npm --prefix api run build — Azure Functions TypeScript and bundle build pass.
- npm run lint — frontend/shared lint passes.

## Commit Message
feat(records): add separate infinite score rankings

Plan: 2026-11-03-infinite-score-mode
Phase: P01-infinite-mode
Task: T02-infinite-ranking-api

- Store infinite personal best alongside existing player profiles
- Add authenticated leaderboard and submission routes

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending
