# Plan: Point Shop and Step Effects

- Date: 2026-11-18
- Status: in_progress
- Decision: [Point Shop and Step Effects](../decisions/2026-11-18-point-shop.md)

## Goal
Add account-persistent shop points, random coin pickups in stage and infinite modes, and a title-screen shop where players can buy, preview, equip, and unequip cosmetic footstep effects. The local demo receives a separate persistent 1,000-point test wallet. Coins and cosmetics never affect game score or ranking.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | Extend the shared profile, authenticated Cosmos API, and client/local wallet with idempotent point collection and purchases | [P01](../phases/2026-11-18-point-shop/P01-account-wallet-api/phase.md) |
| P02 | `in_progress` | Add 5% safe coin drops and one-point collection to both game engines, then render coins and step effects | [P02](../phases/2026-11-18-point-shop/P02-coin-gameplay-effects/phase.md) |
| P03 | `pending` | Add title-screen shop popup, previews, confirmation, inventory and equip controls | [P03](../phases/2026-11-18-point-shop/P03-point-shop-ui/phase.md) |

## Data Contract
- Shared profile wallet: `{ balance: number; ownedEffects: PointEffectId[]; equippedEffect: PointEffectId | null }`.
- `PointEffectId` is exactly `"fire" | "sparkle" | "smoke"`.
- Cosmos `PlayerDocument` fields: optional legacy-compatible `pointBalance?: number`, `ownedPointEffects?: PointEffectId[]`, `equippedPointEffect?: PointEffectId | null`; absent fields normalize to `{ balance: 0, ownedEffects: [], equippedEffect: null }`.
- Collect request: `{ claimId: string }` with a unique UUID generated and persisted by the client wallet store; server always credits exactly 1 point. Purchase request: `{ effectId: PointEffectId }`; server uses the catalog price of 200 points. Equip request: `{ effectId: PointEffectId | null }`.
- New authenticated endpoints: `POST /api/points/coins`, `POST /api/points/purchases`, `POST /api/points/equip`; each returns the canonical `SharedProfile`.
- Coin claim receipt: an additional same-partition Cosmos document with `id: "coin_" + claimId`, `accountId`, and `kind: "point-coin-claim"`, atomically created with the wallet increment by a transactional batch. This makes retries idempotent without an unbounded array in the profile document.
- Local demo storage key: `stair-descent:local:point-wallet:v1`; first use initializes 1,000 points, later loads preserve balance and ownership. Production must never use this wallet.

## Design Tradeoff for Implementation Review
The proposed exact retry deduplication adds one same-partition Cosmos receipt document per credited coin. These receipts are retained permanently so a very late retry cannot credit twice; document count and storage cost therefore grow with play. Review this tradeoff before P01-T02 implementation if the expected coin volume or shared throughput makes it undesirable.

## Execution Order
| Task | Observable outcome | Principal files |
| :--- | :--- | :--- |
| P01-T01 | Shared wallet contract, compatibility normalization, strict request validation and pure wallet mutations | `shared/companyRecords.ts`, `shared/companyRecords.test.ts`, `src/company/recordApi.ts` |
| P01-T02 | Authenticated idempotent coin, purchase and equip endpoints backed by Cosmos | `api/src/playerRepository.ts`, `api/src/handlers.ts`, `api/src/index.ts`, API tests |
| P01-T03 | Company client queue/retry and isolated persistent local test wallet; shared wallet binding available to game screens | `src/company/recordApi.ts`, `src/company/CompanyRecordStore.ts`, `src/company/types.ts`, `src/points/*`, `src/App.tsx` |
| P02-T01 | Stable 5% coin placement and successful-move pickup indices in stage and infinite engines | `src/game/types.ts`, `src/game/gameEngine.ts`, `src/infinite/types.ts`, `src/infinite/infiniteEngine.ts`, `src/points/coinDrops.ts` |
| P02-T02 | Pixel coin rendering, one-time claim dispatch, +1 pickup feedback, and brief equipped footstep effects in both scenes | `src/game/stairSceneModel.ts`, `src/game/StairScene.tsx`, `src/infinite/infiniteSceneModel.ts`, `src/infinite/InfiniteStairScene.tsx`, `src/points/*` |
| P03-T01 | Title-screen point shop popup with balance, catalog, previews, purchase confirmation, owned/equipped state, and unequip | `src/game/GameScreen.tsx`, new `src/points/PointShopDialog.tsx`, `src/game/game.css` |

## Validation
- P01-T01: `npm.cmd test -- --run shared/companyRecords.test.ts src/company/recordApi.test.ts`
- P01-T02: `npm.cmd --prefix api test -- --config vitest.config.ts src/handlers.test.ts src/playerRepository.test.ts`; integration: `npm.cmd --prefix api run test:integration -- src/playerRepository.integration.test.ts` when Cosmos emulator is available.
- P01-T03: `npm.cmd test -- --run src/company/recordApi.test.ts src/company/CompanyRecordStore.test.ts src/points/localPointWallet.test.ts src/App.test.tsx`
- P02-T01: `npm.cmd test -- --run src/game/gameEngine.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/infinite/infiniteEngine.test.ts src/points/coinDrops.test.ts`
- P02-T02: `npm.cmd test -- --run src/game/stairSceneModel.test.ts src/game/StairScene.test.tsx src/infinite/infiniteSceneModel.test.ts src/infinite/InfiniteStairScene.test.tsx src/points/StepEffect.test.tsx`
- P03-T01: `npm.cmd test -- --run src/points/PointShopDialog.test.tsx src/game/GameScreen.test.tsx src/infinite/InfiniteModeScreen.test.tsx`
- Final: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd --prefix api run build`, and `git diff --check`.

## Progress
- done: 3/6
- Active: P02-T01


