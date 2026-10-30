# Task: T01 Initial Countdown

## Status: done

## Goal
After the user presses Start on the stage-selection screen, show a visible three-second countdown over the selected stair scene. Start that stage's game clock and pursuer only after the countdown expires.

## Decision Summary
- Match the existing stage-transition `3`, `2`, `1` countdown and visibility-aware timing.
- Preserve music startup in the click handler so browser audio remains tied to a user gesture.
- Block gameplay input and duplicate Start actions during the countdown; cancel pending countdown work on unmount.

## Implementation

### I01. Reuse the countdown in the initial start flow

- Related Files:
  - `src/game/GameScreen.tsx` :: `handleStart`, countdown completion effect, `StageSelectPanel` and countdown rendering; modify.
  - `src/game/StageTransitionCountdown.tsx` :: `StageTransitionCountdown` props/label; rename `nextStage` to `stage` so it describes both initial and next-stage countdowns; modify.
  - `src/game/GameScreen.test.tsx` :: `session checkpoints` and start-flow tests; modify.

#### Details
- Keep `STAGE_COUNTDOWN_MS = 3000` and the existing `countdownEndsAt` state/ref as the shared deadline.
- On Start, if status is `ready`, no dialog is active, and no countdown is pending: set `runStartedRef` true, set deadline to `Date.now() + STAGE_COUNTDOWN_MS`, set visible time to the click time, set the deadline/ref state, and call `audioController?.startBgm()` as today. Do not call `startGame` yet.
- Hide `StageSelectPanel` while a `ready`-state countdown is active. Leave the selected `StairScene` mounted and show `StageTransitionCountdown` with the current selected stage.
- The countdown effect continues polling every 50 ms only while the document is visible. On expiry, clear the ref/state and call `startGame(state, actualNowMs)` if state is still `ready`; if state is `checkpoint`, keep the existing `continueGame(state, actualNowMs)` path.
- Since game state remains `ready` during the countdown, the existing playing-only game/pursuer loop remains stopped and `applyInput` must not advance the game. Prevent duplicate Start by `runStartedRef` and pending deadline checks.
- Preserve current checkpoint Continue/Quit behavior and the current start audio behavior.
- Update the countdown component to accept the displayed stage and label it as that stage starting.

### I02. Verify countdown and regression behavior

- Related Files:
  - `src/game/GameScreen.test.tsx` :: add initial-countdown behavior coverage and adapt tests that start gameplay through the UI; modify.

#### Details
- Use fake timers to verify the overlay shows 3, then 2, then 1; `startGame` has not been called before 3000 ms; and at 3000 ms it is called once with the selected ready state and current clock time.
- Verify controls cannot climb or jump before expiry and that the stage timer/pursuer deadlines are anchored to the moment the countdown ends.
- Verify unmounting during the initial countdown does not start the game later.
- Keep all existing checkpoint countdown assertions passing.

## Acceptance Criteria
- [x] Start immediately displays a visible 3-second countdown over the selected stage scene.
- [x] Stage time, input, and pursuer movement begin only when countdown ends.
- [x] Existing stage-transition countdown, visibility handling, BGM startup, and teardown behavior remain intact.
- [x] Focused game-screen tests, lint, and production build pass.

## Validation
- `npm run test -- --run src/game/GameScreen.test.tsx --maxWorkers=2` — focused countdown and game-screen regression tests.
- `npm run lint` — static checks.
- `npm run build` — production TypeScript/Vite build.

## Commit Message
```text
feat(game): add countdown before initial start

Plan: 2026-10-30-start-game-countdown
Phase: P01-start-flow
Task: T01-initial-countdown

- Show a three-second countdown after stage selection
- Start the stage clock and pursuer when countdown ends
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending
