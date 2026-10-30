# Task: T01 Deployment Config and Workflow

## Status: pending

## Goal
실제 배포에 필요한 보호 설정·CI 산출물·재실행 가능한 배포 도구를 만들고, 클라우드 변경 없이 검증한다.

## Decision Summary
- Precondition: P01 complete. Frontend hosted auth uses VITE_AUTH_MODE=azure-static-web-apps, APIs built to api/dist/index.cjs with production dependencies.
- Company tenant custom Entra requires chosen SWA Standard; tenant-specific issuer, default HTTPS domain; main validation then automatic production deploy.
- This Task creates code/config only. No Azure resource/auth changes, credentials, GitHub secret changes or push.

## Implementation

### I01. Protected production config generation
- Related Files:
  - `deploy/staticwebapp.template.json` :: auth/routes/platform template; new.
  - `scripts/build-staticwebapp-config.mjs` :: config generator/CLI; new.
  - `scripts/build-staticwebapp-config.test.mjs` :: node:test cases; new.
  - `package.json` :: build:swa-config/test:deployment scripts; modify.
  - `.env.example`, `.gitignore`, `README.md` :: hosted/local env and generated files; modify.
- **Signatures & Types**:
```typescript
// JS module exports and documented structural types
buildStaticWebAppConfig(template: object, tenantId: string): object;
writeStaticWebAppConfig(options: {
  templatePath: string; outputDirectory: string; tenantId: string;
}): Promise<void>;
```
- Input tenant via `ENTRA_TENANT_ID` (not secret, CI variable), UUID validated. CLI output only success/path; no env dump. No missing/invalid tenant fallback. Build writes config AFTER Vite build empties dist, to `dist/staticwebapp.config.json`.
- Template custom provider `auth.identityProviders.azureActiveDirectory.registration`: openIdIssuer=https://login.microsoftonline.com/<tenant>/v2.0, clientIdSettingName=AZURE_CLIENT_ID, clientSecretSettingName=GAME_ENTRA_CLIENT_SECRET. Explicit provider userDetailsClaim="name" for v2 verified name; actual returned name must be tested in P02-T03. No "common"/"organizations"/clientsecretvalue.
- `platform.apiRuntime="node:22"`. Ordered route rules: production local-test/preview endpoints (e.g. /descent-test*) return404; /api/* requires authenticated and no-store; /* requires authenticated. SWA built-in /.auth endpoints must remain usable by platform, not custom rewritten.
- This game uses a single root screen, not a history router: omit navigationFallback to avoid fallback bypass/confusion for protected assets and API failures. Unknown routes stay404. 401 response override may redirect302 to /.auth/login/aad; API client already detects manual redirect and auth-required. Do not turn failed API JSON into index.html.
- Browser/public config references server setting NAMES only. No .env, .memory, source screenshots, local demo entry, credentials or storage URIs in uploaded web root.
- Verify via tests exact route order/root/assets/API and no navigation fallback. The config is not live access proof until release.

### I02. Validated main-branch GitHub Actions
- Related Files: `.github/workflows/azure-company-game.yml` :: verify/deploy jobs; new.
- Triggers push main and pull_request to main, optional workflow_dispatch; deploy only push main (manual production rerun can target same verified main SHA explicitly), repository var `AZURE_DEPLOY_ENABLED == 'true'`. No pull_request_target, previews, fork secret exposure or branch auto publishing.
- permissions contents:read; concurrency one production release, cancel-in-progress false so result remains traceable. Separate verify/deploy with needs gate.
- Latest official release tags read at planning: checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2, download-artifact v8.0.2. Pin those verified tags or immutable commit SHAs for those releases; Azure/static-web-apps-deploy@v1. Node22.x >=22.12.
- Verify job: npm ci(root), npm --prefix api ci, root lint, full root tests --run --maxWorkers=2, API unit/integration, API build, helper node:test, hosted root build. No API tests skipped because Azurite unavailable. No secret required for PR build.
- Runtime frontend uses hosted flag only, server setting references generated later. PR config unit tests use explicit dummy UUID fixtures, not substitute production default.
- Package root dist plus API staged `release/api`: host.json, package.json/lock, dist/index.cjs, and production node_modules. Run production npm ci --omit=dev after API tests and copy ONLY allowlisted runtime files/dependencies; tests/src/local.settings/dev emulator absent. Avoid flattening main path or uploading root source.
- Deploy job downloads artifact from verify for exact SHA, checks required files, runs config generator with real ENTRA_TENANT_ID, rejects missing var. Azure action: app_location=dist, api_location=release/api, output_location="", skip_app_build=true, skip_api_build=true, production_branch=main. Action uploads prebuilt artifacts; no second differently configured build.
- API production package requires dependencies already included; test staging main exists and production dependencies resolve. Runtime22 matches config and package.
- repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN` only action secret input. No token to echo, output artifact or public VITE. repo var ENTRA_TENANT_ID and AZURE_DEPLOY_ENABLED (false/unset means no deploy). Artifacts exclude private files; retained only needed release evidence.
- Use same app/resource/token for later main pushes. Workflow doesn't recreate/reset resources/table.

### I03. Default-plan-only provisioning tooling
- Related Files:
  - `deploy/DeploymentPlan.psm1` :: Get-DeploymentPlan/Merge-EntraWebRedirects/manifest allowlist; new.
  - `deploy/Deploy-DexEscape.ps1` :: explicit Apply provisioning coordinator; new.
  - `scripts/deployment-plan.test.mjs` :: pure PowerShell fixture verification; new.
  - `eslint.config.js` :: scripts Node globals; modify.
- **Signatures & Types** (PowerShell public parameters/objects):
```text
Get-DeploymentPlan -SubscriptionId <string> -TenantId <string> -ClientId <string>
  -ResourceGroup <string> -Location <string> -StaticSiteName <string>
  -StorageName <string> -Repository Hyeongdae/edu
Merge-EntraWebRedirects -Existing <string[]> -Callback <https-url> -> string[]
Deploy-DexEscape.ps1 [-Apply] [-AzureCliPath <path>] [-GhPath <path>]
  [-ManifestPath deploy/azure.resources.json] [-Location eastasia]
```
- No Apply => only plan/sanitized output, no cloud/credential/gh mutation and no file containing secrets. Plan supports preflight separately and uses explicit subscription per command, not global account changes.
- Defaults: rg-dex-escape-prod, unique swa-dex-escape-prod-<suffix>, storage stdexescape<suffix> (lowercase alnum <=24). Standard explicit; region eastasia subject to actual support. Persist names to manifest after successful apply for idempotent rerun.
- Existing resource reused only if manifest+ownership tags project=dex-escape/repository=Hyeongdae/edu/environment=production match; foreign/untagged name collision fails rather than adopting or deleting.
- Expected manifest schema:
```typescript
interface DeploymentManifest {
  schemaVersion: 1; repository: "Hyeongdae/edu"; branch: "main";
  resourceGroup: string; location: string; staticSiteName: string;
  storageAccountName: string; tableName: "DexEscapePlayers";
  sku: "Standard"; defaultHostName: string; url: string;
  tenantFingerprint: string;
  credential: { keyId: string; expiresAt: string };
}
```
- Do not include client secret/deployment token/connection string/login token or raw CLI responses in manifest. Full tenant/client/subscription IDs need not be tracked; load operator config from ignored .env.local/current verified session.
- T02 will execute tool: new RG/site/storage/table, preserve registration callbacks and append credential, app settings safe body file, gh secret via stdin. Tool must implement preflight and safe owned-resource rerun, no broad delete/global overwrite.
- Secret operations: temporary directory outside repo with user-private Windows ACL; exact owned absolute paths checked before cleanup. Pass JSON as `az rest --body @<private-file> --output none` (not shell-interpolated JSON), merge existing settings. Send gh secret via stdin. No secret CLI args, shell transcript/debug prints. Capture stderr privately/redact before reporting.
- Only server runtime settings: AZURE_CLIENT_ID, GAME_ENTRA_CLIENT_SECRET, GAME_RECORDS_CONNECTION_STRING, GAME_RECORDS_TABLE. GitHub deployment token separate.
- Pure tests call powershell.exe on Windows/pwsh on Linux, import module, supply fixtures; cover URI union/preserve SPA, Standard explicit, owned resource detection, invalid names/tenant, manifest secret rejection, default no writes using mocked commands. No real Azure connection or credential in CI tests.
- README explains local behavior, company audience including guests, fresh shared data, exact release steps, same-origin session, credential expiry and account-specific pending queue, cost scope. No custom DNS or performance refactor.

## Acceptance Criteria
- [ ] Production config exists in final dist, tenant specific and all game/API access protected.
- [ ] main deploy consumes the exact successfully tested frontend/API artifacts, PR cannot publish.
- [ ] Provision command defaults to harmless plan and preserves foreign resources/credentials.
- [ ] Tests run with no production secrets or cloud writes.

## Validation
- `npm run test:deployment` — node --test scripts/build-staticwebapp-config.test.mjs scripts/deployment-plan.test.mjs.
- `npm run test -- --run --maxWorkers=2`; `npm --prefix api test`; `npm --prefix api run test:integration`.
- `npm run lint`; `npm --prefix api run build`; hosted `npm run build` then `npm run build:swa-config` with explicit test UUID in process env, restore env afterwards.
- `powershell.exe -NoProfile -File deploy/Deploy-DexEscape.ps1` — PlanOnly, no actual creation/secret changes.
- Validate workflow/YAML structure, artifact allowlist and production dependency resolution; `git diff --check`. Local checks are not successful GitHub-run evidence.

## References
[Custom provider](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom), [configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration), [build/action options](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration). Recheck supported schema if execution detects version changes.

## Commit Message
```text
ci(azure): prepare protected hosted artifacts and validated main deployment

Plan: 2026-10-30-azure-company-game-deployment
Phase: P02-azure-release
Task: T01-deployment-config-and-workflow

- Generate tenant-bound SWA config after frontend build
- Gate production release on frontend and API verification
- Add plan-first scoped provisioning tooling
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending

## Next
P02-T02-provision-company-resources. Do not push the workflow until its target/secrets are ready.
