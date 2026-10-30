# Decisions: Azure Company Game Deployment

- Date: 2026-10-30
- Status: Confirmed
- Feature slug: `azure-company-game-deployment`
- Stage: Interview complete; no cloud resource creation, source implementation, Git push, or deployment performed during this interview.

## D01. Deployment access
- **Chosen**: Provide an internet-accessible HTTPS URL. Require authentication through the company's Microsoft Entra tenant before accessing the game or shared record services; a VPN or company-network restriction is not required.
- **Source**: User selected option 1 for deployment access.
- **Rationale**: Employees can use the game from home or mobile while access remains bound to the company identity provider.

## D02. Hosting and cost scope
- **Chosen**: Create a new dedicated Azure Static Web Apps resource on the Standard plan. Use a separate game resource group and dedicated storage, without repurposing another existing application's resources. Use the Azure-provided HTTPS `azurestaticapps.net` hostname for the first release; custom DNS/domain work was not requested.
- **Source**: User selected option 1 for a new Standard resource, with potential charges disclosed. Dedicated resource isolation and the initial provider hostname are implementation choices.
- **Rationale**: Standard supports the selected custom company-tenant authentication, and a separate application avoids overwriting another hosted project. Standard hosting and additional storage usage can incur costs; no exact fixed monthly total was promised.

## D03. Login audience
- **Chosen**: Allow all accounts that can authenticate in the configured company tenant, including guest accounts registered in that tenant. Do not add a selected-user or selected-group allowlist in this release. Reject personal Microsoft accounts or other tenants unless they are valid guests of the configured tenant.
- **Source**: User selected option 1 after the guest-account inclusion was explicitly explained.
- **Rationale**: This is a tenant-wide internal game rather than a department-specific application.

## D04. Company-wide leaderboard
- **Chosen**: Add a server-backed leaderboard visible to authenticated company users. Keep one best performance per account and display the top ten.
- **Source**: User selected option 2 to include a company-wide shared leaderboard; per-account best and top ten follow the existing game decisions and code.
- **Rationale**: A browser-local leaderboard cannot compare records from different employees or devices.

## D05. Cross-device stage unlocks
- **Chosen**: Store the highest actually cleared stage on the server per authenticated account. Restore unlocked stages after login on another PC/browser/mobile device. This is stage-unlock restoration, not resuming an unfinished run or restoring its current score, position, or remaining clock.
- **Source**: User selected option 1 for server-backed rankings and cleared-stage progress.
- **Rationale**: Employees should not have to clear the same stages again merely because they changed devices.

## D06. Release workflow
- **Chosen**: Use the existing GitHub repository `https://github.com/Hyeongdae/edu.git`, production branch `main`, with GitHub Actions. Changes pushed to main deploy automatically after the required build and tests succeed. Include the first release of the latest local game code in this deployment work.
- **Source**: User selected option 1 for automatic deployment after main-branch verification. The repository and branch were read from Git.
- **Rationale**: Later fixes can follow the same repeatable workflow. Preserve the same Static Web Apps resource and public hostname on subsequent deployments; do not recreate the site or clear its shared records on each release.

## D07. Initial shared data
- **Chosen**: Start the new shared service with no leaderboard entries and a highest-cleared-stage value of zero for each new account, which opens stage one. Do not import existing local test scores, local demo identities, or local stage unlocks into shared production data. Do not erase the old local test data as part of this initialization.
- **Source**: User selected option 1 for everyone starting with new shared records at stage one.
- **Rationale**: Local testing includes browser-specific identities and development records; the company leaderboard should start from actual production play.

## D08. Hosted authentication architecture
- **Chosen**: In the deployed app, use Static Web Apps custom Microsoft Entra authentication with the existing single-tenant app registration and an issuer bound to the configured tenant, never `common` or `organizations`. Protect both game routes/assets and `/api/*` through hosting configuration. Use the hosted session and `/.auth/me` to bootstrap the production UI instead of requiring a second independent MSAL login after hosting authentication.
- **Source**: Implementation decision based on the chosen access restriction and current client-only AuthGate.
- **Rationale**: Browser-only MSAL gating does not enforce access at the hosting/API boundary. One hosted identity should drive the game, personal progress, and shared ranking.
- **Implementation constraints**: Retain the existing local-development MSAL and development-only demo modes. Add the deployed HTTPS web authentication callback to the existing registration while preserving its existing SPA callbacks. Keep the registration single-tenant. Configure the provider to expose a verified name claim as user details for the leaderboard, and verify the actual principal during release validation; use verified platform user details as a fallback, never an arbitrary submitted display name.

## D09. Backend and storage
- **Chosen**: Add same-origin HTTP APIs using Azure Static Web Apps managed Azure Functions with the supported `node:22` runtime. Store production player records in dedicated Azure Table Storage, not in a browser-accessible storage endpoint. Use a supported Node 22 version for the API and CI build; the current Vite dependency requires Node `^20.19.0 || >=22.12.0`.
- **Source**: Implementation choice based on the existing React/Vite client and the supported managed API/runtime model.
- **Rationale**: This provides a small server component for authentication-aware shared records without introducing a general-purpose game server or SQL schema.
- **Data boundaries**: Keep one player profile/best-record entity per hosted account, including highestClearedStage separately from the best attempted-stage result. Records are scoped to this game/environment. The server resolves identity from the platform-authenticated principal; a request's accountId, user name, or tenant field cannot select another player's row.
- **API responsibilities**: Read the authenticated player's profile, read shared top-ten rankings, and accept that player's result snapshots. Expose no general listing of secrets, arbitrary-account update route, or unauthenticated data access. Do not store every keystroke or add mid-run cloud saves as part of this feature.

## D10. Score/progress semantics and concurrent writes
- **Chosen**: Preserve the existing ordering: higher attempted stage, then higher score for that stage, then greater remaining centiseconds; fully tied performances keep the earliest server-accepted achievement. Save the best stage/score/time as one performance tuple, not independent maxima taken from different runs. Equal/worse submissions do not replace a personal best or its achievement time.
- **Source**: Existing `leaderboard.ts`, `stageResult.ts`, game rules, and earlier confirmed ranking decisions.
- **Rationale**: A shared leaderboard must retain the comparisons the game already shows, including attempted stages that ended in capture or timeout.
- **Implementation constraints**: Freeze and submit each result when the stage outcome is determined, before the optional exit/overtime visual sequence finishes. Update highestClearedStage only for an actually cleared stage; never infer clears from a ranking's bestStage. Highest clear is monotonic and unlocks through `min(5, highestClearedStage + 1)`. Use server-owned achievement timestamps and concurrency control/conditional writes so simultaneous devices and retried submissions cannot lower progress, duplicate a ranking row, or replace a stronger best. Monotonic best/progress merging must be idempotent.

## D11. Server validation boundary
- **Chosen**: Validate the authenticated actor, stage bounds/unlocks, non-negative integral score, stage-specific score/outcome consistency, and remaining centiseconds against the shared rules. Use server-controlled identifiers and storage decisions. Keep the client game engine for movement, pursuit, scoring, and animation.
- **Source**: Necessary implementation boundary for moving the existing local result model behind a shared API.
- **Rationale**: API callers must not be able to update another employee's identity or store malformed/out-of-range records.
- **Limit**: This release accepts client-computed result snapshots after validation. It is not a server-authoritative replay system or a guarantee against all client score manipulation. A prize-bearing or adversarial competition would require a separate stronger validation design; that additional system is not silently included here.

## D12. Loading, failures, and local data separation
- **Chosen**: Load the hosted identity and personal server profile before creating the corresponding ready-state stage selection. Do not mount a permanent zero-progress profile while an asynchronous server read is still pending, or overwrite remote progress after a failed read.
- **Source**: Code-derived constraint: current GameScreen initializes game state synchronously from browser storage.
- **Rationale**: Otherwise an employee with server-side unlocks could incorrectly see stage one after logging in on a new device.
- **Failure behavior**: Preserve the existing principle that a record-storage failure does not trap the player in a finished screen. Report shared save/load failures clearly and provide retry; queue pending submissions under the current account/environment and retry in order without duplicating or losing successful writes. If an initial profile cannot be obtained, show a retryable loading/error state rather than silently presenting an empty official profile. Do not transfer another account's pending records after a user switch. Keep local-development records, production cache, and pending shared writes in distinct namespaces. No global localStorage/sessionStorage clear or automatic legacy upload.

## D13. Credentials and cloud configuration
- **Chosen**: Configure the hosting provider's credential, storage access credential, and deployment credential only in their appropriate server/platform or GitHub Actions secret settings. Source files and public VITE-prefixed environment values must not contain client secrets, storage connection strings, or deployment tokens. The existing browser SPA registration values are not an acceptable place for a server secret.
- **Source**: Implementation requirement for the chosen managed authentication, backend, and CI services.
- **Rationale**: Public client bundles cannot keep server credentials confidential.
- **Operational scope**: Add only credentials/settings needed by this game, document ownership and expiration/renewal when a credential expires, preserve unrelated app credentials and redirects, and avoid printing secret values in tools or logs. Verify the active Azure subscription and tenant before resource writes; use the existing authorized company subscription rather than creating a subscription or changing billing ownership. Current read-only context was `CR-Project-01`, enabled, with a tenant matching the project's configured tenant. Resource availability, permissions, and name uniqueness must be rechecked during execution.

## D14. Deployment completion and verification
- **Chosen**: The implementation phase must deliver an actual HTTPS URL serving the current game, an active main-branch deployment workflow, protected authenticated API access, shared top-ten records, and cross-device clear restoration. A local server URL, an empty Azure resource URL, or a build-only result does not fulfill the deployment request.
- **Source**: User request to create a deployment URL plus the selected shared-record scope.
- **Rationale**: The URL is useful only when the game and its chosen company-wide functions are deployed and working.
- **Checks**: Verify build/config artifact placement, production demo bypass disabled, anonymous/foreign-tenant access rejection or company-login redirect, company-account sign-in, authenticated record read/write, denied cross-account writes, score/time ordering, concurrent/idempotent writes, stage unlock restoration, and the successful main-branch release. Keep actual cloud resource identifiers/URL and CI run evidence in the release task. Distinguish a configuration check from an actual signed-in browser check; if an execution tool or approval review blocks a check, record the limitation rather than claiming success. Do not request passwords or MFA codes.

## Existing code and environment facts
- The app is a Vite/React/TypeScript static client with MSAL Entra login, a development-only local demo branch, and no tracked deployment workflow, backend API, or Static Web Apps configuration yet.
- `.env.local` contains configured Client ID/Tenant ID/redirect settings and is ignored by Git. The existing Entra registration was readable, named `Stair-Climb-Game-Local`, with signInAudience `AzureADMyOrg`, two SPA callbacks, no web callback, and appRoleAssignmentRequired false. Identifiers and secrets are intentionally not copied into this decision file.
- Azure CLI was found at `C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd`; its current authenticated tenant matched the project. The subscription contains other hosted applications; these are not targets to overwrite.
- Git's configured origin is Hyeongdae/edu and branch main. At inspection the local branch was 83 commits ahead of its cached origin/main reference; this is not a fresh remote-fetch assertion. Before the first release, inspect/fetch the remote state, safely synchronize the intended game history, and avoid force-pushing unrelated remote work.
- `src/leaderboard/leaderboard.ts` currently stores per-account best performance in browser storage and sorts the top ten. `LeaderboardPanel.tsx` explicitly labels the list `THIS BROWSER`; the hosted UI must describe the company-shared scope.
- `src/game/stageProgress.ts` stores highest actual clears separately from ranking stage. `GameScreen.tsx` reads this synchronously during initial state creation and saves on stage-result effects, so hosted asynchronous profile initialization and storage adapters are required.
- Main descent ranking key is currently `stair-descent:leaderboard:v2`; progress key is `stair-descent:stage-progress:v1`. Existing local migrations must not become production import or reset logic.

## Findings outside the selected feature expansion
- The previously noted App.test.tsx initial-screen assumptions and bundle-size concern exist independently of this request. Update authentication/app-shell assertions where the hosted-session changes directly require it, but do not add an unrelated UI redesign or general bundle-performance project.
- Basic API validation does not constitute full anti-cheat protection; stronger authoritative gameplay validation is a separate scope if required later.
- No custom domain, selected employee-group access, live ranking push notifications, admin reset console, local-data migration, or new gameplay rules were requested.

## Primary references checked on 2026-10-30
- [Custom authentication and tenant-specific Entra registration](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom)
- [Hosted user information and authenticated API principal](https://learn.microsoft.com/en-us/azure/static-web-apps/user-information)
- [Managed Azure Functions API support](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions)
- [Configuration, protected routes, and API runtime selection](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration)
- [Supported runtimes, including Node 22](https://learn.microsoft.com/en-us/azure/static-web-apps/languages-runtimes)
- [GitHub Actions build and deployment configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration)
- [Azure Table Storage data model](https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview)

## Next workflow step
Run `/memory-plan azure-company-game-deployment` to create the implementation and release blueprints. This interview does not advance `.memory/current.md` or provision/deploy resources.
