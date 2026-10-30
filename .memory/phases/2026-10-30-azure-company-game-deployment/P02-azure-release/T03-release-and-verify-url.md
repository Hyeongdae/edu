# Task: T03 Release and Verify URL

## Status: pending

## Goal
최신 main 게임/API를 실제 Azure에 배포하고 회사 로그인·공유 기록·다른 기기 해금 복원을 검증한 뒤 사용 가능한 HTTPS URL을 전달한다.

## Decision Summary
- Precondition: P01 and P02-T01/T02 complete. deploy/azure.resources.json contains actual owned Standard site/host, runtime auth/storage settings and GitHub release secret/vars prepared.
- Existing repo Hyeongdae/edu/main automatic production deployment authorized; URL is usable only when actual game and shared APIs work.
- No force push, unrelated resource/data destruction, fabricated company identities/test leaderboards. No passwords or MFA codes in chat.

## Implementation

### I01. Review and release exact source
- Related Files:
  - `.github/workflows/azure-company-game.yml` :: actual run/gates; read-only unless necessary scoped failure correction.
  - `deploy/azure.resources.json` :: actual target; read-only.
  - `deploy/RELEASE.md` :: deployed SHA/run/URL/verification/renewal; new.
  - `README.md` :: non-secret production link and operator instructions; modify.
  - `.memory` this task/phase/plan/current :: final evidence/progress; modify.
  - Any application/config file needing actual release repair must be identified explicitly with tests; do not redesign other features.
- Git cached main was83 commits ahead origin/main when plan was written. Now fetch origin read-only and inspect current remote/local graph and diff, intended game/history, ignoredsecret status. Do not assume cached ref is still current.
- Preserve remote commits if diverged, integrate safely with reviewable merge/rebase as appropriate without force pushing/shared history loss; rerun relevant tests for actual conflicts/changes. Do not discard user changes or stage unrelated untracked .agents/chrome profiles/local DBs.
- Scan intended tracked source/artifact contents and outbound commit history for credential patterns using redacted output. Never echo matching secret lines. Ignore-file presence alone doesn't prove earlier commits lack secrets. If real credential accidentally appears, stop release of that credential-bearing history, remediate concretely within scope and report needed rotation; do not publish it.
- Confirm GitHub auth has actual push and Actions secrets permissions; connector read permission isn't sufficient. Use prepared gh and setup-git if needed for own account, no token embedded in remote URL.
- Full release gate:
  - root npm ci, api npm ci.
  - npm run test -- --run --maxWorkers=2; npm --prefix api test; npm --prefix api run test:integration.
  - npm run test:deployment; npm run lint; npm --prefix api run build.
  - hosted frontend build and strict config build with verified ENTRA_TENANT_ID, restore process env; git diff --check.
- Do not unnecessarily repeat green tests if exact sources already validated and CI reruns the same gate; repeat only for new changes or unresolved concerns. CI remains required.
- Push reviewed main without force using existing origin. Observe exact HEAD SHA's workflow run and jobs using gh. Use run ID/headSha, not just latest overall run. Failure means inspect sanitized logs, fix tested scope, commit and re-release; no claim of success for failed/skipped deploy.
- Verify Actions deploy reads new site's token, production branch and host; API package path/runtime/dependencies match. The deploy job success alone isn't full sign-in/data acceptance.

### I02. Anonymous and configuration probes
- Retrieve actual deployment host from Azure/manifest, confirm TLS and matching resource/site. Anonymous "/" and known game asset/API paths must deny/redirect into company provider; an unauthenticated200 login portal page is not the game.
- Request /api/profile and /api/results anonymously; no personal/shared JSON or write allowed. Send forged x-ms-client-principal externally to check platform strips/rejects it, not an impersonated successful write. Never persist fake account records.
- Confirm exact tenant issuer, AzureADMyOrg app, Standard config active, company callback registered; foreign/non-guest personal accounts restricted by provider. Without an available foreign test account, clearly label provider/config assertion vs actual foreign-account login test.
- Verify custom source-test/preview paths unavailable, no accidental local demo bypass in production: Vite PROD/DEV branch and artifact check, absent public VITE secrets, no local dev auth bypass path. Do not request public anonymous access just to simplify tests.
- Build/artifact credential checks compare only secret fingerprints/memory boolean results, never print secretvalues or wholecompiledmatches. Do not expose deployment configuration tokens in RELEASE.md.
- Same-origin API JSON auth/error handling remains correct after session expiry; no SPA fallback converted to profile JSON.

### I03. Real authenticated play and records
- **Data & Schema Fields**:
  - Actor = actual verified SWA aad userId/userDetails. profile {accountId,displayName,highestClearedStage,best}; ranking entries contain server-owned performance tuple/achievement time.
  - New account profile defaults highest0/stage1, not inherited browser demo records.
  - Capture deployed source SHA, workflow run URL, UTC/KST verification time, methods(pass/failed/not performed) and safe evidence location.
- **Execution Flow / Logic**:
  1. Use an allowed browser tool if available; otherwise give user concrete one-time actual company browser/login verification steps after deploy preparation. Never request passwords/MFA or copy session cookies into chat.
  2. Actual company sign-in reaches title "덱스 탈출 넘버원" and exact subtitle; game start opens stage selection. No duplicate MSAL login. Verified display name appears sensibly; if v2 name mapping differs, fix provider claim mapping using verified claims, not submitted names.
  3. With new shared account stage1 is open, no legacy local demo scores. Play a real clear and capture/failure as appropriate; outcome is saved before optional office/exit scene completes. Show pending/error/retry without blocking finished/continue/quit.
  4. Check authenticated profile/leaderboard response and one best row for current account. Highest actual clear opens nextstage, failed attempted stage does not grant extra clear. Do not fake "cleared" requests to skip production gameplay or seed leaderboard.
  5. Sign into same account in independent browser/profile/device with separate browser storage and no queue/localStorage copied. Verify server profile restores highest clear and unlocked next stage. Two tabs sharing one localStorage are not sufficient proof.
  6. Verify FIFO/retry identity separation and monotonic behavior from meaningful API/store tests plus observed real save. Race tests may use isolated emulator/injected actors; never create fake employee rows on production or alter other employees' records.
  7. Top-ten order is higher stage, score, remaining centiseconds; exact tie firstserveraccepted. Check comparator/emulator evidence, actual live display and real own profile. Do not intentionally poison production by submitting invented high scores for sorting tests.
  8. Check signout/new account isolation where two genuine consenting sessions available; otherwise record automated account-switch proof and live-check limitation explicitly.
- Browser limitation: on2026-10-30 automatic approval review rejected a prior standalone headless Chrome launch as "blocked by policy". Do not retry same rejected action via another launcher. Distinguish actual permitted signed-in check/manual user confirmation from jsdom/HTTP/config checks; record any unverified part.
- Essential completion requires actual company login + successful server result save + independent-storage restore. If these need user interaction, keep Task pending with URL and exact needed check; do not mark full plan done from infrastructure alone. Optional multiaccount/foreign-account visual evidence may be transparently limited when fixtures/config prove corresponding invariants.

### I04. Release evidence and finish
- deploy/RELEASE.md includes: game title, actual HTTPS link, resource/region/Standard scope, repository/branch, deployed source commit, successful Actions run URL, validation results and distinctions, server profile/restore checks without exposing employee email/token, credential keyId expiry/renewal procedure, known limitations.
- README links actual production game and says company Entra sign-in including registered tenant guests required; local demo path remains documented separately.
- Initial release serves correct source even if subsequent docs/progress commit changes HEAD. Clearly record deployed app SHA; main docs commit may trigger one more validated identical-app release and record final successful run if needed. Do not make a cosmetic code change solely to prove automation.
- Keep cloud resources/token/hostname stable for future main pushes; no data clearing or rebuilding dedicated storage for each release. Never deploy whole project folder as static web content.
- Mark T03 done and P02done3/3/plan7/7 only after essential checks. memory-execute should use normal scoped commit/sync and clear Active Task; preserve historical current context. Final user response gives clickable actual URL and company-login note, plus any material verification limitation.

## Acceptance Criteria
- [x] Reviewed game and API are live at actual HTTPS Azure URL; deployed SHA and passing deploy run are recorded in `deploy/RELEASE.md`.
- [ ] Anonymous/forged-principal requests redirect to Entra; actual company login and successful API access remain to be confirmed.
- [ ] Real result storage and independent-session stage restore remain to be confirmed after company login.
- [x] No local legacy import, unrelated resource modification or secret exposure; main push triggered CI and deployment.
- [x] Evidence separates automated/anonymous HTTP checks from browser/account checks; user has the live URL.

## Validation
- Full/appropriate source gates above and actual successful GitHub run for recorded SHA.
- Sanitized HTTP anonymous/auth tests; actual company-browser login and server save; independent-storage profile restore.
- `npm run test:deployment`; `git diff --check` for documentation/manifest accuracy.
- Validate every README/RELEASE URL against actual Azure target and Actions repository/run; no placeholders or localhost as deployment result.

## Commit Message
```text
docs(release): verify company game deployment and publish the production URL

Plan: 2026-10-30-azure-company-game-deployment
Phase: P02-azure-release
Task: T03-release-and-verify-url

- Record the deployed main revision and successful workflow
- Verify company login shared records and cross-device stage unlocks
- Document the live URL and credential renewal ownership
```

## Progress
- [x] Production build and release completed for SHA `8c01fed3e00d90ed4d8f1df1d485098506306460`; Actions run [40998761290](https://github.com/Hyeongdae/edu/actions/runs/40998761290) succeeded.
- [x] Root 1269, API 95, API integration 10, deployment 25 tests; lint, API build, hosted frontend build, artifact verification passed.
- [x] Anonymous root/profile/leaderboard and untrusted-principal profile requests redirect to Entra.
- [ ] Real employee login, score write and independent-storage unlock restore need the user's authenticated browser session.
- commit: initial release `8c01fed`; release notes pending

## Next
Open the production URL in the user's company browser, sign in, play/save one result, then verify the account's profile and cleared-stage unlock from a fresh browser or device. Only then mark T03 done and advance `.memory/current.md`. Performance optimization remains deferred by user choice.
