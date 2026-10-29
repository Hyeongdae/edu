# Decisions: Dex Escape Number One Title Screen

- Date: 2026-10-29
- Status: Confirmed

## D01. Game title and entry screen
- **Chosen**: After authentication, show a title screen named `덱스 탈출 넘버원` before the stage selection screen.
- **Rationale**: The current entry immediately presents stage selection; a title screen gives the game a clear identity and a deliberate entry point.

## D02. Game start flow
- **Chosen**: The title screen's `게임 시작` button opens the existing stage selection screen. The player chooses an unlocked stage there and presses its existing start button to begin.
- **Rationale**: Preserve stage selection and unlocked-stage progress while adding an explicit title screen.

## D03. Game instructions entry point
- **Chosen**: The title screen has a `게임 설명` button that opens the existing instructions dialog. Remove the `?` button from the game screen; do not add a replacement instructions button during gameplay.
- **Rationale**: Make the instructions discoverable before play and keep the active game screen clear.

## D04. Instructions dialog and game-over flow
- **Chosen**: Reuse the current modal guide and its existing contents. Keep existing settings-dialog help text, account information, and audio settings unchanged. Closing the guide returns to the title screen. Keep the current game-over `다시 시작` flow to stage selection.
- **Rationale**: Reuse the existing complete guide dialog without changing established retry or settings behavior.

## D05. Visual style and authentication
- **Chosen**: Match the existing pixel-art game styling. Keep the current Entra authentication flow unchanged; show the title after authentication.
- **Rationale**: Reuse the established visual system and preserve the current access boundary.

## Existing code facts
- `GameScreen` currently initializes directly into `ready`, where `StageSelectPanel` is shown.
- The current `?` button opens `GameInstructionsDialog`; the guide already contains controls, stage goals, and encouragement.
- The settings dialog contains a separate, partial copy of the control and pursuer explanations; those existing settings contents are outside the requested entry-point change and remain unchanged.
- The game-over `다시 시작` button returns to stage selection through `handleShowStageSelection`.

## D06. Background music timing
- **Chosen**: Preserve the existing attempt to start background music when the authenticated game shell loads; do not change audio timing as part of the title-screen work.
- **Rationale**: The request concerns the entry screen and guide access. Changing when audio starts is a separate behavior and should not expand this feature.

## D07. Settings help content
- **Chosen**: Keep the existing partial control and pursuer help text in settings unchanged. The dedicated `게임 설명` dialog is opened only from the title screen; remove the `?` trigger from the game screen.
- **Rationale**: The user wants the guide entry point on the title and the existing question-mark button removed, while leaving the existing settings contents as they are.
