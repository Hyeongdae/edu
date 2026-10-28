# Task: T03 Main Descent Browser Validation

## Status: done

## Goal

메인 `/`의5단계 하강과 최초 기록 초기화/이후 새 기록 보존을 실제 브라우저에서 입증한다. 독립 실험·인증/오디오 경계를 보존하고 모든 증거가 통과한 뒤 계획을 완료한다.

## Decision Summary

- main5단계/기존 규칙·Entra·픽셀UI 유지, 위쪽 NPC와 내려오는 step/jump/catch. 구 랭킹·해금은 각 origin 최초 전환에 초기화, 새 기록은 유지. 실제 사용자 저장소 대신 소유 context에서만 데이터 초기화 검사를 한다.
- 신규 또는 허용된 전환 구현에서 입증된 관련 결함만 수정한다. 기존 App suite/원본 렌더 성능·번들 개선/일반적 modal 리팩터링/실제 Entra 설정·배포를 확장하지 않는다.
- 사용자 추가 요청(D11)의 main 오디오 재시도 후 focus 복구는 이번 검증의 필수 범위다. T02 GameScreen/기존 테스트 변경만 사용하며 오디오 owner는 유지한다.

## Implementation

### I01. Final contracts and permitted files

- Related Files:
  - `src/game/recordStorage.ts`/test, `stageProgress.ts`/test, `src/leaderboard/leaderboard.ts`/test — read-only unless relevant defect proven
  - `src/game/GameScreen.tsx`/test, `StairScene.tsx`/test, `ControlButtons.tsx`/test, `GameHud.tsx`/test, `pixel/pixel-scene.css`, `pixel-theme.css`, `src/auth/AuthGate.tsx` text only, `index.html`, `README.md` — related fixes only
  - core engine/types/stageRules/route/obstacles/pursuit/base stairSceneModel, src/descent/**/descent-test.html, App/main/authConfig/audio/assets/package/config — read-only
  - This Task/phase/plan/current — completion bookkeeping after evidence passes
  - `%TEMP%\main-game-descent-conversion-2026-10-28\` — new drivers/JSON/PNG/log, outside repo

#### Details

- **Signatures & Types**:

  ```typescript
  type GameRecordScope='ascent'|'descent';
  prepareDescentRecords(storage:Storage):{complete:boolean};
  readLeaderboard(storage?:Storage,scope?:GameRecordScope):LeaderboardEntry[];
  saveBestScore(entry:Omit<LeaderboardEntry,'achievedAt'>,storage?:Storage,now?:Date,scope?:GameRecordScope):SaveBestScoreResult;
  readStageProgress(accountId:string,storage?:Storage,scope?:GameRecordScope):ReadStageProgressResult;
  saveStageProgress(accountId:string,clearedStage:ClearedStage,storage?:Storage,scope?:GameRecordScope):SaveStageProgressResult;
  buildDescentSceneModel(state:GameState):DescentSceneModel;
  // main still stores RAW GameState in its React useState hook (not experiment's {game,nowMs} view).
  // Existing engine: createGameState(random?,{stage?,highestClearedStage?}), startGame(state,now),
  // applyInput(state,input,now), tickGame(state,now), continueGame(state,now), quitAtCheckpoint(state,now),
  // resetGame(random?,options?), resumeGameAfterPause(state,opened,closed) all return GameState.
  ```

- **Data & Schema Fields**:
  - New ranking key`stair-descent:leaderboard:v1`, progresskey`stair-descent:stage-progress:v1`, resetmarker`stair-descent:records-reset:v1`=`1`. Ranking row={accountId,displayName,bestStage1..5,bestScoreinteger≥0,achievedAtISO}; progressrow={accountId,highestClearedStage0..5}. Scope defaultascent for backward compatibility; every main call must explicitlydescent.
  - Legacy allowlist exactly6keys: ascent leaderboardv1..v5 + stage-progressv1. Marker1 short-circuits preparation. Incomplete cleanup retries only these old keys; no old→new migration, no new empty writes during reset, no auth/audio/session clear. Malformed NEW leaderboard handling is separate from reset; only invalid new data may be discarded by current parsing rules.
  - GameState raw fields: status(ready/playing/checkpoint/game-over), stage1..5, score,stepsClimbed,highestClearedStage,clearedStageThisRun,checkpointEnteredAt,stageEndsAt,endReason, direction,straightStepsRemaining,pursuerDistance,pursuerIndex,nextPursuerStepAt,lastPursuerMove{fromIndex,toIndex,atMs}|null,captureCount,captureEndsAt,eventSteps,eventEndsAt,recoveryEndsAt,lastMistake,route,obstacles,lastMove{kind:climb/jump,fromIndex,toIndex,scoreGain:1/2/4,isBonus}|null. All deadlines are absolute number|null. Stage does not become1-only; final5 hascleared, stages1..4checkpoint.
  - Rules fixed: goals150/200/250/300/350; budgets90000/75000/65000/60000/50000ms; long-run box10/20/30/40/50%; NPC800/650/500/400/300ms; initialgap4; fall500/NPC250; one catchends. Long5..9/short1..3 one-or-two-short mixing. Jump2physicalstairs→2/4points;30physicalstairs→30s2x; each stage0points but route/event/totalsteps retained oncontinue.
  - Main selectors remain `.stair-game.pixel-theme`, `.stage-select-panel`, `.checkpoint-panel`, `.game-over-panel`, `.settings-dialog`, `.game-controls`; testids runner/runner-motion/pursuer/pursuer-motion/stair-step/stair-obstacle/route-direction/score-value/stage-time. Main labels are now 내려오기/내려가기. Independent experiment retains descent-prefixed selectors and its own1stage/no-storage behavior.
  - Main model uses pure reflected helper while base upwardmodel remains unchanged. Player260,216/next244/NPCinitial104; step300 from±34,−28/mid±17,−22; jump300 from±68,−56/mid±34,−84; NPC240 same step geometry; catch500 sevenactualrouteframes0/.2/.4/.55/.7/.85/1 inpx. No overall scaleY−1/duplicate actor/old root percentagecatch. Score feedback remains main700ms.

- **Execution Flow / Logic**:
  1. Confirm current T01/T02 source contracts and read-only boundaries, then prepare owned browser/context and legacy/sentinel fixtures before entry scripts.
  2. Run I03 scenarios sequentially with actual app input and documented clock/fixture methods. On assertion failure preserve state/token/screenshot/log; distinguish driver errors from product defects.
  3. Correct only demonstrated related defects in permitted files, add a regression test where appropriate, and rerun affected browser scenarios plus the complete explicit unit/lint/build checks without skips or timeout changes.
  4. Only after all required evidence passes, perform I04 bookkeeping and keep a verified local main link. If blocked, retain in_progress and exact unmet checks rather than resetting real user data or fabricating completion.

### I02. Owned browser, instrumentation and evidence

- Related Files: temporary verification scripts/artifacts and this Task results.

#### Details

1. Discover browser tools first; if absent use Node built-in fetch/WebSocket/CDP, an OWN hidden headless profile, Target.createBrowserContext({disposeOnDetach:true}) and finally dispose only owned contexts. Record actual Node/npm/Chrome/Vite versions/URL/port/evidence. No dependency installation/user browser/profile reads or deletion.
2. Prefer existing loopback demo5175 only after confirming PID/servedentry/env. Otherwise start own hidden loopback dev server via process VITE_LOCAL_DEMO_MODE=true/strictPort. Do not edit .env. AuthConfig's DEV/production boundary and Entra parameters stay unchanged. Fake public accounts are only in owned test component fixtures, never a new production bypass.
3. Every navigation probe must wait for a new document token and actual app ready. Scan `GameScreen` fiber hooks for queue.lastRenderedState with raw route.steps/status; DO NOT use the experimental `{game}` hook probe or fixed hook indices. Read only. No arbitrary state dispatch/fiber mutation/forced promotion for full UI scenarios.
4. Seed storage BEFORE entry scripts in an owned context. Install own original methods/snapshot functions so driver reads do not count as app writes. Observe operations by key/type; legitimate new rank/progress/reset writes are EXPECTED in main. Do not reuse the experiment's assertion that the whole app must make0storage calls.
5. Full traversal may freeze/control document Date.now with real seeded generators and actual displayed cue; find suitable seeds using real engine simulation for both-direction boxes. Do not change chances, reduce targets or synthesize clear states. Explicit imported engine/helper fixture checks for boundaries/alternate-account rendering must be labeled separately from full UI play and actual tenant authentication.
6. Heavy tests/build/source edits must not overlap real-time browser scenarios. Calls/waits under60s with progress updates; scripts/screenshots/JSON/failures outside repo. Pause CSS WebAnimations separately from engine clock for motion PNGs. Close only identity-checked owned helpers, keep user demo link available if practical.

### I03. Required actual browser scenarios

#### A. One-time reset and data persistence — same owned context

1. Prepare v1..v5 legacy ranking arrays and oldprogress including local-demo-account highest5 and another account highest3. v4/v5 rows use valid achievedAt. Seed valid audio settings(.37/muted etc), auth/session/unrelated sentinels. New keys/marker absent. Navigate actual main `/`, authenticate via existing DEV demo only. Assert new fresh1/highest0/score0/4locked/emptyrank/goal150/time01:30, targeted oldkeys absent,marker1, auth/audio/session/unrelated exactbytes retained. No broadclear/legacy→new progress rows.
2. Remove the seeding new-document script after first load; otherwise reload would reset the evidence. With actual cue inputs clear1→checkpoint→Quit→restart. New progress1 and rankstage1actualscore, default2/score0/goal200/3locked. Reload SAME context without overwriting new keys: new values survive and reset does not run again (no new-key remove/empty-array write/markerwrite; allowed markerreads). Changing selected stage/restarting/StrictMode must not erase new records.
3. Continue a real new run, save a higher stage/pair; better pair replaces whole row, worse/lower/tie does not change its name/time. Stage-first ordering and new-rankstage5-withoutprogress→stage1 must hold. Test other account isolation via new-owned context or documented public GameScreen account/key fixture, not fiber props mutation. Browser account fixture is not proof of real Entra account switching.
4. Independently seed valid NEW data+marker1 and reintroduce oldkeys; oldkeys must never influence defaultstage/records. Partial old remove/get failure then recovery must preserve NEW data and retry only oldkeys. If markerwritefails after cleanup, later retry cannot delete NEW records. New-key readfailure must not be treated as knownempty and overwritten. Blocked storage getters should keep main memory play/restart and existing errorUI available; no crash.

#### B. All five stages on four viewports

1. At320×667/390×667/768×1024/1440×900 each, use actual main start/native keyboard or touch sample, then actual cue D/J/Space/primary touch controls through stages1..5. Storage fixture starts fresh once per document/context as appropriate; record actual stage point/steps/actions/jumps/sounds, not assumed counts. Confirm stage budgets/normal chase intervals and target display values from state/rules.
2. Stages1..4 checkpoint, immediate clear persistence, no automaticnext. Hold activebonus checkpoint95controlledsec; D/J/Space blocked; Continue→nextstage0/lastMovenull/same route/obstacles/steps/event with shifted clocks andgap4; Quit saves the actual currentstage+thatstagescore. Stage5 actual finalcleared and no continue. Replay highest unlocked stage/defaultselection behavior remains.
3. Generated long5..9/short1..3 with1/2short mixes, obstacles only long safeinterior at most1, stageAtGeneration on new reveals1..5 follows unchanged core (main stage1checkpoint may reveal stage2; unlike the1stage experiment this is correct). No reroll onresize/settings. Actual generated boxes in BOTH directions; jump2stairs→2/4points and onefootstep per rendered action, gauge physical30including jump. Unit/imported fixture can isolate28/29+2exactboundary. No duplicate actor/box, stage1-only adapter errors or fallback to no-save experimental screen.
4. Check HUD/labels/page title/help/nativebutton aria describe downward. Glyph arrowdown only, upright backdrop/officers. Camera/world shiftsup while player lands on actual lowerstep, topNPC follows real route/ownshortcorners, extra history/far metadata/positivegap. HTML distance badge must not cover the initial top NPC, HUD or gear.

#### C. Time, pause, sounds and lifecycle

1. Real Date.now with no heavy validation: fresh idle logicalNPC800/1600/2400/catch3200, safeindexplayer−1/gap1/capture1/ends3700; normal result gated500/reduced immediate. Record observed polling latency separately from engine logical atMs. Actual wrong input starts no instant NPC move,250/500steps then1300normal successor; repeatkeys do not extend500fall. Test another stage interval using its real budget or documented enginefixture.
2. Own same document frozen/active4actualseconds, same token afterresume, visibility tick preserves earlier caught/time-limit reason and no duplicate record save. If dev HMR reloads, record tooling and rerun with only owned devWebSocketstub; new ready document is not lifecycle proof. Browser catch should save NEW record once, never old key.
3. Imported real engine fixtures: tied expiry250/500vsNPC, earlier250catchvs251expiry, pending100/150 fall acrosspause, recovery-end move/catch before escape input, final stage5 bonusjump at349→353, elapsed deadlines/0score Continue. Label function checks accurately; no raw state injected to promote the on-screen game.
4. Actual UI activebonus settings95controlledsec preserves stage/event/NPC remainders and route/obstacles; inputblocked, volume/mute persists to existing audio:v1 acrossreload, BGM1↔1.25, footstep/fall/no unwanted duplicate onterminal, nativefocusedSpace/touchdedup. Keep main existing cosmetic timer behavior: it may finish under pausedsettings; it must not restart onclose.
5. Check settings focus/Tab/Escape, unmount/timer/listener/audio cleanup via public owned ReactRoot or documented component fixture. No production debugprop. Speaker audibility is not proven by audio callcounts.
6. Required audio-retry focus regression: in an owned document make native BGM play reject until the real `음악 켜기` retry is available, open settings, focus/click it with native CDP input, then allow its actual Promise to succeed. Assert the removed retry button is absent and close has focus after commit. Native Tab/ShiftTab remain in the dialog, Escape closes and trigger regainsfocus; document token unchanged and game remains paused until close. Also resolve while a valid internal range is focused: do not steal focus, ArrowRight still works. For a delayed result after close, leave focus on another owned element and verify it stays there; no dialog reopens or game inputfires. Record snapshots of activeElement/pause remainders/audio counters and a representative `main-descent-audio-retry-focus.png`. Public prop/component fixtures may isolate delayed completion but must be labeled separately from the native main UI retry case.

#### D. Motion and accessible layouts

1. Capture actual step300 and generated left/rightjump at animationcurrentTime0/150/300: step±34,−28→±17,−22→0; jump±68,−56→±34,−84→0. NPC240 independent; catch500sevenrealframes usespixel offsets. One upright player, inner footclip only, step/jump overlays exclude idlecopy/landingfrontlast, below intermediatebox not slicing airborne body. Reduced shows static at correct realanchor/facing and immediately reachable catch result.
2. Four viewport bounds in ready/play/settings/checkpoint/result: scene≥200px, root nooverflow, gear≥44/mobilebuttons≥56,≤720controls visible/desktopnone, turnjumpgap4/outer12, HUD·gear·cue·footer·distancebadge do not cover actors/buttons. At320 rootfont24/32 internal scroll must hit-test stagechoice/start/close/ranges/continue/quit/restart/rank; use valid scores≤353 and actual text.
3. Rapid turn/jump/nextinput removes old arc; independent NPC tick doesn't reset playerkey. Terminal/checkpoint/fall/reset/unmount remove movement/gain according to existing main timing. Photos: `main-descent-ready-320.png`, `main-descent-playing-1440.png`, `main-descent-checkpoint-390.png`, `main-descent-stage5-clear-390.png`, `main-descent-settings-320-font32.png`, `main-descent-{left,right}-jump-{departure,midpoint,landing}.png`, `main-descent-unlocked2-after-reload.png`, `main-descent-new-records-preserved.png`.

#### E. Authentication/build and independent experiment

1. Inspect actual main entry/env and unchanged AuthConfig guards: DEV demo works only indev; normal/prod requires existing Entra path. If tenant config absent, real tenant sign-in is unverified and explicitly limited, not a reason to add bypass/credentials. AuthGate title TEXT can change; login/redirect/MSAL/token config cannot.
2. Default build has only index.html and authenticated main nowimports pure downward model. Extra descent-test.html is still excluded. Vite preview `/descent-test.html` may SPAfallback200 to main; inspect returned module/DOM and do not call it published standalone experiment.
3. Separate owned context opens `/descent-test.html`: still1stage150/90/no save with its original development flaggate; seed new/old/auth/audio sentinels and verify this standalone experiment itself makes0Storagecalls/bytechanges. This is distinct from main's EXPECTED new-record writes. Existing experiment source/default upwardhelper remain unchanged, no double yreflection.

### I04. Completion bookkeeping

- Related Files: this Task, phase.md, `.memory/plans/2026-10-28-main-game-descent-conversion.md`, `.memory/current.md`.

#### Details

1. Record actual testcounts/buildsizes/warnings/browserversions/methods/seeds/clock distinctions/limitations/failures+exactfixes and path to indexed JSON/PNG/log/drivers. No old experiment screenshots reused as main proof.
2. All acceptance passes→Taskdone/requiredcommit, then Taskhash/phase3of3/plancompleted/currentActiveTasknone in separate metadata commit. Preserve T01/T02 and previous completed histories. If a required check cannotrun, leave in_progress/unchecked and state exact limitation; do not label unit-only completion as browser verified.
3. Leave a verified loopback main link available for user when practical, close identity-checked owned headless/temporaryservers only. Don't push/deploy or delete user profile/artifacts/other processes.

## Acceptance Criteria

- [x] Main actual5stage flow and checkpoints work on four sizes with correct downward coordinates/motion/topNPC and existing rules.
- [x] First conversion clears only authorized legacykeys; new rankings/unlocks survive reload/restarts/retries/accounts with auth/audio retained.
- [x] Timings/lifecycle/settings/mobile/reduced-motion and source/auth/standalone boundaries pass with owned browser artifacts.
- [x] Native audio retry removes its control safely, keeps focus inside settings/Escape·Tab usable, preserves range focus and does not steal focus after close.
- [x] Explicit27files/lint/build/diff checks pass, exact counts/limitations recorded, completion pointers and main local link updated.

## Validation

- `npm.cmd test -- --run src/game/recordStorage.test.ts src/game/StairScene.test.tsx src/descent/descentEngine.test.ts src/descent/descentSceneModel.test.ts src/descent/descentGate.test.ts src/descent/DescentTestApp.test.tsx src/descent/descentViewState.test.ts src/descent/DescentGameScreen.test.tsx src/descent/DescentScene.test.tsx src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts src/auth/authConfig.test.ts --maxWorkers=2` — all27files/actualcount/skip0.
- `npm.cmd run lint`
- `npm.cmd run build`
- `if (Test-Path -LiteralPath dist/descent-test.html) { throw 'Standalone experiment must remain outside default build' }`
- `git diff --check`
- `git diff --name-only bdf18d5 -- src/game/gameEngine.ts src/game/stageRules.ts src/game/types.ts src/game/stairRoute.ts src/game/stairObstacles.ts src/game/timedPursuit.ts src/game/stairSceneModel.ts src/game/game.css src/descent descent-test.html src/App.tsx src/App.test.tsx src/main.tsx src/auth/authConfig.ts src/audio public vite.config.ts package.json package-lock.json` — readonlybaseline unchanged; distinguish unrelated existing user changes.
- All required I03 actual browser scenarios with mjs/JSON/PNG/log/evidence index in owned temporary directory. No skip/timeout/newdependency/fiber injection/real user storage reset for verification.

## Commit Message

```text
test(game): verify five-stage main descent and fresh persistent records

Plan: 2026-10-28-main-game-descent-conversion
Phase: P01-main-descent
Task: T03-main-descent-browser-validation

- Validate downward stages checkpoints motion and timed pursuit in the browser
- Prove one-time legacy reset and preservation of new records and preferences
- Record responsive authentication and standalone experiment boundaries
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in the following metadata synchronization commit

## Execution Evidence — 2026-10-28

### Result and methods

- **9 browser drivers + 지정27파일727/727tests(56.60초, workers2, skip0) 통과**. lint 오류·경고0, TypeScript/Vite build와 diff check 통과. 제품 source/test 추가 수정이 필요한 결함은 발견하지 않았다. source는 T02 `5217dfa` 그대로다. timeout/skip/config/dependency 변경 없음.
- 브라우저 도구 검색 결과 연결된 브라우저 도구가 없어 Node 내장 fetch/WebSocket/CDP와 소유 hidden headless Chrome만 사용했다. Node24.21.0/npm11.19.0/Chrome156.0.8078.49/Vite8.3.5. 매 탐색의 document UUID·실제 ready를 기다렸고 GameScreen의 raw GameState hook은 읽기 전용으로 탐색했다. fiber dispatch/props 변경/강제 화면 승급은 수행하지 않았다.
- 전체 진행은 실제 생성기 seed0.5·표시 cue의 D/J/Space/primary pointer 이벤트와 native 키·터치 대표 입력이다. document Date.now를 제어해 긴 진행과95초 대기를 검사했다. 실제 추격/lifecycle는 Date.now를 수정하지 않은 별도 driver다. 함수 fixture/공개 GameScreen 계정 fixture는 화면 전체 진행의 증거와 구분했다.

### Browser evidence

| Driver | Verified result |
| :--- | :--- |
| `full-flow.mjs` | 320×667/390×667/768×1024/1440×900 모두 실제5단계 클리어. 점수150/200/250/300/352, 각615행동·641물리계단·26보너스점프·발소리615회·넘어짐0회. 제한90/75/65/60/50초와 NPC800/650/500/400/300ms, checkpoint95초 동결/입력 차단/다음 단계0점·같은 route/obstacles/event 유지, 최종5단계·낮은 단계 재도전의 최고 기록 보존 통과. 긴5..9/짧은1..3 및1/2짧은 구간 혼합, 안전한 긴 구간 장애물·generation stage1..5 확인. |
| `storage.mjs` | 구6키/두 계정 high5·3에서 빈 랭킹·1단계0점/목표150·4잠금, 정확히6삭제·marker1 단일 쓰기와 auth/audio/session/무관한 byte 보존. 초기 seed script 제거 후 실제 clear1→Quit→restart→동일 context reload2/0/목표200, clear2 후 reload3와 새 기록 보존. 새 rank만으로 해금 금지, 공개 account/key fixture의 A/B 해금 분리, whole best pair/이름/시간 동점·하위 보존·정렬. 구키 get/remove 및 marker write 실패 후 새 기록 보존·재시도, 새키 읽기 실패의 덮어쓰기 방지, blocked getter의 실제 오류 UI/메모리 플레이/재시작 통과. 실제 Entra 계정 전환 증거로 주장하지 않는다. |
| `motion.mjs` | 실제 generated 양방향 점프에서 WebAnimation0/150/300ms의 ±68,−56→±34,−84→0, step300/NPC240의 ±34,−28→±17,−22→0 확인. 고정 anchor/inner clip·단일 actor/landing front, resize의 장애물 결정 보존, catch500의7개 px 경유점·inner travel/facing, reduced static idle와 safe facing/즉시 결과 접근 통과. 본문 screenshot3개와 양방향 midpoint를 실제로 열어 픽셀 장면·클립/상자 가림도 확인했다. |
| `real-time.mjs` | 실제800/1600/2400/3200ms 추격·safeindex−1/gap1/capture1/3700ms 종료, 실제250/500 빠른 추격/1300 정상 복귀, 잘못된 입력 즉시 이동 없음·회복 후 D와 소리, NPC 자기 코너/extra history/far 메타데이터, 같은 문서4실제초 frozen→active 단일 잡힘·새 랭킹 쓰기1회, reduced 즉시 결과 통과. 관측 polling 지연과 엔진 atMs를 구분했다. 소유 문서의 Vite WebSocket만 stub해 HMR 새 문서를 lifecycle 증거로 오인하지 않았다. |
| `audio-settings.mjs` | 실제 main에서 native HTMLMediaElement.play의 거부→native 재시도→원래 play Promise 성공 후 버튼 제거/close focus, Tab·ShiftTab trap/Escape·trigger 복귀. pending 재시도 중 내부 range focus 유지·native ArrowRight, 닫은 뒤 늦은 완료의 외부 focus 보존. 활성 보너스에서 설정95제어초의 stage/event/NPC 동결·회복, 볼륨/음소거 audio:v1 재접속 보존, 실제 재생 중 BGM1↔1.25, cosmetic 완료 후 재생 없음. 소유 공개 root unmount 시 GameScreen timer0/listener0/audio dispose1 통과. |
| `layout.mjs` | 네 화면의 ready/play/settings/checkpoint/result와320px root font24/32의 내부 스크롤 hit-test를 확인했다. scene≥200px/root overflow 없음/gear≥44/mobile≥56, turn-jump gap4/outer12·720 breakpoint·내려가기 화살표·NPC와 HUD/gear/cue 거리 badge 비중첩, 단계·시작·닫기·range·Continue/Quit·재시작·랭킹 접근 통과. high-clear5/rank5score352 입장 fixture임을 명시했고 checkpoint는 실제1단계 입력으로 도달했다. |
| `boundaries.mjs` | 실제 ES module 함수 fixture로28/29+2 gauge,90초 expiry before score,250/500 동시 만료 우선·이른 capture, pending100/150 pause, 회복 종료 직전 잡힘/탈출 우선순위, stage5 bonus349→353, Continue0을 검사했다. 별도 실제 UI에서 빈/반복 Space·연속 넘어짐 소리, native touch/focused Space 점프와 상자 충돌, 즉시 다음 입력의 arc 교체와 NPC tick 중 player key 보존 통과. 함수 fixture를 강제 화면 승급에 사용하지 않았다. |
| `auth-standalone.mjs` | dev demo false/기본 production은 기존 Entra 설정 안내이며 새 우회 없음. production의 descent-test.html HTTP200은 main SPA fallback이고 독립 실험 배포가 아니다. 별도 DEV 실험은 그대로1단계150~153점/90초·좌표 한 번 반전이며 구·새 기록/auth/audio/session sentinel의 Storage getter/메서드0회·byte equality 통과. 실제 tenant 로그인은 설정/자격 증명 없이 미검증이다. |
| `normal-generated-jump.mjs` | seed0.19 실제 main의 보너스 전 generated 장애물을 native Space로 넘어 실제2물리계단/2점·발소리1회·넘어짐0·단일 player를 확인했다. seed0.5 전체 진행의26점프는 모두4점 보너스였으므로 일반 점수 증거를 별도 보완했다. |

### Artifacts, boundaries and cleanup

- 증거 폴더: `C:\Users\DEX\AppData\Local\Temp\main-game-descent-conversion-2026-10-28\`. `evidence-index.json`은 **145 artifacts/PNG82·필수14사진**의 크기·SHA256과9개 driver 결과를 연결한다. 과거 실험 사진을 main 증거로 재사용하지 않았다.
- 최종 로그: `full-flow-final.log`, `storage-final.log`, `real-time-final.log`, 나머지 driver 동명 `.log`, `regression-27-final.log`, `lint-final.log`, `build-final.log`, `source-audit.log`, `final-link.json`. raw source/규칙/실험/authConfig/audio/public/config/package의 baseline `bdf18d5` diff 없음, T03의 제품 source는 `5217dfa` 대비 diff 없음. 기본 dist는 index.html만 있고 실험 HTML은 없다.
- 빌드 JS553.68kB(gzip154.76kB)/CSS57.30kB(gzip10.95kB). 기존500kB 초과 chunk 경고가 최종 build에 출력됐다. 번들 개선이나 오래된 App 전체suite 수리는 범위를 확장하지 않았다.
- driver 오류 보존/수정: CJS ReactDOM default export interop, 실험→main selector, StrictMode의 비활성 첫 Audio 대신 실제 재생 인스턴스 선택, native Space가 집중된 close를 정상 클릭한 경우, dispose 계측 wrapper의 this binding, box 탐색 중 checkpoint Continue, React commit 전 motion 샘플링, Chrome 재시작 직후 연결 race를 수정해 재검증했다. 보조 복합 실행 명령은 자동 검토에서 한 번 거부되어 허용된 단일 프로세스 시작과 별도 검증 명령으로 나누어 정상 완료했다. 제품 결함으로 간주하거나 검사를 생략하지 않았다.
- 사용자 profile/실제 기록에는 접근하지 않았다. context를 폐기하고 identity 확인한 소유 Chrome/보조5176·5177만 종료했다. 기존 demo PID21048과 `http://127.0.0.1:5175/`는 유지했다. 최종 HTML HTTP200/title 내려오기/main entry/DEVtrue/demo true/descent model을 확인했다. `.env`/인증 설정/서버 배포·push는 변경하지 않았다.
- 제한: 전체5단계는 제어 시계 UI 검증이며 실제 제한시간 전체 대기는 아니다. 순수 함수 경계·공개 계정 fixture와 native main 사례를 구분했다. 실제 Entra tenant 로그인/회사 계정 전환·스피커 청취 품질은 판정하지 않았다.
- 신규 범위 밖 결함 발견: **특이사항 없음**. 다음 Task는 없으며 phase/plan/current 완료 동기화만 남는다.
