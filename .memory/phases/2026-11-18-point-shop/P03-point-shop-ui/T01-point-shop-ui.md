# Task: T01 Point Shop Popup

## Status: done

## Goal
Add a keyboard-accessible point shop popup to the title screen. Users can inspect the wallet, preview three footstep effects, confirm purchases, equip/unequip owned effects, and see server errors without losing or corrupting the wallet.

## Decision Summary
- Title screen has the only shop entry point. Existing stage/infinite game screens do not gain a shop button.
- Effects cost 200 each, can be bought once, and a newly bought effect is equipped immediately. Only one or none may be equipped.
- Existing points are shown in title/shop and not as a persistent gameplay HUD. Local demo receives 1,000 persistent browser test points; hosted profile starts at 0.

## Implementation

### I01. Shop dialog and title-screen entry
- Related Files:
  - `src/points/PointShopDialog.tsx` :: `PointShopDialog`, catalog cards, purchase confirmation; new
  - `src/points/PointShopDialog.test.tsx` :: shop behavior and keyboard/accessibility; new
  - `src/points/point-shop.css` :: responsive pixel-theme dialog/card styles; new
  - `src/game/GameScreen.tsx` :: `ActiveGameDialog`, title actions, dialog focus/keyboard routing; modify
  - `src/game/GameScreen.test.tsx` :: title shop entry and persistence across mode selection; modify
  - `src/game/game.css` :: title button layout integration only; modify
  - `src/points/StepEffect.tsx` :: shared effect renderer preview mode from P02; modify/read-only as appropriate

#### Details
- **Signatures & Types**:
  ```typescript
  export interface PointShopDialogProps {
    wallet: PointWalletBinding;
    onClose(): void;
  }
  export function PointShopDialog(props: PointShopDialogProps): ReactElement;
  type ActiveGameDialog = "settings" | "instructions" | "leaderboard" | "pause" | "customization" | "shop" | null;
  ```
- Add `shop` to `ActiveGameDialog` and `OpenGameDialog` in `GameScreen.tsx`; title remains behind the popup. Add a `포인트 상점` title action beside existing title controls, with `aria-haspopup="dialog"`, `aria-expanded`, and `aria-controls`. Use existing dialog opening guard/focus restoration and do not make the shop available while a run is active.
- `PointShopDialog` uses `role="dialog"`, `aria-modal="true"`, a labelled heading, close button, focus trap, Escape close, and directional menu navigation/Enter activation through the existing `handleDirectionalMenuNavigation` conventions. Opening from the title returns focus to the shop trigger. Opening shop must not start, pause, reset, or change any game state/audio.
- Header displays confirmed `wallet.balance` as `N 포인트`, production/local label as appropriate, current `equippedEffect`, and sync error/status. Do not optimistically show a balance deduction. When balance/profile is loading or saving, disable purchase/equip buttons consistently; when an error occurs, show a readable alert and retry action from the binding.
- Render catalog in fixed order `fire`, `sparkle`, `smoke`. Each card has Korean name, 200-point price, current owned/equipped status, and a short looping preview using the exact same `StepEffect` implementation as gameplay. For unowned effects, show `구매`; owned but unequipped show `장착`; equipped shows `장착 중` plus `해제` control.
- Clicking `구매` opens an in-dialog `role="alertdialog"` confirmation containing item name and exact `200 포인트` deduction. `취소` returns focus to that card's purchase button and changes nothing. `구매 확인` calls `wallet.purchaseEffect(effectId)` once; on success update the view from canonical wallet and display success; on insufficient points keep wallet unchanged and display an error. Prevent double-click submission while in flight.
- Purchase completes and equips immediately per decision. A repeated purchase for owned item is replaced by `장착` and never invokes the purchase API. `해제` calls `wallet.equipEffect(null)`; switching among owned effects calls `wallet.equipEffect(effectId)` and never spends points.
- Point shop works with the binding passed from `GameScreen`; production receives CompanyRecordStore binding, local demo receives `LocalPointWalletStore`. If no wallet binding is available, show a disabled shop error rather than silently generating points.
- Make layout fit narrow mobile and game frame without page-level horizontal overflow. Preserve pixel theme and visible keyboard focus. Use CSS-only/vector previews; add no external assets or dependencies.

#### Tests
- Title action opens/closes popup and restores focus; opening does not change stage or infinite mode state; title-only visibility is enforced.
- Assert all three item names, 200 prices, short effect previews, and accurate balance/owned/equipped states.
- Confirmation cancel does not call purchase; confirmation executes once; insufficient balance/error retains old balance and has accessible error; double click sends one purchase.
- Purchase success decreases canonical balance by 200, adds ownership and auto-equips; existing item can be equipped without spending; only one equipped; unequip returns to null.
- Test local 1,000-point seeded wallet end-to-end in the shop and server profile binding independently; no point leaderboard/ranking mutation or score request occurs.
- Test Escape, arrows, Enter, focus trap, close focus restoration, and narrow viewport class behavior.

## Acceptance Criteria
- [ ] Shop opens only from title and is a popup over the existing title scene.
- [ ] Three effect cards display 200-point prices and animated previews.
- [ ] Purchase confirmation, balance checks, owned/equipped states and unequip work without duplicate debit.
- [ ] Local demo spending persists after reload; hosted server responses remain canonical.
- [ ] No point total is added to gameplay HUD or ranking, and game rules/audio are unaffected by opening/closing the shop.

## Validation
- `npm.cmd test -- --run src/points/PointShopDialog.test.tsx src/game/GameScreen.test.tsx src/infinite/InfiniteModeScreen.test.tsx src/points/localPointWallet.test.ts`
- `npm.cmd run lint`
- `npm.cmd run build`

## Commit Message
```text
feat(ui): add title-screen point shop

Plan: 2026-11-18-point-shop
Phase: P03-point-shop-ui
Task: T01-point-shop-ui

- Add previewable fire, sparkle, and smoke effects
- Confirm point purchases and support equip and unequip
```

## Progress
- [x] Implementation complete
- [x] Validation passed: 4 files, 130 tests; lint; build
- commit: `92e0a13`
