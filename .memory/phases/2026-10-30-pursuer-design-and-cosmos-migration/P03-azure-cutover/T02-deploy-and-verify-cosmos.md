# Task: T02 Deploy and Verify Cosmos

## Status: pending

## Goal
Publish the verified Cosmos-backed API/game and prove that a real company Entra account can load its profile, save a result, see the shared ranking, and restore its cleared-stage unlock before any legacy storage is deleted.

## Decision Summary
- Use the existing production Static Web Apps URL/repository/workflow. Keep the Cosmos container and old Table account both available during cutover.
- A mocked API test is not proof of production persistence: wait for a real company-account browser sign-in/result save and verify the resulting profile/leaderboard through the deployed app/Cosmos resource before marking this task complete.

## Implementation

### I01. Build, publish, and verify the exact release

- Related Files:
  - `.github/workflows/azure-company-game.yml` :: verify/deploy jobs — keep the source SHA and verified artifact aligned; modify only if package/API output changes require it.
  - `deploy/RELEASE.md` :: deployed SHA, API backend, workflow run, and verification status — update with non-secret facts.
  - `deploy/azure.resources.json` :: current target identifiers — read-only; no secrets or test-player identities.
  - `api/src/index.ts`, `api/src/handlers.ts`, `src/company/CompanyRecordStore.ts` — runtime path — read-only unless release integration fixes are necessary.

#### Details
- Run the release checks against the exact candidate SHA before publishing:
  - `npm run lint`
  - `npm test -- --run --maxWorkers=2`
  - `npm --prefix api test`
  - `npm --prefix api run test:integration`
  - `npm run test:deployment`
  - `npm --prefix api run build`
  - `npm run build` with the production Static Web Apps auth environment used by CI
  - `npm run stage:api` and `node scripts/verify-release.mjs` with the configured tenant variable.
- Push only the reviewed intended `main` history; never force-push or rewrite remote history. Wait for the GitHub Actions `verify` and production `deploy` jobs to succeed for that exact SHA. Preserve the existing URL `https://ashy-cliff-0e5e4b600.1.azurestaticapps.net` and existing Entra configuration.
- Verify anonymous requests still redirect/protect the app and `/api/profile`, `/api/leaderboard`, `/api/results`; no unauthenticated or caller-supplied account can select another profile. Confirm deployed API settings have the three Cosmos setting names present without printing values.
- Request real company-account verification in the browser: sign in through the existing Entra tenant, load profile/leaderboard, play and submit a valid result, confirm it appears in the company TOP 10/profile, and reopen/refresh or use a separate browser to confirm the saved unlock comes from the same Cosmos profile. Do not ask for or copy passwords/MFA codes, and do not place account IDs or result payloads in the repo.
- Verify the saved item exists in `stair-climb/players`, has the correct hashed `id`, `/accountId` partition value, schema/profile/best fields, and no local test row. Verify API top ten and profile agree with the company app response.
- Keep `stdexescape384874bc` and old Table app settings during all checks. If company login or a real Cosmos write cannot be confirmed, leave this task active and keep the legacy store; do not proceed to T03.

## Acceptance Criteria
- [ ] CI and production deployment succeed for the exact reviewed SHA at the existing URL.
- [ ] Anonymous access remains blocked and a genuine company session can read/write only its own profile.
- [ ] A real submitted score and unlock are visible in Cosmos and the company ranking after reload/another browser session.
- [ ] No data was migrated from the old table; the verified Cosmos records are new post-cutover data.
- [ ] Legacy Storage settings/account remain available until T03.

## Validation
- GitHub Actions run for the exact SHA — all verify and deploy steps succeed.
- Live browser/API smoke — Entra-protected profile, save, ranking, and unlock restore pass with a real company account.
- Read-only Cosmos check — expected target container and saved profile fields are present; no secret or personal account value is logged into repository files.

## Commit Message
```text
release(deploy): publish Cosmos-backed company rankings

Plan: 2026-10-30-pursuer-design-and-cosmos-migration
Phase: P03-azure-cutover
Task: T02-deploy-and-verify-cosmos

- Publish the verified Cosmos API and game build
- Confirm authenticated save, ranking, and unlock restoration
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
