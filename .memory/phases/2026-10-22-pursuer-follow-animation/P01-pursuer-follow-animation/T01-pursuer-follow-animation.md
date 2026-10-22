# Task: T01 Pursuer Follow and Catch Animation

## Status: done

## Goal
Give the existing pursuer a visible one-step hop toward the player after each mistake. When the pursuer catches the player, show brief contact and a quick hop back to its starting position during the existing 500 ms recovery. On a final catch, keep the game-over result and leaderboard panel hidden until that recovery ends. Preserve the existing engine rules, saved score timing, input lockout, and storage format.

## Decision Summary
- Wrong input already reduces `GameState.pursuerDistance` by one; a catch resets it from 1 to 4, removes one life, and sets `lastMistake` and `recoveryEndsAt` for 500 ms. Use this state transition to drive a presentation-only animation.
- Use discrete stair hops. On catch, show contact and return to the far position within the recovery window. Keep animation state in `GameScreen`; do not change `GameState`, engine rules, or localStorage data.
- The final catch changes game status to `game-over` immediately. Save the final score immediately, but hide only the result/leaderboard panel while the catch animation is active; reveal it when the existing recovery ends. Inputs remain blocked by the existing game status/recovery checks.

## Implementation

### I01. Drive pursuer presentation from existing game state

- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen`; modify local React presentation state and scene/result-panel props.
  - `src/game/gameEngine.ts` :: `applyInput`, `tickGame`; read-only reference for mistake, catch and recovery transitions.
  - `src/game/types.ts` :: `GameState`; read-only reference. Do not add or change model fields.

#### Details
- **Signatures & Types**:
  - Add local state inside `GameScreen`:
    - `const [pursuerAnimationKey, setPursuerAnimationKey] = useState(0);` — increment once when a new mistake begins, so CSS choreography can be restarted reliably.
    - `const [isPursuerCaught, setIsPursuerCaught] = useState(false);` — true only for a mistake transition where the pursuer distance reset upward.
    - `const previousPursuerDistanceRef = useRef(gameState.pursuerDistance);` — records the previous rendered distance for identifying a catch.
  - Extend the existing `GameScreen` mistake effect (the effect that calls `audioController?.playFall()` when `lastMistake` changes false to true). Add `gameState.pursuerDistance` to its dependency list. Do not change when audio plays.
  - Extend `StairSceneProps` with:
    - `pursuerAnimationKey: number`
    - `isPursuerCaught: boolean`
  - Add `data-pursuer-catching={isPursuerCaught}` to the `.game-frame` element. Pass the two new props to `StairScene`.
- **Data & Schema Fields**:
  - Do not modify `GameState` (`status`, `pursuerDistance`, `recoveryEndsAt`, `lastMistake`, or any other field), persistence records, or localStorage keys.
  - `pursuerAnimationKey` and `isPursuerCaught` exist only in the `GameScreen` component and are not serialized.
- **Execution Flow / Logic**:
  1. Initialize `previousPursuerDistanceRef` from the initial `gameState.pursuerDistance` (normally 4).
  2. In the existing mistake effect, when `gameState.lastMistake` is true and `previousMistakeRef.current` is false, increment `pursuerAnimationKey`. Set `isPursuerCaught` to `gameState.pursuerDistance > previousPursuerDistanceRef.current`. For an ordinary mistake the new distance is lower; for a catch the engine has reset it from 1 to 4.
  3. When `gameState.lastMistake` becomes false, set `isPursuerCaught` to false. Always update `previousPursuerDistanceRef.current` and `previousMistakeRef.current` after processing the transition. Keep the catch flag stable for the whole recovery interval.
  4. On a final catch, let `gameState.status` become `game-over` and let the existing score-save effect run immediately. The `.game-frame` data attribute lets CSS hide the already-rendered `.game-over-panel` until `isPursuerCaught` becomes false; do not delay score persistence or change status.
  5. Preserve the current input lockout. Do not enable inputs while the catch animation or result-panel delay is active.
- **Error & Exception Handling**:
  - Do not add timers for this presentation. Reuse the existing `recoveryEndsAt` / `lastMistake` lifecycle so unmounting cannot leave a new timeout pending.
  - If `audioController` is absent, animation state still updates; the existing optional audio calls remain safe.
- **State Transition & Return**:
  - Mistake start: increment animation key; set caught flag only if distance increased due to engine reset.
  - Recovery end: clear caught flag; final game-over panel becomes visible through CSS.
  - Correct input and game start retain existing state behavior; no pursuer animation is triggered by a correct step.

### I02. Render stepwise approach and catch choreography

- Related Files:
  - `src/game/StairScene.tsx` :: `StairSceneProps`, `StairScene`; modify pursuer transform and SVG group attributes.
  - `src/game/game.css` :: `.pursuer`, `.game-over-panel`, `@keyframes`, and `prefers-reduced-motion`; add choreography and final-catch visibility rules.

#### Details
- **Signatures & Types**:
  - Update `StairSceneProps` as specified in I01.
  - Add a pure helper `getPursuerTransform(distance: number): string`. Clamp distance to the supported range 1–4 and return these exact SVG transforms:
    - distance 4: `translate(57 253)` (existing starting position)
    - distance 3: `translate(91 239)`
    - distance 2: `translate(125 225)`
    - distance 1: `translate(159 211)`
  - For the caught animation, use the SVG `<g className="pursuer">` base transform at the starting position `translate(57 253)` and animate relative CSS `translate` offsets with `transform-box: view-box`. Define contact as 136 viewBox units right and 56 units up from the start, expressed as `26.154% -15.556%` of the `520 × 360` SVG viewBox. The catch path has four discrete 34 × 14 hops from the reset position; its final hop moves from distance 1 to contact. Ordinary steps use the helper's distance transform and must not animate a smooth horizontal slide.
- **Data & Schema Fields**:
  - Render `data-motion-key={pursuerAnimationKey}` on the pursuer group and include `is-approaching` while `state.lastMistake && !isPursuerCaught`; include `is-caught` while `isPursuerCaught`.
  - Keep the existing distance tag text sourced from `state.pursuerDistance`, including the engine's reset to 4 after a catch.
- **Execution Flow / Logic**:
  1. Compute the ordinary pursuer base transform from the current `state.pursuerDistance` using the exact mapping above. The initial position is unchanged.
  2. On an ordinary mistake, the SVG transform moves immediately to the next mapped anchor. Add a brief vertical hop animation to communicate a discrete stair step. Do not apply a CSS transform transition that slides the pursuer between anchors.
  3. On a catch, the engine distance is already reset to 4. Keep the group at the starting transform and use an `is-caught` keyframe animation that hops toward the contact offset, holds briefly, then hops back to zero offset. Use discrete keyframe timing so it reads as stair hops rather than a smooth slide. Complete the animation in 500 ms, matching the existing recovery duration.
  4. Keep the existing idle bob animation when no mistake/catch animation is active. New movement classes must take precedence over bob so animations do not conflict.
  5. Under `prefers-reduced-motion: reduce`, disable the bob, step-hop, and catch keyframes. Keep the mapped position changes immediate. The final result panel should be visible immediately under reduced motion by overriding the catch visibility rule in the same media query.
  6. When `.game-frame[data-pursuer-catching="true"]` is present, set its direct `.game-over-panel` child to `visibility: hidden` and disable pointer interaction. Do not hide the `.game-stage`; reveal the result panel as soon as the attribute becomes false. This applies only while motion is enabled; reduced-motion override shows results immediately.
- **Error & Exception Handling**:
  - Clamp unexpected distance values to 1–4 in `getPursuerTransform` so the renderer always has a valid position.
  - Ensure the catch class is cleared from existing recovery state; do not leave a hidden result panel if the scene remounts or the game restarts.
- **State Transition & Return**:
  - Idle: bob at current distance anchor.
  - Wrong input without catch: one anchor closer and one short hop.
  - Catch: contact then return to distance-4 anchor within 500 ms; final result panel appears after recovery.

### I03. Cover transition and regression cases

- Related Files:
  - `src/game/GameScreen.test.tsx` :: `describe("GameScreen controls")`; add presentation behavior tests.
  - `src/game/gameEngine.test.ts` :: existing engine tests; read-only regression coverage for distance, lives and recovery.

#### Details
- **Test Scenarios**:
  1. Start the game and send an incorrect input. Assert the pursuer group has the next distance anchor and a new motion key, while the score/lives and engine rules retain their existing values.
  2. Trigger enough incorrect inputs, waiting out each recovery, to reach a catch. Assert lives decrease once, distance resets to 4, the caught presentation flag is set, and it clears after the recovery timer advances.
  3. Trigger a catch that consumes the final life. Assert game status and score-save behavior occur immediately while `.game-over-panel` is hidden during the caught presentation; after recovery, assert the result and leaderboard panel is visible. Assert inputs cannot restart or change the final score during the delay.
  4. Preserve existing fall-audio behavior and verify correct inputs do not increment the pursuer motion key.
  5. Check the CSS rules manually for `prefers-reduced-motion`: approach/catch/bob animation is disabled and the final result panel is not delayed.
- **Test isolation**:
  - Use Vitest fake timers for recovery cases, advance at least the existing 500 ms recovery interval, and wrap timer advances that cause React updates in `act(...)`.
  - Use a fresh render and clear localStorage between tests as the existing `afterEach` does.
  - Do not change `gameEngine.test.ts` expectations unless implementation reveals an existing regression; this task must preserve all engine rules.

## Acceptance Criteria
- [x] Each wrong input moves the visible pursuer one discrete stair anchor closer; correct input does not move it.
- [x] Catch shows brief contact followed by a quick hop back to the starting anchor, completed within the existing 500 ms recovery; the catch consumes exactly one existing life.
- [x] The final score is saved immediately on game over, while the result and leaderboard panel appears after catch recovery. Input remains locked during recovery.
- [x] `GameState`, engine rules, localStorage schema, existing sound triggers, and score calculation are unchanged.
- [x] Reduced-motion preference disables pursuer movement keyframes and does not delay the final result panel.
- [x] Existing and new component tests, lint, and production build pass.

## Validation
- `npm test -- --run src/game/GameScreen.test.tsx src/game/gameEngine.test.ts` — new presentation tests and existing controls/engine regression tests pass.
- `npm run lint` — ESLint passes.
- `npm run build` — TypeScript check and Vite production build pass.
- Manual browser check at 390×667 and 1440×900: ordinary wrong-input hops, catch/return, final-catch result reveal, input lockout, and reduced-motion behavior are visible and unclipped.

## Commit Message
```text
feat(game): animate the pursuing chaser

Plan: 2026-10-22-pursuer-follow-animation
Phase: P01-pursuer-follow-animation
Task: T01-pursuer-follow-animation

- Move the pursuer one stair per mistake
- Show catch and return before final results
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: complete (see task commit in git history)
