# Task: T01 Deterministic Coin Drops and Pickup Rules

## Status: done

## Goal
Add a stable 5% coin drop to each eligible stair in both game modes and report the exact stair indices crossed by a correct move, without changing game score, event progress, obstacle rules, or ranking submissions.

## Decision Summary
- Every generated stair index gets a deterministic 5% coin roll; an obstacle stair is never collectible. Corners are eligible.
- A correct move collects coins across every index in `(fromIndex, toIndex]`, so jumping past a coin collects it. Incorrect input, pursuer movement, or merely seeing a coin never collects it.
- Coin generation is seeded per run and based on stair index, so rerenders, route extension, and scene visibility cannot reroll a coin.

## Implementation

### I01. Shared stable drop helper
- Related Files:
  - `src/points/coinDrops.ts` :: constants and pure seeded coin lookup; new
  - `src/points/coinDrops.test.ts` :: probability, stability, obstacle filtering; new
  - `src/game/types.ts` :: `GameState`, `GameMove`; modify
  - `src/infinite/types.ts` :: `InfiniteGameState`, `InfiniteMove`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export const POINT_COIN_SPAWN_CHANCE = 0.05;
  export function createPointCoinSeed(random: () => number): number;
  export function hasPointCoin(seed: number, stairIndex: number): boolean;
  export function getCollectedPointCoinIndices(
    seed: number,
    fromExclusive: number,
    toInclusive: number,
    isObstacle?: (stairIndex: number) => boolean,
  ): number[];
  export interface GameMove {
    kind: "climb" | "jump";
    fromIndex: number;
    toIndex: number;
    scoreGain: 1 | 2 | 3 | 4;
    isBonus: boolean;
    collectedCoinIndices: number[];
  }
  export interface InfiniteMove {
    fromIndex: number;
    toIndex: number;
    scoreGain: 1 | 2;
    isBonus: boolean;
    collectedCoinIndices: number[];
  }
  ```
- Implement a documented 32-bit integer mixing function to map `(seed, stairIndex)` reproducibly to `[0,1)`. `hasPointCoin` returns true only when the mapped roll is below `0.05`. Validate nonnegative safe stair index and a finite integer seed. Repeated calls for the same seed/index must always agree; changing index should produce a distributed sequence. Do not use `Math.random()` during render or route advancement.
- `getCollectedPointCoinIndices` validates `fromExclusive < toInclusive`, visits each integer index once in ascending order, includes an index only when `hasPointCoin` is true and `isObstacle(index)` is false. With no obstacle callback, all rolled stair indices are eligible.
- Add `pointCoinSeed: number` to both state types. In `createGameState(random, options)` and `createInfiniteGameState(random)`, call `createStairRoute(random)` first and derive one seed from the same injected random source. Keep the seed unchanged across route advancement/checkpoints; a reset creates a new seed.
- Add `collectedCoinIndices: []` to all initial/terminal `lastMove` values or retain existing null semantics. Every successful move sets it to the eligible rolled indices from the current player index through the landing index. Failed moves and tick/pursuer transitions have `lastMove: null` or an empty pickup list; pursuer never collects coins.

### I02. Engine transitions in both modes
- Related Files:
  - `src/game/gameEngine.ts` :: `createGameState`, `applyInput`, `continueGame`, `resetGame`; modify
  - `src/game/gameEngine.test.ts` :: stage pickup transitions; modify
  - `src/infinite/infiniteEngine.ts` :: `createInfiniteGameState`, `applyInfiniteInput`; modify
  - `src/infinite/infiniteEngine.test.ts` :: infinite pickup transitions; modify
  - `src/game/stairObstacles.ts` :: `hasObstacle` usage only; read-only unless helper integration requires a type update

#### Details
- For stage mode, after `inputIsCorrect` is true and `landingStep` is computed, call `getCollectedPointCoinIndices(pointCoinSeed, currentState.stepsClimbed, landingStep.index, index => hasObstacle(currentState.obstacles, index))`. A one-step climb checks one stair; a two-stair jump checks both crossed stairs. Existing obstacle stairs remain uncollectible even if jumped through.
- For infinite mode, after correctness succeeds, call the helper for indices from `current.stepsClimbed` through `nextStep.index`; no obstacle callback is needed.
- Keep `score`, `scoreGain`, `eventSteps`, `eventEndsAt`, end results, stage caps, infinite ranking submissions, pursuer timing, turn rules, and obstacle generation byte-for-byte equivalent in behavior. A collected coin adds one wallet point, never one game score.
- Stage completion still returns the movement's `lastMove` with its collected indices so a coin on the clearing step is credited. The next stage retains `pointCoinSeed` because it is one continuous run. Restart/reset creates a new seed and new random drops.

#### Tests
- With injected deterministic random source, prove stable same-index results before and after route extension and across scene reads.
- Fixed-seed sequence test: many stair indices yield a coin count near 5% (for example, within a deterministic 3.5%–6.5% band over 10,000 indices); this verifies the mix is not biased while avoiding flaky randomness.
- Correct forward/turn move reports only the destination coin; wrong input reports none; pursuing ticks report none; jump reports coins on both intermediate and landing indices but filters obstacle indices.
- Stage clear on a coin stair returns that pickup. Restart changes the seed. Score, event and pursuer expectations in existing tests remain unchanged.

## Acceptance Criteria
- [ ] Each index's roll is stable for the lifetime of a run and independent of rendering.
- [ ] Stage and infinite modes use exactly 5% deterministic per-stair placement; obstacle stairs are excluded and corners are allowed.
- [ ] Only successful player movement reports pickup indices; jump checks every stair crossed.
- [ ] Collected coins do not alter game score, event gauge, timer, or ranking result.

## Validation
- `npm.cmd test -- --run src/points/coinDrops.test.ts src/game/gameEngine.test.ts src/infinite/infiniteEngine.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts`
- `npm.cmd run build`

## Commit Message
```text
feat(game): add stable point coin drops

Plan: 2026-11-18-point-shop
Phase: P02-coin-gameplay-effects
Task: T01-coin-drop-gameplay

- Roll 5 percent coins by stair index in both modes
- Report coins crossed by valid walks and jumps without changing score
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending
