# Decisions: In-Game Settings and Keyboard Controls

- Date: 2026-11-05
- Status: Confirmed

## D01. Settings entry points
- **Chosen**: Allow the audio settings dialog from the title screen, stage-mode ready/checkpoint screens, infinite-mode ready screen, and active gameplay. Disable the settings button during any start/continue/restart countdown and while another dialog or terminal animation is active.
- **Rationale**: The sound controls are currently only reachable from a settings dialog whose trigger is disabled before the game enters `playing`; the title screen has no settings trigger.

## D02. Pause keyboard shortcut
- **Chosen**: `Escape` opens the existing pause menu while playing or during a start/continue countdown in either mode. Existing dialog behavior keeps Escape closing settings or other dialogs rather than opening a second dialog.
- **Rationale**: Reuse the existing pause lifecycle so timers, pursuer movement, audio, and countdown recovery remain consistent.

## D03. Restart keyboard shortcut
- **Chosen**: `R` opens the existing pause menu with the restart confirmation selected. The affirmative button receives focus, and Enter confirms it. The existing mode-specific restart path and 3-second countdown run; choosing the negative action returns to the pause menu.
- **Rationale**: The game already asks for confirmation before a restart and starts a fresh run after the countdown. This adds a shortcut without bypassing that safeguard or duplicating restart logic.

## D04. Keyboard scope
- **Chosen**: Handle `R` and `Escape` only in game screens, when no dialog is already open and the event target is not a text-entry control. `R` does not repeat while held.
- **Rationale**: Avoid stealing text input or interfering with settings, ranking, and confirmation dialog keyboard behavior.
