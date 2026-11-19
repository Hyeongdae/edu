# Task: T02 Coin Rendering, Claims, and Footstep Effects

## Status: done

## Goal
Render collectible coins on visible stairs, forward successful coin indices to the wallet once, show `+1` only after server/local confirmation, and display the equipped player's pixel footstep effect for about 500 ms after landing in both game modes.

## Decision Summary
- Coins are visual game-scene objects. The balance is not added to the gameplay HUD.
- Wallet mutation is dispatched from a once-per-move effect, never from a React state updater, engine reducer, or scene render. Production `collectCoin` queues before request; local demo credits immediately.
- Fire, sparkle, and smoke are player-only, short bursts beneath the landed feet; only one equipped effect is rendered.

## Implementation

### I01. Scene coin placement model and pixel coin
- Related Files:
  - `src/game/stairSceneModel.ts` :: `SceneStep`, `StairSceneModel`, `buildStairSceneModel`; modify
  - `src/game/stairSceneModel.test.ts` :: visible coin projection; modify
  - `src/infinite/infiniteSceneModel.ts` :: `InfiniteSceneModel`, `buildInfiniteSceneModel`; modify
  - `src/infinite/infiniteSceneModel.test.ts` :: visible coin projection; modify
  - `src/points/PointCoin.tsx` :: pixel coin renderer; new
  - `src/points/point-effects.css` :: pixel coin and pickup animation; new
  - `src/points/PointCoin.test.tsx` :: accessible coin render; new

#### Details
- Extend each scene step model with `hasPointCoin: boolean`, calculated by `hasPointCoin(state.pointCoinSeed, index)`. In stage mode also require `!hasObstacle(state.obstacles, index)`. Keep the visible-step window and its coordinates unchanged.
- Render `PointCoin` as a small self-contained pixel-art SVG/DOM coin placed on the stair top, with `aria-label="포인트 코인"` and `data-stair-index`; decorative pixels are `aria-hidden`. Do not add coins to obstacle stairs.
- Add `collectedPointCoinIndices: number[]` to both game states. On a successful move, union its `lastMove.collectedCoinIndices`; after route advancement, prune indexes below `route.steps[0].index`. This bounded run state hides collected coins while their stairs remain in scene history and prevents revisiting/re-rendering a reward. It resets with the new seed/run. Validate indexes are unique nonnegative integers within retained route history.
- Never render a pursuer coin pickup; the pursuer continues using existing appearance and movement rendering.

### I02. Claim dispatch and confirmed `+1` feedback
- Related Files:
  - `src/company/types.ts` :: `PointWalletBinding` confirmation revision/state from P01; modify
  - `src/company/CompanyRecordStore.ts` :: expose confirmed claim changes through snapshot; modify
  - `src/points/localPointWallet.ts` :: local claim confirmation state; modify
  - `src/game/GameScreen.tsx` :: player-input movement and point claim handling; modify
  - `src/infinite/InfiniteModeScreen.tsx` :: player-input movement and point claim handling; modify
  - `src/points/PointGainFeedback.tsx` :: accessible floating `+1` feedback; new
  - `src/points/PointGainFeedback.test.tsx` :: feedback lifecycle; new

#### Details
- Add to the point binding snapshot a monotonically increasing `coinGainRevision` and `lastCoinGainAt` (or equivalent unique confirmed claim event). Increment only after server confirms the receipt or local store credits. Do not increment on enqueue or failed request.
- Subscribe to each new `lastMove` object in an effect and use a `WeakSet<object>` ref to process a move object once; call `pointWallet.collectCoin()` once per `lastMove.collectedCoinIndices`. Do not call the wallet from `setState(state => ...)`, engine reducers, or scene render. A tick that preserves the same `lastMove` object, React rerender, or StrictMode effect replay must not resubmit it.
- Hold a `WeakSet<object>` of processed `lastMove` objects in a ref. Add the object to the set before dispatching claims so React rerenders, StrictMode effect replay, repeated tick callbacks, and visibility reconciliation cannot submit it twice. Distinct coins crossed on a jump each call the wallet once. `CompanyRecordStore.collectCoin()` creates/persists a request UUID before network I/O; retry keeps the same claim ID. Local credits once per dispatch.
- `PointGainFeedback` receives a new confirmation revision and renders a floating `+1` beside the player for 500–700 ms; if two claims are confirmed close together, queue them in order so the labels do not overlap. Screen readers receive a polite live announcement only on confirmed credit. Do not show the balance or a pending `+1` in the HUD.
- When equipped effect is non-null and the player completes a movement, pass a new step-effect key and `PointEffectId` to the scene. Trigger on final landing, including a jump landing; do not animate on failed input or pursuer movement. Add an `@media (prefers-reduced-motion: reduce)` static brief state.

#### Tests
- Scene-model tests: coins remain at same index during route extension, are absent at obstacle indices, corner indices remain eligible, collected indexes disappear, and scene coordinates do not change.
- Claim tests: each correct move dispatches only crossed coins; double render/StrictMode-style repeated notification dispatches once; skipped jump coin dispatches; failed input and tick do not dispatch; retry uses the same claim ID; only confirmed wallet state produces one `+1`.
- Effect tests: no effect when unequipped or after a wrong input; fire/sparkle/smoke data variant on successful step and jump landing; effect ends at the stated deadline; pursuer appearance remains unaffected.

## Acceptance Criteria
- [ ] Coin pixels appear only on eligible visible stairs and are removed after collection.
- [ ] Each successful pickup is sent once to the wallet and is not re-awarded by rerender or retry.
- [ ] `+1` appears next to the player only after credited confirmation; no constant HUD balance exists.
- [ ] Equipped effects render below the player's feet briefly in stage and infinite modes and never change game rules.

## Validation
- `npm.cmd test -- --run src/game/stairSceneModel.test.ts src/game/StairScene.test.tsx src/infinite/infiniteSceneModel.test.ts src/infinite/InfiniteStairScene.test.tsx src/points/PointCoin.test.tsx src/points/PointGainFeedback.test.tsx src/game/GameScreen.test.tsx src/infinite/InfiniteModeScreen.test.tsx`
- `npm.cmd run lint`
- `npm.cmd run build`

## Commit Message
```text
feat(game): show coin pickups and player step effects

Plan: 2026-11-18-point-shop
Phase: P02-coin-gameplay-effects
Task: T02-coin-and-step-effect-rendering

- Render and claim eligible coins in both game modes
- Add confirmed point feedback and selectable player footstep bursts
```

## Progress
- [x] Implementation complete
- [x] Validation passed: 8 files, 179 tests; lint; build
- commit: `b19857f`



