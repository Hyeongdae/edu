# Task: T01 Title Scene and Guide Copy

## Status: done

## Goal
After authentication, retain the same in-game staircase scene and idle pixel characters under both the title and stage selection. Fade from the title to stage selection over about 200 ms without starting the game, unless the user prefers reduced motion. Replace the guide encouragement with the exact confirmed sentence.

## Decision Summary
- Exact guide text: `5단계를 모두 클리어하고 멋지게 퇴근해봐요 화이팅! 잡히면 야근일지도..`
- Reuse the existing ready-state `StairScene`, preserving one mounted scene across title and stage selection. Hide its heading and live instruction hint on the title; keep the player and pursuer still and visible.
- On `게임 시작`, crossfade the title out and stage selection in over 200 ms. If `matchMedia("(prefers-reduced-motion: reduce)").matches` is true, show stage selection immediately.
- Keep existing Entra auth, title text/buttons, stage progression, settings contents, audio startup, and game-start button semantics unchanged.

## Implementation

### I01. Keep the game scene mounted under the title and stage selector

- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen`, `isTitleScreen`, new title-leaving state/ref, `handleEnterStageSelection`, game-stage and title/stage-select JSX; modify
  - `src/game/GameScreen.test.tsx` :: title scene presence, scene identity, stage transition, and reduced-motion integration; modify
  - `src/game/StairScene.tsx` :: ready-state staircase, idle runner/pursuer, `.scene-heading`, `.scene-hint`; read-only
  - `src/game/StageSelectPanel.tsx` :: existing stage selector mount/focus behavior; read-only

#### Details
- **State and types**:
  ```typescript
  const TITLE_SCENE_TRANSITION_MS = 200;
  const [isTitleScreen, setIsTitleScreen] = useState<boolean>(true);
  const [isTitleLeaving, setIsTitleLeaving] = useState<boolean>(false);
  const titleTransitionTimeoutRef = useRef<number | undefined>(undefined);
  ```
  `isTitleScreen` already exists; add only `isTitleLeaving` and `titleTransitionTimeoutRef`. Do not add fields to `GameState`, reset the game, or persist title-view state.
- **Scene rendering and semantics**:
  1. Keep one `.game-stage` element and its `.game-layout`/`<StairScene>` mounted for the entire title-to-stage-selection flow. Do not duplicate or key-remount `StairScene` when `isTitleScreen` changes.
  2. Render `GameHud` inside `.game-stage` only when `isTitleScreen === false`; this keeps the title background focused on the scene.
  3. While title is visible, add a title-background marker (for example `is-title-background` class or `data-title-screen="true"`) to `.game-stage`. Hide `.scene-heading` and `.scene-hint` through the title-background CSS selector. Keep the staircase, office backdrop, player, and pursuer visible. Ready status plus `isClimbing={false}` and no scheduled pursuer movement must leave both characters idle.
  4. Mark the background scene `aria-hidden` and `inert` while `isTitleScreen` is true. The title heading and two actions remain the accessible foreground; do not expose the live direction hint to screen readers on the title.
  5. Continue rendering the title's existing `h1`, `게임 시작`, and `게임 설명` controls above the scene. The game instructions dialog continues to open only from its title button.
- **Transition flow**:
  1. Update `handleEnterStageSelection(): void` to return if a dialog is active, `gameState.status !== "ready"`, or the transition is already running.
  2. If `window.matchMedia?.("(prefers-reduced-motion: reduce)").matches` is true, set `isTitleScreen` to false immediately and leave `isTitleLeaving` false.
  3. Otherwise set `isTitleLeaving` to true. Render the existing `StageSelectPanel` while `gameState.status === "ready"` and either title has finished or `isTitleLeaving` is true. Keep it as a sibling overlay above the same `.game-stage`.
  4. During `isTitleLeaving`, set `data-title-transitioning="true"` on `.game-frame`; mark the outgoing title layer `aria-hidden`/`inert` and make it ignore pointer events. The title and stage selector transition simultaneously for `TITLE_SCENE_TRANSITION_MS` (200 ms).
  5. Start `window.setTimeout` for 200 ms. On completion set `isTitleScreen` and `isTitleLeaving` to false and clear the ref. In the component unmount cleanup, clear `titleTransitionTimeoutRef` to prevent a delayed state update.
  6. Do not call `startGame`, change score/stage, reset progress, or start audio during the title-to-selector transition. The selected stage's existing `시작하기` action remains the only action that begins the run.
  7. Keep `handleShowStageSelection` after game over unchanged; it still bypasses the title.
- **Test cases** in `GameScreen.test.tsx`:
  - Initial title render contains the stairs and office backdrop plus `data-testid="runner"` and `data-testid="pursuer"`; heading and live hint are hidden in title-background mode; HUD and stage clock are absent; the title still has exactly its two buttons.
  - Capture `document.querySelector(".stair-scene")`, click `게임 시작`, verify the stage selector appears, the title enters its leaving state, and the exact same scene DOM element remains mounted. Advance fake timers by 200 ms and verify the title is gone and scene identity is still unchanged.
  - Verify `gameEngine.startGame` is not called and the game remains `ready` throughout title-to-selector transition. Waiting five seconds before pressing the selector's `시작하기` must leave the stage time at its full value.
  - Mock `matchMedia` to return reduced-motion preference and verify clicking `게임 시작` immediately removes the title/transition and shows stage selection without waiting for a timer.
  - Preserve existing guide focus restoration, unlocked-stage selection, game-over restart, and no in-game `?` tests.
  - Clean up any fake timers and `matchMedia` stubs in each test to prevent leakage into other `GameScreen` tests.

### I02. Update guide copy and add paired transition styling

- Related Files:
  - `src/game/GameInstructionsDialog.tsx` :: `.instructions-encouragement` paragraph; modify
  - `src/game/GameInstructionsDialog.test.tsx` :: exact encouragement assertion; modify
  - `src/game/game.css` :: base title background/transition selectors; modify
  - `src/game/pixel-theme.css` :: pixel title/stage-select transition and reduced-motion selectors; modify

#### Details
- **Guide content**:
  - Render exactly `5단계를 모두 클리어하고 멋지게 퇴근해봐요 화이팅! 잡히면 야근일지도..` in the existing `.instructions-encouragement` paragraph.
  - Update the existing test to assert the exact new string and no longer expect the previous encouragement. Do not change the stage table, control wording, or encouragement container/accessibility semantics.
- **CSS behavior**:
  - In `game.css`, hide only the title background's `.scene-heading` and `.scene-hint`; do not hide the staircase or pixel officers. The same title-background selector must not affect normal stage selection or active gameplay.
  - In `pixel-theme.css`, while `data-title-transitioning="true"`, animate `.game-title-screen` opacity from 1 to 0 and `.stage-select-panel` opacity from 0 to 1 over 200 ms with an ease-out curve. Keep the stage panel above the title layer and preserve its existing layout/focus behavior.
  - At phone widths, override the mobile `.game-stage` grid/scroller positioning as needed so the title background remains a full-frame staircase scene instead of being pushed into the normal HUD/controls grid. The title and stage panel must remain readable/tappable at narrow and short viewports.
  - Add matching `@media (prefers-reduced-motion: reduce)` rules that disable these transition animations; the JS reduced-motion check must also skip the 200 ms delay.
  - Keep normal stage-select rendering and post-game restart free of title-transition animations.

## Acceptance Criteria
- [x] The instructions dialog displays the exact requested encouragement text and its existing controls/table remain unchanged.
- [x] The title shows the existing game staircase with both player and pursuer idle, while hiding the game's direction heading and live instruction hint.
- [x] The identical `StairScene` remains mounted from title through stage selection; no scene regeneration or score/progress reset occurs.
- [x] `게임 시작` fades the title out while the stage selection panel fades in over the same background for about 200 ms; reduced-motion users see the stage selector immediately.
- [x] The title-to-stage-selection transition does not start a run, stage timer, pursuer, or additional BGM request. The existing `시작하기` stage action still starts the run.
- [x] Mobile layout keeps the scene full-frame behind the title and the stage selector usable; normal gameplay and game-over retry remain unchanged.

## Validation
- `npm.cmd test -- src/game/GameScreen.test.tsx src/game/GameInstructionsDialog.test.tsx src/game/StageSelectPanel.test.tsx` — scene reuse, transition, reduced-motion, title guide, stage selector, and copy tests pass.
- `npm.cmd run lint` — no lint errors.
- `npm.cmd run build` — TypeScript checks and Vite production build pass.

## Commit Message
```text
feat(game): blend title into stair scene

Plan: 2026-10-29-title-scene-and-guide-copy
Phase: P01-title-scene
Task: T01-title-scene-and-guide-copy

- Keep the game stair scene behind title and stage selection
- Fade into stage selection and update the guide encouragement
```

## Progress
- [x] Implementation complete
- [x] Validation passed (119/119 targeted tests, lint, and production build)
- commit: pending
