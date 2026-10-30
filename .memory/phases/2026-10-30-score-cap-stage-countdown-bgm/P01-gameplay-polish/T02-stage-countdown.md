# Task: T02 Stage Countdown

## Status: done

## Goal
Give the player a visible three-second transition after pressing Continue at a cleared-stage checkpoint, then begin the next stage with its full timer and normal pursuer delay.

## Decision Summary
- Show a large 3–2–1 over the existing stair scene after Continue is pressed.
- Keep the game model at `checkpoint` during the countdown. Start the next stage only after three seconds, so stage time and pursuer movement do not run during the transition.

## Implementation

### I01. Add a reusable accessible countdown view

- Related Files:
  - `src/game/StageTransitionCountdown.tsx` :: `StageTransitionCountdown` — display next stage and seconds remaining; new.
  - `src/game/StageTransitionCountdown.test.tsx` :: countdown text and accessibility role — new.
  - `src/game/game.css` :: `.stage-transition-countdown` — overlay positioning and general layout; modify.
  - `src/game/pixel-theme.css` :: pixel countdown styling and reduced-motion behavior; modify.

#### Details
- **Signatures & Types**:
  ```typescript
  interface StageTransitionCountdownProps {
    nextStage: GameStage;
    secondsRemaining: 1 | 2 | 3;
  }

  export function StageTransitionCountdown(props: StageTransitionCountdownProps): ReactElement;
  ```
- **Execution Flow / Logic**:
  1. Render a full game-frame overlay with the next-stage label and a large `3`, `2`, or `1`.
  2. Use a live status region (`role="status"`, `aria-live="assertive"`, `aria-atomic="true"`) so keyboard and screen-reader users receive the countdown.
  3. Keep the scene visible behind the overlay. Do not add motion that is required to understand the countdown; disable optional pulse/scale effects under `prefers-reduced-motion: reduce`.

### I02. Delay continue transition until countdown completion

- Related Files:
  - `src/game/GameScreen.tsx` :: `handleContinue`, countdown state/effect, checkpoint/countdown rendering — modify.
  - `src/game/GameScreen.test.tsx` :: checkpoint continue timing, paused clocks, input blocking, cleanup — modify.

#### Details
- **Execution Flow / Logic**:
  1. When a checkpoint player presses Continue, record `countdownEndsAt = Date.now() + 3000`; prevent repeated Continue and hide/disable Quit while the countdown is active.
  2. Keep `gameState.status === "checkpoint"` for the entire countdown. Do not call `continueGame` at button press.
  3. Derive displayed seconds with `Math.ceil((countdownEndsAt - nowMs) / 1000)`, bounded to 1–3. Render the countdown overlay instead of `CheckpointPanel` while active.
  4. At or after the deadline, call `continueGame(state, actualNowMs)` exactly once, clear countdown state, and set `nowMs` to that same timestamp. Existing `continueGame` shifts the event deadline by the checkpoint pause and schedules the next pursuer step from the actual transition time.
  5. Do not accept game input during the countdown; the existing keyboard and movement gates based on `status !== "playing"` remain effective.
  6. Clear countdown timers on unmount and when the countdown is canceled by a restart or state replacement. If a background tab delays the callback, show no negative countdown and only start once it becomes active again.
- **Tests**:
  - Continue click shows `3`, then `2`, then `1`; next stage starts after 3000ms.
  - At the beginning of the new stage, the full stage duration remains and the pursuer's first deadline is based on the transition completion time.
  - Stage state remains checkpoint and the pursuer/time do not advance before completion.
  - Repeated clicks do not create multiple transitions; D/J/Space inputs do not move the player during countdown.
  - Existing quit-at-checkpoint behavior remains available before Continue is pressed.
  - Unmounting during countdown clears timers and does not later continue the game.

## Acceptance Criteria
- [ ] Continue starts a visible 3–2–1 countdown over the stair scene.
- [ ] Next-stage timer and pursuer start only after the three-second countdown.
- [ ] No extra movement, duplicated transition, or timer leak occurs during/after the countdown.
- [ ] Keyboard and reduced-motion access remain usable.

## Validation
- `npm test -- --run src/game/StageTransitionCountdown.test.tsx src/game/GameScreen.test.tsx --maxWorkers=2` — countdown component and integration tests pass.
- `npm run lint` — no lint errors.
- `npm run build` — type check and production bundle pass.

## Commit Message
```text
feat(game): add a countdown between cleared stages

Plan: 2026-10-30-score-cap-stage-countdown-bgm
Phase: P01-gameplay-polish
Task: T02-stage-countdown

- Show a three-second countdown over the stair scene
- Start the next-stage clock and pursuer after the countdown
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending (record after commit)
