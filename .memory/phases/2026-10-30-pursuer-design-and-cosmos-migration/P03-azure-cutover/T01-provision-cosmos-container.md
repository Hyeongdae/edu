# Task: T01 Provision Cosmos Container

## Status: done

## Goal
Create the requested stair-game container in the existing Cosmos account and configure the deployed Static Web Apps API to reach it securely, without interrupting the currently deployed Table-backed release or deleting any existing resource.

## Decision Summary
- Exact target: resource group `grill-me-edu`, Cosmos account `maze-rescue-ms-b7af62a9`, database `stair-climb`, container `players`, partition path `/accountId`.
- The `stair-climb` database has a separate shared 400 RU/s offer. Omit container-level throughput. Add Cosmos settings while retaining old Table settings until T02 has deployed and passed live verification.

## Implementation

### I01. Deployment manifest and plan validation

- Related Files:
  - `deploy/DeploymentPlan.psm1` :: `Assert-DexManifest`, `Get-DeploymentPlan`, `Assert-DexDeploymentPermissions` — record and validate the exact Cosmos target and required actions; modify.
  - `deploy/azure.resources.json` :: current non-secret deployment manifest — add Cosmos resource identifiers and the legacy account name while deletion is pending; modify.
  - `scripts/deployment-plan.test.mjs` :: deterministic plan, permission, and mocked Apply tests — update for the Cosmos container/settings; modify.

#### Details
- **Manifest Fields**: Keep `schemaVersion`, repository/branch, resource group, location, Static Web Apps name/URL, SKU, Entra credential metadata, and tenant fingerprint. Add exactly `cosmosAccountName: "maze-rescue-ms-b7af62a9"`, `cosmosDatabaseName: "stair-climb"`, `cosmosContainerName: "players"`, `cosmosDatabaseThroughput: 400`, and temporary `legacyStorageAccountName: "stdexescape384874bc"`. Continue rejecting connection strings, account keys, passwords, token values, or secret-bearing field names in persisted manifests.
- Bump the manifest schema/version checks as needed; fail closed if an existing saved manifest points at a different subscription/resource group, Cosmos account, database, container, Static Web Apps site, or legacy account. Do not infer a replacement name.
- Update permission preflight to require the necessary scoped `Microsoft.DocumentDB/databaseAccounts/read`, SQL database/container read/create, and account key-list actions plus existing SWA app-setting and Static Web Apps actions. Do not query/patch Entra or GitHub if the required Cosmos permission is absent.
- Update `scripts/deployment-plan.test.mjs` fake Azure responses to cover exact account/database validation, owned target, missing vs existing container, `/accountId` partition validation, no throughput argument, key material handled only in memory, SWA setting merge, idempotent rerun, and no Cosmos secrets in command logs/output/manifest. Preserve tests for original SWA callback, Entra settings, unrelated app settings, and deployment token stdin handling.

### I02. Cosmos container and server settings

- Related Files:
  - `deploy/Deploy-DexEscape.ps1` :: Apply preflight, Cosmos target validation/provisioning, and SWA app-setting merge — replace Storage account/table provisioning with Cosmos provisioning; keep the old Storage account untouched in this task.
  - `deploy/RELEASE.md` :: API data-store and deployment verification notes — document Cosmos target with no secret; update.
  - `.github/workflows/azure-company-game.yml` :: release artifact flow — read-only unless a build output adjustment is required.

#### Details
- **Azure target validation**:
  1. Before any cloud write, verify active subscription and signed-in operator are the intended existing deployment principal; verify exact `grill-me-edu` group and that the named Cosmos account exists in it, is `GlobalDocumentDB`, and contains the `stair-climb` SQL database.
  2. Verify the `stair-climb` database shared provisioned throughput is 400 RU/s and that no dedicated throughput is set on `players`.
  3. List/show `players`. If absent, create exactly with `az cosmosdb sql container create --resource-group grill-me-edu --account-name maze-rescue-ms-b7af62a9 --database-name stair-climb --name players --partition-key-path /accountId`; deliberately omit `--throughput`. If already present, accept only when its partition-key path is `/accountId` and it has no conflicting dedicated throughput. Never replace/delete a mismatched existing container.
  4. Do not alter account kind, regions, network/firewall settings, database throughput, existing `auth`/`game` containers, their contents, or other Azure resources.
- **Connection secret and SWA settings**:
  - Retrieve Cosmos document endpoint and primary key through Azure CLI/tool results only in memory; construct the `AccountEndpoint=...;AccountKey=...;` connection string without writing it to a repo file, manifest, terminal, GitHub variable, or persistent local state file.
  - Read existing Static Web Apps app settings, preserve all unrelated and current Table settings, then merge server-only values `GAME_RECORDS_COSMOS_CONNECTION_STRING`, `GAME_RECORDS_COSMOS_DATABASE=stair-climb`, and `GAME_RECORDS_COSMOS_CONTAINER=players` into the managed API app settings.
  - Update only the Static Web Apps appsettings resource; do not put the Cosmos string in Vite `VITE_*`, compiled browser code, workflow YAML, deployment manifest, or GitHub variables. Confirm through a presence-only read that all three names are set; never print or return the connection string.
  - Make Apply idempotent: on rerun verify the same exact resource, preserve unrelated app settings, avoid a duplicate container, and reuse the current valid Entra credential/deployment token metadata without printing any secret.
- **No deletion here**: Leave `GAME_RECORDS_CONNECTION_STRING`, `GAME_RECORDS_TABLE`, account `stdexescape384874bc`, and `DexEscapePlayers` untouched until T02 has deployed and a company login/save has been verified.

## Acceptance Criteria
- [x] Existing Cosmos account/database are verified, and the new container uses `/accountId` with the database-shared throughput configuration.
- [x] Cosmos connection string is available only to the deployed API through server-side settings; no credential appears in tracked files, output, or frontend assets.
- [x] Existing SWA/Entra/deployment settings remain intact and current Table deployment remains available for rollback.
- [x] Apply rerun is idempotent and mismatched resource/container ownership/configuration fails closed.
- [x] This task deletes no resource and changes no existing Cosmos data/container.

## Validation
- `npm run test:deployment` — 25 tests pass; PlanOnly made no cloud calls.
- `npm run lint` — passes.
- Mock Apply — exact Cosmos target, server-only settings, preserved Table rollback settings, secret-safe output, and idempotent rerun pass.

## Commit Message
```text
feat(deploy): provision the stair game Cosmos container

Plan: 2026-10-30-pursuer-design-and-cosmos-migration
Phase: P03-azure-cutover
Task: T01-provision-cosmos-container

- Create the shared-throughput Cosmos NoSQL container
- Add server-only Cosmos settings without removing the rollback store
```

## Progress
- [x] Azure resource provisioned: `stair-climb/players`, `/accountId`, shared database throughput 400 RU/s; initial `maze-rescue/stair-climb-players` removed per user correction.
- [x] Production SWA app settings added; original Table settings preserved. Secret values were not printed.
- [x] Deployment code/manifest updated and automated checks passed.
- commit: `a904755`
