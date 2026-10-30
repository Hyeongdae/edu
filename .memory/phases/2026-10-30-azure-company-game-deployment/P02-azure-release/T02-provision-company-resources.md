# Task: T02 Provision Company Resources

## Status: pending

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
- [ ] Actual owned Standard site/private table exist in verified company subscription.
- [ ] Existing Entra registration gains only needed web callback and game credential; old callbacks/credentials preserved.
- [ ] GitHub credentials target correct repository/site and app settings contain no public secret.
- [ ] Sanitized manifest supports stable rerun; no game deployment claim before T03.

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
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending

## Execution Attempt (2026-10-30; awaiting Azure access)
- Task remains pending. No successful provisioning, manifest, recovery journal, resource, credential, callback, server setting, GitHub secret/variable or release was created. Do not advance to T03.
- Actual Azure CLI account is enabled CR-Project-01 and tenant matches ignored .env.local. Existing configured app resolves to Stair-Climb-Game-Local, AzureADMyOrg; operator is an app owner. Snapshot: SPA callbacks2, Web callbacks0, credentials0. Identifiers/tokens were captured privately, not copied into tracked files.
- Microsoft.Web and Microsoft.Storage are registered and both advertise East Asia support; SWA provider exposes API2025-05-01. This proves region/schema availability, not actual deployment permission or a created Standard SKU.
- PlanOnly concrete target: rg-dex-escape-prod / swa-dex-escape-prod-384874bc / stdexescape384874bc / DexEscapePlayers / eastasia / Standard; cloudWrites=false. These are planned names only, not a deployed URL.
- Azure management GET subscription effective permissions returned value=[]; actual group-exists check returned Forbidden. App ownership does not confer Azure resource RBAC. No create attempt is an appropriate substitute for the missing permissions.
- Added deployment permission preflight before GitHub operations/state creation/cloud writes. Initial creation checks subscription scope (including group creation); owned saved reruns check dedicated group scope. Checks required read/write/list-secret operations, supports wildcard or narrower custom roles and respects notActions. Actual Apply now stops with a sanitized missing-permissions error; manifestCreated=false/recoveryStateCreated=false/cloudWrites=false verified.
- Official GitHub CLI v2.103.3 amd64 installed outside repo at %LOCALAPPDATA%/dex-tools/gh-v2.103.3/bin/gh.exe; SHA25698d0cfa794721665d7973dd728c78aff7bd836d58f10f6d7a03568eccb0a22e0 matched GitHub release asset digest. Normal device login completed as Hyeongdae. Actual repo Hyeongdae/edu push/admin=true, Actions secrets public-key and variables-read checks passed; no remote setting changes or push.
- Local validation after preflight change: deployment24/24, zero skipped; lint and diff checks passed. Tests cover empty permissions stopping after two read operations with no state file, scoped/narrow roles and exclusions, plus repeat fake Apply preserving resources/callbacks/settings/credentials.
- Access dependency: ask company administrator for the necessary deployment rights in CR-Project-01, or authenticate a company account that has those rights and the existing app edit capability. Never switch subscriptions/billing owner or grant roles automatically. Recheck permissions on resume, then run PlanOnly/Apply and all I05 actual configuration checks.
- Public references: [GitHub CLI v2.103.3](https://github.com/cli/cli/releases/tag/v2.103.3), [Azure Web RBAC operations](https://learn.microsoft.com/en-us/azure/role-based-access-control/permissions/web-and-mobile). No broader app/game changes; existing bundle warning remains deferred.

## Next
P02-T03-release-and-verify-url. Do not stop the overall deployment objective at this empty-resource milestone.
