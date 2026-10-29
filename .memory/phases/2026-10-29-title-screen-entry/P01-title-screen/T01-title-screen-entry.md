# Task: T01 Title Screen Entry

## Status: done

## Goal
After authentication, show a title view for `덱스 탈출 넘버원` with exactly two accessible actions. The player can enter stage selection from `게임 시작`, or read the existing guide from `게임 설명`; no stage clock or pursuer movement begins until the player starts a stage.

## Decision Summary
- Show the title after the existing Entra auth gate. Use the pixel-art visual system already loaded by `GameScreen`.
- `게임 시작` reveals the existing `StageSelectPanel`; its own `시작하기` continues to start the selected unlocked stage.
- `게임 설명` opens the existing `GameInstructionsDialog` only from the title. Remove the in-game `?` trigger. Closing the dialog returns focus to the title's `게임 설명` button.
- Preserve the existing game-over `다시 시작` route directly to stage selection, saved unlock state and game logic. Keep the existing settings dialog contents unchanged.

## Implementation

### I01. Add a title entry state and connect the existing stage flow

- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen`, `handleStart`, `handleShowStageSelection`, `openGameDialog`, `closeInstructions`, title JSX, focus refs/effect; modify
  - `src/game/GameScreen.test.tsx` :: `GameScreen` entry, start, guide, focus, and retry integration tests; modify
  - `src/App.tsx` :: `GameAppShell` authentication-time audio startup; read-only, preserve existing behavior

#### Details
- **State & types**:
  - Add `isTitleScreen: boolean`, initialized to `true`, local to `GameScreen`. Do not add a `GameState` field or persist title visibility.
  - Add `handleEnterStageSelection(): void`; when no dialog is open and `gameState.status === "ready"`, set `isTitleScreen` to `false`. This handler must not call `startGame`, change `gameState`, invoke audio methods, reset progress, or touch saved records.
  - Keep `handleStart(): void` as the existing stage selector's action. It calls `startGame`, sets `runStartedRef`, initializes run save/error state, and requests BGM playback after the player presses the stage selector's existing `시작하기` button. `src/App.tsx` also retains its existing authentication-time playback attempt.
  - Keep the existing `activeDialog` union (`"settings" | "instructions" | null`) and modal pause logic. Instructions are reachable only from the title button, so do not show an instructions trigger in the stage selector, active game, checkpoint, or result views.
  - Reuse `instructionsTriggerRef` for the title's `게임 설명` button. Existing modal focus logic must move focus to `instructionsCloseRef` when opened and restore it to `instructionsTriggerRef` after close.
- **Render flow**:
  1. Render the title view before the regular stage/game view while `isTitleScreen` is true. It contains an `h1` with exact text `덱스 탈출 넘버원` and exactly two buttons: `게임 시작` and `게임 설명`.
  2. Do not render `GameHud`, `StairScene`, `StageSelectPanel`, `ControlButtons`, `CheckpointPanel`, result panel, settings trigger, or gameplay footer in the title view. The instructions modal may appear over the title after `게임 설명` is activated.
  3. `게임 시작` sets `isTitleScreen` false and reveals the already initialized `StageSelectPanel`, including existing selected/default unlocked stage and progress notice. It does not start a run.
  4. Render all existing game-status branches unchanged after title exit. The game-over restart path continues to call `handleShowStageSelection` and bypasses the title.
  5. Remove the existing in-game button whose visible content is `?`. Do not add a text-labeled guide button during gameplay.
- **Guide modal gate**: Permit `openGameDialog("instructions")` when the title is visible as well as under existing allowed statuses, but ensure the only rendered trigger is the title button. Closing via close button, Escape, or backdrop must dismiss the dialog without changing `isTitleScreen`; return focus to the title trigger. There is no paused run when the title guide opens.
- **Tests** in `GameScreen.test.tsx`:
  - Initial render shows the exact title heading and exactly the two named title buttons; stage selection, HUD, stair scene controls, settings trigger, and footer are absent.
  - Activating `게임 설명` opens the existing accessible instructions dialog; close button, Escape, and backdrop dismissal return to the title; focus returns to the `게임 설명` button. No game start or score/progress write occurs.
  - Activating `게임 시작` reveals the stage selector with the existing unlocked-stage options and `시작하기`; before that second button is pressed, the game remains `ready` and the stage clock and pursuer are not running. Leave authentication-time audio startup behavior unchanged.
  - Selecting an unlocked stage then pressing `시작하기` still starts exactly that stage; locked-stage behavior remains unchanged.
  - After a result, `다시 시작` still returns directly to stage selection; no title view or guide trigger appears in gameplay, stage selection, checkpoint, or result.
  - Existing modal pause/resume, settings audio, record persistence, and stage-selection tests remain valid. Update existing tests that assumed `StageSelectPanel` was the initial render to first activate `게임 시작`.

### I02. Style the title view using the existing pixel theme

- Related Files:
  - `src/game/GameScreen.tsx` :: title view classes and accessible heading/button markup; modify
  - `src/game/game.css` :: title layout and responsive rules; modify
  - `src/game/pixel-theme.css` :: title/button pixel theme selectors if needed; modify only if needed

#### Details
- **Markup**: Use semantic `main`/existing `.game-frame`, one `section` labelled by the title heading, and two native `<button type="button">` controls with visible text and accessible names `게임 시작`, `게임 설명`.
- **Visuals**: Reuse current full-screen frame, pixel palette, border treatment, and button tokens. Center the title and two actions within the available frame. Use a primary style for start and a secondary style for guide, without adding a third action or decorative control that resembles one.
- **Responsive behavior**: Keep both buttons visible and tappable at phone widths and short viewport heights; permit title content to shrink/scroll if necessary. Respect existing reduced-motion behavior; no mandatory title animation is required.
- **Focus**: On initial title render, provide a clear visible keyboard focus when a title action receives focus. Do not autofocus a control in a way that steals focus from auth navigation.

## Acceptance Criteria
- [x] After successful authentication, the first game view is a pixel-styled title screen with the exact title and exactly two buttons: `게임 시작` and `게임 설명`. Existing authentication-time audio startup behavior is unchanged.
- [x] `게임 시작` opens the existing unlocked stage selector without starting its timer, score, or pursuer; the stage selector's `시작하기` begins play normally.
- [x] The existing guide dialog opens from the title's `게임 설명` button and closes back to the title with keyboard focus restored.
- [x] No `?` guide button or replacement guide button appears in the stage selector, gameplay, checkpoint, or result screens.
- [x] Existing stage selection, unlock progress, settings account, help text, audio, game-over retry, and record behavior are preserved.
- [x] Title layout remains usable on mobile and short viewport sizes.

## Validation
- `npm.cmd test -- src/game/GameScreen.test.tsx src/game/StageSelectPanel.test.tsx src/game/GameInstructionsDialog.test.tsx` — title entry, stage flow, guide dialog, and related regressions pass.
- `npm.cmd run lint` — no lint errors.
- `npm.cmd run build` — TypeScript checks and Vite production build pass.

## Commit Message
```text
feat(game): add title screen entry flow

Plan: 2026-10-29-title-screen-entry
Phase: P01-title-screen
Task: T01-title-screen-entry

- Add Dex Escape Number One title screen and start/guide actions
- Preserve stage selection, guide modal accessibility, and retry flow
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: 69b039b
