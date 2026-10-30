# Decisions: Cosmos Ranking Storage Migration

- Date: 2026-10-30
- Status: Confirmed
- Feature slug: `cosmos-ranking-storage-migration`
- Stage: Confirmed and provisioned. Azure target and server-side settings are prepared; the Cosmos-backed code has not yet been deployed or verified with a company account.

## D01. Cosmos destination
- **Chosen**: Store deployed game records in the `players` container in a separate `stair-climb` database in the existing Cosmos DB for NoSQL account `maze-rescue-ms-b7af62a9`.
- **Source**: User corrected the initial container-under-`maze-rescue` layout and selected a dedicated `stair-climb` database with a `players` container.
- **Rationale**: A dedicated database separates stair-game records from the existing `maze-rescue` database and its `auth` and `game` containers.

## D02. Container partitioning
- **Chosen**: Partition records by each authenticated player's account ID using the Cosmos path `/accountId`.
- **Source**: User selected grouping records by player account.
- **Rationale**: The existing repository reads and updates one profile per authenticated account, so account-based partitioning supports that access pattern directly.

## D03. Throughput
- **Chosen**: Give the new `stair-climb` database its own shared 400 RU/s throughput pool; do not provision dedicated throughput on its `players` container.
- **Source**: User selected the separate-database option after the additional throughput allocation was explained.
- **Rationale**: The database gets its own 400 RU/s pool, separate from the existing `maze-rescue` database. This adds provisioned throughput cost.

## D04. Cosmos authentication
- **Chosen**: Keep the Cosmos connection string in an Azure Static Web Apps server-only application setting. Never include it in browser code or Vite-prefixed public settings.
- **Source**: User selected option 1 after the server-only storage and managed-identity choices were explained.
- **Rationale**: The existing record API runs in Static Web Apps managed Functions and already reads storage credentials from server environment settings.

## D05. Existing record handling and old account deletion
- **Chosen**: Do not migrate existing `DexEscapePlayers` records. Start the Cosmos container without those records. After the Cosmos-backed deployment is verified, delete the dedicated Azure Storage account `stdexescape384874bc` that currently holds the game table.
- **Source**: User selected discarding the existing records and had requested deletion of the old storage account.
- **Rationale**: The new company leaderboard is intentionally started fresh. Waiting until Cosmos-backed behavior is verified avoids removing the active backend before its replacement works.

## D06. Local versus deployed record behavior
- **Chosen**: Only the deployed company game persists profiles and ranking results to Cosmos DB. Local game runs do not persist or submit records.
- **Source**: User confirmed that records should be saved only in the deployed game.
- **Rationale**: This prevents local play from polluting the company leaderboard and avoids a local record store that the user does not need.

## D07. Record schema and ranking behavior
- **Chosen**: Preserve the existing API behavior: one profile per account, including `displayName`, `highestClearedStage`, and one best result (`bestStage`, `bestScore`, `remainingTimeCs`, `achievedAt`). Keep the current authenticated API contracts and top-ten ordering by stage, then score, then remaining time, with existing deterministic tie breaks.
- **Source**: Confirmed from `shared/companyRecords.ts` and `api/src/playerRepository.ts`; this is existing behavior, not a new user choice.
- **Rationale**: This task changes the persistence backend, not the ranking rules or gameplay progression.

## D08. Data and concurrency fields
- **Chosen**: Use a Cosmos document `id` derived from the current SHA-256 account row key, `accountId` as the partition key, and retain `schemaVersion: 1` and the current profile/result fields. Use Cosmos conditional writes to preserve protection against concurrent profile updates.
- **Source**: Derived from the current table entity key, schema, and ETag-based retry behavior in `api/src/playerRepository.ts`.
- **Rationale**: Retaining stable account addressing and concurrency checks prevents duplicate profiles or lost updates while adapting Table Storage semantics to Cosmos DB for NoSQL.

## D09. Existing implementation work required
- **Chosen**: Replace the Table Storage repository and configuration with the Cosmos DB for NoSQL SDK and server settings; update deployment provisioning and documentation to create/configure the Cosmos container and remove the dedicated Storage account only after verification.
- **Source**: Derived from the current `@azure/data-tables` implementation, `GAME_RECORDS_CONNECTION_STRING`/`GAME_RECORDS_TABLE` settings, and `deploy/Deploy-DexEscape.ps1` provisioning flow.
- **Rationale**: The existing Cosmos account is NoSQL, not Cosmos DB for Table, so the Azure Table SDK cannot directly address the selected container.

## D10. Scope guard
- **Chosen**: Do not modify the Cosmos `auth` or `game` containers, their documents, or the existing `maze-rescue` database and its throughput. The temporary `maze-rescue/stair-climb-players` container was removed after creating the dedicated target.
- **Source**: User explicitly asked to delete the initially created container after choosing the separate-database layout.
- **Rationale**: This migration is limited to the stair-climb game's new database, the production API settings, and its dedicated old Storage account.
