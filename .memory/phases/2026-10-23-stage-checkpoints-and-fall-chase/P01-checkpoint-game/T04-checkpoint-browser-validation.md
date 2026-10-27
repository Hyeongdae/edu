# Task: T04 Checkpoint Browser Validation

## Status: done

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

- [x] 전체5단계와 체크포인트 계속/그만두기·동결·동적400점 목표가 동작한다.
- [x] 해금·0점 재도전·이전 기록 기준·계정/저장 오류·v4랭킹이 검증된다.
- [x] 실제 시간 일반 추격/250ms 넘어짐 가속/단일 잡힘·중지 복귀와 정확한 경계가 확인된다.
- [x] 네 화면 및320px 확대·모션 감소에서 조작/안내/선택/결과에 접근 가능하다.
- [x] 지정17파일/lint/build/브라우저 증거가 통과하고 완료 포인터가 커밋된다.

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

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Validation Results — 2026-10-27

### Commands

- 위 Validation의 정확한17파일 명령: 최초432/432, 수정 후 **17파일433/433 PASS** (41.63s). `initial-tests.log`, `final-tests.log`.
- `npm.cmd run lint`: PASS, `lint.log`.
- `npm.cmd run build`: PASS (`tsc --noEmit && vite build`, Vite8.3.5), `build.log`. JS550.83kB(gzip153.95kB), CSS55.50kB(gzip10.77kB). 이번 로그에는 chunk 경고 문구가 출력되지 않았으나 JS는 여전히500kB를 넘는다. 기존 번들 크기 이슈를 해결한 것으로 표시하지 않는다.
- `git diff --check`: PASS. 관련 변경4개 소스/테스트와 이 Task만 구현 커밋에 포함한다. Phase/plan/current와 실제 커밋 hash는 뒤의 메모리 동기화 커밋에서 기록한다.

### Environment and evidence

- Windows PowerShell, Node `v24.21.0`, Chrome `156.0.8078.48`. 연결된 브라우저 도구가 없어 숨겨진 headless Chrome의 새 전용 프로필과 CDP `Target.createBrowserContext({disposeOnDetach:true})`를 사용했다. 각 드라이버는 finally에서 자신이 만든 context만 폐기했다. 일반 사용자 프로필/저장소에는 접근하지 않았다.
- 실제 앱 `http://127.0.0.1:5173/`, 개발 서버 프로세스의 `VITE_LOCAL_DEMO_MODE=true`. `.env`/인증 구현/프로덕션 우회 코드는 변경하지 않았다. 의존성 추가 없음.
- 아티팩트 기준 경로: `C:\Users\DEX\AppData\Local\Temp\stair-checkpoints-t04\`. 아래 `.mjs` 드라이버, 같은 이름의 `.json`/`.log`, PNG는 이 디렉터리에 보관했다. 브라우저 실행은 CPU 부하가 큰 테스트/빌드와 분리했다.
- `cdp.mjs`: 실제 DOM/입력, 해당 context의 React 상태/오디오 호출 계측. 특정 경계는 실제 엔진으로 만든 일관된 상태를 주입했다. 전체 5단계 진행은 상태 강제 승급 없이 실제 표시된 다음 입력으로 플레이했다. Date.now/seed 제어와 실제 경과 시간을 구분한다. 프로덕션 디버그 훅 없음.

### Browser results

| Driver / evidence | Result |
| :--- | :--- |
| `full-flow.mjs`, `full-flow.json` | 수정 뒤 네 화면에서 다시 PASS. 320×667/390×667/768×1024/1440×900 각각 실제 생성 경로로 1~5단계, 최종 2000점·점프29회. 긴짧긴/긴짧짧긴·연속J·장애물/미출현 결정 보존. 체크포인트마다 진행도 즉시 저장/랭킹 미저장, 95초 동결·입력 차단·Tab/Escape, 중복 Continue 방지·동적400점·보너스 보존. 최종5/단일 저장·3단계 새 판0점/65초·이전5단계 기록 보존. |
| `storage.mjs`, `storage.json` | PASS. 첫 클리어 후 새로고침, 1단계 Quit, Continue 후2단계 실패, 최초 실패0단계, 이전3단계에서3/1단계 재도전, 실제4단계 클리어/해금/기본 선택. 소유 문서의 계정 props 변경으로 다른 계정 잠금 확인. v1/v2/v3만 정리, v4/progress/기타 보존. 단계→점수→시각 정렬·동점/낮은 기록의 이름/시각/점수 쌍 보존. get/set/remove 실패·별도 오류·메모리 해금·복구 후 플레이/저장. |
| `extras.mjs`, `extras.json` | PASS. 실제 `stair-climb:audio:v1` 설정과 `msal.owned-sentinel` 보존, 옛v3에서 해금 추론 없음, localStorage getter 자체 차단 상태에서도 안내/시작 가능. 11개 기본 계단 외 실제 NPC 역사 계단 표시. |
| `pursuit.mjs`, `pursuit.json` | PASS. 실제 시간 첫 이동 논리800ms/관측894ms, 단일 잡힘 논리3200ms/관측3412ms, 결과 표시3813ms·단일 저장. 실제 넘어짐250/500ms 예약을268/584ms에 관측, 다음 일반1300ms를1354ms에 관측. 성공 발소리1/실수1. 다른 단계 일반650/500/400/300ms 확인. 제어시간으로 전 단계250/500/일반 복귀, 이전100→350 예약, 정확한250/500 만료 우선·이른 잡힘 보존·회복 끝 도주 금지. 설정95초 전후 stage90000/event30000/NPC800ms 유지, native range/Escape/포커스·차단 입력·객체 보존. 넘어짐 설정100→10100 후 남은150ms, 다음10250/11050. 모션 감소 결과 즉시 접근. |
| `lifecycle.mjs`, `lifecycle.json` | PASS. 별도 새 context에서 실제4초간 CDP Page frozen/active, 같은 document token 유지·복귀 시 잡힘1/예약null/랭킹0단계. 개발 HMR의 자동 새로고침을 막기 위해 이 소유 문서의 Vite WebSocket만 임시 stub 처리했다. OS 탭 UI 검증으로 주장하지 않는다. `pursuit.json`에는 별도로 Debugger renderer suspension/resume4초 결과도 있다. |
| `layout.mjs`, `layout.json` | PASS. 네 기본 화면과320px root24/32px에서 선택5개/플레이/설정/체크포인트/결과 검사. 긴 이름·16자리 점수·긴 장애물 안내·TOP10/현재 사용자·재시작/랭킹 스크롤·오류 안내. root 가로세로 overflow 없음, scene≥200px, 버튼≥56px·gear44px·turn/jump4px<outer12px, desktop 조작 버튼 숨김. 200% 저장 오류 화면의 두 버튼 모두 elementFromPoint hit=true, 각각240×56px. |
| `motion.mjs`, `motion.json` | PASS. 실제 생성 장애물에서 좌우 점프, WebAnimation currentTime0/150/300 + 촬영 중 cosmetic virtual-time pause. 오른쪽(-68,56)→(-34,-28)→(0,0), 왼쪽(68,56)→(34,-28)→(0,0). 단일 캐릭터·feet clip 밖/장애물 위 overlay, reduced-motion transform/animation none·idle frame. |
| `boundaries.mjs`, `boundaries.json` | PASS. 엔진/box fixture 경계에서2칸·2/4점·게이지28/29·호출1회, 실제 CDP touch/native focused Space, 잘못된 반복 입력1회 소리, 빠른J→Space/후속 이동 취소, 점프 중 독립 NPC 이동. 보너스 만료·잡힘/시간 종료·클리어 점프·Quit/재시작/계정 변경 unmount 연출 정리. NPC가 player입력 없이 실제6(left)→7(right)→8(right) 이동, 기본11계단/단일 sprite·far gap44/offscreen index 유지. |

대표 PNG: `selection-320-font32.png`, `checkpoint-progress-error-320-font32.png`, `stage3-fresh-1440.png`, `fall-250ms.png`, `catch-result.png`, `storage-error.png`, `left-jump-midpoint.png`, `reduced-jump.png`. `layout-failure.json/png`에는 수정 전 버튼 가림 재현이 남아 있다. 성공 드라이버들은 page runtime 예외가 없음을 확인했다. 오디오 계측은 호출 횟수이며 스피커 청취 증거가 아니다.

### Demonstrated fix and regression

- 수정 전320px/200%에서 `.checkpoint-progress-error`의 absolute/z-index6 안내가 Continue/Quit 위에 겹쳤다. 실제 hit-test에서 Continue의 hitClass가 `checkpoint-progress-error`, hit=false였다.
- `GameScreen`에서 `CheckpointPanel`로 선택적 `progressError`를 전달하고, 오류 문단을 스크롤 가능한 dialog 내부의 일반 흐름으로 옮겼다. CSS absolute/inset/z-index를 제거했다. 목표 크기/글자/검증 조건은 줄이지 않았다.
- `CheckpointPanel.test.tsx`에 오류가 dialog 안에 포함되며 두 콜백을 계속 사용할 수 있음을 회귀 테스트로 추가했다. 수정 후 오류 화면·모든 반응형 화면과 네 크기의 실제 전체 진행을 재검증했다.

### Driver corrections and limits

- 최초 드라이버의 `#sfx-volume`을 실제 `#effects-volume`으로 수정했다. 지난 obstacle 결정을 은퇴된 메타데이터로 덮어쓰던 수집기, 옛 엔진 함수/field명, 체크포인트 자동 진행을 가정한 탐색, React effect 전 오디오 카운터 초기화, await 없는 restart/start도 수정 후 재실행했다. 이는 제품 결함으로 계산하지 않았다.
- CDP frozen/active 초기 시도에서 `Inspected target navigated or closed`/`__state is not defined`가 발생했다. 별도 진단으로 document token 변경과 Vite 개발 클라이언트 새로고침을 확인했다. 위 lifecycle 전용 드라이버가 소유 문서의 HMR socket만 막은 후 같은 문서/실제시간 복귀를 통과했다. 제품 코드나 게임 시계를 우회하지 않았다.
- 별도 넘어짐 소리 청취 문제, 독립 App 전체 테스트, 번들 분할, Entra 설정/배포는 이 Task의 완료 범위 밖이다.
