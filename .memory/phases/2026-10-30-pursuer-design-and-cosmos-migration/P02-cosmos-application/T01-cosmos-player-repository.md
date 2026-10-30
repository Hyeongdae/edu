# Task: T01 Cosmos Player Repository

## Status: done

## Goal
Make the production Functions API read, update, and rank one Cosmos DB for NoSQL player document per authenticated account, preserving the current validated profile/ranking contract and bounded concurrency retries.

## Decision Summary
- Use the pinned `@azure/cosmos` package version `4.10.1`, a long-lived `CosmosClient` created from a server-only connection string, database/container environment settings, and a NoSQL item whose partition key is `/accountId`.
- Keep the existing `SharedProfile`, `SharedBest`, validation, merge, authentication, and HTTP contracts unchanged. Use Cosmos item ETags with conditional replace; never expose Cosmos internals or credentials to API responses.

## Implementation

### I01. Cosmos document model and repository adapter

- Related Files:
  - `api/src/playerRepository.ts` :: `PlayerRepository`, `getPlayerRowKey`, `decodeEntity` replacement, `encodeEntity` replacement, `createPlayerRepository`, `createPlayerRepositoryFromEnvironment` — replace Table client operations with Cosmos container operations; modify.
  - `api/src/playerRepository.test.ts` :: private player repository tests — replace Table mocks with a Cosmos container/item mock while retaining repository contract coverage; modify.
  - `api/package.json` :: dependencies — add exact `@azure/cosmos: 4.10.1`, remove `@azure/data-tables`; modify.
  - `api/package-lock.json` :: lockfile — regenerate from `api/package.json`; modify.
  - `api/local.settings.example.json` :: API environment example — remove Table setting names; keep Cosmos settings test-only/placeholder and no production secret; modify.
  - `shared/companyRecords.ts` :: `SharedProfile`, `SharedBest`, `mergeSharedResult`, `getSharedTopScores`, `validateResultForProfile` — read-only; preserve business rules.
  - `api/src/handlers.ts` and `api/src/principal.ts` :: authenticated API boundary — read-only; preserve routes and trusted actor resolution.

#### Details
- **Signatures & Types**:
  ```typescript
  export interface PlayerRepository {
    getProfile(actor: AuthenticatedActor): Promise<SharedProfile>;
    listTopScores(): Promise<SharedBest[]>;
    submit(actor: AuthenticatedActor, input: SubmitResultRequest): Promise<SharedProfile>;
  }

  export interface PlayerDocument {
    id: string;
    accountId: string;
    schemaVersion: 1;
    displayName: string;
    highestClearedStage: ClearedStage;
    bestStage?: GameStage;
    bestScore?: number;
    remainingTimeCs?: number;
    achievedAt?: string;
  }
  ```
  Keep/derive the existing `AuthenticatedActor`, `SharedProfile`, `SharedBest`, and `SubmitResultRequest` types from `shared/companyRecords.ts`. Define a narrow `PlayerContainer` test seam exposing `item(id, partitionKey)`, `items.create(document)`, and `items.query(spec, options).fetchAll()`; do not cast to `TableClient`.
- **Document fields**:
  - `id = "p_" + sha256(accountId).hex`, preserving `getPlayerRowKey(accountId)` as the stable item ID.
  - `accountId` is both the trusted actor's identity and the `/accountId` partition-key value; it is not accepted from the submission body.
  - `schemaVersion: 1`, `displayName`, and `highestClearedStage` are always present.
  - Best-result fields are all present together only when a best exists: `bestStage`, `bestScore`, `remainingTimeCs`, and `achievedAt`. Do not store an explicit `best: null` field; map to/from `SharedProfile.best` at the repository boundary.
  - `_etag` and Cosmos system metadata are read from the SDK response but excluded from serialized documents and public API DTOs.
- **Environment**:
  - Require non-empty `GAME_RECORDS_COSMOS_CONNECTION_STRING`, `GAME_RECORDS_COSMOS_DATABASE`, and `GAME_RECORDS_COSMOS_CONTAINER` values; fail closed with the existing `RecordServiceError("storage-unavailable")` when absent/invalid.
  - Construct the client using the documented `new CosmosClient(connectionString)` overload. Resolve `client.database(databaseName).container(containerName)` once in `createPlayerRepositoryFromEnvironment`; retain the existing `api/src/index.ts` lazy module singleton so a warm Functions worker reuses the client.
  - Do not log environment values, connection strings, SDK response bodies, or raw errors.
- **Read and validation flow**:
  1. `getProfile` and `submit` point-read `container.item(getPlayerRowKey(actor.accountId), actor.accountId).read<PlayerDocument>()`.
  2. Treat only an SDK 404/NotFound for that exact item as a fresh profile. A missing database/container, 401/403, timeout, 429 exhausted by the SDK, or other error maps to `storage-unavailable` (HTTP 503), never to empty profile.
  3. Validate `id`, `accountId`, schema version, non-empty/length-bounded display name, cleared-stage range, all-or-none best fields, stage score/time bounds, UTC ISO `achievedAt`, and the invariant that a cleared best stage is unlocked. Keep the current fail-closed behavior.
  4. Return public DTOs without `id`, `_etag`, `_rid`, `_self`, `_attachments`, or `_ts`.
- **Leaderboard query**:
  - Query `container.items.query<PlayerDocument>({ query: "SELECT TOP 10 * FROM c WHERE IS_DEFINED(c.bestStage) ORDER BY c.bestStage DESC, c.bestScore DESC, c.remainingTimeCs DESC, c.achievedAt ASC, c.accountId ASC" }, { maxItemCount: 10 }).fetchAll()`.
  - Decode/validate each returned document and map only `best` fields to `SharedBest`. The order matches `compareSharedPerformance`: higher stage, higher score, more remaining time, earlier server timestamp, then lexical account ID. Profiles with no best are omitted. The query is cross-partition because account ID is the partition key and a company-wide ranking spans all accounts.
- **Conditional submit flow**:
  1. Retry at most five times. On every attempt, re-read the latest profile and call `validateResultForProfile` with its latest `highestClearedStage` before merging.
  2. Use `mergeSharedResult` and the server's `now().toISOString()` exactly as today. Do not replace on unchanged/weaker submissions.
  3. When missing, use `container.items.create(document)`. On 409 conflict, re-read and recompute.
  4. When present, use `container.item(id, actor.accountId).replace(document, { accessCondition: { type: "IfMatch", condition: stored.etag } })`. On 412, re-read and recompute; after five conflicts return existing `RecordServiceError("conflict")` (HTTP 409).
  5. Map SDK errors through the existing `storageBoundary`; never include Cosmos diagnostics or credentials in the returned error.
- **Tests**: Preserve coverage for missing profile vs missing container, corrupt documents, no-best/partial-best, stable hash ID, sorted TOP 10, no leaked system fields, invalid/locked results, exact whole-tuple comparison, unchanged/no-op writes, create-409 race, conditional replace-412 race, rereading latest unlock before a retry, bounded five attempts, and storage failures mapping to 503.

### I02. API test/environment contract

- Related Files:
  - `api/local.settings.example.json` :: `Values` — use only harmless local placeholders; no account key or production connection string; modify.
  - `api/src/playerRepository.test.ts` :: environment factory cases — assert each missing/invalid Cosmos setting fails closed; modify.

#### Details
- The local game must not depend on API credentials. The example must contain no real secret and must not point at the production Cosmos endpoint. Integration tests get their isolated emulator configuration from the test harness, not from `GAME_RECORDS_COSMOS_CONNECTION_STRING` in the developer shell.
- Leave `api/src/index.ts`, `api/src/handlers.ts`, HTTP status/error mapping, SWA principal parsing, and request/response DTOs unchanged unless a compile-only import adjustment is required.

## Acceptance Criteria
- [x] Production API code/dependencies and local settings no longer use Table Storage. The old Azurite integration harness remains dev-only until its replacement in P02-T02.
- [x] Existing API routes and authenticated profile/result/leaderboard shapes are unchanged.
- [x] Each account has one stable Cosmos item in partition `/accountId`, and concurrent submissions retain the strongest valid whole best tuple and monotonic stage unlock.
- [x] Missing Cosmos configuration/resource or Cosmos service failures return the existing 503 response, never a successful empty leaderboard/profile.
- [x] No Cosmos internal fields or secret values appear in the public API.

## Validation
- `npm --prefix api test` — API unit/handler/repository tests pass.
- `npm --prefix api run build` — Node 22 Functions bundle and TypeScript check pass.

## Commit Message
```text
feat(api): store player records in Cosmos DB

Plan: 2026-10-30-pursuer-design-and-cosmos-migration
Phase: P02-cosmos-application
Task: T01-cosmos-player-repository

- Replace Table repository with Cosmos NoSQL item operations
- Preserve rankings, validation, and conditional concurrency retries
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: `cd7a914`
