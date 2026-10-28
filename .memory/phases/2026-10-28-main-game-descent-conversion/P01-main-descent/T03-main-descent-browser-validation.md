# Task: T03 Main Descent Browser Validation

## Status: pending

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

- [ ] Main actual5stage flow and checkpoints work on four sizes with correct downward coordinates/motion/topNPC and existing rules.
- [ ] First conversion clears only authorized legacykeys; new rankings/unlocks survive reload/restarts/retries/accounts with auth/audio retained.
- [ ] Timings/lifecycle/settings/mobile/reduced-motion and source/auth/standalone boundaries pass with owned browser artifacts.
- [ ] Native audio retry removes its control safely, keeps focus inside settings/Escape·Tab usable, preserves range focus and does not steal focus after close.
- [ ] Explicit27files/lint/build/diff checks pass, exact counts/limitations recorded, completion pointers and main local link updated.

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

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
