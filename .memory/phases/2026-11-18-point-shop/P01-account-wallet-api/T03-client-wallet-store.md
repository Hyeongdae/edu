# Task: T03 Client Wallet Store and Local Test Wallet

## Status: done

## Goal
Load and mutate the production account wallet through authenticated APIs, persist/retry unconfirmed coin claims without duplication, and provide an isolated local demo wallet seeded with 1,000 points once per browser.

## Decision Summary
- Hosted users use the Cosmos-backed wallet in the existing account profile; the local demo never calls the company points API.
- Every coin claim is queued under the signed-in account before network submission and retained for automatic retry until confirmed.
- Local demo balance/inventory/equipment are stored separately in localStorage and are not synchronized to production.

## Implementation

### I01. Client API and point wallet binding
- Related Files:
  - `src/company/recordApi.ts` :: `RecordApiErrorCode`, request wrappers, `CompanyRecordApi`; modify
  - `src/company/recordApi.test.ts` :: point API request and response validation; modify
  - `src/company/types.ts` :: point wallet UI binding and pending claim model; modify
  - `src/company/CompanyRecordStore.ts` :: snapshot binding, queue persistence, retry, mutations; modify
  - `src/company/CompanyRecordStore.test.ts` :: queue, backoff, account isolation and mutations; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export interface PointWalletSnapshot {
    wallet: PointWallet;
    status: "idle" | "saving" | "error" | "auth-required";
    errorMessage: string | null;
    coinGainRevision: number;
    lastCoinGainAt: number | null;
  }
  export interface PointWalletBinding extends PointWalletSnapshot {
    collectCoin(): void;
    purchaseEffect(effectId: PointEffectId): Promise<void>;
    equipEffect(effectId: PointEffectId | null): Promise<void>;
    retry(): void;
  }
  export interface PendingPointCoinClaim { claimId: string; createdAt: string; }
  export interface CompanyRecordApi {
    // existing methods remain
    postPointCoin(accountId: string, request: CollectPointCoinRequest, signal: AbortSignal): Promise<PointWalletResponse>;
    postPointPurchase(accountId: string, request: PurchasePointEffectRequest, signal: AbortSignal): Promise<PointWalletResponse>;
    postPointEquip(accountId: string, request: EquipPointEffectRequest, signal: AbortSignal): Promise<PointWalletResponse>;
  }
  ```
- Add client wrappers for `/api/points/coins`, `/api/points/purchases`, and `/api/points/equip`; validate exact response profile/account ID through `normalizeSharedProfile`. Add `insufficient-points` and `effect-not-owned` to `RecordApiErrorCode`, preserving safe Korean messages.
- Extend `CompanyRecordBinding` with `pointWallet: PointWalletBinding`; initialize it from `profile.wallet`. On every successful mutation, replace the local profile from the canonical server response. Do not optimistically debit purchase points; `purchaseEffect` resolves only when server confirms and rejects on insufficient points/network/API error.
- Persist pending claims under `stair-descent:company:production:coin-claims:v1:${encodeURIComponent(accountId)}` as an ordered JSON array. Validate on load, enqueue synchronously before starting fetch, and process strictly one request at a time. Do not silently discard claims when persistence fails; surface an error and retain the in-memory item for retry. Success removes only the matching claim ID and updates the canonical profile. Network/timeout/5xx failures keep the entry and use capped exponential retry; 401/403 set `auth-required`; malformed/invalid requests become a visible permanent error instead of endless retries. Retry resumes on store start, visibility return, and explicit retry.
- Serialize coin, purchase, and equip writes per account to keep client snapshots in response order. `collectCoin()` generates a unique UUID from the injected `uuid` option, persists it as the claimId before network I/O, and uses that same id for all retries. A purchase waits for earlier queued coin claims to settle before it checks the canonical balance. Requests always include the existing account precondition and game request headers; a queued claim remains scoped to the account that created it. Expose `coinGainRevision` and `lastCoinGainAt` in the wallet binding and increment them only on confirmed production credit or immediate local credit; P02 uses these fields to show `+1` feedback.

### I02. Isolated local demo wallet
- Related Files:
  - `src/points/localPointWallet.ts` :: `LocalPointWalletStore`; new
  - `src/points/localPointWallet.test.ts` :: fake-storage persistence tests; new
  - `src/App.tsx` :: create and pass the local-only wallet binding; modify
  - `src/game/GameScreen.tsx` :: accept and forward `PointWalletBinding`; modify
  - `src/infinite/InfiniteModeScreen.tsx` :: accept the same binding; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export const LOCAL_POINT_WALLET_KEY = "stair-descent:local:point-wallet:v1";
  export const LOCAL_POINT_STARTING_BALANCE = 1000;
  export class LocalPointWalletStore {
    constructor(storage: Pick<Storage, "getItem" | "setItem">);
    getSnapshot(): PointWalletSnapshot;
    subscribe(listener: () => void): () => void;
    collectCoin(): void;
    purchaseEffect(effectId: PointEffectId): Promise<void>;
    equipEffect(effectId: PointEffectId | null): Promise<void>;
  }
  ```
- Missing key initializes `{ balance: 1000, ownedEffects: [], equippedEffect: null }` once and immediately writes it. Valid existing storage preserves all points and items across reloads. Invalid JSON/invalid wallet resets only this local test wallet to the documented test seed; never call `localStorage.clear()`.
- Local purchase uses the same shared purchase/equip pure functions and catalog price, commits only after sufficient funds. Local collect credits once for each `collectCoin()` call and persists balance immediately. Input movement processing in P02 guards duplicate dispatch; production additionally uses Cosmos receipt documents for retry idempotency.
- `App.tsx` creates this store only for the development-only `localDemoMode` branch. Hosted `CompanyRecordsGate` supplies the production binding. A normal authenticated shell without a company-record binding must not silently create/use the test wallet; point collection/shop is disabled with a clear unavailable state.
- `GameScreen` passes one binding to both stage and infinite mode so balance, inventory, and equipped effect remain shared when switching modes.

#### Tests
- API wrapper tests: exact path/method/body, auth account header, valid wallet update, invalid payload/response, server insufficient-points mapping, and network retry classification.
- Store tests: queued claim survives store recreation, claims are sequential, repeated claim IDs are not requeued, only confirmed claims leave queue, account keys do not cross, retry continues after transient errors, purchase does not debit on error, equip update is canonical.
- Local store tests: initializes 1,000 only on missing key, persists purchases/equip/unequip/reload, no overflow/negative balances, malformed storage recovery touches only its own key.
- App test: local demo uses the test wallet, hosted account uses server wallet, and local demo makes no `/api/points/*` calls.

## Acceptance Criteria
- [ ] Production point wallet always comes from authenticated `/api/profile` and mutation responses.
- [ ] Local demo starts with 1,000 test points once and retains test purchases without touching account API.
- [ ] Failed coin saves remain queued and retry without client-side double credits.
- [ ] Existing profile, appearance, ranking queue, and audio storage behavior is unchanged.

## Validation
- `npm.cmd test -- --run src/company/recordApi.test.ts src/company/CompanyRecordStore.test.ts src/points/localPointWallet.test.ts src/App.test.tsx`
- `npm.cmd run lint`
- `npm.cmd run build`

## Commit Message
```text
feat(points): bind persistent and local test wallets

Plan: 2026-11-18-point-shop
Phase: P01-account-wallet-api
Task: T03-client-wallet-store

- Retry production coin claims per authenticated account
- Seed an isolated local wallet with 1,000 test points
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: `6a9b3f7`





