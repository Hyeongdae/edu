# Plan: Pursuer Design and Cosmos Migration

## Goal
Give the pursuer one consistent, slightly slimmer pixel-art appearance with a yellow straw hat in chase and capture scenes, then move deployed player profiles and rankings from the dedicated Azure Table Storage account to a new Cosmos DB for NoSQL container. Local play will not save records. Delete the old Storage account only after the deployed Cosmos-backed game has been verified.

## Decisions
- [Pursuer straw-hat design](../decisions/2026-10-30-pursuer-straw-hat-design.md)
- [Cosmos ranking storage migration](../decisions/2026-10-30-cosmos-ranking-storage-migration.md)

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | Update the older pursuer's SVG pixel art across chase and overtime-capture scenes. | [P01](../phases/2026-10-30-pursuer-design-and-cosmos-migration/P01-pursuer-pixel-art/phase.md) |
| P02 | `pending` | Replace Table Storage with Cosmos DB for NoSQL in the API, add isolated Cosmos integration coverage, and stop local game persistence. | [P02](../phases/2026-10-30-pursuer-design-and-cosmos-migration/P02-cosmos-application/phase.md) |
| P03 | `pending` | Create/configure the production Cosmos container, deploy and verify the API, then remove the old dedicated Storage account. | [P03](../phases/2026-10-30-pursuer-design-and-cosmos-migration/P03-azure-cutover/phase.md) |

## Work Order and Boundaries
- Follow the single `.memory/current.md` task pointer. These independent features are grouped under one plan but execute one task at a time: P01 artwork, P02 application code, P03 Azure cutover.
- P01 updates both hand-drawn SVG implementations. Keep pursuer motion, capture choreography, player art, and game rules unchanged.
- P02 stores Cosmos documents with `id = p_<sha256(accountId)>`, partition key `/accountId`, `schemaVersion: 1`, profile fields, and the existing optional best-result fields. Preserve authenticated API contracts and ranking order.
- P02 local game sessions do not read or write local ranking/progress keys. Stage clears remain available in the current in-memory run; a page reload starts local play at stage 1. The production `CompanyRecordStore` retry queue is separate and remains unchanged.
- P03 targets only account `maze-rescue-ms-b7af62a9`, database `stair-climb`, container `players`, resource group `grill-me-edu`, Static Web App `swa-dex-escape-prod-384874bc`, and dedicated legacy account `stdexescape384874bc`. Do not touch Cosmos `auth`/`game`, the existing `maze-rescue` database, or unrelated resource-group assets.
- The `stair-climb` database has its own shared 400 RU/s throughput pool; the `players` container has no dedicated throughput. This is separate from the existing `maze-rescue` database's 400 RU/s pool.
- Azure provisioning is already in place: `stair-climb/players` exists with `/accountId`, `maze-rescue/stair-climb-players` was deleted, and the three `GAME_RECORDS_COSMOS_*` server settings are present on the existing Static Web App. The app has not yet been redeployed or verified against Cosmos.
- Keep old Table settings and the Storage account through deployment and real company-account verification. Only P03-T03 may remove the old settings and delete the legacy account.
- Existing active work parked by this plan: the previous `.memory/current.md` pointer was Azure Company Game Deployment P02-T03. Its real Entra login / save check is superseded by P03-T02's Cosmos-backed login and save verification; do not run the obsolete Table-specific check separately.

## Validation References
- Cosmos JavaScript SDK `@azure/cosmos` client, item read/create/replace, query, and response ETag: [Microsoft Learn SDK quickstart](https://learn.microsoft.com/azure/cosmos-db/sql-api-nodejs-get-started), [CosmosClient reference](https://learn.microsoft.com/javascript/api/%40azure/cosmos/cosmosclient?view=azure-node-latest), [Item reference](https://learn.microsoft.com/en-us/javascript/api/%40azure/cosmos/item?view=azure-node-latest), and [RequestOptions reference](https://learn.microsoft.com/en-us/javascript/api/%40azure/cosmos/requestoptions?view=azure-node-latest).
- Cosmos container CLI: [Azure CLI `az cosmosdb sql container`](https://learn.microsoft.com/en-us/cli/azure/cosmosdb/sql/container?view=azure-cli-latest). Omitting `--throughput` is required for sharing the existing database offer.
- Shared throughput behavior and limits: [Provision throughput for containers and databases](https://learn.microsoft.com/en-us/azure/cosmos-db/set-throughput).
- Static Web Apps API application settings are server-side environment variables and support connection strings: [Microsoft Learn application settings](https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings).
- Cosmos NoSQL emulator for isolated local/CI integration coverage: [Linux-based emulator](https://learn.microsoft.com/en-us/azure/cosmos-db/emulator-linux).

## Progress
- done: 0/7 (active: P01-T01)
