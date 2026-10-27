# Task: T04 Checkpoint Browser Validation

## Status: pending

## Goal

새 규칙의 전체5단계·체크포인트·재도전·진행도·랭킹·250ms추격을 격리 브라우저에서 확인하고, 회귀/lint/build와 증거를 남겨 계획을 완료한다.

## Decision Summary

- 모든 검증은 현재 실제 앱과 실제 생성기를 기준으로 한다. 가속 진행용 제어 시각과 실제 시간 추격 증거를 구분한다.
- 발견된 관련 결함만 수정하고 별도 소리 청취 문제·전체 App 테스트 정리·번들 분할·배포를 합치지 않는다.

## Implementation

### I01. Required prior contracts

- Related Files:
  - `src/game/types.ts`, `stageRules.ts`, `gameEngine.ts`, `stageProgress.ts` — read-only unless a required check exposes a contract defect
  - `src/game/GameScreen.tsx`, `GameHud.tsx`, `CheckpointPanel.tsx`, `StageSelectPanel.tsx`, `StairScene.tsx`, `stairSceneModel.ts`, `pixel-theme.css`, `pixel/pixel-scene.css` — verified related fixes only
  - `src/leaderboard/leaderboard.ts`, `LeaderboardPanel.tsx` — verified related fixes only

#### Details

- **Models**: playable GameStage1..5; ClearedStage0..5; status ready|playing|checkpoint|game-over; reasons caught/time-limit/cleared/quit. No lives. Session fields stageStartScore:number,recordStage:ClearedStage,clearedStageThisRun:ClearedStage,checkpointEnteredAt:number|null plus existing real route/obstacle/move/NPC/event/recovery fields.
- **Rules**: scoreRequired400 each, durationMs90000/75000/65000/60000/50000, probability.1/.2/.3/.4/.5, base pursuit800/650/500/400/300ms. Goal=getStageTargetScore(stageStartScore), no stage*400 shortcut. Overshoot retained, Continue sets next stageStartScore=current score.
- **Engine APIs**: createGameState/resetGame(random?,{stage?,highestClearedStage?}) lock selected<=max(1,highest); ready selected/0score/recordStagehighest/clearedThisRun0/steps0/event0/newroute/selected-stage obstacles/NPC-4/no clocks. startGame(ready,now) preserves preview and arms selected clocks. applyInput/tickGame pure and validate real indices/times. continueGame(checkpoint,now) preserves score/route/event/record, shifts frozen bonus once, advances stage, resets NPCgap4/full new stage/base pursuit deadline. quitAtCheckpoint ends quit.
- **Checkpoint**: stages1..4 retain just-cleared stage, enteredAt=completion time, stage/NPC clocksnull; tick/input identity and bonus displayed at enteredAt. Stage5 ends cleared without a sixth stage. Record=max(prior known highest,actual clears this run). Final rank comparison occurs once only at game-over; actual clear saves progress immediately.
- **Catch**: first scheduled contact ends caught; NPC retains last safe player-1/gap1, captureCount+1/captureEndsAt=at+500, no respawn. Normal result waits500ms animation; reduced-motion result is immediately accessible. Stage expiry tied with NPC/input wins; earlier fatal catch remains caught after later expiry.
- **Fall**: wrong input sets recovery=now+500 and nextNPC=min(previous,nextnow+250), no instant step. At each NPC step use fast successor only if lastMistake and at+250<=recoveryEnd; otherwise base successor. Pending step exactly at recoveryEnd still happens before input. Repeated recovery input cannot extend boost. Stage1 fall0→steps250/500/next1300; earliernext100→100/350/next1150. Settings shifts stage/event/NPC once while recovery elapses; open100/close10100 retains next10250 then base. Checkpoint is already frozen and settings does not double-shift it.
- **Storage**: rank `stair-climb:leaderboard:v4` JSONarray entries `{accountId,displayName,bestStage:ClearedStage,bestScore,achievedAt}`; prior rankv1/v2/v3 cleanup only. Account progress key `stair-climb:stage-progress:v1` array `{accountId,highestClearedStage}`. readStageProgress(account,storage?)→{highestClearedStage,available}; save→{highestClearedStage,saved,error?}. Initial known highest=max(currentaccount validv4,progress). Do not infer from legacy. Rank ordering stage desc/score desc/time asc, whole pair/ties preserved; new run record baseline inherits prior highest with score0.
- **Presentation**: ready StageSelectPanel has5buttons, locked stagesdisabled, defaultmax(1,highest), native Start `시작하기`; result `다시 시작` returns ready selection before Start. Checkpoint dialog `계속하기`/`그만두기`, focus/Tab/no automatic Escape action. Settings gear disabled while selecting/checkpoint. D/J/Space ignore nonplaying/native menu buttons, touch movement remains immediate primary pointerdown with detail1 click ignored. Score/event only HUD, internal scrolling and scene>=200px, mobile automatic controls/footer, desktop>=721px controlsnone. Player300ms jump outside feet clip, NPC240ms independent, reduced motion static.
- **Signatures & Types — existing APIs used by drivers**:
  ```typescript
  function createGameState(random?:()=>number,options?:GameStartOptions):GameState;
  function startGame(state:GameState,nowMs:number):GameState;
  function applyInput(state:GameState,input:GameInput,nowMs:number):GameState;
  function tickGame(state:GameState,nowMs:number):GameState;
  function continueGame(state:GameState,nowMs:number):GameState;
  function quitAtCheckpoint(state:GameState,nowMs:number):GameState;
  function resumeGameAfterPause(state:GameState,openedAtMs:number,closedAtMs:number):GameState;
  ```
- **Data & Schema Fields**: use the exact prior state/storage fields above. Evidence JSON may record viewport,width,height,rootFont,controlledTime:boolean,scenario,result,metrics,screenshotPath; it is temporary verification data, not a new production model.

### I02. Regression and permitted fixes

- Related Files:
  - All17 test files listed below — run; add relevant regressions for any correction
  - `src/test/gameFixtures.ts`, `obstacleFixtures.ts` — test-only fixture corrections if needed
  - `package.json`, auth/audio implementation, unrelated CSS/App tests — read-only

#### Details

- Run the exact17file command, lint and build. Fix only failed checks caused by these contracts. Do not relax stage-lock/storage validators, weaken single-catch/400point assertions, increase timeouts, disable lint, add packages or production test props.
- Existing movement tests isolate chance with create/reveal no-hit spies; actual stairObstacles tests and browser use the real seeded generator. Maintain two-step2/4points/event28/29, repeated single-step turns, history/offscreen NPC and same input replay tests.
- Allow necessary verified selector/grid/focus/timer corrections in the related files above. Add the regression that demonstrates each fix and rerun affected plus full17file checks. Record existing500kB bundle warning separately, not as a test failure or a fixed issue.
- **Execution Flow / Logic**: establish the prior contracts, run regression, execute isolated browser scenarios, fix and replay demonstrated failures, rerun final regression/lint/build after browser work, and only then synchronize completion. Report tool/driver errors concretely and keep unmet acceptance criteria open.

### I03. Isolated browser verification

- Related Files:
  - Temporary drivers/PNG/JSON outside production source — verification artifacts only
  - This Task Validation Results — store actual tool/version/path/method/results/limitations

#### Details

- Prefer a connected browser tool. Otherwise use existing CDP browser connection with Target.createBrowserContext({disposeOnDetach:true}) and a target in that owned context; dispose only that context in finally. A fresh hidden helper profile is allowed when necessary. If automatic approval rejects launch, report the action/reason and use an allowed isolated connection; do not expose/clear the user's normal profile or open a visible helper window.
- Use local-demo development mode, not a production auth bypass. No real Entra credentials or ordinary browser storage fixtures. Temporary document-level controlled Date.now/seed and engine-derived coherent snapshots are allowed for specific boundaries, clearly logged. Never add a source debug hook/skip-stage control. Run browser checks separately from CPU-heavy tests/build and avoid editing files mid-run that trigger HMR.

#### Full progression and checkpoint decisions

1. Required normal viewports:320×667,390×667,768×1024,1440×900. Start with fresh owned storage. Verify only stage1 selectable, ready90s/goal400/no hearts, startscore0/NPCgap4.
2. Play through all5 using displayed next box→Space, else corner→J, else D; mobile equivalent buttons plus native CDP touch/keyboard samples. Never force a full-flow promotion. At each clear1..4 inspect dialog/current just-cleared stage/actualscore/progress saved/rank not yet saved, and all timers/bonus frozen while waiting.
3. Continue explicitly: new stage75/65/60/50s, target=actual checkpointscore+400, score/event/route/known decisions preserved, NPCgap4/full new base interval. D/J/Space/touch while awaiting choice cannot move. Double Continue cannot skip a stage. With no overshoot goals400/800/1200/1600/2000; assert computed targets if overshoot occurs.
4. Final5clear has no Continue, record5/actualscore and one final ranking comparison, no catch delay. Result restart returns selection default5 with stages1..5; choose3 starts0score/65s/goal400/newroute/event0/NPCgap4/initialobstacleprobability.30, recordbaseline5. Capture/fail preserves that baseline and prior best if worse.
5. Separate fresh profile run: clear1 then Quit ->record1/actualscore/saveonce; clear1 then Continue and fail2 ->record1; fail before any clear ->0stage. Seed valid priorprogress3 to test start3 failure ->record3/currentrunscore, not0. Selecting lowerstage1 still inherits3; actual newclear4 raises to4. Do not confuse these prior-history and fresh cases.
6. Verify reload immediately after a checkpoint retains unlock despite no final ranking yet. Highest0 still allows1, highest2 locks3. Another account cannot see that unlock. Duplicate/start/menu actions do not write progress/rank.
7. Real generator: long5..9 followed by1or2short1..3, both patterns/back-to-back J; short never box, long at most1/interior/same-direction landing. Hit/null decisions stable across resize/checkpoint/pause/continue. Probability thresholds10/20/30/40/50 are established by pure tests, not empirical frequency from one game.

#### Pursuit, exact times and animations

1. Separately allow real Date.now to advance: stage1 idle shows NPC step after800ms without player input, success widens gap until next scheduled move, no-input single catch about3200ms ends with one final save/record0. Normal catch gate lasts500ms and reduced-motion result is immediate.
2. Separate real-time fresh fall: wrong input leaves NPC unmoved immediately; first scheduled steps250/500ms (DOM may reconcile by300/500 due100ms polling; inspect engine atMs). Recovery inputs do not restart it. Verify later base cadence and record elapsed times. Engine-derived snapshots may establish all five base intervals and earlier-next100 boundary; identify these as controlled checks.
3. Exact250/500 stage deadline wins over NPC/Space; earlier250 catch survives later251 stage deadline. At recoveryEnd500, due catch precedes escape input. Bonus expiry and capture/timeout during pending jump must not leave a stale sprite or duplicate audio/save.
4. Playing settings95s with active bonus/pending NPC preserves all3 remaining times once; D/J/Space/touch blocked, Escape/native audio range/focus/preferences work. Paused fall100→close10100 keeps remaining150ms, recovery visually ends, first resumed pending step then base. Checkpoint95s with active bonus is separately frozen; continue must not count settings/checkpoint overlap twice.
5. Hidden/lifecycle suspension with real elapsed time must reconcile enough for a single fatal catch on return, stopping before a later stage expiry. Clearly distinguish CDP frozen/active lifecycle from OS tab UI. Do not claim frozen full-stage runs validate real pursuit.
6. Verify gap>4/real NPC index/11base nodes/history extras/offscreen metadata/no RangeError. NPC crosses a short corner on its own facing without player action. One sprite copy; NPC240ms replay at250ms cadence cannot freeze/cancel player300ms jump. Test both left/right jump departure/midpoint/landing; arc above box/outside clip, subsequent D/J/Space cancels previous arc. Clear-producing jump, Quit, catch, timeout, restart and unmount all clear obsolete visuals with one successful footstep and only actual mistake fall calls.

#### Storage, responsive UI and evidence

1. In owned storage preload legacyv1/v2/v3, validnewv4, per-account progress and audio/auth/other sentinels. Confirm only legacy ranking keys removed, validnew keys retained after reload/restart, no inference from oldv3, current account isolated. Validate stage-first whole-pair/tie timestamp/TOP10/current player, zero-stage label.
2. Inject read/setItem/removeItem failures only in the owned document, restore them afterwards. Progress failure keeps in-memory unlock/Continue/Quit; final ranking failure shows its separate error/restart; storage recovery allows later play. No localStorage.clear in an ordinary profile.
3. At all normal sizes inspect ready selection/checkpoint/playing/result/settings bounds and accessibility. At320px repeat root font24px/32px (150%/200%), including long box cue, five stage buttons, two checkpoint actions, long account name/16digit score, error/restart/ranking scrolling. Targets>=56px; turn/jump gap4<outer12; gear44px never overlaps HUD; no page-wide overflow. Use internal scrolling when content cannot fit; do not shrink targets/text or globally override fonts in product code.
4. Save screenshots/metric assertions/driver paths/actual browser versions and pass/fail results in this Task. Sample names selection-320-font32.png, checkpoint-bonus.png, stage3-fresh.png, fall-250ms.png, catch-result.png, storage-error.png. Snapshot CSS animations at0/150/300ms with controlled animation time if needed, documenting cosmetic-time control. Audio instrumentation is call-count evidence, not speaker audibility.

### I04. Completion bookkeeping

- Related Files:
  - This Task, parent `phase.md`, plan `.memory/plans/2026-10-23-stage-checkpoints-and-fall-chase.md`, `.memory/current.md` — update only after passing

#### Details

- Mark Task done/check criteria, attach actual17file/lint/build/browser results, commit using prescribed message. Then record implementation hash, phase done4/4, plan completed, current Active Task none with T01..T04 hashes and preserved previous five-stage plan history. Commit memory synchronization separately so a fresh checkout does not rerun completed work.
- If a required browser check cannot be completed, leave relevant acceptance unchecked and task in_progress, state the concrete reason and completed evidence; never call this plan completed just because unit tests pass. Preserve the separate fall-sound decision and bundle warning.

## Acceptance Criteria

- [ ] 전체5단계와 체크포인트 계속/그만두기·동결·동적400점 목표가 동작한다.
- [ ] 해금·0점 재도전·이전 기록 기준·계정/저장 오류·v4랭킹이 검증된다.
- [ ] 실제 시간 일반 추격/250ms 넘어짐 가속/단일 잡힘·중지 복귀와 정확한 경계가 확인된다.
- [ ] 네 화면 및320px 확대·모션 감소에서 조작/안내/선택/결과에 접근 가능하다.
- [ ] 지정17파일/lint/build/브라우저 증거가 통과하고 완료 포인터가 커밋된다.

## Validation

- `npm test -- --run src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts`
- `npm run lint`
- `npm run build`
- I03 browser checklist with actual paths/metrics/screenshots/results. Do not claim unrelated App/full-suite/audibility/deployment success.

## Commit Message

```text
test(game): validate checkpoint replays and accelerated pursuit

Plan: 2026-10-23-stage-checkpoints-and-fall-chase
Phase: P01-checkpoint-game
Task: T04-checkpoint-browser-validation

- Verify checkpoint pause selection progress and version-four ranking flows
- Check real pursuit fall timing and responsive accessible game panels
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
