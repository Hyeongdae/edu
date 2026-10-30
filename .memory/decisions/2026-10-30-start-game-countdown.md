# Decisions: Start Game Countdown

- Date: 2026-10-30
- Status: Confirmed

## D01. Countdown behavior
- **Chosen**: Reuse the existing three-second `3`, `2`, `1` countdown after the player presses the selected stage's Start button. Keep the selected stair scene visible beneath it.
- **Rationale**: This matches the stage-transition countdown the user already approved and keeps the game flow consistent.

## D02. When gameplay begins
- **Chosen**: Do not start the stage timer, player input, or pursuer movement until the countdown reaches zero; start the selected stage at that moment.
- **Rationale**: The existing stage-transition rule starts its timer and pursuer only after the countdown. The same rule makes the initial countdown fair.

## D03. Audio and lifecycle
- **Chosen**: Keep starting background music in the Start button click handler to preserve browser user-gesture playback. Use the existing visibility-aware countdown timing and cancel its pending timer when the screen unmounts.
- **Rationale**: Audio playback should retain the current user-gesture behavior; countdown lifecycle should match the existing stage transition.
