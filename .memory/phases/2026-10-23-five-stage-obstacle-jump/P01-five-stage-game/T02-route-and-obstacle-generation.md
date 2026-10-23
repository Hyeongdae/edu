# Task: T02 Route and Obstacle Generation

## Status: done

## Goal

긴5~9칸 뒤 짧은1~3칸 구간1개 또는2개를 랜덤으로 연결하고, 안전한 긴 구간에만 장애물을 결정하는 순수 모듈을 만든다. 추격자가 뒤처져도 필요한 과거를 남길 수 있는 경로 API를 준비한다. 아직 장애물을 GameState/충돌/렌더에 연결하지 않는다.

## Decision Summary

- 두 패턴 긴→짧→긴/긴→짧→짧→긴을 섞고 구간마다 방향 반전한다. 두 연속 짧은 구간의 길이는 다르게, 긴 구간끼리는 중간에 짧은 구간이 있으므로 같은 길이도 허용한다.
- 긴 구간에만 단계별10/20/30/40/50%로 최대1개, 첫/마지막 칸 제외. 짧은 구간은 결정된null이다. 보이는 장애물/없음은 재추첨하지 않는다.

## Implementation

### I01. 경로 생성 상태와 과거 보관 API

- Related Files:
  - `src/game/types.ts` :: StairRunLength, StairRunKind, StairRouteRun, StairRoute; modify
  - `src/game/stairRoute.ts` :: chooseRunLength, validateRoute, extendRoute, createStairRoute, advanceStairRoute, getRouteRun; modify
  - `src/game/stairRoute.test.ts` :: generator/metadata/retention cases; modify

#### Details

- **Previous Contract**: T01 supplies GameStage1..5 and getStageRule returning durationMs,targetScore,obstacleProbability,pursuerStepIntervalMs. T01 values are90/75/65/60/50s;300/600/900/1200/1500;.10/.20/.30/.40/.50;1000/800/600/500/400ms. GameInput remains forward|turn. Current GameState has no obstacles or independent pursuer fields; current visible scene still projects11nodes with4behind/6ahead. Route starts-4..18 and future coverage remains18.
- **Signatures & Types**:
  ```typescript
  type StairRunLength = 1 | 2 | 3 | 5 | 6 | 7 | 8 | 9;
  type StairRunKind = "long" | "short";
  interface StairRouteRun {
    startIndex: number;
    length: StairRunLength;
    direction: Direction; // left|right
    kind: StairRunKind;
  }
  interface StairRoute {
    steps: readonly StairRouteStep[]; // index,column:number;direction:Direction
    runs: readonly StairRouteRun[];
    rngState: number; // uint32
    tailDirection: Direction;
    tailRunLength: StairRunLength;
    tailRunKind: StairRunKind;
    tailStepsRemaining: number;
    tailShortRunsRemaining: 0 | 1;
  }
  function chooseRunLength(unit:number,kind:StairRunKind,
    previousLength:StairRunLength|null):StairRunLength;
  function getRouteRun(route:StairRoute,index:number):StairRouteRun|null;
  function advanceStairRoute(route:StairRoute,playerIndex:number,
    oldestRequiredIndex?:number):StairRoute;
  ```
- **Fields/defaults**: initial history-4..0 is right-facing with no run metadata. First real run starts1/kindlong/right. Store full run end implicitly as start+length-1 even if future nodes stop midway. tailShortRunsRemaining is the number of extra short runs after the currently active first short run;0for long,0or1for short.
- **Flow**:
  1. chooseRunLength validates finite unit in[0,1), kind and valid previous length ornull. Long candidates=[5,6,7,8,9], short=[1,2,3], exclude previousLength if present in that candidate set. Initial previous=null; after a short, the next long does not exclude an earlier nonadjacent long.
  2. createStairRoute reads random once. Use that unit for initial long length and floor(unit*4294967296) seed; initialize tailShortRunsRemaining0 and metadata, extend to18. Keep LCG constants1664525/1013904223/uint32division4294967296.
  3. When a long finishes and more nodes are needed, draw one LCG unit for short count (unit<.5→1,else2), draw another for first short length, append opposite-direction short, remaining=count-1. When a short ends with remaining1, draw one unit for a different short length, append opposite direction and setremaining0. When short ends with remaining0, draw one unit for next long length and append opposite direction long. Only generate a new run when an actual next node is required; preserve RNG when merely reading metadata.
  4. Extend clones steps/runs, never mutates old state. advanceStairRoute defaults oldestRequiredIndex=player-4; explicit value must be safe integer<=player-4 and>=first retained index. The existing player>=0/needed history/continuous preview checks remain. Extend to player+18 then trim only nodes index<oldestRequiredIndex and runs whose full end<oldestRequiredIndex. Do not reconstruct a run start from its pruned prefix.
  5. Validate continuous indices/column deltas, run start/length/kind/direction, retained positive node containment, alternating direction, no adjacent repeated length/long-long/three-short pattern, tail counters/RNG/full-tail-end agreement. A retained prefix can begin mid-pattern; don't require already pruned predecessor runs. getRouteRun validates existing node and returnsnull onlyforindex<=0; missing positive metadata throws RangeError.
- **Errors/return**: invalid time-independent inputs/state/missing nodes/attempted backwards refill use RangeError. Default callers retain23nodes; explicit retention may hold more. Don't silently recreate deleted history or clip a supplied oldest index. No DOM/clock/global random reads beyond the initial seed.

### I02. Stable long-only obstacle decisions

- Related Files:
  - `src/game/types.ts` :: StairObstacleRun, StairObstacleState; modify
  - `src/game/stairObstacles.ts` :: VISIBLE_FUTURE_STEPS, chooseObstacleIndex, createObstacleState, revealObstacles, hasObstacle; new
  - `src/game/stairObstacles.test.ts` :: probability/safety/stability; new
  - `src/game/stageRules.ts` :: getStageRule; read-only

#### Details

- **Signatures & Types**:
  ```typescript
  interface StairObstacleRun {
    runStartIndex:number;
    runLength:StairRunLength;
    kind:StairRunKind;
    direction:Direction;
    stageAtGeneration:GameStage;
    obstacleIndex:number|null;
  }
  interface StairObstacleState { rngState:number; runs:readonly StairObstacleRun[]; }
  const VISIBLE_FUTURE_STEPS = 6; // exported
  function chooseObstacleIndex(run:StairRouteRun,stage:GameStage,
    appearanceUnit:number,positionUnit:number):number|null;
  function createObstacleState(route:StairRoute,stage:GameStage):StairObstacleState;
  function revealObstacles(state:StairObstacleState,route:StairRoute,
    playerIndex:number,stage:GameStage):StairObstacleState;
  function hasObstacle(state:StairObstacleState,index:number):boolean;
  ```
- **Flow/data**: seed=(route.rngState XOR0xa5a5a5a5)>>>0, independent sameLCG arithmetic. No second Math.random. History<=0 has no decisions. A null obstacleIndex means decided empty, never pending.
- chooseObstacleIndex validates run/kind-length match, stage and both finite[0,1) units. Short→null always. Long appearanceUnit<p hits and returns start+1+floor(positionUnit*(length-2)); equality misses. This selects2..L-1 and gives same-direction takeoff/landing; no first/last/corner placements.
- create starts empty then reveal(player0). reveal validates unique records/uint32/placements and matching run metadata where retained. Consider sorted runs with end>=player-4 and start<=player+6. Existing decisions remain byte-for-byte even after stage change. Every newly exposed run consumes exactly2LCG draws (including short/null decisions) for predictable replay, then stores full metadata/stage/null-or-index. Prune obstacle decisions only when end<player-4; pursuit does not need old obstacle decisions because boxes never block it. Route history can remain longer independently.
- No pruning/new decisions→same state reference. Otherwise clone state/list, never mutate route/RNG. hasObstacle reads recorded index only; safeinteger check,<=0false. Bad route/record/unit/stage gives RangeError, no silent reroll.
- **Tests**: each stage p-.epsilon hit/p equal miss; fixed.15 miss1/hit2..5; long positions0/.999 yieldsecond/penultimate for5..9. Every short length1..3 null even appearance0. Oneorzero/run,metadata.kind correct, empty decisionsstable, priorstage decisionsstable/newstage applied onlynewruns, pruned starts remainoriginal, replay/freeze/noextraMathrandom, bounded obstacle lists despite long retained NPC history. No flaky empirical percentage assertions.

### I03. Existing fixture and projection compatibility

- Related Files:
  - `src/game/gameEngine.test.ts` :: named five-step helper/initial range fixtures; modify
  - `src/game/stairSceneModel.test.ts` :: full length coverage/corner indices; modify
  - `src/game/GameScreen.test.tsx` :: deterministic corner/run-length assumptions; modify
  - `src/game/gameEngine.ts`, `src/game/stairSceneModel.ts`, `src/game/GameScreen.tsx`, `src/game/StairScene.tsx` :: current gameplay/scene; read-only

#### Details

- New initial random0/.5/.999 means5/7/9. randomFiveSteps must be0, not.5. First corner now follows5D with seed0. J into a1step short immediately requires anotherJ; assert no extra D. Audit every hardcoded old4step/corner boundary rather than keeping old generator output.
- All chooseRunLength callers now pass kind explicitly. The old invalid-previous-length3 test is obsolete because3 is a valid short length; use4 as unsupported and separately reject kind/length mismatch in stored route metadata. A previous valid short length passed while selecting long is allowed and excludes no long candidate.
- Generation tests traverse1000+nodes using route APIs, gather long lengths5..9 and short1..3, both short counts, no adjacent short repeat, both directions, deterministic replay and RNG draw schedule. Replace old all-run set[4,5,6]/fixed >150run count with explicit metadata/pattern assertions. Use enough fixed seeds for coverage, not probabilistic globalMathrandom.
- Default advances still have23nodes; explicit oldest=-4 after player20 keeps43nodes through38. Advance with an increasing oldest trims that prefix only; never permits a request before the current first node. Freeze new nested run lists too.
- Scene still draws11nodes with integer projection260+columnDelta*34,216-indexDelta*28. All lengths/patterns fit the existing scene because visible window remains6ahead/4behind. Use route-only iteration plus coherent low-score GameState projection to avoid ending finalclear during geometry tests. No projection scale/viewBox change.
- Current engine/scene pursuit remains fixed-gap until T03, so update only route assumptions here. Obstacles stay disconnected until T04; don't add invisible collision at this checkpoint.

## Acceptance Criteria

- [x] Both mixed patterns, all allowed lengths, opposite directions and adjacent-short nonrepetition are deterministic.
- [x] Requested older history and full run boundaries survive; default API remains compatible.
- [x] Only long runs can hold safe/stable obstacles at exact10/20/30/40/50% thresholds.
- [x] Existing D/J game and11node projection pass without partially connecting obstacles/independent pursuit.

## Validation

- `npm test -- --run src/game/stageRules.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/gameEngine.test.ts src/game/GameScreen.test.tsx`
- `npm run lint`
- `npm run build`
- Do not run browser final sign-off or alter App.test.tsx/production debug flags. No new dependencies.

## Commit Message

```text
feat(game): generate mixed stair runs and long-run obstacles

Plan: 2026-10-23-five-stage-obstacle-jump
Phase: P01-five-stage-game
Task: T02-route-and-obstacle-generation

- Mix long runs with one or two short turns and preserve requested history
- Decide stable obstacles only on safe long-run interior stairs
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
## Validation Results — 2026-10-23

- 지정 Vitest6파일:202/202tests,6/6파일 통과. 실제 Windows명령은 npm.cmd이며 청사진 npm CLI와 동일하다.
- `npm run lint`: 종료코드0.
- `npm run build`: 최종 종료코드0, TypeScript+Vite 통과(206modules, JS533.75kB/gzip149.36kB). 최초TS7053은 Array.isArray 검사 후 구간 타입 추론 문제였고 로컬 StairRouteRun 타입 명시로 해결했다.
- 빌드의500kB초과 청크 경고는 남아 있다. 기능 오류와 구분하며 분할/경고 한도 변경은 수행하지 않았다.
- 긴5~9/짧은1~3의 두 패턴, 정확한LCG추첨 순서/단일초기난수, 연속J, 과거 보관·원래 구간 경계, 긴 구간만10~50% 안전한 단일 장애물/없는 결정도 보관/단계 변경과재생 안정성을 검증했다.
- 장애물 상태는 실제 게임/충돌/렌더에 아직 연결하지 않았고 현재 입력은D/J, 추격은 기존 방식이다. 브라우저 육안·전체App.test.tsx·실제 음원 청취는 실행하지 않았다.
- 새 인접 결함 발견 없음. 기존 넘어짐 소리 문제/독립 App 기대값·옛 CSS 정리는 별도로 유지한다.
