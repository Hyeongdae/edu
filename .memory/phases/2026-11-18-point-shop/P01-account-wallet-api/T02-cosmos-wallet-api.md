# Task: T02 Cosmos Wallet and Authenticated API

## Status: done

## Goal
Add wallet persistence and authenticated APIs to the existing Cosmos player container. Every coin claim is credited exactly once, purchases atomically debit and unlock an item, and equipment changes preserve all ranking, progress, and appearance fields.

## Decision Summary
- Keep profile and wallet in the existing `/accountId` partition in `stair-climb-players`; do not create a Cosmos database or container.
- `PlayerDocument` remains schemaVersion 1 and adds optional legacy-compatible wallet fields.
- Use a unique receipt document and Cosmos transactional batch in the same account partition so retrying a coin request cannot credit twice or leave a receipt without its point.

## Implementation

### I01. Cosmos player document and repository operations
- Related Files:
  - `api/src/playerRepository.ts` :: `PlayerRepository`, `PlayerDocument`, `PlayerContainer`, `decodeDocument`, `encodeDocument`, `createPlayerRepository`, `readStored`; modify
  - `api/src/playerRepository.test.ts` :: repository and mock-container wallet operations; modify
  - `api/test/playerRepository.integration.test.ts` :: actual Cosmos transactional behavior; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface PlayerRepository {
    // existing methods remain
    collectPointCoin(actor: AuthenticatedActor, claimId: string): Promise<SharedProfile>;
    purchasePointEffect(actor: AuthenticatedActor, effectId: PointEffectId): Promise<SharedProfile>;
    equipPointEffect(actor: AuthenticatedActor, effectId: PointEffectId | null): Promise<SharedProfile>;
  }
  export interface PlayerDocument extends ItemDefinition {
    // existing fields remain
    pointBalance?: number;
    ownedPointEffects?: PointEffectId[];
    equippedPointEffect?: PointEffectId | null;
  }
  ```
- Normalize an old document with all three new fields absent to an empty wallet. Treat partial wallet field presence or invalid field values as `storage-unavailable`; do not discard unrelated profile fields. When constructing a new account record during its first coin claim or purchase, initialize `schemaVersion: 1`, `highestClearedStage: 0`, actor identity, empty ranking/appearance defaults, and the wallet mutation in the same account partition. `encodeDocument` writes canonical `pointBalance`, `ownedPointEffects`, and `equippedPointEffect` while preserving stage records, both infinite records, progress, display name, and appearance.
- Extend the narrow `PlayerContainer` test interface with the Cosmos SDK `items.batch(operations, accountId)` behavior used by production. Coin operation uses a receipt document `{id: "coin_" + sha256(claimId), accountId, kind: "point-coin-claim", createdAt}` plus a conditional replace/create of the player document in one transactional batch. Receipt IDs must not reveal raw client identifiers.
- `collectPointCoin`: validate actor and bounded claim key before storage. Read current profile and ETag; if receipt already exists, return the current canonical profile without changing balance. Otherwise create receipt and increment balance by exactly 1 with a same-partition transactional batch. On receipt conflict, reread and return current profile. On player ETag conflict, reread and retry up to five times; after the retry limit return existing `conflict` error. A failed batch must commit neither receipt nor balance.
- `purchasePointEffect`: merge through `purchasePointEffect` from I01, replace/create via ETag retry up to five times. Already-owned item returns the current profile without charge. Insufficient funds maps to `RecordServiceError("insufficient-points")` (HTTP 409); no partial write.
- `equipPointEffect`: merge through `equipPointEffect` from I01, preserve all other fields, use ETag retries; unowned effect maps to `RecordServiceError("effect-not-owned")` (HTTP 409).
- Account documents and coin receipt documents must share partition key `/accountId`. Existing top ranking queries remain unchanged; receipt documents have no `bestStage`, `infiniteBestScore`, or `infiniteV2BestScore`, so ranking queries cannot include them.

#### Tests
- Mocked repository tests: old profile defaults, all existing fields survive each mutation, exact +1, replay same claim has no second credit, two distinct claims add two points, concurrent claim conflict resolves once, insufficient purchase has no write, duplicate purchase is no-op, equip validation, five-attempt conflict cap, generic storage errors stay sanitized.
- Cosmos integration tests (using `createCosmosEmulatorHarness`): transactional receipt + profile update commits together, replay is idempotent, two independent claims both credit once, failed/aborted batch leaves no partial update, conditional purchase preserves current appearance and scores, receipt docs do not enter top-10 queries.
- No live production Cosmos account is used for tests.

### I02. Authenticated point routes
- Related Files:
  - `api/src/handlers.ts` :: `createRecordHandlers`, `readResultBody`; modify
  - `api/src/handlers.test.ts` :: authentication, exact request validation, status mapping; modify
  - `api/src/index.ts` :: repository delegation and `app.http` registrations; modify
  - `api/src/errors.ts` :: public error mapping only if needed; modify

#### Details
- Add handlers and `POST` routes:
  - `/api/points/coins`: `{ claimId }` -> `repository.collectPointCoin(actor, claimId)`.
  - `/api/points/purchases`: `{ effectId }` -> `repository.purchasePointEffect(actor, effectId)`.
  - `/api/points/equip`: `{ effectId: PointEffectId | null }` -> `repository.equipPointEffect(actor, effectId)`.
- Reuse the existing `authenticated` wrapper and `readResultBody` JSON/content-type/`x-game-request`/8 KiB checks. Never accept account identity from the body; actor is read from `x-ms-client-principal` and optional `x-game-account` must match.
- Return `{ profile }` with canonical normalized wallet for success. Map unknown IDs and malformed fields to 400 invalid-request; insufficient points/effect-not-owned to 409; unauthenticated and storage/conflict failures through existing sanitized conventions.
- Register explicit methods/routes in `api/src/index.ts`, delegating each operation through lazy `getRepository()`.

#### Tests
- For each route: unauthenticated requests do not call the repository; malformed JSON, wrong content type, missing `x-game-request`, extra body keys, forged `accountId`, amount/price and unknown effect reject before repository calls.
- Verify valid route dispatch, response profile shape, 409 mapping, sanitized 503/storage response, and no score/leaderboard calls.

## Acceptance Criteria
- [x] Legacy profiles still read and write without losing progress, scores, or appearance.
- [x] Same coin claim can never produce a second credit, including repeated requests and concurrent retries.
- [x] Purchase debit and effect unlock are a single conditional document update; balance cannot go below zero.
- [x] All point mutations derive account identity from authenticated principal and preserve the current container/partition.
- [x] Existing stage and infinite ranking queries return only player ranking records.

## Validation
- `npm.cmd --prefix api test -- src/handlers.test.ts src/playerRepository.test.ts`
- `npm.cmd --prefix api run test:integration -- test/playerRepository.integration.test.ts` (requires configured Cosmos emulator; must be reported as unverified when unavailable)
- `npm.cmd --prefix api run build`

## Commit Message
```text
feat(api): persist point wallets and idempotent shop actions

Plan: 2026-11-18-point-shop
Phase: P01-account-wallet-api
Task: T02-cosmos-wallet-api

- Store wallet fields with each account profile in Cosmos
- Add authenticated coin, purchase, and equip operations
```

## Progress
- [x] Implementation complete
- [x] Focused tests and build passed; live emulator integration remains unverified because `COSMOS_EMULATOR_ENDPOINT` is not configured.
- commit: pending

## Validation Notes (2026-11-18)
- Focused API route/repository tests: 209 passed across 2 files.
- API TypeScript check and Azure Functions bundle build passed.
- Cosmos integration suite was attempted but could not start: no `COSMOS_EMULATOR_ENDPOINT` is configured. No production Cosmos account was contacted.
