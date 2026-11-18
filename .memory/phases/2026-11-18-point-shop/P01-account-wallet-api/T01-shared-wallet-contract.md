# Task: T01 Shared Wallet Contract and Mutations

## Status: done

## Goal
Define one validated wallet contract shared by browser and Azure Functions, preserve compatibility with existing Cosmos profiles that do not yet contain wallet fields, and make point collection, purchases, and equipping deterministic pure operations.

## Decision Summary
- A point is a shop currency only. Coin pickup gives exactly 1; each of `fire`, `sparkle`, and `smoke` costs 200.
- Canonical wallet is `{ balance, ownedEffects, equippedEffect }`; production profile without wallet data defaults to 0 points, no owned effects, and no equipped effect.
- Server receives an opaque unique `claimId` for a single coin credit; amount and price are never accepted from client requests.

## Implementation

### I01. Shared profile wallet and strict request contracts
- Related Files:
  - `shared/companyRecords.ts` :: `SharedProfile`, `ApiErrorCode`, wallet types, request/response types, profile normalization helpers; modify
  - `shared/companyRecords.test.ts` :: profile normalization and wallet merge/request tests; modify
  - `src/company/recordApi.ts` :: `isSharedProfile`, `normalizeSharedProfile`; modify
  - `src/company/recordApi.test.ts` :: legacy/malformed wallet parsing tests; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export const POINT_EFFECT_IDS = ["fire", "sparkle", "smoke"] as const;
  export type PointEffectId = (typeof POINT_EFFECT_IDS)[number];
  export interface PointWallet {
    balance: number;
    ownedEffects: PointEffectId[];
    equippedEffect: PointEffectId | null;
  }
  export interface CollectPointCoinRequest { claimId: string; }
  export interface PurchasePointEffectRequest { effectId: PointEffectId; }
  export interface EquipPointEffectRequest { effectId: PointEffectId | null; }
  export interface PointWalletResponse { profile: SharedProfile; }
  export const POINT_EFFECT_PRICE = 200;
  export const POINT_COIN_VALUE = 1;
  export function createEmptyPointWallet(): PointWallet;
  export function isPointEffectId(value: unknown): value is PointEffectId;
  export function isPointWallet(value: unknown): value is PointWallet;
  export function isCollectPointCoinRequest(value: unknown): value is CollectPointCoinRequest;
  export function isPurchasePointEffectRequest(value: unknown): value is PurchasePointEffectRequest;
  export function isEquipPointEffectRequest(value: unknown): value is EquipPointEffectRequest;
  export function purchasePointEffect(previous: PointWallet, effectId: PointEffectId):
    | { ok: true; wallet: PointWallet; changed: boolean }
    | { ok: false; code: "insufficient-points" };
  export function equipPointEffect(previous: PointWallet, effectId: PointEffectId | null):
    | { ok: true; wallet: PointWallet; changed: boolean }
    | { ok: false; code: "effect-not-owned" };
  ```
- `SharedProfile` gains required normalized property `wallet: PointWallet`. `normalizeSharedProfile` accepts legacy server profile responses with the wallet field absent and returns `createEmptyPointWallet()`; when present, the object must have exactly the wallet fields, a safe nonnegative integer balance, unique valid effect IDs, and an equipped effect that is either null or owned. Malformed wallet data makes the response invalid; do not silently erase a partially corrupt wallet. Every profile merge for stage result, infinite v1/v2 result, point pickup, purchase, equip, and appearance must preserve the current wallet; when creating a new profile, use the empty wallet.
- Request validators require exact own keys. `claimId` is a nonempty bounded string (maximum 128 UTF-8 bytes), `effectId` must be one of the three catalog IDs, and equip permits explicit null. Requests do not accept points, price, accountId, or inventory fields.
- `purchasePointEffect` returns a no-op success when the effect is already owned (no charge); when not owned and balance is at least 200, subtract 200, append the effect once, and equip it immediately. Insufficient balance returns `insufficient-points` without mutation.
- `equipPointEffect` allows null to unequip and allows a non-null effect only when it is owned. Preserve immutability by returning new arrays/objects for changed wallets.
- Extend `ApiErrorCode` with `insufficient-points` and `effect-not-owned` and ensure the frontend API parser recognizes these codes.

#### Tests
- Accept legacy `SharedProfile` without wallet and normalize to zero/empty/null.
- Reject negative, fractional, unsafe, duplicate-owned, unknown-effect, and equipped-but-not-owned wallet values.
- Reject unexpected fields and client-supplied amount/price/account identity in requests.
- Verify 199 points cannot buy; exactly 200 buys once and leaves 0; repeated purchase is no-op; a later purchase of a different item deducts exactly 200; equip owned succeeds; equip unowned fails; null unequips.

### I02. Shared contract compatibility fixtures
- Related Files:
  - `api/src/playerRepository.test.ts` :: profile fixture builders affected by required normalized wallet; modify
  - `api/test/playerRepository.integration.test.ts` :: legacy and new profile fixtures; modify

#### Details
- Update expected `SharedProfile` objects from repository results to include a wallet, while old stored player document fixtures omit the three wallet fields to exercise defaulting.
- Do not change stage/infinite score ranking order or old schemaVersion-1 appearance compatibility.

## Acceptance Criteria
- [ ] All old profile response shapes still normalize to a valid default wallet.
- [ ] Strict validators reject client attempts to choose a point amount or price.
- [ ] Purchase/equip pure functions meet every listed balance, ownership, and duplicate rule.
- [ ] Existing ranking and appearance tests require no behavior changes beyond the new wallet property.

## Validation
- `npm.cmd test -- --run shared/companyRecords.test.ts src/company/recordApi.test.ts`

## Commit Message
```text
feat(points): define shared wallet and effect contracts

Plan: 2026-11-18-point-shop
Phase: P01-account-wallet-api
Task: T01-shared-wallet-contract

- Add backwards-compatible wallet profile normalization and strict requests
- Define pure one-time purchase and equip rules
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending

