# Decisions: Title Scene and Guide Copy

- Date: 2026-10-29
- Status: Confirmed

## D01. Instructions encouragement copy
- **Chosen**: Replace the guide's encouragement with this exact text: `5단계를 모두 클리어하고 멋지게 퇴근해봐요 화이팅! 잡히면 야근일지도..`
- **Rationale**: Use the requested playful wording about finishing the five stages and the risk of overtime if caught.

## D02. Title background scene
- **Chosen**: Use the existing in-game staircase scene as the title background, including both the player and pursuer shown idle. Hide the scene's direction heading and live instruction hint while on the title.
- **Rationale**: Show the actual game setting and characters while keeping the title readable and free of gameplay instructions.

## D03. Transition to stage selection
- **Chosen**: Keep the same staircase scene mounted behind both the title and stage selection. On `게임 시작`, fade out the title and briefly fade in the stage selection panel.
- **Rationale**: The background does not change during the transition, making stage selection feel like the next layer of the same game screen.

## D04. Motion accessibility
- **Chosen**: Use a short fade (about 200 ms) and skip it for users who prefer reduced motion.
- **Rationale**: Preserve the requested transition while following the app's existing `prefers-reduced-motion` styling convention.

## Existing code facts
- `GameInstructionsDialog` currently displays the encouragement text in `src/game/GameInstructionsDialog.tsx`.
- The title and game content are currently mutually exclusive in `src/game/GameScreen.tsx`; title mode does not render the game scene.
- `StairScene` already renders the staircase, player, and pursuer for a ready game state. It also renders `.scene-heading` and `.scene-hint`, which should be hidden behind the title.
- Stage selection already appears over the game scene, so the scene can remain unchanged while the title and stage selection layers transition.
- `src/game/pixel-theme.css` already contains a `prefers-reduced-motion: reduce` media query.
- The settings dialog has a separate partial control/pursuer explanation; the current title-screen decision leaves that content unchanged.
