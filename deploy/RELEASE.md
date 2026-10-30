# Stair Climb Game ??Azure Release

- Production URL: https://ashy-cliff-0e5e4b600.1.azurestaticapps.net/
- Hosting: Azure Static Web Apps Standard in East Asia.
- Source: `Hyeongdae/edu`, branch `main`.
- Deployed merge commit: `d681bad02c25684bca99223dbe3ecdbfcb2b0663`.
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
