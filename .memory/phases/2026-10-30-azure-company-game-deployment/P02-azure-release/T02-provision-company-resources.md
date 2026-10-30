# Task: T02 Provision Company Resources

## Status: done

## Goal
정확한 회사 구독과 저장소 권한을 확인한 뒤 전용 Azure 리소스와 Entra/SWA/GitHub 설정을 실제로 준비한다. 아직 Git push나 사이트 릴리스는 하지 않는다.

## Decision Summary
- Precondition: P01 and P02-T01 complete; PlanOnly/Apply tool and tested workflow available.
- 이미 사용자가 새 Standard/전용 저장소 비용, 회사 테넌트 전체(등록 guest 포함), main 자동 배포를 선택했다. 같은 범위에 대해 다시 허가를 묻지 않는다.
- 다른 게임/리소스/등록 callback/기존 credential은 유지한다. 최신 게임을 덮어쓸 빈 사이트가 아니라 T03의 실제 배포 대상으로 준비한다.

## Implementation

### I01. Authenticated capability preflight before paid writes
- Related Files:
  - `deploy/Deploy-DexEscape.ps1` :: preflight/Apply; modify only if verified provider behavior requires correction.
  - `deploy/DeploymentPlan.psm1` :: settings/manifest merge; modify if needed.
  - `.env.local` :: existing tenant/client IDs read-only, never tracked/printed.
  - `deploy/azure.resources.json` :: sanitized actual manifest; new after successful apply.
  - `README.md` :: actual non-secret prerequisites/rotation note; modify if needed.
- Azure CLI absolute path `C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd`; local account read showed subscription CR-Project-01 enabled and tenant matching .env.local, but recheck now. Assert subscription ID/current tenant/app IDs internally, output only name/boolean checks. Every resource command explicitly uses verified subscription; never change billing/global account for convenience.
- Existing Entra application displayName Stair-Climb-Game-Local, signInAudience AzureADMyOrg; currently two SPA callback URIs and zero web callbacks. Resolve object ID from configured client ID; do not find by display name alone or create a duplicate app. Assert tenant and app ownership/edit permission.
- Git remote expected https://github.com/Hyeongdae/edu.git, production main. Current connector can read but reports push/admin false; it cannot set Actions secrets. Prefer connector for sufficient read operations, use authenticated gh fallback for write/secret capabilities.
- gh absent in checked PATH/standard locations at planning. If still absent, install official GitHub CLI portable Windows binary under user-local tool path, not repo/source. Latest checked v2.103.3; select architecture correctly and verify published checksum/digest before use. No policy/permission bypass.
- Authenticate user's intended GitHub account with browser/device flow if necessary, verify repo push and Actions secrets/variables access BEFORE paid resource creation. No passwords/MFA/tokens requested in chat. A missing write token is a genuine access dependency; keep this task pending with clear next login action if it cannot be obtained.
- Check Azure create rights and Graph app-update/addPassword rights; fail early on403, no speculative destructive tests. Verify eastasia SWA Standard/storage availability; if unsupported, use a supported same-tenant region without touching other resources and record actual choice. No new subscription or changed billing owner.
- No require_escalated shell option is available in this environment; use current authorized tools, never invent an approval flow.

### I02. Scoped resources and fresh private data
- **Data & Schema Fields**:
  - Manifest schemaVersion1; repository Hyeongdae/edu; branch main; resourceGroup/location/staticSiteName/storageAccountName/tableName/sku/defaultHostName/url/tenantFingerprint/credential{keyId,expiresAt}.
  - Owned tags project=dex-escape, repository=Hyeongdae/edu, environment=production.
  - Defaults rg-dex-escape-prod, unique swa-dex-escape-prod-<suffix>, storage stdexescape<suffix>, table DexEscapePlayers.
- **Execution Flow / Logic**:
  1. Run tool PlanOnly, review concrete names, then -Apply. It must assert owner tags before any reuse, and reject foreign/untagged collisions. Keep stable names/URL after first creation via manifest.
  2. Create dedicated RG; create SWA explicitly `--sku Standard`, chosen supported location, manual/Other source configuration. Do not authorize Azure to generate/rewrite repository workflow; the checked-in workflow owns deployment.
  3. Create StorageV2 Standard_LRS account, HTTPS-only/minTLS1.2, public blob access disabled; no browser CORS/storage website exposing data. Table endpoint remains server-credential authenticated. Read account credential privately, create DexEscapePlayers once.
  4. Fresh table contains no rows; API absent profile maps to highest0 and stage1. Never import any local records/demo identities. On rerun nonempty dedicated table is retained and not reset; stop to diagnose unexpected ownership rather than delete it.
  5. Capture actual defaultHostName from Azure; public URL=https://<defaultHostName>. It is a target address at this stage, not evidence the game is live.
  6. Provisioning is recoverable after partial failure by reusing owned manifest/resources; do not automatically delete groups/storage on failure. Report sanitized state and failed step.

### I03. Additive Entra and server settings
- **Signatures & Types** (document operator semantics, not public HTTP APIs):
```text
AddGameWebCallback(existingWebUris[], actualHost) -> union with exact
  https://<actualHost>/.auth/login/aad/callback
AddGameCredential(applicationObjectId, expiresInDays=180) ->
  private secretText; trackable keyId/expiresAt only
MergeServerSettings(existingProperties, gameProperties) -> mergedProperties
```
- Read application current web.redirectUris/SPA URIs/audience and password credential metadata, sanitized counts only. Add exact HTTPS web callback to existing URI union; preserve all existing web and SPA callbacks, app permissions and other settings. Keep AzureADMyOrg and existing appRoleAssignmentRequired=false (all tenant members/guests chosen).
- Use Graph `POST /applications/{objectId}/addPassword` with displayName indicating this game's production auth and expires180days. This is additive; never overwrite passwordCredentials or use a credential reset that clears existing keys. Capture secretText privately and save only required server setting; keep keyId/expiration metadata for renewal.
- On rerun retain already-working game credential/settings if present; do not accumulate a fresh credential every invocation. If a new credential is required after lost partial setup, create additive replacement and report old owned orphan metadata; do not remove unrelated credentials.
- Server app settings only:
  - AZURE_CLIENT_ID = existing app registration client ID.
  - GAME_ENTRA_CLIENT_SECRET = new owned app secret.
  - GAME_RECORDS_CONNECTION_STRING = private dedicated storage credential.
  - GAME_RECORDS_TABLE = DexEscapePlayers.
- Retrieve existing SWA app settings privately; merge, never replace unrelated entries. ARM REST: POST `/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/staticSites/{site}/listAppSettings?api-version=2025-05-01` to read; PUT `/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/staticSites/{site}/config/appsettings?api-version=2025-05-01` with body `{properties:{...merged settings...}}` to update. Confirm provider supports this published version before writing. Use `az rest --body @<private-json> --output none`; do not assume CLI --setting-names supports JSON-file syntax. This is the same appsettings collection used by `az staticwebapp appsettings set`; validate API runtime receives the GAME_RECORDS settings after deployment.
- Secret files outside repo with user-private ACL, no debug output/transcript, no interpolated secret command strings. Check owned absolute temp directory before cleanup. Record errors redacted; never print raw Azure settings/secrets list.
- Do not put server credentials in VITE variables/.env.example/Git tracked data. Browser client ID/tenant are public identifiers but not a place for these secrets.

### I04. GitHub release credentials and durable manifest
- Capture `az staticwebapp secrets list` deployment token in private memory; no raw tool result. Send via stdin to `gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo Hyeongdae/edu`. It must target the new site's token, never another existing game.
- Set repository variable ENTRA_TENANT_ID to verified tenant, AZURE_DEPLOY_ENABLED=true only after Azure settings/callback/table are ready. Read/list names to validate existence; do not reveal secret values.
- Token expiration/lifecycle depends on resource; document reset/rotation procedure, not a guessed permanent validity. Entra credential keyId/expiration180days recorded, remind renew server setting before expiry while preserving callbacks.
- Write allowlisted deploy/azure.resources.json from actual returned resources. No secret connection/access/deploy token, no user login token, no raw CLI objects. SHA/fingerprint permitted instead of private tenant ID. Store new resource URL/names/sku and ownedcredential metadata only.
- T03 will push current main. Until then no workflow run or empty site is called a completed deployment. Keep access/preflight results separate from live authentication tests.

### I05. Verify configuration without publishing
- Assert actual SWA sku Standard, default host, same subscription/ownedRG, table account isolation, credential expiry, callback exact union preserving original SPA entries, correct single tenant issuer template and server setting NAMES/presence.
- Verify dedicated table fresh-empty only on first creation; no public anonymous Table access. API still not deployed, so do not claim authenticated result write passed.
- Re-run PlanOnly against manifest: no second resource/key planned when already configured; same host/resource selected.
- Validate GitHub secret/var names exist and tenant matches without revealing values. Public source scan rejects credentials, private temp files removed and only intended non-secret manifest/docs in Git diff.
- Do not run production score-seeding/legacy import/clear as a verification shortcut.

## Acceptance Criteria
- [x] Actual owned Standard site/private table exist in verified company subscription.
- [x] Existing Entra registration gains only needed web callback and game credential; old callbacks/credentials preserved.
- [x] GitHub credentials target correct repository/site and app settings contain no public secret.
- [x] Sanitized manifest supports stable rerun; no game deployment claim before T03.

## References
[SWA application settings](https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings), [appsettings REST 2025-05-01](https://learn.microsoft.com/en-us/rest/api/appservice/static-sites/create-or-update-static-site-app-settings?view=rest-appservice-2025-05-01), [official CLI settings implementation](https://github.com/Azure/azure-cli/blob/dev/src/azure-cli/azure/cli/command_modules/appservice/static_sites.py).

## Validation
- `powershell.exe -NoProfile -File deploy/Deploy-DexEscape.ps1` then explicit `-Apply` with private operator context; final PlanOnly must reuse owned resources.
- Sanitize CLI structured results before tool output; validate actual Standard SKU, ownership tags, verified tenant match, callback/settings presence, table existence. Capture pass booleans/IDs appropriate for non-secret release evidence.
- `npm run test:deployment`; `git diff --check`; manifest allowlist/credential scan.
- If tool code changed in this Task, rerun its relevant tests/lint; if application code unexpectedly needs changes, validate full relevant gate and explain scope rather than silently bypassing P01 contracts.
- Stop pending on missing actual auth/permissions and state exactly what login is needed; never mark provisioning complete from planned names.

## Commit Message
```text
chore(azure): configure dedicated company game hosting and release credentials

Plan: 2026-10-30-azure-company-game-deployment
Phase: P02-azure-release
Task: T02-provision-company-resources

- Record owned Standard site and private records storage metadata
- Configure additive Entra callback and server-only game settings
- Connect the repository release token without exposing credentials
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `df5a933`

## Execution Evidence (2026-10-30)
- Completed with the user's direction to use the existing `grill-me-edu` resource group. Its Contributor role was verified at that group scope; the new game resources were independently tagged. No new group was created.
- Azure account is enabled CR-Project-01 and its tenant matches ignored `.env.local`. Existing `Stair-Climb-Game-Local` is single-tenant and operator is an owner. Before changes: SPA callbacks2, Web callbacks0, password credentials0. Subscription permissions were empty and new-group lookup Forbidden; group-level permissions allowed the selected operations.
- Actual target: `grill-me-edu` / `swa-dex-escape-prod-384874bc` / `stdexescape384874bc` / `DexEscapePlayers` / East Asia / Standard. Site URL: `https://ashy-cliff-0e5e4b600.1.azurestaticapps.net`. Ignored `deploy/azure.resources.json` contains only allowlisted names, URL, SKU, identity fingerprint and Entra credential keyId/expiry (2027-04-28), never credential text.
- Azure created a Standard Static Web Apps site, a StorageV2 Standard_LRS account with public blob disabled, HTTPS-only and TLS1.2 minimum, plus its fresh `DexEscapePlayers` table. No local scores were imported. Site and storage carry Dex Escape ownership tags.
- Added the exact HTTPS `/.auth/login/aad/callback` to the existing Web URI list. Both original SPA redirects remain; app stays single-tenant with assignment-required false. Added one 180-day Entra credential; its keyId and expiry match manifest metadata.
- Server-only SWA settings were fetched privately and verified: client ID matches, app secret and Storage connection string exist, table name is correct. GitHub device login as Hyeongdae succeeded; repository push/admin and Actions secret/variable access verified. The new site's token was sent through stdin; tenant and deploy variables are correct. T02 made no push or workflow run.
- Live checks passed: manifest schema, Standard SKU/hostname, storage safeguards, table, Entra callback/audience/assignment, SPA preservation, credential metadata, four server settings, GitHub secret/variables. Rerun PlanOnly selects the saved target and reports `cloudWrites=false`.
- The original 20 resource names in the shared group are still present. An Azure Automation staging cleanup runbook was published by another operator during this minute; Azure activity logs attribute it to another principal. This task did not alter it or any existing game resource.
- Added `-UseExistingResourceGroup -ResourceGroup <explicit-name>` for deployment into an already-authorized group. It checks the exact group name and scoped RBAC before side effects. Also stopped passing the unsupported subscription argument to `az ad` commands. First real preflight stopped before resource writes on that CLI argument; the fixed retry completed successfully.
- Validation: deployment helpers25/25 (zero skips), lint, diff check, real Apply, live configuration and stable rerun checks passed. No root/game/API code changed. Bundle-size work remains deferred.
- Current hosting target is Azure Static Web Apps Standard with managed Azure Functions API/auth routing. Azure App Service is separate; switching would not remove Azure RBAC and needs a separate planned API/auth migration. [SWA API options](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview/), [App Service docs](https://learn.microsoft.com/en-us/azure/app-service/).
- The hostname is provisioned but awaits the T03 workflow push/release. No live game deployment or company login test is claimed.

## Next
P02-T03-release-and-verify-url. Do not stop the overall deployment objective at this empty-resource milestone.
