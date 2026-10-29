# Decisions: Title Copy and Overtime Capture

- Date: 2026-10-29
- Status: Confirmed

## D01. Title subtitle
- **Chosen**: Replace the subtitle under `덱스 탈출 넘버원` with exactly `계단을 내려가 1층까지 도착해 퇴근하세요!`.
- **Source**: Explicit user request.
- **Rationale**: State the destination and the goal of leaving work directly on the title screen.

## D02. Capture scene placement and duration
- **Chosen**: After the existing approximately 500 ms staircase capture animation, show a separate office overtime scene for approximately 2,000 ms, then automatically reveal the existing result and leaderboard screen.
- **Source**: User selected option 1 for placement and option 1 for duration.
- **Rationale**: Give getting caught a short narrative ending without requiring another button press before viewing the result.

## D03. Office scenery
- **Chosen**: Use the game's pixel art style for a nighttime office with desks, computers, stacks of documents, and windows showing a neon city skyline.
- **Source**: User selected option 1 for the office background; pixel styling follows the existing game.
- **Rationale**: Make the overtime destination recognizable and keep the scene visually consistent with the stair game.

## D04. Character action
- **Chosen**: The existing older office-worker pursuer grabs the young protagonist's arm and pulls them toward a desk. The protagonist drops into the chair and lowers their head. Complete this action within the approximately two-second office scene.
- **Source**: User selected option 1 for the animation action.
- **Rationale**: Show clearly that the escape failed and the protagonist has been brought back to work.

## D05. Trigger and game-state boundaries
- **Chosen**: Show the overtime scene only for a run ending with `endReason === "caught"`, at any stage. Keep the engine's existing end time and frozen result; save the ranking at capture as it does today. The office scene is presentation after the result is determined, so its duration must not change score, remaining time, stage unlocks, or ranking order.
- **Source**: The requested trigger is being caught; timing and persistence boundaries follow existing code.
- **Rationale**: A visual sequence must not affect the player's recorded result. Timeout, checkpoint quit, and stage-five success already have their own outcomes.

## D06. Rendering and animation lifecycle
- **Chosen**: Follow the existing SVG/CSS pixel-scene approach and reuse the young/older character designs. Add the required arm-grab and seated/slumped artwork for the office scene; the current gameplay poses do not provide those gestures. Keep the existing approximately 500 ms capture window distinct from the following 2,000 ms office sequence. Derive elapsed time from the capture result timestamp so rerenders or tab visibility changes do not restart the scene. Clean up scene timers when unmounting or starting another run.
- **Source**: Code-derived implementation constraints.
- **Rationale**: Existing scenes are drawn with SVG and animated using CSS. A dedicated presentation layer can add the new gesture without changing stair movement rules or the success ending.

## D07. Reduced motion and focus
- **Chosen**: Follow the existing office-exit ending convention: with `prefers-reduced-motion: reduce`, skip the moving sequence and its delay, and show the final overtime illustration with the result instead. During the ordinary moving scene, treat it as the active foreground and prevent focus or gameplay/settings interaction behind it. Restore focus to the existing restart action when the result is shown.
- **Source**: Existing motion-accessibility and ending-focus conventions, applied to the new scene.
- **Rationale**: Preserve the story without requiring motion and keep keyboard focus on the currently visible screen.

## D08. Text and audio scope
- **Chosen**: The requested subtitle is the confirmed text change. No new voice, sound effect, music track, or dialogue was requested. Keep the existing game-over audio lifecycle when adding this visual scene.
- **Source**: Request scope and existing audio ownership.
- **Rationale**: Complete the chosen character animation and background without inventing an additional audio feature.

## Existing code facts
- `src/game/GameScreen.tsx` renders `.game-title-tagline`, controls capture visibility, saves `stageResult`, renders the result/leaderboard, and stops BGM when the status becomes `game-over`.
- `src/game/gameEngine.ts` determines the caught result immediately and keeps `captureEndsAt` active for the existing capture animation. This is already a completed game, even while the short capture animation is visible.
- `src/game/useOfficeExitEnding.ts` already uses a result timestamp, a bounded presentation timer, and the reduced-motion preference for the stage-five success ending.
- `src/game/OfficeExitEnding.tsx` draws a company scene with SVG and reuses `PixelOfficer`; the overtime scene should follow this approach while representing the caught outcome separately.
- `src/game/pixel/PixelOfficer.tsx` currently exposes `idle`, `climb`, `fall`, and `jump` poses. Grabbing an arm and sitting with a lowered head require additional artwork.

## Out-of-scope findings
- No additional existing defect requiring a separate task was identified during this interview.
- This decision file completes the interview only. Implementation and task-pointer changes belong to the subsequent memory-plan and memory-execute steps.
