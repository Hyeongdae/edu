# Decisions: Game Pause Menu

- Date: 2026-11-03
- Status: Confirmed

## D01. Pause button placement
- **Chosen**: Add a pause button beside the settings button in both stage and infinite modes.
- **Rationale**: The user asked for an in-game pause control in both modes.

## D02. Pause button availability
- **Chosen**: Show the button during active play and 3-second countdowns. Hide it on mode/stage selection and checkpoint choice screens.
- **Rationale**: The user selected availability during countdowns while limiting the control to gameplay flow.

## D03. Pause menu actions
- **Chosen**: Provide `게임 재개`, `다시시작`, and `타이틀로 돌아가기` in a game-styled modal menu.
- **Rationale**: These are the three actions requested by the user.

## D04. Resume behavior
- **Chosen**: Resume after a 3-second countdown, preserving the current score and game state. Keep game time, events, and pursuer movement paused through the countdown.
- **Rationale**: The user requested a 3-second countdown before continuing from the current score.

## D05. Restart behavior
- **Chosen**: Ask for confirmation. `예` restarts the same stage or mode at 0 points after a 3-second countdown; `아니오` returns to the pause menu.
- **Rationale**: The user requested confirmation, a clean restart, and a countdown. The user chose the pause menu as the destination for `아니오`.
- **Chosen for checkpoint countdown**: Restart the stage that is about to begin, at 0 points after the 3-second countdown.
- **Rationale**: The user clarified that restart during the inter-stage countdown should target the upcoming stage.

## D06. Return-to-title behavior
- **Chosen**: Ask for confirmation before returning to the title. `예` returns to the title; `아니오` returns to the pause menu.
- **Rationale**: The user explicitly requested confirmation before leaving the game.

## D07. Audio while paused
- **Chosen**: Stop background music while the pause menu is open and resume it when the 3-second resume countdown begins.
- **Rationale**: The user selected this behavior.

## D08. Countdown interruption
- **Chosen**: If paused during a start or stage-transition countdown, cancel that countdown; choosing resume starts a fresh 3-second countdown before the pending game transition continues.
- **Rationale**: The user requested pause availability during countdowns and a 3-second countdown on resume.

## Codebase findings
- Stage mode already pauses timers and pursuer deadlines while its settings dialog is open via `resumeGameAfterPause`.
- Infinite mode pauses its pursuer/event deadlines while settings are open and stores the pause start time.
- Stage mode's `checkpoint` state represents a cleared stage waiting to continue; restarting there needs a chosen stage target, captured above.
