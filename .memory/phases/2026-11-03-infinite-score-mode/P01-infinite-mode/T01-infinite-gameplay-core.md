# Task: T01 Infinite Gameplay Core

## Status: done

## Goal
Create independently testable endless-mode rules and an upward scene model without changing the stage engine bounded score, timer, obstacle, or checkpoint rules.

## Decision Summary
- Infinite runs have no timer, score cap, obstacles, jumps, or checkpoints. A wrong direction ends the run as a fall; pursuer contact also ends the run.
- Reuse the deterministic random route generator, D/J turn rules, stage-four base speed (300 ms), catch-up policy (100 ms at 15 stairs until the gap returns to 6), and the current 500 ms fall/catch animation durations.
- One successful stair earns 1 point, or 2 during a 30-second event triggered every 50 traversed stairs. Failure becomes terminal immediately; the result overlay waits until the short animation finishes.

## Implementation

### I01. Define separate infinite state transitions

- Related Files:
  - src/infinite/types.ts :: InfiniteGameStatus, InfiniteEndReason, InfiniteGameState, InfiniteInput, InfiniteMove; new.
  - src/infinite/infiniteEngine.ts :: createInfiniteGameState, startInfiniteGame, tickInfiniteGame, applyInfiniteInput, getInfinitePursuerMotionDurationMs; new.
  - src/infinite/infiniteEngine.test.ts :: deterministic transition tests; new.
  - src/game/stairRoute.ts :: createStairRoute, advanceStairRoute, countStraightSteps, getRouteStep; read-only.
  - src/game/pursuitRules.ts :: getPursuerCatchUpState and catch-up constants; read-only.

#### Details
- Types:
  ~~~typescript
  export type InfiniteGameStatus = "ready" | "playing" | "game-over";
  export type InfiniteEndReason = "fall" | "caught";
  export type InfiniteInput = "forward" | "turn";
  export interface InfiniteMove {
    fromIndex: number;
    toIndex: number;
    scoreGain: 1 | 2;
    isBonus: boolean;
  }
  export interface InfiniteGameState {
    status: InfiniteGameStatus;
    endReason: InfiniteEndReason | null;
    score: number;
    stepsClimbed: number;
    direction: Direction;
    straightStepsRemaining: number;
    pursuerDistance: number;
    pursuerIndex: number;
    isPursuerCatchingUp: boolean;
    nextPursuerStepAt: number | null;
    lastPursuerMove: PursuerMove | null;
    captureCount: number;
    captureEndsAt: number | null;
    fallEndsAt: number | null;
    eventSteps: number;
    eventEndsAt: number | null;
    lastMistake: boolean;
    route: StairRoute;
    lastMove: InfiniteMove | null;
  }
  export function createInfiniteGameState(random?: () => number): InfiniteGameState;
  export function startInfiniteGame(state: InfiniteGameState, nowMs: number): InfiniteGameState;
  export function tickInfiniteGame(state: InfiniteGameState, nowMs: number): InfiniteGameState;
  export function applyInfiniteInput(state: InfiniteGameState, input: InfiniteInput, nowMs: number): InfiniteGameState;
  export function getInfinitePursuerMotionDurationMs(
    state: Pick<InfiniteGameState, "isPursuerCatchingUp">,
  ): number;
  ~~~
  - InfiniteGameStatus = ready | playing | game-over.
  - InfiniteEndReason = fall | caught | null.
  - InfiniteInput = forward | turn.
  - InfiniteMove = fromIndex, toIndex, scoreGain (1 or 2), isBonus.
  - InfiniteGameState fields: status, endReason, score, stepsClimbed, direction, straightStepsRemaining, pursuerDistance, pursuerIndex, isPursuerCatchingUp, nextPursuerStepAt, lastPursuerMove, captureCount, captureEndsAt, fallEndsAt, eventSteps, eventEndsAt, lastMistake, route, lastMove.
  - Export createInfiniteGameState(random?), startInfiniteGame(state, nowMs), tickInfiniteGame(state, nowMs), applyInfiniteInput(state, input, nowMs), and getInfinitePursuerMotionDurationMs(state).
- State invariants:
  - There is no stage, stage deadline/result, obstacle state, life, checkpoint, or highest-cleared-stage field.
  - Score, step and route indices are safe integers; score is non-negative and uncapped. Pursuer distance equals stepsClimbed minus pursuerIndex and stays at least 1 while playing.
  - eventSteps is 0–49 while inactive. Deadlines are nullable epoch milliseconds. Terminal animation deadlines never permit more input or chase movement.
  - New state starts at route index 0, score/steps/event progress 0, pursuer four stairs behind, and uses the generated route direction.
- Transition rules:
  1. Reject invalid finite/non-negative times, malformed route/state, or inconsistent pursuer distance with RangeError.
  2. startInfiniteGame starts the first pursuer deadline at nowMs + 300. A forward input succeeds only on the same direction; turn succeeds only at a direction change. Each successful input advances exactly one physical stair and updates route, direction, straightStepsRemaining, score, and lastMove. Never inspect or generate obstacles.
  3. Count successful physical stairs only when the 2x event is inactive. On the 50th stair, reset the gauge and set eventEndsAt to nowMs + 30,000. The threshold stair earns the normal point because the event activates after that move. While active, each stair earns 2 points; event progress is paused. Expiry clears eventEndsAt and the next gauge starts at zero.
  4. Move the pursuer one actual route stair per due deadline. Use 300 ms normally and PURSUER_CATCH_UP_INTERVAL_MS while getPursuerCatchUpState is true. Enter at distance >=15 and exit at distance <=6. Contact sets game-over/caught, increments captureCount, and retains captureEndsAt = contact time + 500.
  5. Wrong direction sets game-over/fall, lastMistake=true, and fallEndsAt = nowMs + 500. It awards no score and advances neither player nor pursuer. Correct movement returns a playing state with lastMove for visual feedback.
  6. A tick on a terminal state does not move or score; it may only expire the relevant visual deadline. Reject score increments past Number.MAX_SAFE_INTEGER.
- Use the same 50 ms polling interval as the existing pursuit loop at the screen layer. Engine deadlines remain absolute so delayed callbacks produce deterministic catch results.

### I02. Project an ascending infinite scene

- Related Files:
  - src/infinite/infiniteSceneModel.ts :: buildInfiniteSceneModel and actor/stair projections; new.
  - src/infinite/infiniteSceneModel.test.ts :: route coordinates and motion; new.
  - src/game/stairSceneModel.ts :: projectRouteStep and upward viewport geometry; read-only.
  - src/game/pixel/PixelOfficer.tsx :: current player/pursuer artwork; read-only.
  - src/game/pixel/PixelStair.tsx :: existing stair assets; read-only.
  - src/game/pixel/PixelOfficeBackdrop.tsx :: existing office scene; read-only.

#### Details
- Export InfiniteSceneModel with visible steps, pursuer preview steps, player, pursuer, catch frames, pursuer motion, visibility, and player motion; export buildInfiniteSceneModel(state: InfiniteGameState).
- Use projectRouteStep directly so increasing route indices appear higher on screen. Never call buildDescentSceneModel or reflect y coordinates.
- Keep the existing 11-stair viewport, visibility bounds, historical route anchoring, catch frames, and actor motion source/target indices.
- Reuse existing office backdrop, pixel characters and stair top/front art. Do not include obstacles in the model or render tree.

### I03. Verify core rule boundaries

- Related Files:
  - src/infinite/infiniteEngine.test.ts :: seeded state and transitions; new.
  - src/infinite/infiniteSceneModel.test.ts :: upward geometry and animation anchors; new.

#### Details
- Test seeded initial route, player starts at step 0, pursuer starts four stairs behind, and increasing steps project upward.
- Test correct/incorrect forward and turn inputs on straight runs and corners; wrong input must terminate immediately without movement or score.
- Test 1 point per ordinary stair, the exact 50-step boundary, threshold-stair score, event duration/expiry, 2 points during the event, and no stage score cap.
- Test 300 ms base chase, 15-stair catch-up at 100 ms, return to base at gap 6, collision, terminal freeze, and invalid clock/state/distance/safe-integer values.
- Test scene projection across left/right turns, pursuer preview, visibility boundary, and exact player/catcher motion anchors.

## Acceptance Criteria
- [x] Infinite engine and scene model do not use stage timer, target, checkpoint, obstacle, or life rules.
- [x] Score/event/pursuit/failure boundaries are deterministic and covered by unit tests.
- [x] Increasing route indices render higher in the infinite scene with existing pixel office assets.
- [x] Stage engine and stage rules remain unchanged.

## Validation
- npm run test -- --run src/infinite/infiniteEngine.test.ts src/infinite/infiniteSceneModel.test.ts --maxWorkers=2 — focused engine/model tests pass.
- npm run lint — no lint or TypeScript errors.
- npm run build — production TypeScript/Vite build succeeds.

## Commit Message
feat(game): add infinite score mode engine

Plan: 2026-11-03-infinite-score-mode
Phase: P01-infinite-mode
Task: T01-infinite-gameplay-core

- Add uncapped upward score-mode transitions
- Reuse route and pursuer rules without stage caps

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending
