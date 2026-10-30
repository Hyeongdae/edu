# Task: T02 Cosmos Integration Coverage

## Status: done

## Goal
Exercise the Cosmos repository against an isolated NoSQL emulator in CI so item reads/writes, ranking queries, and ETag conflicts are checked without using the company Cosmos account or any real player records.

## Decision Summary
- Replace the current API integration suite's private Azurite Table process with Microsoft's Linux Cosmos DB for NoSQL emulator service. Use a throwaway test database/container per suite and block any non-loopback or production endpoint.
- Emulator credentials are test-only. The emulator does not test cloud identity/authentication; production authorization is checked in P03.

## Implementation

### I01. Isolated integration harness

- Related Files:
  - `api/test/azuriteHarness.ts` :: `startAzurite` — remove the Table-specific process harness; delete.
  - `api/test/table.integration.test.ts` :: Table integration cases — replace with Cosmos repository integration coverage; delete/rename.
  - `api/test/cosmosEmulatorHarness.ts` :: new test-only Cosmos connection/database/container lifecycle.
  - `api/test/playerRepository.integration.test.ts` :: new real SDK repository integration tests.
  - `api/package.json` and `api/package-lock.json` :: remove Azurite dev dependency and keep `test:integration` script; modify.

#### Details
- **Harness contract**:
  ```typescript
  export interface CosmosEmulatorHarness {
    container: PlayerContainer;
    close(): Promise<void>;
  }
  export async function createCosmosEmulatorHarness(): Promise<CosmosEmulatorHarness>;
  ```
- Read only `COSMOS_EMULATOR_ENDPOINT` for the local/CI emulator. Require `http:` or `https:` and host `localhost`, `127.0.0.1`, or the explicitly configured GitHub service DNS name. Reject Azure `documents.azure.com`, a non-loopback host outside the CI service path, production environment variable names, and any attempt to call `createPlayerRepositoryFromEnvironment` against production settings.
- Create a random test database ID and a test container with `id` matching `Players<32 lowercase hex>` and partition path `/accountId`. Use isolated disposable throughput only inside the emulator test fixture. Delete the random database and dispose the `CosmosClient` in `afterAll`, even when an assertion fails. Never write fixtures to the real `maze-rescue` account.
- Keep result fixtures in `api/test/fixtures.ts` or add Cosmos-only fixture helpers in the new integration file; do not copy production credentials.
- Port the current real-Table integration guarantees to Cosmos: missing point read produces a fresh profile; a saved profile is readable through a second repository; one item per account; another account partition is isolated; clear/result fields round-trip; TOP 10 ordering and tie breaks match the shared comparator; ETag 412 causes reread/recompute without losing a concurrent clear; create conflict 409 retries; missing container returns 503; Cosmos metadata is not returned.
- **CI**: Add `mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-latest` as a service to the `verify` job in `.github/workflows/azure-company-game.yml`, expose the emulator's HTTP gateway on the runner, wait on its documented health probe, and set only `COSMOS_EMULATOR_ENDPOINT` for the integration command. Keep `npm --prefix api run test:integration` in the workflow. Do not set `GAME_RECORDS_COSMOS_CONNECTION_STRING` in CI.
- **Local invocation**: Document that a developer intentionally running API integration tests starts the same emulator locally; local game play itself does not start/use Cosmos and does not persist records.

### I02. Integration verification

- Related Files:
  - `api/vitest.integration.config.ts` :: integration test configuration — keep test-only include and timeout behavior compatible with the emulator; modify if needed.
  - `.github/workflows/azure-company-game.yml` :: `verify` service and integration step — ensure readiness before the test step; modify.

#### Details
- Do not weaken auth/security unit tests to accommodate the emulator. The emulator intentionally does not enforce production authentication; it is used only for database behavior.
- If the current preview Linux emulator lacks a specific test feature, retain unit mocks for that case and document the precise untestable feature. Do not fall back to the production account or silently skip the entire integration suite.

## Acceptance Criteria
- [ ] No API integration test imports `TableClient` or starts Azurite.
- [ ] The CI integration suite targets only the Cosmos emulator and creates a unique disposable database/container.
- [ ] Cleanup deletes only the test database created by that suite and disposes its client.
- [ ] Concurrency, point reads, query order, error boundaries, and single-account document guarantees pass through the actual `@azure/cosmos` SDK.

## Validation
- GitHub Actions PR `verify` job — hosted Linux emulator readiness, API unit tests, Cosmos integration tests, and API build pass without production Cosmos secrets. The test does not require Docker on the developer's PC.
- Optional local run: `npm --prefix api run test:integration` with the same Cosmos emulator running locally.

## Commit Message
```text
test(api): cover Cosmos repository with emulator

Plan: 2026-10-30-pursuer-design-and-cosmos-migration
Phase: P02-cosmos-application
Task: T02-cosmos-integration-coverage

- Replace Azurite integration fixtures with isolated Cosmos NoSQL tests
- Run the emulator-backed repository suite in CI
```

## Progress
- [x] Implementation complete
- [x] GitHub Actions PR `verify` passed, including the Cosmos emulator integration suite and production artifact staging.
- commit: `b12fb0a` (follow-up fixes: `1953844`, `3b19c48`)
