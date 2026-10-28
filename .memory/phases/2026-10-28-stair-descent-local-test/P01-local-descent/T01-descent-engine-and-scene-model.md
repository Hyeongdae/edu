# Task: T01 Descent Engine and Scene Model

## Status: done

## Goal

DOM/저장소 없이 기존 게임 규칙으로1단계 내려오기를 계산하고, 위쪽 NPC/아래쪽 다음 계단·모션 좌표를 반환하는 독립 함수를 만든다. 원본 게임의 엔진/좌표 모델을 변경하지 않고 단위 검증 가능한 기반을 제공한다.

## Decision Summary

- 새로운 제품 파일은 `src/descent/`에만 둔다. 원본 순수 엔진·생성기를 읽기 전용으로 재사용한다. stage1/150점/90초/800ms/오입력500ms·추격250ms/기존10% 장애물과 이벤트를 유지한다.
- 논리 index는 계속 증가하고 표시 y만 아래로 증가한다.1단계 체크포인트는 adapter에서 최종 cleared로 바꾸며 다음 단계 reveal과 저장 부수 효과를 노출하지 않는다. 이 Task에는 UI/entry/오디오/저장소 코드가 없다.

## Implementation

### I01. Pure single-stage adapter

- Related Files:
  - `src/descent/descentEngine.ts` :: createDescentState/startDescent/applyDescentInput/tickDescent/resumeDescentAfterPause/resetDescent — new
  - `src/game/gameEngine.ts` :: createGameState/startGame/applyInput/tickGame/resumeGameAfterPause — read-only
  - `src/game/stairObstacles.ts` :: revealObstacles — read-only
  - `src/game/types.ts`, `stageRules.ts`, `stairRoute.ts` — read-only

#### Details

- **Signatures & Types**:

  ```typescript
  import type { GameInput, GameState } from '../game/types';
  export function createDescentState(random?: () => number): GameState;
  export function startDescent(state: GameState, nowMs: number): GameState;
  export function applyDescentInput(state: GameState, input: GameInput, nowMs: number): GameState;
  export function tickDescent(state: GameState, nowMs: number): GameState;
  export function resumeDescentAfterPause(state: GameState, openedAtMs: number, closedAtMs: number): GameState;
  export function resetDescent(random?: () => number): GameState;
  ```

- **Data & Schema Fields**:
  - Reuse `GameState` without renaming or a persisted DTO. `status:'ready'|'playing'|'checkpoint'|'game-over'` in base type; descent public outputs never checkpoint. `stage:GameStage` is always1, `score:number` is current points, `stepsClimbed:number` means moved physical stairs. `direction:'left'|'right'`, `straightStepsRemaining:number` unchanged.
  - `highestClearedStage`, `clearedStageThisRun`:0 initially/1 after actual final clear, memory only. Never hydrate from ranking/progress. `checkpointEnteredAt:number|null` always null in public output.
  - `stageEndsAt`, `nextPursuerStepAt`, `eventEndsAt`, `recoveryEndsAt`, `captureEndsAt`:number|null absolute milliseconds; `endReason:'caught'|'time-limit'|'cleared'|'quit'|null`, descent never generates quit. `pursuerIndex:number`, `pursuerDistance:number=stepsClimbed-pursuerIndex>=1`, `captureCount:number`, `lastPursuerMove:{fromIndex:number,toIndex:number,atMs:number}|null`, `lastMistake:boolean`, `eventSteps:number`, `route:StairRoute`, `obstacles:StairObstacleState`, `lastMove:{kind:'climb'|'jump',fromIndex:number,toIndex:number,scoreGain:1|2|4,isBonus:boolean}|null` unchanged.
  - Ready: score/steps/eventSteps0; all clocks null; gap4/index−4; direction right; stage1; clear history0; route from real generator; all obstacle decision metadata stageAtGeneration1. No Storage/React/account fields.

- **Execution Flow / Logic**:
  1. create delegates `createGameState(random,{stage:1,highestClearedStage:0})`; reset delegates same new-run creation. Public state-taking functions reject stage!==1, highest/cleared values outside0..1, incoming checkpoint or non-null checkpointEnteredAt with RangeError. Other engine invariants/time validation stay delegated to original engine; don't weaken them or duplicate rules tables.
  2. start/tick/resume delegate original functions. If no change, preserve returned identity. No continue/quit API and no persisted clear/unlock behavior. Valid ready/input/game-over no-op semantics follow original engine.
  3. apply delegates original applyInput, preserving input reconciliation (expiry before same-time input/NPC; earlier fatal catch). Wrong input retains actual lastMistake/recovery end, existing earlier NPC deadline vsnow+250 minimum, no immediate NPC movement. Success preserves original route/points/bonus/lastMove/step count.
  4. Original applyInput at score>=150 produces stage1 checkpoint, raises in-memory clear to1 and reveals future decisions at stage2. Only for this returned checkpoint, construct a new result with status game-over/endReason cleared/checkpointEnteredAt null/stageEndsAt null/nextPursuerStepAt null/eventEndsAt null/recoveryEndsAt null/captureEndsAt null/lastMistake false/lastPursuerMove null. Retain actual score150..153/steps/route/lastMove/positive gap/actual clear1; lastMove permits one terminal success sound but renderer will suppress motion outside playing.
  5. For that final transition recompute `obstacles` using **pre-input state.obstacles**, returned route/steps and `revealObstacles(previousObstacles,next.route,next.stepsClimbed,1)`. Do not pass the already stage2-revealed next.obstacles. This preserves prior decisions/RNG and ensures all final new decisions use stage1. No remapping existing stage2 metadata or hand-made probability suppression.
  6. Catch/time-limit are returned as engine outcomes; don't overwrite reason based on score. Final clear has no capture gate; catch retains scheduled capture+500ms. Subsequent tick clears capture flags normally; repeated tick/input never recaptures or revives. resume uses original freeze semantics, including recovery expiring during settings while the pending NPC remainder is preserved.
  7. No import of GameScreen/App/auth/leaderboard/stageProgress/audio preference helpers, no global mutation/browser storage. Keep RNG deterministic in supplied random/route state and inputs unmutated.

### I02. Downward scene projection

- Related Files:
  - `src/descent/descentSceneModel.ts` :: projectDescentRouteStep/buildDescentSceneModel and types — new
  - `src/game/stairSceneModel.ts` :: projectRouteStep/buildStairSceneModel + scene types — read-only
  - `src/game/stairRoute.ts` :: getRouteStep — read-only

#### Details

- **Signatures & Types**:

  ```typescript
  import type { GameState, StairRouteStep } from '../game/types';
  import type { ScenePoint, StairSceneModel } from '../game/stairSceneModel';
  export interface DescentPlayerMotion {
    kind: 'climb' | 'jump'; from: ScenePoint; to: ScenePoint;
  }
  export interface DescentSceneModel extends StairSceneModel {
    playerMotion: DescentPlayerMotion | null;
  }
  export function projectDescentRouteStep(step: StairRouteStep, playerStep: StairRouteStep): ScenePoint;
  export function buildDescentSceneModel(state: GameState): DescentSceneModel;
  ```

- **Data & Schema Fields**:
  - Reused fields: `steps:readonly SceneStep[]` with `{x,y,index,direction}`, `player`/`pursuer:SceneActor` same fields, `catchFrames:readonly {x,y,index,offset}[]`, `pursuerMotion:{from:ScenePoint,to:ScenePoint,atMs:number}|null`, `playerJump:{from:ScenePoint,to:ScenePoint}|null`, `pursuerVisible:boolean`. New `playerMotion` supplies one-step/corner travel too; no timing/Storage inside this model.
  - Projection: x260+(column−player.column)*34, y216+(index−player.index)*28, viewBox520×400. Player anchor260,216. Historical4 behind at y104; future6 at384 (frontface+16 reaches400). Directions/index/offset/atMs stay identical.

- **Execution Flow / Logic**:
  1. Call original buildStairSceneModel to retain matching index/distance, real route, adjacent NPC and same-direction two-stair jump validation. Mirror **points only**, `y'=432−oldY`, xunchanged. This is equivalent to projectDescentRouteStep using original projectRouteStep then y432−y. Do not reverse SVG/art or logical route.
  2. Map steps/player/pursuer, both ends of NPC/playerJump and every catch frame. Keep original catch offsets0/.2/.4/.55/.7/.85/1 and real indices. Recalculate pursuerVisible from new x/y: x+34>0 && x−34<520 && y+16>0 && y−88<400; never copy original boolean.
  3. If lastMove non-null/toIndex equals current steps, validate integer fromIndex and distance1 for climb or2 for jump; derive playerMotion from getRouteStep(fromIndex) projected relative to current player to player anchor. The original builder already rejects corner-crossing jumps. Null otherwise. This model can retain terminal lastMove info; UI decides whether animation is allowed.
  4. Existing11 scene steps stay index−4..+6. Preserve valid far NPC/extra historical stair metadata even if invisible. Invalid pursuit/move/time/route errors propagate as RangeError; don't clamp indices/forge route points to hide them. Do not mutate state or original scene result.

### I03. Regression tests

- Related Files:
  - `src/descent/descentEngine.test.ts`, `src/descent/descentSceneModel.test.ts` — new
  - `src/test/gameFixtures.ts` :: withPursuitAt, `src/test/obstacleFixtures.ts` :: withObstacle/makeObstacleFixture — read-only test imports
  - `src/game/stageRules.test.ts`, `gameEngine.test.ts`, `timedPursuit.test.ts`, `stairRoute.test.ts`, `stairObstacles.test.ts`, `stairSceneModel.test.ts` — read-only regression

#### Details

- Test real seeded generation and legal inputs, purity/deep-frozen input, deterministic reducer replay; obstacle fixture only for explicit boundary cases. Long5..9/short1..3/actual10% decision remains original implementation. First actual inputs Dforward/Jturn atcorner; jump two stairs2/4points; gauge28/29→event30sec; wrong/empty jump/collision500ms with250ms NPC, repeated input and100ms earlier pending boundary.
- create/reset always ready1/clear0/score0/no clocks/freshroute, start90sec/NPC800/gap4, no stage2 option/API. Invalid stage2/highest>1/checkpoint/negative/nonfinite time throws without RNG/storage mutations.
- Use coherent near-goal input states (e.g.149 normal jump→151,149 bonus jump→153,148 bonus jump→152) and actual full legal route traversal to prove immediate final cleared/one terminal reason/score preserved/no CP/no nextstage. On final reveal assert every run.stageAtGeneration===1 and equality with original stage1 reveal from prior obstacles; repeat tick cannot create stage2.
- Idle NPC800/1600/2400/catch3200; safe index player−1/gap1/captureCount1/captureEndsAt3700 then cleared flag; expiry ties/earlier catch; normal/paused fall100→10100 pending10250/next11050; stage/event/NPC95sec pause remnants. No state side effects in sound/storage (none imported).
- Projection coordinates for both directions; next stair y244>216, initial NPC y104<216/head16; original remains nexty188/NPC328. One-step fromY−28 and jump fromY−56/to0; both xsigns; mirror catch frames/own NPC directions across short corners; positivegap/far visibility recomputed/both viewport edges/extra history; route/purity and invalid jump/capture indices validated.

## Acceptance Criteria

- [x] New pure adapter returns only stage1 ready/playing/game-over and final150..153 cleared with stage1 obstacle decisions.
- [x] Original timing/input/obstacle/bonus contracts are reused without source changes or storage access.
- [x] Downward model puts future below/NPC above and transforms all motion/catch points while keeping art/directions upright.
- [x] New tests and specified regressions/lint/build pass without skip/config/dependency changes.

## Validation

- `npm.cmd test -- --run src/descent/descentEngine.test.ts src/descent/descentSceneModel.test.ts src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts` — all8files pass; record actual count.
- `npm.cmd run lint`
- `npm.cmd run build` — TypeScript includes new src/descent modules; default original app still builds.
- `git diff --check`
- `git diff --name-only -- index.html src/main.tsx src/App.tsx src/game src/audio src/auth src/leaderboard src/test vite.config.ts package.json package-lock.json` — empty relative to start of Task; unrelated pre-existing changes must be distinguished, never reverted.

## Commit Message

```text
feat(game): add isolated single-stage descent engine and scene model

Plan: 2026-10-28-stair-descent-local-test
Phase: P01-local-descent
Task: T01-descent-engine-and-scene-model

- Adapt stage one completion without changing the climbing engine
- Project descending stairs and pursuit using real route indices
- Cover timing obstacle and scene geometry regressions
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `0225893`
- After success: Task done/commit, phase done1/3/T02 in_progress, current Active T02. Do not implement the screen or run browser validation in this Task.

## Validation Results — 2026-10-28

### Implementation and contracts

- 신규 제품 파일 `src/descent/descentEngine.ts`, `descentSceneModel.ts`와 두 테스트만 구현했다. 원본 engine/scene/types/route/obstacles/fixtures/auth/audio/ranking/config/package는 변경하지 않았다. 화면/HTML/오디오/저장/서버/브라우저 검증은 이 Task에 포함하지 않았다.
- adapter는 기존 엔진에 start/input/tick/pause를 위임하고 stage1/clear0..1/체크포인트 미노출을 검증한다. 최초 생성과 재시작은 stage1/score0/clear0/새 route/no clocks다. 실제150점 이상 클리어는 체크포인트 대신 최종 game-over/cleared로 종료하며 초과점수와 성공 lastMove를 유지한다. terminal lastMove는 다음 T02 렌더러가 status!==playing에서 애니메이션을 억제해야 한다.
- 마지막 장애물은 반환된 stage2 metadata를 수정하는 대신 입력 전 obstacles와 새 실제 route로 `revealObstacles(...,1)`을 다시 계산한다. 원본 엔진에서 stage2 결정이 실제 생성되는 경계와 비교해 최종 결정이 모두stage1이며 기존 결정 객체도 보존됨을 검증했다.
- scene은 원본 검증과 좌표를 재사용해 점의 y만 `432-y`로 변환한다. 플레이어260/216, 다음계단y244, 초기NPCy104(머리y16), 미래6번째y384/앞면끝400이다. player/NPC/step/jump/catch 좌표 전체와 양방향 playerMotion을 연결하고 NPC 가시성을 새 좌표로 다시 계산한다. 논리 index/방향/잡힘 offset/시간은 보존한다. SVG나 캐릭터 자체를 뒤집는 코드는 없다.

### Evidence

| Validation | Actual result |
| :--- | :--- |
| 위 정확한8파일 테스트 명령 | **8파일356/356 PASS**,9.07s, Vitest5.0.5/jsdom |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS, exit0, TypeScript + Vite8.3.5 |
| `git diff --check` / staged diff check | PASS |
| 위 원본 경로 diff 명령 | 변경 없음 |
| 제품 두 파일의 storage/React/audio/leaderboard/progress 검색 | 해당 의존/접근 없음 |

- 실제 생성기의7개 seed로 합법 입력을 진행해 최종150..153/1단계/최종 종료/기존 생성 결정/불변성과 결정성을 검증했다. 정상점프2/보너스4, 게이지28/29 경계,10% long-run 임계값/안전 내부/짧은 구간 제외, 오입력500/추격250·500·다음1300, 먼저 예정된100/다음350·1150, 만료 우선/이른 잡힘,90초 만료,95초 설정 동결과 남은150ms 복구를 포함한다.
- scene 테스트는 실제 경로 생성과 일관된 위치 fixture로 양방향/모든 구간 길이/11계단 경계/카메라 상대 이동/짧은 코너의 NPC 독립 방향/실제 catch frames/양방향 점프/화면 양쪽과 위쪽 가시성/과거 계단/먼NPC 메타데이터/잘못된 endpoint·route·시간·추격 입력 거절을 검증했다. geometry fixture는 점수·시간과 독립된 좌표 검사이며 실제 UI 플레이로 주장하지 않는다.
- deep-freeze 입력/재실행 결과 일치/원본 상태 보존을 확인했다. localStorage/sessionStorage getter를 throw하도록 둔 테스트에서도 adapter/model 호출의 getter 접근은0회이며 초기 생성 이후 Math.random 부수 효과는 없다. UI 생애 전체 저장 무접근/효과음/실제 시각·브라우저 모션은 T02/T03 검증 대상이다.
- 빌드 출력: JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB). 원래 main 출력211modules/동일 asset 이름을 유지한다.500kB chunk 경고가 실제 출력되었으며 기존 별도 이슈로 남긴다. 경고 제한/번들 설정을 바꾸지 않았다.
- 로그: `C:\Users\DEX\AppData\Local\Temp\stair-descent-t01-2026-10-28\tests.log`, `lint.log`, `build.log`. 최초 `tests-first-visibility-expectation.log`, `build-first-fixture-type.log`도 보존했다. 최초에는 새 테스트의 patch 배열이 리터럴 union 대신 number로 추론된 TypeScript 오류와 위/아래에서 캐릭터 일부가 보이는 경계 기대값 오류가 있었다. 테스트 타입을 Partial<GameState>로 명시하고, gap8의 부분 표시와 gap9의 상승visible/하강hidden 경계를 구분해 수정했다. 제품 validator/확률/timeout/검증 기준을 완화하지 않았다.
- 새로 범위를 넓혀 처리한 인접 결함은 없다. 기존 번들 크기 이슈 외 새 특이사항 없음. 실제 하강 화면/테스트 링크/스피커 청취/배포 완료로 표시하지 않는다.
