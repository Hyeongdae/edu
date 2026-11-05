# Task: T01 Settings Entry Points and Keyboard Shortcuts

## Status: done

## Goal
Expose the existing audio settings dialog from title and safe non-playing screens in both modes, and route `Escape`/`R` during play through existing pause and restart confirmation behavior.

## Decision Summary
- Settings is available on title, stage ready/checkpoint, infinite ready, and gameplay screens; countdowns and other modal/terminal states lock the trigger.
- `Escape` opens the existing pause menu; `R` opens that menu with restart confirmation selected. The focused affirmative button is activated by Enter; existing behavior owns the restart and 3-second countdown.
- Do not invoke shortcuts behind dialogs, while text entry has focus, or repeatedly while `R` is held.

## Implementation

### I01. Title and stage-mode settings lifecycle
- Related Files:
  - `src/game/GameScreen.tsx` :: `openGameDialog`, `closeGameDialog`, title-screen actions, settings trigger, keyboard `useEffect`, settings content — allow the settings dialog without pausing a non-running game; show an accessible title settings trigger; enable settings on ready/checkpoint but not during countdown; remove duplicated instructions/chase guide from settings; map keyboard shortcuts through existing pause logic; modify.
  - `src/game/PauseMenuDialog.tsx` :: `firstActionRef`, confirmation buttons, `onKeyDown` — focus the affirmative action for restart confirmation and confirm on Enter while it is focused; modify.
- Settings opened while `gameState.status` is not `playing` must leave `pausedDialogOpenedAtRef` null so closing does not shift any game deadlines.
- Settings opened while playing must continue reconciling/pause-shifting game state exactly as current code does.
- Countdown lock must use `countdownEndsAtRef.current !== null` so both initial and checkpoint countdowns are covered.
- `R` should enter pause confirmation state `restart`; the confirmation handler must retain existing stage target rule (next stage if currently at checkpoint, otherwise current stage) and 3-second countdown.
- Escape during a modal must retain the modal’s own handler (close/cancel); do not open pause behind it.

### I02. Infinite-mode settings and shortcuts
- Related Files:
  - `src/infinite/InfiniteModeScreen.tsx` :: settings trigger, `openSettings`, `closeSettings`, keyboard effect, `openPauseMenu`, `confirmInfiniteRestart` — enable settings from ready/playing when no countdown or overlay, and add the same pause/restart keyboard paths; modify.
- Preserve existing infinite mode deadline-shift behavior when settings/pause overlays close, and reuse its confirmation-based 3-second restart.
- Countdown `Escape`/`R` must use existing `openPauseMenu` pending-countdown behavior; restart confirmation resumes the current mode’s restart path.

## Acceptance Criteria
- [x] Title screen has an accessible settings button that opens the same audio controls as in-game settings.
- [x] Stage ready and checkpoint screens can open settings; stage countdown disables settings.
- [x] Infinite ready screen can open settings; infinite countdown disables settings.
- [x] In either mode, Escape during gameplay/countdown opens pause and freezes the existing clocks; existing modal Escape behavior remains intact.
- [x] In either mode, R opens pause with restart confirmation; Enter on the focused affirmative action confirms, the negative action preserves the current run, and confirmation resets the mode with its existing 3-second countdown.
- [x] Typing targets, dialog controls, and repeated R keydown do not accidentally pause/restart.

## Validation
- Focused tests when explicitly requested: `npx vitest run src/game/GameScreen.test.tsx src/infinite/InfiniteModeScreen.test.tsx --maxWorkers=2`.
- If test verification is requested, run the focused command, then `npm run lint` and `npm run build`.
- Inspect final diff with `git diff --check`; report any validation not run.

## Commit Message
```text
feat(game): expose audio settings and add pause shortcuts

Plan: 2026-11-05-game-settings-and-keyboard-controls
Phase: P01-settings-and-hotkeys
Task: T01-settings-and-hotkeys

- Open settings from title and ready screens in both modes
- Remove duplicate game help from settings; route Escape/R through pause and restart flows with Enter confirmation
```

## Progress
- [x] Implementation complete
- [x] Validation complete
- commit: `f10148d`

## Execution Result — 2026-11-05
- Added title-screen `설정` entry point and enabled the top-right settings button on stage-ready/checkpoint and infinite-ready screens. Countdown, terminal, and modal states remain locked.
- `Escape` opens the existing pause menu during gameplay/countdowns. `R` opens it with restart confirmation selected; Enter confirms the focused affirmative action. Existing confirmation handlers keep the same stage/mode reset and 3-second countdown behavior. Text-entry targets, open dialogs, and repeated keydown are ignored.
- Existing audio preferences and controls are reused. Settings opened before gameplay do not shift game deadlines; settings opened during play preserve existing pause/resume deadline handling.
- Removed the duplicate controls and pursuer explanation from the stage-mode settings dialog; the separate game instructions dialog remains the place for that guide.
- Initial deployment CI found a pause button handler passing its click event as the confirmation argument. Wrapped the handler in both modes and updated settings tests for the intentionally removed duplicate guide content.
- Local targeted tests, full CI tests (1981 passed), lint and production build passed. GitHub Actions verified and deployed commit `f10148d` to Azure Static Web Apps in run `41959486047`.
