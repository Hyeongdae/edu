# Stair Climb Game ??Azure Release

- Production URL: https://ashy-cliff-0e5e4b600.1.azurestaticapps.net/
- Hosting: Azure Static Web Apps Standard in East Asia.
- Source: `Hyeongdae/edu`, branch `main`.
- Deployed application/API commit: `ae9d9b175a97f73cacc50d3f1d0180bafb3b7be8`.

## Latest release — 2026-11-04

- GitHub Actions: https://github.com/Hyeongdae/edu/actions/runs/41782715701 — verify and deploy succeeded at 15:05 KST.
- Includes account character customization, expanded appearance options, gender visual distinction, and separated mobile infinite-mode touch controls.
- CI passed frontend/shared tests (1784), API tests (198), Cosmos emulator integration tests (13), deployment checks (26), lint, and client/API builds. Client and API were published from the same verified artifact.
- Azure production environment is Ready, with `lastUpdatedOn` of `2026-11-04T06:04:59.747872+00:00`.
- After deployment, anonymous requests to `/`, `/api/profile`, and `/api/leaderboard` returned 302 to Entra sign-in; `/.auth/me` returned 200. Authenticated play, account appearance restoration, and real mobile interaction were not manually verified in this release.

## Historical Cosmos cutover — 2026-10-30

The following workflow and live-data checks document the earlier Cosmos cutover. They were not repeated against production data for the appearance release.
- GitHub Actions run: https://github.com/Hyeongdae/edu/actions/runs/41016497593 ??verify and deploy succeeded.

## Current ranking storage

- Azure Cosmos DB account: `maze-rescue-ms-b7af62a9`.
- Database/container: `stair-climb/players`, partition key `/accountId`.
- Throughput: shared database throughput of 400 RU/s.
- The leaderboard composite index matches the production five-field sort. A direct TOP 10 query succeeded; 14 player profiles passed the expected hashed-ID and schema checks.
- A company account confirmed that its score and stage unlock remain after reloading the deployed game.
- Anonymous requests to the app and record APIs redirect to Entra sign-in.
- No old Table records were migrated.

## Retired ranking storage

- Dedicated Storage account `stdexescape384874bc` was deleted after live Cosmos verification on 2026-10-30.
- `GAME_RECORDS_CONNECTION_STRING` and `GAME_RECORDS_TABLE` were removed from the Static Web App settings.
- The Static Web App, Cosmos account, database, and containers remain in place. Cosmos `auth` and `game` containers were not modified.

## Entra credential maintenance

The Entra application owner is responsible for rotating the Static Web Apps `GAME_ENTRA_CLIENT_SECRET`. The currently configured credential expires on 2027-04-28. Rotate it before expiry and verify sign-in and API access. Never store the credential value in this document or the repository.
