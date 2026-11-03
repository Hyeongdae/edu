# Task: T03 Infinite Mode Pause

## Status: done
## Goal
Add the same pause menu, countdown, confirmations, and BGM behavior to infinite mode without losing its score or pursuit state when resuming.

## Decision Summary
- Show pause beside settings during infinite play or its initial/resume countdown. Use the shared `PauseMenuDialog`; infinite restart resets the current infinite run to 0 after confirmation and a 3-second countdown.
- Stop BGM while paused and start it when the resume/restart countdown begins. Do not change ranking persistence or score rules.

## Implementation

### I01. Infinite pause state and controls

- Related Files:
  - `src/infinite/InfiniteModeScreen.tsx` :: pause state, `startCountdown`, countdown effect, `openSettings`, `closeSettings`, keyboard handling, controls, and overlay rendering — add pause lifecycle; modify
  - `src/infinite/InfiniteModeScreen.test.tsx` :: pause/resume/restart/title flow tests — modify
  - `src/infinite/infinite-mode.css` :: pause overlay refinements if mode-specific sizing is required — modify only as needed
  - `src/infinite/infiniteEngine.ts` :: `tickInfiniteGame`, `createInfiniteGameState`, `startInfiniteGame` — read-only existing transitions

#### Details
- **Signatures & Types**:
  ```typescript
  type InfiniteResumeTarget = "playing" | "start" | null;
  const openPauseMenu: () => void;
  const beginPausedResumeCountdown: () => void;
  const confirmInfiniteRestart: () => void;
  const confirmInfiniteTitleReturn: () => void;
  ```
- **Data & Schema Fields**:
  - Add `pauseConfirmation: PauseMenuConfirmation`, `pauseResumeTargetRef`, and reuse `pausedAtRef` for the active-play pause timestamp.
  - Keep countdown target separate from `gameState.status`: `ready` means the initial countdown is pending; `playing` means a suspended run will resume after the countdown.
- **Execution Flow / Logic**:
  1. Render the adjacent pause button while `status === "playing"` or `countdownEndsAt !== null`. Do not show it in the pre-game ready screen without a countdown.
  2. On pause during play, reconcile via `tickInfiniteGame`, store pause start and resume target `playing`, open shared pause dialog, stop BGM. On pause during initial countdown, cancel countdown and store target `start`.
  3. On resume, keep state unchanged, begin a fresh 3000ms countdown, and start BGM. At countdown end, for target `playing`, shift `nextPursuerStepAt` and `eventEndsAt` by `now - pausedAt`, then run `tickInfiniteGame`; for target `start`, call `startInfiniteGame` on the ready state. Clear refs after completion.
  4. Restart option opens shared confirmation. `아니오` returns to the pause menu. `예` calls `createInfiniteGameState()`, resets `previousStepsRef`, `previousEventRef`, and `terminalHandledRef`, sets target `start`, and starts a 3000ms countdown with BGM.
  5. Title option opens shared confirmation. `아니오` returns to pause actions. `예` clears countdown and pause state, stops BGM, and calls `onReturnToTitle()`.
  6. Do not allow settings and pause menu to be active at the same time. Keep existing settings pause behavior and adjust deadline shifting so each pause duration is applied exactly once.
  7. Render `<PauseMenuDialog modeName="무한 모드" ... />` with the same three menu actions and confirmation wording as stage mode.
- **Error & Exception Handling**:
  - If `tickInfiniteGame` reaches game-over while opening pause, do not enter pause; keep the result/presentation flow.
  - Clear pause/countdown refs on restart, title return, countdown completion, and unmount. Do not submit an extra ranking record during pause/restart; submission remains tied to actual game-over.
- **State Transition & Return**:
  - Resume preserves score, stairs, event gauge, pursuer distance, and route. Restart starts a new infinite run at 0. Title return exits infinite mode through the existing callback.

### I02. Infinite flow verification
- Related Files:
  - `src/infinite/InfiniteModeScreen.test.tsx` :: countdown pause, state preservation, confirmations, and audio calls — modify
#### Details
- Verify the button appears during active infinite play and the countdown, but not before pressing `게임 시작`.
- Verify score/steps/event/pursuer state stays unchanged during menu and resume countdown; it advances only after the countdown completes.
- Verify restart requires yes/no confirmation, resets the score and route only on `예`, and starts a new 3-second countdown.
- Verify title return only happens on `예`; `아니오` restores pause actions.
- Verify BGM stop/start ordering and that pause never submits a ranking result.

## Acceptance Criteria
- [x] Infinite mode pause uses the same menu and modal behavior as stage mode.
- [x] Resume preserves the current infinite run and keeps pursuer/event deadlines frozen until countdown completion.
- [x] Restart and title return require confirmation and `아니오` returns to the pause menu.

## Validation
- `npm test -- src/infinite/InfiniteModeScreen.test.tsx` — 6 tests passed.
- `npm run lint` — passed with no ESLint errors.
- `npm run build` — TypeScript and production build passed (existing >500 kB bundle-size warning).

## Commit Message
```text
feat(game): add infinite mode pause flow

Plan: 2026-11-03-game-pause-menu
Phase: P01-pause-flow
Task: T03-infinite-mode-pause

- Pause infinite score and pursuit timers
- Confirm restart and title return in infinite mode
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `ec1c52a`
