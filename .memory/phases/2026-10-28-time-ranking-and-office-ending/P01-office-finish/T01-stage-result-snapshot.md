# Task: T01 Stage Result Snapshot

## Status: done

## Goal

엔진이 클리어·잡힘·시간 초과 순간의 성적을 보존해 체크포인트 대기·연출·늦은 callback으로 남은 시간이 변하지 않도록 한다. 다음 Task가 사용할 정확한 성적 API를 제공한다.

## Decision Summary

- D01/D02: 남은 시간을0.01초로 내림해 비교·표시를 일치시킨다. 종료 전 stageEndsAt에서 계산하며 늦은 잡힘은 실제 NPC deadline 기준이다.
- 계획 2026-10-28-time-ranking-and-office-ending, P01-office-finish. T01만 구현하고 T02로 전진한다. baseline15704d3, 기본추격600/500/400/300/250ms와 거리30→50ms→7 규칙이 기준이다.

## Implementation

### I01. Result type and pure helpers

- Related Files:
  - `src/game/types.ts` :: `StageResult`, `GameState` — modify.
  - `src/game/stageResult.ts` :: 결과 생성/검증/표시 — new.
  - `src/game/stageRules.ts` :: `getStageRule` — read-only, 시간/목표 상한 출처.

#### Signatures & Types

```typescript
export interface StageResult {
  readonly stage: GameStage;
  readonly score: number;
  readonly remainingTimeCs: number;
  readonly endedAtMs: number;
  readonly outcome: "cleared" | "caught" | "time-limit";
}
// Existing GameState에 추가:
stageResult: StageResult | null;

export function captureStageResult(
  state: Pick<GameState, "stage" | "score" | "stageEndsAt">,
  outcome: StageResult["outcome"],
  endedAtMs: number,
): StageResult;
export function isStageResult(value: unknown): value is StageResult;
export function formatRemainingTimeCs(remainingTimeCs: number): string;
```

#### Data & Schema Fields

- stageResult는 필수 nullable: ready/playing은null, checkpoint/game-over는non-null. 이후 tick/quit은 같은 결과 object를 보존한다.
- stage:1..5; score:기존과 같은integer>=0; endedAtMs:finite>=0; remainingTimeCs:safe integer,0..getStageRule(stage).durationMs/10; outcome:위3값.
- 예: stageEndsAt90000, endedAtMs12345→remainingTimeCs7765→표시77.65초. 계산은 floor(max(0, stageEndsAt-endedAtMs)/10), time-limit는0.
- format은 정수의 몫/나머지로 항상 소수2자리와 단위를 생성:0→0.00초,1→0.01초,1234→12.34초,9000→90.00초. 음수/NaN/Infinity/소수/unsafe integer는RangeError. 단계별 상한 검증은 snapshot/leaderboard validator에서 수행한다.

#### Execution Flow / Logic

1. captureStageResult는 stage/score/outcome/endedAtMs/nonnull finite stageEndsAt을 검증한다. 잘못된 입력은RangeError, 원본 상태를 변경하지 않는다.
2. 종료 시각이 deadline 이상이면0. 결과가 단계 제한시간을 넘으면RangeError. time-limit 결과는 실제 deadline의at로 생성한다.
3. 비교에 생ms를 남기지 않고 centiseconds로 한 번 정규화한다. 내부 Date.now 대신 명시적으로 받은 endedAtMs만 사용한다.

### I02. Capture before clearing clocks

- Related Files:
  - `src/game/gameEngine.ts` :: `validatePursuit`, `createGameState`, `startGame`, `tickGame`, `applyInput`, `continueGame`, `quitAtCheckpoint`, `resetGame` — modify.
  - `src/descent/descentEngine.ts` :: `applyDescentInput` — 1단계 checkpoint→terminal 변환 시 core snapshot을 그대로 보존; 필요할 경우에만 명시적 할당.
  - `src/descent/descentViewState.ts` :: `createDescentViewState` — fresh preview 검사에 stageResult null 추가.
  - `src/test/gameFixtures.ts` — 합성 상태의 snapshot 일관성 보완만 허용.

#### Details

1. Factory/reset/start/Continue는stageResult=null. Continue는 다음 단계score0/gap4/기본추격/기존route·bonus 보존 규칙을 따른다.
2. tickGame의 stage-expiry 분기는 clocks를 지우기 전 current와at로time-limit snapshot 생성. 동시 deadline에서 stage expiry 우선.
3. 접촉 분기는 안전한NPC index로 돌리기 전 current와실제접촉at로caught snapshot 생성.500ms cosmetic gate가 끝나도 결과는 같다. callback now100000에서도 실제captureat2400이면remaining8760.
4. 목표 도달 성공 입력은 새score의movedState와입력nowMs로cleared snapshot 생성. jump overshoot도 실제값 보존.1..4단계checkpoint와5단계game-over 모두 생성한다.
5. quitAtCheckpoint는snapshot 참조를 그대로 보존하며 outcome은cleared, endReason만quit.95초checkpoint 대기에서 기록 시간이 줄어들지 않는다.
6. pause는 기존stageEndsAt 이동을 사용한다. resume/종료후tick에서 결과를 다시 생성하지 않는다. 단독adapter의1단계 최종clear도 core snapshot을 보존한다. 새 ending GameStatus를 추가하지 않는다.
7. validatePursuit는 shape와snapshot.stage/score가state와같은지, 단계별time상한을 검사한다. checkpoint는cleared, terminal caught/time-limit/cleared는각outcome, quit은cleared 결과. ready/playing은null. 단독adapter의game-over/cleared stage1은 유효하다.
8. getStageSecondsLeft의 기존실시간HUD 정수초 API는 그대로이며 T02랭킹은stageResult를 직접 읽는다.

### I03. Tests and fixture updates

- New `src/game/stageResult.test.ts`: 변환/표시/schema와 실제engine 경계.
- 기존검사에서 새 결과 기대값과합성 상태만 보완:
  - `src/game/{gameEngine,timedPursuit,pursuerCatchUp,stairRoute,stairObstacles,stairSceneModel}.test.ts`
  - `src/game/{GameScreen,StairScene,GameHud}.test.tsx`
  - `src/descent/{descentEngine,descentSceneModel,descentViewState}.test.ts`
  - `src/descent/{DescentGameScreen,DescentScene,DescentTestApp}.test.tsx`
- 가짜game-over/ready 상태를spread하면stageResult도status에맞춘다. 시간/점수를 다른도전에서 합성하지 않는다. fixture는 실제deadline으로captureStageResult를 호출하거나 진짜engine 전환으로 만든다.
- `src/leaderboard/*`, `src/game/recordStorage.ts`, auth/audio/config/package는read-only. T01은 아직 랭킹 형식·저장시점을 바꾸지 않는다.

#### Required cases

- 12345/12349/12350ms 내림경계,0/1cs,1..5단계상한,missing/null/잘못된type.
- score149→150 clear at12345/deadline90000→7765, bonusjump149→153 보존, 모든단계목표.
- idle stage1 catchat2400→8760, callback100000에서도동일, incremental/late동일.
- fall250/500·catchup50/gap7·expiry/capture/input tie우선순위.
- timeout0, checkpoint95초wait/quit결과동일참조, Continue null/newstage, 설정pause 이동기한, terminal500ms후결과보존.
- 단독stage1clear 결과보존/foreignstage거절/저장무접근, deepfreeze/결정적재생/RNG추가소모없음.

## Acceptance Criteria

- [x] 실제종료경계에서유효한StageResult가생성되고 보통진행은null.
- [x] 표시0.01초와저장정수값/단계기한/pause계산이일치.
- [x] 메인5단계·단독1단계의기존추격/경로/장애물/연출검사통과.
- [x] 지정29파일·lint·build·diff검사통과와실제결과기록.

## Validation

```powershell
npm.cmd test -- --run src/game/stageResult.test.ts src/game/pursuerCatchUp.test.ts src/game/recordStorage.test.ts src/game/StairScene.test.tsx src/descent/descentEngine.test.ts src/descent/descentSceneModel.test.ts src/descent/descentGate.test.ts src/descent/DescentTestApp.test.tsx src/descent/descentViewState.test.ts src/descent/DescentGameScreen.test.tsx src/descent/DescentScene.test.tsx src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts src/auth/authConfig.test.ts --maxWorkers=2
npm.cmd run lint
npm.cmd run build
& 'C:/Program Files/Git/cmd/git.exe' diff --check
```

모든 명령 통과, skip0. 로그는 `%TEMP%/time-ranking-and-office-ending-2026-10-28/`의 Task별 폴더. 실행 당시 실제 test 수/시간/빌드 크기·경고를 기록한다. 테스트 timeout/skip/config/package 변경 금지.


## Commit Message

```text
feat(game): preserve centisecond stage results at completion

Plan: 2026-10-28-time-ranking-and-office-ending
Phase: P01-office-finish
Task: T01-stage-result-snapshot

- Capture clear, catch and timeout results before clearing stage clocks
- Preserve checkpoint results and reset them on the next stage
- Cover quantization, delayed ticks, pause and standalone boundaries
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `cbc6c26`; plan docs `b3c67aa`.

## Validation Results — 2026-10-28

- 지정29파일 **864/864tests**, skip0, workers2,124.79초 통과. 기존754개와 신규 stageResult110개. 최종 근거 `regression-29-serial.log`.
- 새 pure helper/schema/format과 실제 engine 경계에서 모든 단계 목표/초과 점수, 0.01초 내림, 잡힘 실제2400ms/지연callback100000ms, 넘어짐250/500·가속50/gap7, timeout우선, 체크포인트95초/quit 동일 결과 참조, Continue/null, 설정pause, 단독1단계clear/저장getter0/RNG0을 확인했다.
- 초기 신규 검사 전28파일754/754(55.17초), 초기 helper109/109(1.49초). 신규 factory 검사를 추가한29파일 실행은 빌드/lint를 함께 실행하던 중 기존 GameScreen의 bonus-pause 검사가5초 제한을 넘겨(7.847초)79개 연쇄실패/785개통과(101.98초)했다. 다른 검증 종료 후 동일 명령을 별도 실행해864/864 통과했다. 두 실행 사이 제품 source/검사/timeout/skip/config는 변경하지 않았다.
- lint 오류0/경고0, TypeScript·Vite build 통과, git diff --check 통과. JS555.79kB(gzip155.40)/CSS57.33kB(gzip10.97); 기존500kB초과 번들 크기는 유지되고 이번 build.log에는 해당 경고 재출력이 없다.
- 증거: `C:/Users/DEX/AppData/Local/Temp/time-ranking-and-office-ending-2026-10-28/T01/`의 regression-initial.log/result-focus-initial.log/regression-29-final.log(중간실패)/regression-29-serial.log(최종성공)/lint.log/build.log.
- 제품 변경: types.ts, gameEngine.ts, 신규stageResult.ts, 단독fresh guard(descentViewState.ts) 및 신규stageResult.test.ts. 기존 검사/fixture 수정은 불필요했고 descentEngine.ts도 기존 spread가 core snapshot을 보존해 source수정이 필요하지 않았다.
- 랭킹/recordStorage/진행도/auth/audio/설정/규칙/계단 아트/실제 기록에는 추가 변경 없음. 브라우저 검증은 후속T04 대상이다. 기존 화면 검사 시간 제한의 자원 경쟁 이슈 외 신규 범위 밖 결함: 특이사항 없음.
