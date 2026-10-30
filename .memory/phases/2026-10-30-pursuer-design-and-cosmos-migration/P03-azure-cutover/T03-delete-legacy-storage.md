# Task: T03 Delete Legacy Storage

## Status: done

## Goal
After T02 proves that real company records are saved and restored from Cosmos, remove the obsolete Table app settings and delete only the dedicated game Storage account requested by the user.

## Decision Summary
- Deletion is explicitly requested and the old ranking history is intentionally discarded. The old account remains until the Cosmos release is verified; this task is strictly gated on T02 completion evidence.
- Delete only `stdexescape384874bc` in `grill-me-edu`, never the Static Web Apps site or Cosmos account/database/containers.

## Implementation

### I01. Remove the legacy app settings and Storage account

- Related Files:
  - `deploy/Deploy-DexEscape.ps1` :: final Apply configuration and retired-resource handling ??remove old Storage provisioning/configuration after the account is deleted; modify.
  - `deploy/DeploymentPlan.psm1` :: `Assert-DexManifest`, `Get-DeploymentPlan`, permissions ??remove `legacyStorageAccountName` from the final steady-state target; modify.
  - `deploy/azure.resources.json` :: final manifest ??record Cosmos target only and remove retired Storage identifiers; modify.
  - `scripts/deployment-plan.test.mjs` :: final plan/Apply expectations ??assert no Storage creation, Table creation, or old setting returns; modify.
  - `deploy/RELEASE.md` :: final API storage and deleted-resource status ??update with non-secret facts.

#### Details
- **Preconditions**:
  1. Require P03-T02 complete with CI/deploy SHA and real company-account Cosmos profile/result/unlock verification recorded.
  2. Before deletion, read exact resource ID/group/name and ownership tags for `stdexescape384874bc`; verify it is the dedicated game Table account, not `swa-dex-escape-prod-384874bc`, and that the expected table is `DexEscapePlayers`.
  3. Verify current SWA settings contain Cosmos endpoint/database/container values by presence only and do not print secret values. Confirm production code references only Cosmos settings.
- Remove only `GAME_RECORDS_CONNECTION_STRING` and `GAME_RECORDS_TABLE` from Static Web Apps settings while preserving Cosmos and all unrelated settings. Verify no old Table setting name remains.
- Delete using the exact scoped command `az storage account delete --resource-group grill-me-edu --name stdexescape384874bc --yes` only after revalidating the full resource ID and tags. Do not delete an account selected by a computed/ambiguous path or delete the shared resource group.
- Verify the exact old account is absent from `az storage account list --resource-group grill-me-edu`; treat an unexpected permission/lock/error as incomplete and do not claim deletion. Verify the SWA site and Cosmos account/database/container still exist.
- Remove `legacyStorageAccountName`, old Table name, and every Storage creation/list-keys/table-service branch from the steady-state manifest/script/permission plan. The deployment plan should validate that Cosmos values remain exact and that reruns cannot recreate the deleted Storage account.
- Preserve the user's explicit choice to start fresh: do not export/restore the old table. Do not clear Cosmos records or change the existing database-shared throughput.

### I02. Final source/release verification

- Related Files:
  - `deploy/azure.resources.json` :: final Cosmos-only manifest ??verify no secret/legacy account field remains.
  - `deploy/RELEASE.md` :: final live-storage note ??verify Cosmos account/database/container identifiers and production URL; no personal record data.
  - `deploy/DeploymentPlan.psm1` and `deploy/Deploy-DexEscape.ps1` :: final steady-state script ??verify Apply/PlanOnly never recreates Table resources.

#### Details
- Search source/config/docs for `DexEscapePlayers`, `GAME_RECORDS_TABLE`, `GAME_RECORDS_CONNECTION_STRING`, and `Microsoft.Storage/storageAccounts`; remove production provisioning references while retaining historical decision/task evidence as historical records, not as active config.
- Validate all unrelated SWA settings and the Entra app configuration remain unchanged. Do not modify or clear `auth`/`game` containers.

## Acceptance Criteria
- [x] T02 live verification passed before deletion begins.
- [x] Only `stdexescape384874bc` is deleted; the account is absent and the SWA/Cosmos resources remain.
- [x] Old Table app settings and active provisioning references are removed; rerun does not recreate storage/table resources.
- [x] Production rankings/profile continue to read/write Cosmos after the cleanup; the user confirmed their records remained.
- [x] Existing `maze-rescue` Cosmos containers/data and its 400 RU/s throughput are unchanged; `stair-climb/players` remains available with its separate shared 400 RU/s database throughput.

## Validation
- `npm run test:deployment` ??final manifest and idempotent Apply tests prove no Table/Storage recreation.
- `npm run lint` ??scripts and tests pass static checks.
- `npm run build` ??deployed app build remains valid.
- Read-only Azure verification ??legacy account absent, Cosmos/SWA resources present, Cosmos server settings remain present, and post-delete company profile/leaderboard smoke succeeds.

## Commit Message
```text
chore(azure): remove the retired game Storage account

Plan: 2026-10-30-pursuer-design-and-cosmos-migration
Phase: P03-azure-cutover
Task: T03-delete-legacy-storage

- Remove obsolete Table settings and provisioning code
- Delete the verified dedicated legacy account after Cosmos cutover
```

## Progress
- [x] Implementation complete: old Table settings removed and only the dedicated `stdexescape384874bc` account deleted.
- [x] Validation passed: deployment tests 26/26, lint, production build, Azure resource/settings check, anonymous API redirect (302), and user-confirmed Cosmos records remain available.
- commit: pending