# Task: T03 Stage Score Browser Validation

## Status: pending

## Goal

새 해금/단계별 점수/실제 도전 단계 랭킹과 구 진행도 보존을 실제 격리 브라우저에서 확인한다. 사용자가 보고한 clear1→그만두기→다시 시도 흐름을 재현해2단계0점 시작을 증명하고, 모든 acceptance와 회귀가 통과한 뒤 계획을 완료한다.

## Decision Summary

- 현재 구현의 최종 계약은 아래 I01이다. 과거v4/400점/클리어단계기록/2000점 전체진행을 검증 기준으로 쓰지 않는다. 실제 생성기/실제 앱 입력과 제어시간·엔진 경계 상태를 구분한다.
- 이 Task는 검증과 검증으로 입증된 관련 결함 수정만 수행한다. 완료 표시를 위해 테스트를 약화하거나 범위를 별도 인증/배포/오디오 청취/공용 서버로 늘리지 않는다.

## Implementation

### I01. Required final API and model contracts

- Related Files:
  - `src/game/types.ts`, `stageRules.ts`, `gameEngine.ts`, `stageProgress.ts`, `src/leaderboard/leaderboard.ts` — read-only unless a required acceptance check demonstrates a related defect
  - `src/game/GameScreen.tsx`, `GameHud.tsx`, `StageSelectPanel.tsx`, `CheckpointPanel.tsx`, `StairScene.tsx`, `stairSceneModel.ts`, `pixel-theme.css`, `pixel/pixel-scene.css`, `src/leaderboard/LeaderboardPanel.tsx` — verified related fixes only

#### Details

- **Signatures & Types**:

  ```typescript
  type GameStage = 1|2|3|4|5;
  type ClearedStage = 0|GameStage;
  interface GameStartOptions { stage?:GameStage; highestClearedStage?:ClearedStage; }
  function getStageTargetScore(stage:GameStage):number;
  function getHighestUnlockedStage(highestClearedStage:ClearedStage):GameStage;
  function createGameState(random?:()=>number,options?:GameStartOptions):GameState;
  function resetGame(random?:()=>number,options?:GameStartOptions):GameState;
  function startGame(state:GameState,nowMs:number):GameState;
  function applyInput(state:GameState,input:"forward"|"turn"|"jump",nowMs:number):GameState;
  function tickGame(state:GameState,nowMs:number):GameState;
  function continueGame(state:GameState,nowMs:number):GameState;
  function quitAtCheckpoint(state:GameState,nowMs:number):GameState;
  function resumeGameAfterPause(state:GameState,openedAtMs:number,closedAtMs:number):GameState;
  interface StageProgressEntry { accountId:string;highestClearedStage:ClearedStage; }
  function migrateLegacyStageProgress(storage?:Storage):{entries:StageProgressEntry[];available:boolean};
  function readStageProgress(accountId:string,storage?:Storage):{highestClearedStage:ClearedStage;available:boolean};
  function saveStageProgress(accountId:string,clearedStage:ClearedStage,storage?:Storage):{highestClearedStage:ClearedStage;saved:boolean;error?:"storage-unavailable"};
  interface LeaderboardEntry {accountId:string;displayName:string;bestStage:GameStage;bestScore:number;achievedAt:string;}
  function readLeaderboard(storage?:Storage):LeaderboardEntry[];
  function getTopScores(entries:LeaderboardEntry[],limit?:number):LeaderboardEntry[];
  function saveBestScore(entry:Omit<LeaderboardEntry,"achievedAt">,storage?:Storage,now?:Date):{entries:LeaderboardEntry[];saved:boolean;error?:"storage-unavailable"};
  ```

- **Data & Schema Fields**:
  - GameState keeps status ready/playing/checkpoint/game-over, stage1..5, score=current-stage points, highestClearedStage0..5, clearedStageThisRun0..5, checkpointEnteredAt:number|null. No recordStage/stageStartScore/lives. StageStart options defaults1/0; stage<=helper(highest). Readyscore0/no clocks/event0/newroute/selected-stage decisions/NPC-4.
  - Existing non-score fields retain exact meanings/types: stepsClimbed, direction, straightStepsRemaining, stageEndsAt, nextPursuerStepAt, pursuerIndex/distance, lastPursuerMove, captureCount/EndsAt, eventSteps/EndsAt, recoveryEndsAt, lastMistake, route/obstacles/lastMove. Scene uses real indices with positive gap; lastMove kind climb/jump and distance1/2, scoreGain1/2/4.
  - Rule rows: targets150/200/250/300/350; durations90000/75000/65000/60000/50000; long-run obstacle.1/.2/.3/.4/.5; baseNPC800/650/500/400/300ms. Long5..9 and1or2 short1..3 route pattern, one safe interior box per long max/no short boxes, decisions stable. D forward/J turn+climb/Space jump past one box to following stair.
  - Unlock helper H0..5→1/2/3/4/5/5, selectable1..helper, defaulthelper. Current account cleared progress only; no v5 ranking inference. Result restart returns ready selection, then Start begins0/newrun; same/locked selection cannot reroll or auto-start.
  - Clear at stage target or above keeps actual overshoot and raises actual cleared history. Stages1..4 checkpoint same stage/score and all clocks frozen, no rank save. Continue sets nextstage/score0/lastMove null/full time/NPCgap4, keeps route/obstacles/steps/gauge and shifts remaining bonus once. Quit ranks checkpoint stage/current score. Final5 ends cleared/current350..353 without6.
  - New rankkey `stair-climb:leaderboard:v5`, rows stage1..5 only; current actual stage/score candidate, highest stage→score→earlier date, personal best whole pair/tie preserved. Progresskey `stair-climb:stage-progress:v1` actual clear0..5, max peraccount. Rank4 migration reads valid full rows/merges allaccount maxima beforeconditionaldeletion; v1/v2/v3 never inferclear. Both input reads + requiredprogresswrite must succeed beforev4cleanup. Errors retain source/known partialhighest, no partialoverwrite. Cleanup failure nonfatal to validv5 use; corruptv5 onlyownkey safe-empty handling, v5storageerrors separate fromprogressfailure.
  - Single terminal comparison/save, no rank at checkpoint/ready. First failed1 is rank1score0; prior highestclear3 replay1score80 is candidate1/80, not3/80. Newv5(2,80) cannot unlock3 when actualhighestclear1.
  - Firstcatchends once; safeNPCplayer-1/gap1/captureEndsAt=scheduledcatch+500. Normal result gate500ms, reduced immediate. Same-time stageexpiry beatsinput/NPC; earliercatch staysfatal. Wrong input500msfall next=min(existing,now+250), fast successor onlyif at+250<=recoveryEnd. Repeats cannot extend. Stage1 fall0→250/500/next1300; earlier100→100/350/next1150; pausedfallopen100/close10100→next10250 then11050.
  - Playerjump300ms/NPC240ms independent; one successfulfootstep/action, actualmistakefall once. Score reset alone produces no sound, no stale gain/arc or eventrestart. Settings/CP95sec freeze clocks and preserveobjects. Dialog/nativefocus/trap/Range/Escape behaviors and mobile56pxtargets/group4px vsouter12px/gear44px maintained. Error paragraph stays inside scrolling checkpointdialog.

### I02. Regression validation and permitted corrections

- Related Files:
  - Exact17 test files in Validation — run; add regressions only for demonstrated related corrections
  - `src/test/gameFixtures.ts`, `obstacleFixtures.ts` — fixture corrections only if coherence fails, not production chance suppression
  - package/auth/audio implementation/unrelated App tests — read-only

#### Details

- Run exact17file/lint/build at start and again after any browser fix. Record count/time/build sizes/warnings, don't substitute whole-suite success for specified scope. Do not add dependencies, skips, timeout increases, lint disables, relaxed validators or production test props.
- Correct failing related assertions for new semantics with real consistent states. Preserve random generation, replay/purity, two-step2/4points/event28/29, catch-time priority,250/500ms, native input and one audio/save checks.
- Any browser failure must be separated into product defect vs driver/tool/setup failure. Fix the exact related source/test when demonstrated, replay that scenario plus affected regressions, then final full checks. Record incomplete criteria honestly; do not mark completed when a required browser check remains unverified.

### I03. Isolated actual browser scenarios

- Related Files:
  - Temporary CDP/browser drivers and PNG/JSON/log outside repo — verification only
  - This Task Validation Results — actual methods/paths/toolversions/results/limitations

#### Details

#### Environment and evidence ownership

1. Discover connected browser tool first. If absent, use owned CDP incognito context (`Target.createBrowserContext({disposeOnDetach:true})`) and dispose only it in finally. Fresh hidden helper profile is allowed; never ordinary browser user storage or visible helper windows. No actual profile clearing or real Entra credentials. Local demo development server process env only, no production auth bypass.
2. Use real local app and route/obstacle generators. Full flow uses displayed next box→Space, corner→J, elseD and actual controls. Native CDP keyboard/touch samples plus DOM inputs allowed. Document-level Date.now/seed and coherent actual-engine/fixture snapshots allowed only for boundary/layout fixtures; no forced full-flow promotion.
3. Separate real-time pursuit/lifecycle from controlled stage progression, do not run heavy tests/build or edit source while browser scenarios run. Use waits below60sec between updates. Owned document failures must be restored before reusing context. Keep evidence under an exact new temporary directory such as `%TEMP%\stair-stage-scores-2026-10-27\`; record actual path, driver scripts, screenshots, JSON bounds/callcounts, toolversions.
4. Existing helper artifacts at `%TEMP%\stair-checkpoints-t04\` usedv4/recordStage/stageStartScore/2000point final. Adapt API/fields/targets/probe selection before reuse. Scan actual React GameState hook by structure instead of a fixed hook index. During navigation wait for a genuinely new document before installing probes. In prior Chrome156, ViteHMR could reload a Page frozen/active target; verify document token, and if needed stub only owned-document Vite socket for this specific lifecycle test, record method/no OS tab UI claim. Never work around a game defect by resetting its state during a real-time scenario.

#### A. User reproduction, checkpoints and ranking

1. 새 저장소에서는1단계만 선택 가능하며90초/목표150/점수0/하트 없음/시계 미시작/랭킹 없음이다. 표시된 안내대로 실제 입력해1단계를 클리어한다. 체크포인트는1단계150~153점, 최고 클리어1, 진행도 즉시 저장, v5랭킹 미저장이어야 한다. D/J/Space/터치 입력은 진행시키지 못하고 설정 버튼은 비활성이다.
2. 그만두기는 v5에(1,실제 점수)를 한 번 저장한다. 다시 시작하면 ready 선택창에서2단계가 기본 선택되고1~2만 해금, 점수0/목표200/시계 미시작이다. Start2는75초/NPC650ms/간격4/이벤트0/새 경로로 시작한다. 클리어 후 새로고침해도 기본2가 유지된다. 사용자 재현 흐름의 PNG/JSON을 반드시 남긴다.
3. 별도 새 판에서 clear1→활성 보너스가 있는 체크포인트95초 대기→Continue2를 검증한다. 점수0/목표200/75초, route/obstacles 객체와 총 계단 수/게이지/보너스 잔여시간은 유지, NPC간격4다. 이전 scoreGain/점프/오디오는 전환 자체로 재생되지 않는다. 첫 성공의+1/2/4가 한 번만 표시된다. 중복 Continue로3단계를 건너뛰지 못하고 Tab 순환/Escape 미선택이 유지된다.
4. 실제 엔진의 합법 입력으로 만든 일관된 경계 상태에서2단계80점 후 실제 잡힘/시간초과를 발생시킨다. 랭킹2/80, 최고 클리어1,3잠김이어야 한다. 실제 클리어2를 가진3단계150점 종료도 랭킹3/150과4잠김을 확인한다. 이 경계 검증은 제어시간/엔진 스냅샷 사용을 명시하고 전체 실제 플레이로 주장하지 않는다.
5. 3단계10점>2단계200점,2단계120점>2단계80점과 열등/동점 기록의 쌍·이름·시각 보존을 확인한다. 과거 최고 클리어3인 사용자의1단계80점 종료 후보는1/80이며, 클리어 이력3/기본 선택4와 기존 더 높은 개인 최고는 유지된다. 최초1단계0점 실패도1단계로 표시한다. TOP10/현재 사용자 강조/v5의 새로고침 보존을 확인한다.
6. 네 기본 화면320×667/390×667/768×1024/1440×900 각각에서 실제 입력으로5단계를 진행하고 체크포인트에서 명시적으로 계속한다. 새 단계마다0/목표150·200·250·300·350, 체크포인트 동결, 최종5단계350~353점/6단계 없음/즉시 결과/단일 v5저장을 확인한다. 실제 장애물·점프·긴/짧은 혼합 경로와 오디오 호출 수를 기록한다. 누적1250/2000점을 새 목표로 쓰거나 스피커 청취를 검증했다고 주장하지 않는다.

#### B. Migration, account separation and storage failures

1. 소유 저장소에 v4만 있던 현재 계정 클리어1, 다른 계정 클리어3/5, 중복/잘못된 행, 더 낮거나 높은 progress, audio/auth/기타 sentinel, 선택적으로 유효v5를 넣는다. 로드 시 모든 유효 클리어 최대값이 진행도에 저장된 뒤 v4가 정리되어야 한다. 구 기록은 v5로 복사하지 않고 현재 기본 단계는2다. 계정 전환 시 해당 계정의 해금만 보이며, v5는 새 클리어를 부여하지 않는다. 새로고침에서도 유효v5는 유지되고 v1/v2/v3은 해금에 기여하지 않는다.
2. progress get, v4 get, progress set을 각각 실패시킨다. 알려진 최고값은 메모리에 유지, 불완전한 입력으로 다른 계정을 덮어쓰지 않음, v4보존, 경고와 Continue/Quit 접근 가능을 확인한다. 복원 후 읽기/새로고침에서 전 계정 병합을 완료한 뒤에만 v4를 정리한다. 쓰기가 차단된 동안 저장 성공을 기대하지 않는다.
3. v4 removeItem 실패에서는 진행도가 먼저 영구 저장되어 있어야 하며 남은v4가 새 랭킹으로 표시되지 않고 유효v5를 사용할 수 있어야 한다. 복원 후 정리 재시도를 확인한다. v5 get/set 실패는 별도 기록 오류/재시작으로 처리하고 실제 클리어 진행도와 메모리 해금은 유지한다. 전체 localStorage getter 차단에서도 안내/ready1/시작은 가능해야 한다. 모든 주입은 소유 문서의 try/finally로 복원한다.
4. 새 사용자의 클리어 진행도 쓰기 실패에서도 clear1 후 Continue2 또는 Quit→선택2가 메모리에서 가능해야 한다. v5(2,점수)를 실제 클리어2로 사용하지 않는다. 현재 계정 화면 생애 동안 기존/새 실제 클리어 값을 유지하고, 쓰기 복원 후 실제 새 클리어가 진행도로 저장됨을 확인한다. 차단된 쓰기가 저장되었다고 주장하지 않는다.

#### C. Timing, controls, motion and responsive access

1. 실제 Date.now에서 무입력1단계의 첫 NPC논리 이동800ms/단일 잡힘3200ms를 확인한다. 실제 예약 atMs와100ms polling으로 관측된 시간을 구분한다. 실제 오입력은 즉시 이동하지 않고250/500/다음1300ms에 이동하며 반복 복구 입력은 재시작하지 않는다. 실수 소리1/성공 발소리1 호출을 기록한다. 다른 단계 일반650/500/400/300ms는 일관된 엔진 제어 상태로 확인할 수 있으며 그렇게 표기한다. 최초 실패 결과는1단계0점이다.
2. 같은 소유 문서를 실제4초간 CDP lifecycle 동결/복귀시켜 한 번 잡히고 한 번 기록하는지 확인한다. 이른 잡힘에서 멈추며 뒤의 시간초과로 덮지 않는다. 방법/document token/Vite대처를 기록한다. ready로 재로드된 상태를 복귀 성공으로 계산하지 않는다.
3. 제어시간으로250/500ms 만료와 점프/NPC가 겹치면 만료 우선,250ms 이른 잡힘과251ms 만료라면 잡힘 유지, 회복500ms 예정 이동은 도주 입력 전 처리함을 확인한다. 활성 보너스/예정NPC가 있는 설정95초 전후3개 잔여시간 보존, native range/설정 저장/Escape/포커스/입력 차단을 확인한다. 체크포인트95초 동결은 별도이며 설정을 열 수 없다. 넘어짐 설정100→10100은 남은150ms 후 일반 간격으로 돌아간다.
4. 실제 상자의 양방향 점프를 WebAnimation0/150/300ms에서 촬영한다. offsets±68/56→±34/−28→0/0, clip밖/상자 위/단일 복사본, 모션 감소의 정적 표현을 확인한다. native focused Space/터치 한 동작, 빠른 회전/점프/취소, NPC240ms와 플레이어300ms 독립 모션을 확인한다. 보너스 만료·잡힘·시간초과·클리어 점프·Quit·재시작·unmount에서 이전 연출/중복 오디오·저장이 남지 않는다. Continue의 점수 초기화도 추가 발소리/오래된+점수 표시를 만들지 않는다.
5. 플레이어 입력 없이 NPC가 짧은 코너를 자신의 방향으로 통과하는지 확인한다. 실제 인덱스/양수 간격/기본11계단/역사 계단/화면 밖 메타데이터/간격4초과를 유지하고 RangeError가 없어야 한다. 설정/resize/Continue 후 생성된 장애물 결정이 바뀌지 않는다.
6. 모든 기본 화면에서 선택/플레이/체크포인트/설정/결과 bounds, desktop 조작 버튼 숨김, mobile 버튼≥56px·gear44px·HUD분리, turn/jump4px<outer12px, scene≥200px, root overflow 없음을 확인한다. 320px root24/32px에서5개 단계 버튼/체크포인트 두 동작/긴 상자 안내·계정 이름/16자리 점수(안전 정수9007199254740991)/오류/TOP10/랭킹 스크롤/재시작을 반복한다. 패널 내부를 스크롤하고 hit-test로 버튼에 접근하는지 검사한다. 오류 안내는 dialog 안에 유지하고 모션 감소 결과는 즉시 접근 가능해야 한다. 대표 PNG `clear1-quit-selection2.png`, `stage2-zero-target200.png`, `rank-stage2-score80.png`, `migration-error-320-font32.png`와 양방향 점프를 남긴다.

### I04. Completion bookkeeping

- Related Files:
  - This Task, parent `phase.md`, `.memory/plans/2026-10-27-stage-unlocks-and-per-stage-scores.md`, `.memory/current.md` — update after all required checks pass

#### Details

- 실제 명령/개수/빌드 크기와 증거 경로/방법/실패/수정/제한을 기록한다. acceptance/Task done 뒤 지정 메시지로 관련 source/test수정과 이 Task를 커밋한다. 그 다음 T03 hash, phase done3/3, plan completed, current Active Task none 및 T01~T03 이력을 기록하고 메모리 동기화를 별도 커밋한다. 이전 완료 계획 hash/이력은 보존한다.
- 필수 브라우저 검사가 불가능하면 Task in_progress/해당 criterion 미체크를 유지하고 구체적인 이유와 확인된 증거를 보고한다. 단위 테스트 통과만으로 계획을 완료하지 않는다. 합의 범위 밖 발견 사항은 별도 보고하며 임의 구현하지 않는다.

## Acceptance Criteria

- [ ] clear1→Quit→재시도/재접속에서2단계0점/목표200,3단계 잠금이 유지된다.
- [ ] 모든 단계0점 전환/체크포인트 동결/경로·이벤트 보존과 최종5단계350~353점/해당 단계 랭킹이 맞다.
- [ ] v4 전 계정 진행도 보존 뒤 초기화/v5보존, 부분 실패·복구·계정 분리가 검증된다.
- [ ] 실제 시간 추격/넘어짐/lifecycle, 입력·점프·오디오 호출·단일 저장과 네 화면/320px 확대를 통과한다.
- [ ] 지정17파일/lint/build/브라우저 증거 통과와 완료 포인터/이력이 커밋된다.

## Validation

- `npm.cmd test -- --run src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`
- I03 실제 브라우저 검증과 드라이버/JSON/PNG/log/version 증거. 별도 App전체 테스트/소리 청취/배포 완료로 주장하지 않는다.

## Commit Message

```text
test(game): validate next-stage unlocks and per-stage ranking flows

Plan: 2026-10-27-stage-unlocks-and-per-stage-scores
Phase: P01-stage-scores
Task: T03-stage-score-browser-validation

- Verify clear quit retry and zero-score checkpoint transitions
- Check legacy progress preservation and actual-stage ranking boundaries
- Validate timing motion and responsive game panels in isolated browsers
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
