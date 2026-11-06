# Task: T02 Keyboard Navigation Across Game Menus

## Status: done

## Goal
Connect the tested directional navigation handler to every game menu and dialog in stage and infinite modes. Preserve each screen's current action and keyboard shortcuts, and make the primary action focused when a screen opens so Enter works immediately (including Retry on a result screen).

## Decision Summary
- Apply navigation to title, mode/stage selection, instructions, leaderboard, settings, customization, pause, checkpoint, result, and confirmation menus/popups in both modes where applicable.
- Up/Down and Left/Right follow the visible layout. At a boundary focus stops. Enter activates the focused native action; normal Tab and existing Escape behavior remain unchanged.
- Keep D/J/Space gameplay controls and native keyboard behavior for sound sliders and inputs unchanged. Do not change game rules, scores, saved data, or ranking APIs.

## Implementation

### I01. Mark stage-mode menus and connect root keyboard delegation
- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen` root render and inline title, result, and settings panels - add `onKeyDown={handleDirectionalMenuNavigation}` to the game root and `data-keyboard-menu` to each distinct menu/action group; add an initial focus only to groups without an existing primary-action focus/ref.
  - `src/game/StageSelectPanel.tsx` :: `StageSelectPanel` - mark the stage and action menu scope while retaining focus on the selected unlocked stage.
  - `src/game/StageSelectPanel.test.tsx` - test directional navigation from selected stage through the visible stage row and down to Start/Ranking/Title actions.
  - `src/game/GameScreen.test.tsx` - test title focus/navigation, result default focus to Retry, arrow navigation to Ranking and Title, Enter activation, and settings action navigation.
- Requirements:
  - Keep separate focus groups where simultaneous game HUD controls must not become result or stage-selection menu candidates.
  - Do not add the marker to the gameplay scene or control surfaces. The handler should only activate when a key event originates within a marked menu scope.
  - Preserve existing focus restoration refs, dialog key handlers, and current stage-selection disabled-stage rules.

### I02. Integrate stage-mode dialogs and customization
- Related Files:
  - `src/game/CheckpointPanel.tsx` :: `CheckpointPanel` - mark Continue/Quit and any actionable record-recovery items as one menu scope; preserve Continue initial focus and Tab trap.
  - `src/game/CheckpointPanel.test.tsx` - test arrow focus through enabled actions and Enter activation.
  - `src/game/PauseMenuDialog.tsx` :: `PauseMenuDialog` - mark the active pause or confirmation action group; preserve Resume/Yes initial focus, the existing Enter confirmation behavior, Escape behavior, and Tab trap.
  - `src/game/PauseMenuDialog.test.tsx` - test Up/Down focus for Resume/Restart/Title and Yes/No, plus Enter on the focused action.
  - `src/game/GameInstructionsDialog.tsx` :: `GameInstructionsDialog` - mark close and tab actions; its existing tab-specific Left/Right/Home/End handling must run first and `defaultPrevented` arrows must not be reprocessed by the root handler.
  - `src/game/GameInstructionsDialog.test.tsx` - verify tab arrow behavior remains intact and other menu actions are directionally reachable.
  - `src/leaderboard/LeaderboardDialog.tsx` :: `LeaderboardDialog` - mark close and mode-tab actions, preserve existing Tab/Escape and initial close focus behavior.
  - `src/leaderboard/LeaderboardDialog.test.tsx` - verify menu arrows and existing keyboard dismissal/focus return behavior.
  - `src/character/CharacterCustomizationDialog.tsx` :: `CharacterCustomizationDialog` - mark dialog tabs and actions; appearance choices are native radio inputs, so their arrow-key selection remains browser-native; leave sliders and other native inputs to browser keyboard behavior; preserve its current modal focus management.
  - `src/character/CharacterCustomizationDialog.test.tsx` - verify arrow navigation between dialog tabs and actions, while radio-group and slider arrows retain native browser behavior.

### I03. Integrate infinite-mode menus and dialogs
- Related Files:
  - `src/infinite/InfiniteModeScreen.tsx` :: `InfiniteModeScreen` - attach root key delegation; mark infinite start/result/settings action groups; focus Game Start on the ready panel and Retry on the result panel when they appear.
  - `src/infinite/InfiniteModeScreen.test.tsx` - verify initial focus, Up/Down and Left/Right focus changes where laid out, Enter starts/retries/opens selected action, and gameplay key handling/pause shortcuts remain unchanged.
- Requirements:
  - Dialog descendants may bubble arrow events to the screen root, but the handler must resolve the closest marked menu group and honor `defaultPrevented` from existing handlers.
  - Do not change D/J/Space behavior, R restart confirmation, Escape pause/dismiss behavior, score timing, BGM, or result/ranking submission.

### I04. Integration verification
- Run focused tests for every modified component listed in I01-I03. Then run `npm run test -- --run --maxWorkers=2`, `npm run lint`, `npm run build`, and `git diff --check`.
- Verify all screen states remain keyboard reachable without a mouse, Tab still works, hidden/disabled choices are skipped, and a slider keeps its native arrow-key adjustment.
- Inspect the existing build warning and record whether it is unchanged; do not add unrelated performance changes.

#### Expected Interaction Flow
1. When a menu appears, its existing primary focus remains; if none exists, focus the menu's primary action. For example, a result view focuses Retry.
2. Pressing Enter activates the focused button through its native behavior.
3. Pressing an arrow moves focus to the nearest enabled visible action in that visual direction. At the first/last edge, focus remains in place.
4. Pressing Tab continues to move focus with existing dialog traps; pressing Escape follows the current screen's behavior.
5. When focus is on a range slider or another native form input, arrow keys keep native input behavior and do not move menu focus.

## Acceptance Criteria
- [x] Every named stage-mode and infinite-mode menu/dialog exposes directional focus navigation.
- [x] Result panels open with Retry focused; Enter retries, and Down reaches the following result action.
- [x] Stage/mode selection, tabs, pause/checkpoint confirmations, customization choices, settings actions, and leaderboard actions can be reached by arrows and activated with Enter.
- [x] Disabled/hidden actions are skipped and navigation stops at a boundary.
- [x] Tab traps/restoration, Escape, R restart confirmation, D/J/Space controls, sound sliders, scores, and ranking behavior remain intact.
- [x] Focused tests, full suite, lint, build, and diff check pass.

## Validation
- Focused component tests: `npm run test -- --run src/game/GameScreen.test.tsx src/game/StageSelectPanel.test.tsx src/game/CheckpointPanel.test.tsx src/game/PauseMenuDialog.test.tsx src/game/GameInstructionsDialog.test.tsx src/leaderboard/LeaderboardDialog.test.tsx src/character/CharacterCustomizationDialog.test.tsx src/infinite/InfiniteModeScreen.test.tsx`
- Full suite: `npm run test -- --run --maxWorkers=2`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Commit Message
```text
feat(keyboard): navigate all game menus with arrows

Plan: 2026-11-05-keyboard-menu-navigation
Phase: P01-directional-menus
Task: T02-menu-navigation-integration

- Add directional selection to game menus, dialogs, and result screens
- Keep native Enter, Tab, Escape, sliders, and gameplay controls working
```

## Progress
- [x] Implementation complete
- [x] Validation passed: focused tests 8 files/171 tests; full suite 60 files/2012 tests; lint; build; `git diff --check`.
- commit: `5c4cfc0`
