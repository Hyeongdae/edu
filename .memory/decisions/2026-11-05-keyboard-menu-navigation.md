# Decisions: Keyboard Menu Navigation

- Date: 2026-11-05
- Status: Confirmed

## D01. Navigation scope
- **Chosen**: Add keyboard navigation to every game menu and dialog: title, mode and stage selection, instructions, leaderboard, settings, customization, pause, checkpoint, result, and confirmation prompts.
- **Rationale**: The user selected all menus and popups.

## D02. Directional navigation
- **Chosen**: Arrow keys move focus between enabled, visible menu actions according to their visual layout. Vertical lists use Up/Down; horizontal rows and tabs use Left/Right. At a boundary, focus remains on the current end item.
- **Rationale**: Match the visible arrangement and keep navigation predictable. Boundary wrap was not selected; use the recommended stop-at-boundary behavior.

## D03. Activation and initial focus
- **Chosen**: Enter activates the focused item. When a menu or dialog opens, focus its primary action (for example, Retry on a result screen), so Enter works immediately. Preserve normal Tab navigation and each existing Escape behavior.
- **Rationale**: The user expects Enter to restart from the result screen and arrow navigation to reach the following actions.

## D04. Gameplay controls
- **Chosen**: Keep D/J/Space gameplay controls unchanged. Arrow navigation applies to menus and dialogs; native keyboard behavior of focused inputs and sliders remains available.
- **Rationale**: Add menu navigation without changing established gameplay controls or sound-setting interactions.
