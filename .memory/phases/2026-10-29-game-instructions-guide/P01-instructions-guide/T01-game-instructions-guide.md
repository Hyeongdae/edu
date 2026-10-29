# Task: T01 Game Instructions Guide

## Status: done

## Goal
Add an in-game guide to the main descending stair game so players can open it from the top-right area before or during play, understand desktop/mobile controls, see the exact five-stage time and score goals plus obstacle/chaser difficulty, and get encouragement to finish all five stages and exit the office. During active play, opening the guide pauses gameplay and closing it resumes from the same state without charging time or allowing a pursuer step.

## Decision Summary
- Put a separate `게임 설명` button beside the existing settings button in the top-right of the main game frame.
- Render the guide as a modal dialog. Opening it while playing uses the existing tick-before-pause and resume-after-pause behavior; opening it before starting does not start timers.
- Explain D (move down one stair), J (turn at a corner while moving down), Space (jump across an obstacle by moving two stairs), and the equivalent three on-screen mobile buttons.
- Read stage data from `STAGE_RULES`, with columns for stage, time, target score, obstacle probability, and normal pursuer interval.
- Include this exact encouragement: `5단계를 모두 클리어하고 멋지게 퇴근해 봐요! 끝까지 파이팅!`
- Match the existing pixel dialog styling and accessibility behavior: labeled modal, close button, Escape to close, focus trap, focus moved into the dialog on open and returned to its trigger on close.

## Implementation

### I01. Create a stage-data-backed guide dialog

- Related Files:
  - `src/game/GameInstructionsDialog.tsx` :: `GameInstructionsDialog`, stage table rendering, control/help content; new
  - `src/game/GameInstructionsDialog.test.tsx` :: guide content and modal accessibility tests; new
  - `src/game/stageRules.ts` :: `STAGE_RULES`, read-only source of the five stage rows; read-only

#### Details

- **Component API**:
  ```typescript
  interface GameInstructionsDialogProps {
    onClose: () => void;
    closeButtonRef: React.RefObject<HTMLButtonElement | null>;
    dialogRef: React.RefObject<HTMLElement | null>;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  }
  export function GameInstructionsDialog(props: GameInstructionsDialogProps): React.ReactElement;
  ```
- **Source schema**: `StageRule` in `stageRules.ts` has `stage: GameStage`, `durationMs: number`, `scoreRequired: number`, `obstacleProbability: number`, and `pursuerStepIntervalMs: number`. Iterate over `STAGE_RULES`; do not define a second stage array.
- **Display formatting**:
  - `durationMs / 1000` as integer seconds: `90초`, `75초`, `65초`, `60초`, `50초`.
  - `scoreRequired` as `${value}점`: `150점`, `200점`, `250점`, `300점`, `350점`.
  - `obstacleProbability * 100` as integer percent: `10%`, `20%`, `30%`, `40%`, `50%`.
  - `pursuerStepIntervalMs / 1000` in seconds with trailing zeros removed: `0.5초`, `0.4초`, `0.35초`, `0.3초`, `0.28초` per stair.
- **Contents**:
  - Heading `게임 설명`, a close button with accessible name `게임 설명 닫기`, and `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the heading.
  - Desktop controls: D descends one stair; J turns at a corner while descending one stair; Space jumps over the obstacle and moves two stairs, and only succeeds when the landing stair is clear.
  - Mobile controls: use the on-screen descend, turn, and jump buttons, with the same movement behavior.
  - Five-row stage table with accessible column headers `단계`, `제한시간`, `목표 점수`, `장애물 확률`, `추격자 속도`.
  - Encouragement text exactly as listed in the Decision Summary.
- **Tests**: Assert the three keyboard controls and mobile control explanation render; assert all five rows display the exact source values; assert the modal accessible name, close control, and focus/keyboard callbacks are wired.

### I02. Connect the guide to the main game and preserve pause semantics

- Related Files:
  - `src/game/GameScreen.tsx` :: dialog state, pause/resume handlers, top-right buttons, timer/input gates, focus management, modal render; modify
  - `src/game/game.css` :: `.game-instructions-button`, guide dialog/table layout, narrow viewport rules; modify
  - `src/game/pixel-theme.css` :: pixel treatment for guide button and dialog/table; modify
  - `src/game/GameScreen.test.tsx` :: guide entry point, modal pause/resume, keyboard and focus integration; modify

#### Details

- **State and refs**:
  - Track active dialog with `"settings" | "instructions" | null` (or equivalent typed state), plus a ref mirror used by global listeners.
  - Maintain one modal-open timestamp for a paused run. Do not allow both dialogs open concurrently.
  - Keep separate trigger and close-button refs for settings and guide. Restore focus to the guide trigger after guide close.
- **Open flow**:
  1. In `playing`, call `tickGame(gameState, openedAt)` before pausing. If it ends the game, do not open the guide. Otherwise store `openedAt`, open the guide, and stop interval-driven ticks and input handling.
  2. In `ready`, open the guide without starting or changing any game clocks. The guide button must remain usable before the player starts so stage requirements can be read in advance.
  3. Prevent opening a second dialog while one is already open. Keep existing settings availability and behavior intact.
- **Close flow**: On close button, Escape, or backdrop click, close the guide. If it paused a playing run, call `resumeGameAfterPause(state, openedAt, closedAt)` exactly once. If opened from `ready`, only close the guide. Return focus to the guide trigger.
- **Gameplay gates**: Treat either settings or guide as a paused modal for keyboard handling, input buttons, timer interval, and `visibilitychange` reconciliation. Resume the same stage, score, event countdown, and pursuer schedule after closing.
- **Button**: Add a distinct top-right `게임 설명` button adjacent to settings with `aria-haspopup="dialog"`, `aria-expanded`, and `aria-controls`. Preserve access at `ready` and `playing`; prevent opening over checkpoint/ending modal states. Keep both buttons visible and tappable at narrow widths.
- **Visual behavior**: Follow existing pixel dialog colors, borders, focus outlines, and backdrop. Make the guide body/table vertically scrollable within viewport height; on mobile use compact cells or stacked stage rows without horizontal page overflow. Keep the table readable at desktop and phone widths.
- **Regression tests**:
  - Open guide from `ready`, verify it does not start the timer, close with Escape, and verify focus returns to the trigger.
  - Open during `playing`, advance fake time while it is open, verify stage time, active event time, player state, and pursuer position do not advance; close and verify timers resume from the paused values.
  - Verify keyboard Tab focus remains trapped, backdrop close works, and keyboard movement does not leak through while guide is open.
  - Verify settings dialog behavior and its audio controls remain intact.

## Acceptance Criteria
- [x] The top-right `게임 설명` button opens a separately labeled modal beside settings.
- [x] The guide explains desktop and on-screen mobile controls, including that Space jumps two stairs over an obstacle.
- [x] All five rows show the exact stage duration, target score, obstacle probability, and normal pursuer interval from `STAGE_RULES`.
- [x] The guide includes the confirmed five-stage office-exit encouragement.
- [x] Opening in `ready` does not start play; opening during play pauses stage/event clocks and pursuer movement; closing resumes correctly.
- [x] Escape/backdrop/close button, focus trap, focus restoration, keyboard/touch layouts, and existing settings behavior work.

## Validation
- `npm.cmd test -- src/game/GameInstructionsDialog.test.tsx src/game/GameScreen.test.tsx` — guide content, modal interactions, pause/resume, and main-screen regression tests pass.
- `npm.cmd run lint` — no lint errors.
- `npm.cmd run build` — TypeScript and Vite production build pass.

## Commit Message
```text
feat(game): add in-game instructions guide

Plan: 2026-10-29-game-instructions-guide
Phase: P01-instructions-guide
Task: T01-game-instructions-guide

- Explain controls and five-stage goals in a modal guide
- Pause the run while the guide is open
```

## Progress
- [x] Implementation complete
- [x] Validation passed (2 files, 109 tests; lint and build passed; Vite retains the existing large-chunk warning)
- commit: pending