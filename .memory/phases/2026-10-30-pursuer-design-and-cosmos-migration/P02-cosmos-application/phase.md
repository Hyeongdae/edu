# Phase: P02 Cosmos Application

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` | Replace the player repository's Table SDK with Cosmos DB for NoSQL while preserving record contracts and concurrency. | [T01](./T01-cosmos-player-repository.md) |
| T02 | `done` | Replace Azurite integration coverage with isolated Cosmos emulator coverage in CI. | [T02](./T02-cosmos-integration-coverage.md) |
| T03 | `done` | Remove browser-local ranking/progress persistence from local game runs while keeping session progression playable. | [T03](./T03-disable-local-record-persistence.md) |

## Progress
- done: 3/3
- T01 commit: `cd7a914`
- T02 commit: `b12fb0a` (Cosmos emulator CI passed; follow-up fixes `1953844`, `3b19c48`)
- T03 commit: `be80818` (128 tests, lint, build passed)
