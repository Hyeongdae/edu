# Task: T02 Stage Mode Pause

## Status: pending

## Goal
Let stage-mode players pause during active play or either start/transition countdown, then resume, restart the relevant stage, or return to title through the shared confirmation flow.

## Decision Summary
- Add the pause button beside settings only while `gameState.status === "playing"` or a 3-second countdown is active. Keep it absent on stage selection and checkpoint choice screens.
- Resume after 3 seconds from the paused score/state; shift stage, event, and pursuer deadlines by the full pause plus countdown. Restart after confirmation with 0 score and 3-second countdown. If paused during the checkpoint transition countdown, restart the upcoming stage.

## Implementation

### I01. Stage pause state and controls

- Related Files:
  - `src/game/GameScreen.tsx` :: `ActiveGameDialog`, `openGameDialog`, `closeGameDialog`, `handleStart`, `handleContinue`, countdown effect, frame controls and pause rendering — add stage pause/resume lifecycle; modify
  - `src/game/GameScreen.test.tsx` :: pause button and stage pause flow cases — modify
  - `src/game/gameEngine.ts` :: `resumeGameAfterPause`, `resetGame`, `startGame`, `continueGame` — read-only existing transition functions
  - `src/game/StageTransitionCountdown.tsx` :: `StageTransitionCountdown` — read-only existing 3-2-1 overlay

#### Details
- **Signatures & Types**:
  ```typescript
  type ActiveGameDialog = "settings" | "instructions" | "leaderboard" | "pause" | null;
  type OpenGameDialog = Exclude<ActiveGameDialog, null>;
  type StageResumeTarget = "playing" | "start" | "continue" | null;
  const openPauseMenu: () => void;
  const beginPausedResumeCountdown: () => void;
  const confirmPausedRestart: () => void;
  const confirmPausedTitleReturn: () => void;
  ```
- **Data & Schema Fields**:
  - Add `pauseResumeTargetRef: React.MutableRefObject<StageResumeTarget>` to preserve the pending transition while the dialog is open.
  - Reuse `pausedDialogOpenedAtRef` for the time when active gameplay was frozen. For a ready/checkpoint countdown, store its resume target and cancel `countdownEndsAtRef`/`countdownEndsAt` before opening the pause menu.
  - Add parent state `pauseConfirmation: PauseMenuConfirmation` and `isPauseOpen` derived from `activeDialog === "pause"`.
- **Execution Flow / Logic**:
  1. Render the pause button adjacent to `.game-settings-button` if status is `playing` or `countdownEndsAt !== null`. Give it `aria-label="일시정지"`; it opens the pause dialog.
  2. If opened during play, call `tickGame(state, now)` first. Only pause if the reconciled state is still `playing`; record pause timestamp, set active dialog to `pause`, and stop BGM.
  3. If opened during a ready/checkpoint countdown, save target `start` or `continue`, clear both countdown state and ref, open the menu, and stop BGM. No stage/checkpoint choice screen gets a pause button.
  4. On `게임 재개`, close the menu but retain pause target and timestamp; start a fresh 3000ms countdown with label `게임 재개`, and call `audioController.startBgm()` at countdown start.
  5. Extend the existing countdown completion handler: `playing` target calls `resumeGameAfterPause(pausedState, pauseOpenedAt, actualNowMs)`; `start` calls `startGame(state, actualNowMs)`; `continue` calls `continueGame(state, actualNowMs)`. Clear the target/ref only after transition completes. Time, event, and pursuer deadlines remain frozen through the countdown.
  6. Restart menu option switches confirmation to `restart`. `아니오` returns to pause actions. On `예`, clear pause refs/dialog, call `resetGame` with 0 score at the target stage, set `runStartedRef`, then show 3-second start countdown. Target is current stage while playing or at initial start countdown; target is `(gameState.stage + 1) as GameStage` when current status is `checkpoint`.
  7. Title menu option switches confirmation to `title`. On `예`, close pause, stop BGM, reset the stage preview to the highest unlocked stage using `readKnownHighest()`, set `activeMode="title"`, `isTitleScreen=true`, `isTitleLeaving=false`, clear countdown and `runStartedRef`. `아니오` returns to pause actions.
  8. Settings remains a separate dialog and retains its existing automatic-resume behavior. A pause dialog and settings dialog must never be open together.
  9. Render `<PauseMenuDialog modeName="단계 모드" ... />` from `GameScreen` while pause is active. Its `onResume` starts the 3-second resume countdown rather than resuming immediately.
- **Error & Exception Handling**:
  - Do not start a pause if `tickGame` finds timeout/capture/end state; let existing result flow win.
  - Clear countdown refs on pause, restart, title return, unmount, and successful countdown completion so stale intervals cannot launch a game unexpectedly.
  - If checkpoint status is stage 5/final game-over, the pause button is not rendered because no active or transition countdown exists.
- **State Transition & Return**:
  - Pause is an overlay; underlying game state remains playing but deadlines are shifted on resume. Restart creates a fresh ready state and enters the existing `startGame` countdown path. Title confirmation restores the existing title screen and its default scene.

### I02. Stage flow verification
- Related Files:
  - `src/game/GameScreen.test.tsx` :: pause rendering, pause timing, resume/restart/title confirmation, and countdown interruption — modify
#### Details
- Verify button is shown in playing and ready/checkpoint countdown states, hidden in stage select/checkpoint choice.
- Verify no score, step, stage clock, event expiry, or pursuer movement occurs during pause and the 3-second resume countdown.
- Verify restart confirmation `아니오` keeps pause open; `예` resets current stage to 0 and begins at 3; in transition countdown it targets the upcoming stage.
- Verify title confirmation follows the same no/yes behavior and `예` restores title screen.
- Verify pause interruption of both initial and inter-stage countdown cancels the old countdown and resume starts a new 3-second one.
- Verify BGM `stopBgm` on pause and `startBgm` when countdown begins.

## Acceptance Criteria
- [ ] Stage mode can be paused beside settings during gameplay or countdown, with no clock/pursuit advancement until resumed.
- [ ] Resume preserves current score; restart requires confirmation and starts the proper stage at 0 after 3 seconds.
- [ ] Title return requires confirmation and restores the title screen.

## Validation
- `npm test -- src/game/GameScreen.test.tsx` — focused stage screen tests pass.
- `npm run lint` — no ESLint errors.
- `npm run build` — TypeScript check and production build pass.

## Commit Message
```text
feat(game): add stage mode pause flow

Plan: 2026-11-03-game-pause-menu
Phase: P01-pause-flow
Task: T02-stage-mode-pause

- Pause stage timers and pursuit across the resume countdown
- Confirm stage restart and title return
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
