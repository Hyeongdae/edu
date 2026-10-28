# Task: T03 Descent Browser Validation

## Status: pending

## Goal

원본 오르기 게임을 보존한 별도 로컬 내려오기 버전이 실제로 플레이되고 기록을 전혀 접근하지 않음을 확인한다. 하강 방향/장애물/추격/모션/모바일 결과를 증거로 남긴 뒤 계획을 완료하고 테스트 링크를 제공한다.

## Decision Summary

- 신규 제품 구현은 `descent-test.html`, `src/descent/`에만 있다. 기존 `/`/src/game/App/auth/audio/leaderboard/설정은 읽기 전용.1단계150점/90초, D/J/Space, 위쪽 NPC800ms/넘어짐500·추격250ms, 긴5~9/짧은1~3/긴 구간10% 상자,30물리계단→30초2배, 저장 없음.
- 검증으로 입증된 **신규 내려오기 구현의 관련 결함**만 고친다. 단위 테스트 성공만으로 브라우저 완료라 표시하지 않는다. 새 의존성/skip/timeout완화/원본 코드 수정/인증·배포 변경은 하지 않는다.

## Implementation

### I01. Required final contracts and permitted files

- Related Files:
  - `descent-test.html`, `src/descent/main.tsx`, `descentGate.ts`, `DescentTestApp.tsx`, `descentViewState.ts`, `DescentGameScreen.tsx`, `DescentScene.tsx`, `descent.css`, `descentEngine.ts`, `descentSceneModel.ts` and their7 tests — read-only unless required check demonstrates a related defect
  - Existing `src/game/**`, `src/audio/**`, `src/leaderboard/**`, `src/auth/**`, `src/test/**`, `src/main.tsx`, `App.tsx`, `index.html`, globalCSS/package/config — read-only
  - Temporary drivers/PNG/JSON/log outside repo — verification only

#### Details

- **Signatures & Types**:

  ```typescript
  // descentEngine.ts, all return original GameState, stage always1:
  function createDescentState(random?:()=>number):GameState;
  function resetDescent(random?:()=>number):GameState;
  function startDescent(state:GameState,nowMs:number):GameState;
  function applyDescentInput(state:GameState,input:'forward'|'turn'|'jump',nowMs:number):GameState;
  function tickDescent(state:GameState,nowMs:number):GameState;
  function resumeDescentAfterPause(state:GameState,openedAtMs:number,closedAtMs:number):GameState;
  function projectDescentRouteStep(step:StairRouteStep,playerStep:StairRouteStep):ScenePoint;
  function buildDescentSceneModel(state:GameState):DescentSceneModel;
  function isDescentTestEnabled(env:Readonly<{DEV:boolean;VITE_LOCAL_DEMO_MODE?:string}>):boolean;
  function createDescentViewState(readyState:GameState,nowMs:number):DescentViewState;
  function descentViewReducer(view:DescentViewState,action:DescentViewAction):DescentViewState;
  ```

- **Data & Schema Fields**:
  - GameState keeps original status/score/stepsClimbed/real increasing route indices/left-right direction/straightStepsRemaining/route/obstacles, actual clocks/nulls/lastMove/lastPursuerMove/positive distance/captureCount. Descent outputs only ready/playing/game-over, stage1; highestClearedStage/clearedStageThisRun0→1 in memory only, checkpointEnteredAt alwaysnull, no recordStage/stageStartScore/lives/optionsfor2.
  - create/reset ready score0/no clocks/event0/realnewroute/boxdecisionstage1/gap4/index−4; start90sec/next800. At150..153 finalcleared immediately: no checkpoint/continue/nextstage/capture gate, event/stage/NPC/recovery/capture clocks null, all obstacle decisions stage1. Adapter recomputes final stage1 reveal using pre-input obstacles (original engine otherwise reveals next-stage decisions). Keep actual score/steps, correct reason on expiry/catch, terminal success sound once. Restart returns ready rather than auto-playing.
  - New scene reuses original model validation but maps all point.y via432−oldY; xunchanged, anchor260/216, nextindex+1y244, NPCinitial−4y104, future+6y384/front400. Includes11steps index−4..+6, actual extra historical stairs, NPC visible recomputed, playerMotion kind/from/to, playerJump, pursuerMotion atMs, catchFrames0/.2/.4/.55/.7/.85/1. Art/labels upright, direction from own route.
  - DescentViewState fields: game,nowMs,settingsOpenedAt,playerMoveAt,playerMotionKey,scoreGain:1|2|4|null,scoreGainIsBonus,scoreGainUntil,successfulActionCount,mistakeCount. Actions start/tick/open-settings/close-settings(now),input(input,now),restart(readyState,now). Reducer deterministic: restart RNG outside reducer; sound counters monotonic across restart. React hook stores **view.game**, not raw GameState.
  - App enabled gate exact DEV && trimmedflagtrue. Audio prefs default.5/unmuted cloned memory only, no Storage/MSAL/account/progress/rank imports/effects. Start-clickBGM only, retry blocked/nonfatal, bonusrate1.25, successoneperaction/fallonce, no side effects in reducer, cleanup on unmount. Dedicated CSS `.descent-game` with unique keyframes; no `.stair-game` reuse.
  - Native controls/timing: D/J same behavior but desc labels, Space nonrepeat/scrollprevent except focusedbutton nativeclick, text/range exclusions; primary pointerdown+detail1click one action, mobile56px/gear44px/turn-jump4pxvsouter12/desktopcontrolsnone. Player300ms/NPC240ms independent; falling500ms/nextmin(existing,now+250), catchends afterscheduled+500 with reduced result immediate; expiry ties win/earlier catch fatal. Settings freezes clocks; normal/reduced static pose and correct focus.

- **Execution Flow / Logic**:
  1. Run exact24files/lint/build at start; record actual counts/sizes/warnings. Any source correction gets a new regression and repeat affected scenario plus final24/lint/build. No fixes to unrelated original App suite. Diff originally tracked game files against Task start/previous completed main commit `8d9b31d` to distinguish user changes; don't revert unrelated work.
  2. Verify no configured build input change or default dist/descent-test.html. Gate test DEVfalse even flagtrue; own temporary dev server flagfalse shows unavailable entry and no controller/timers. Vite preview's SPA fallback may return original index at unknown URL: do not count HTTP200 alone as descent publication. Inspect served content/absence of descent root/module.
  3. New source errors are fixed only in permitted new files and tests. If a criterion cannot be verified, record why and leave Task in_progress/checkbox unchecked; do not complete the plan based on summaries from prior ascent tests.

### I02. Owned actual browser and evidence

- Related Files:
  - `%TEMP%\stair-descent-local-test-2026-10-28\` :: new temporary driver/script/JSON/PNG/log files — verification only
  - This Task Validation Results — actual methods/results/limits

#### Details

1. Discover connected browser tool first. If absent, use Node built-in fetch/WebSocket/CDP with own hidden headless profile and `Target.createBrowserContext({disposeOnDetach:true})`; close only owned contexts/helpers in finally after checking their identity. Never ordinary user browser/profile data. Node/npm/Chrome versions and actual port/URL/evidence path must be recorded. Don't install dependencies.
2. Local development only: server process env `VITE_LOCAL_DEMO_MODE=true`, loopback host, available strictPort. Don't edit .env/auth/package/build config. Existing5175 server is a candidate only after confirming active/appropriate; otherwise launch own dev helper. No visible helper window. No OS tab UI claims for CDP lifecycle.
3. App-load probes must wait for genuinely new document token, install before page scripts for storage instrumentation, and scan React hook structure for `{game:{route:{steps},status},nowMs,...}` under DescentGameScreen. No fixed hook indices and no production debug/test props. Read view via queue.lastRenderedState; its queue.dispatch expects a DescentViewAction, **not** arbitrary GameState replacement. Old ascent helpers using `__set(state)` cannot be reused unchanged.
4. Full UI flow uses actual generated stairs/boxes/displayed cue and D/J/Space/primary touch controls. For repeatable full flow use document Date.now seed before mounting but do not force promotion or reduce probabilities. Find seeds via real adapter simulation if needed to see boxes before150; record selected seeds. Boundary assertions may import real adapter/view reducer into the owned dev page and pass coherent explicit fixtures; record these as engine/view checks rather than actual on-screen boundary play. No mutating reducer/fiber internals to bypass guards.
5. Run no heavy tests/build/source edits during browser scenarios, especially actual-time checks. Waits below60sec per call/update. Restore prototype/getter/clock/fixture injections in owned documents before reusing contexts. Control CSS WebAnimation timing separately from engine clock, and always dispose on failure. Keep scripts/JSON/PNG and failures+fixes outside repo; no .agents/.chrome-debug-profile cleanup.

### I03. Required browser scenarios

#### A. Separate entry, no saved data access, original preserved

1. In own context use new-document initialization before app script to seed owned v1/v2/v3/v4/v5 rankings (include validv4only user), progress:v1, audio:v1, auth/session and unrelated sentinels. Seed using original Storage access, then install/reset counters for localStorage/sessionStorage **getters and methods**, before loading the entry module of `/descent-test.html`. Keep original methods for driver-only snapshot reads. Do not use `/` or a presumed inert404 as preparation because Vite SPA fallback can mount the original app. App-ready/Start/inputs/settingsvolume·mute/clear/fail/restart/unmount makes0 storage calls and byte-identical sentinel data. No legacy cleanup/migration, no rank/progress save. Separately make both storage getters throw and verify mount/start/settings/end/restart remain usable. Don't count tool seed/read/restore operations as app calls; record exact counters and before/after.
2. Enabled entry shows local-test label, stage1/0/150/01:30/event0/nohearts/no account/rank/selection/nextstage/clockarmed. Same HTML with devflagfalse static unavailable and zero game/audio initialization. Inspect default build output absent descent HTML; original main/auth behavior remains.
3. In a **different owned context**, load original `/` with known fixture storage. Original ascending next stair y188/NPC328 and original text/selection/records behavior remain. Actual cue-play1stage→checkpoint→Quit→restart2default/0/goal200 confirms old screen/records still work. Keep ascent and descent counters/evidence separate, don't misreport legitimate original storage accesses as descent failure. Check source/config remains unchanged.

#### B. Actual descending play and original rules

1. At320×667/390×667/768×1024/1440×900 each, start through real button, use native CDP keyboard/touch sample, then follow actual nextbox→Space/corner→J/otherwiseD to final150..153. stagealways1, no checkpoint/continue/2, finalclear immediate and no persisted records. Restart returns ready0/90/event0/newroute/no clocks; nextstart gap4/800. Record counts for actions/physicalstairs/points/jumps/fall/audio and finalscore per viewport, not estimates. Real long5..9/short1..3/one-or-two short mixing and safe10% stage1 decisions remain stable.
2. Record steps/camera/actor anchors before and after D and J: world relative y shifts upward and player lands down the next actual stair while body/art stays upright. NPC's route points appear above and follow both-direction short corners without player input. Standard11steps/extra history/far metadata/positivegap. Nextbox and landing stair are readable below player, no RangeError or duplicate actor/box copies.
3. Find actual generated boxes in **both** directions using seeded real runs, not forced chance0/1. Space jumps2stairs/2points beforebonus or4duringbonus; crossing actual30physicalstairs fills gauge then30sec2x, including28/29+2 boundary (explicit engine fixture allowed for exact gauge edge). No box on short/start/end; decisions unchanged after resize/settings. At clear assert all decisions stillstageAtGeneration1, including terminal reveal, no inherited stage2 chance.
4. Actual wrong input/empty jump/boxcollision cause fall once/no step until500ms; repeat input doesn't extend. Audio successes count **actions**, not stairs; a jump has1footstep, fall1, BGMstartonce/run/eventrate normal↔bonus/stoponce/end, settings/restart don't replay old gain/move. Promiseblockedplay and mute/preferences remain nonfatal and memory-only. Do not claim speaker audibility from call counts.

#### C. Actual time, boundary probes, settings and lifecycle

1. Separate real Date.now checks with no heavy background tools: fresh idle nextNPC800ms, scheduled steps1600/2400/catch3200ms once/safeindexplayer−1/gap1/captureEndsAt3700. Record logical atMs vs observed100ms polling latency and resultgate. Normal noinput fails0points. Actual wrongkey starts no immediate NPC shift;250/500ms steps then1300, no reset from repeated keys. Successful later D/NPC motion independently proceeds.
2. Own same document frozen/active through CDP Page lifecycle for4actual seconds, verify token unchanged/latecatchonce/earlyreasonpreserved/no save calls/stale motion gone. If Vite HMR triggers reload, identify as tooling, re-run in same owned document with only its dev socket stubbed and record method. A new ready document is not proof of lifecycle recovery. Reduced-motion catch result immediately accessible; normal result hidden untilgate.
3. In imported actual adapter/view functions with coherent timestamps/snapshots verify90sec expiry (keep NPC deadline after expiry for that isolated boundary), exact250/500 expiry vsNPC/jump and earlier250catchvs251expiry, pending100fall, recovery-end move before escape input, final bonusjump149→153. State which tests were boundary functions, not displayed actual-time play. Do not falsify app state or full-flow advancement to show these results.
4. Actual UI walk30physicalsteps with activebonus, open settings, record stage/event/NPC remainders, advance document clock95sec, D/J/Space/touch blocked, native range keys and memory mute work, close viaEscape preserves three remainders androute/obstacles. Gearfocusrestored/Tabloop/nativeSpace not extra jump. Wronginput then open at100/close10100 preserves pending150 and next10250/11050 via actual UI controlledclock or explicit reducer fixture, documented accurately. Unmount cleans timers/listeners/audio and late promise updates.

#### D. Motion and accessible layouts

1. Capture actual player step300ms and actual generated left/right box jump at WebAnimation currentTime0/150/300. Offsets relative landing: step(±34,−28)→(±17,−22)→(0,0); jump(±68,−56)→(±34,−84)→(0,0). Freeze cosmetic time forPNG without making engine run ahead. Player/feetclip remains one upright copy, jump overlay above box/intermediate stair, landing front hides feet only. NPC240ms independently uses own from/to; catch500ms follows mappedrealstairs. Static reduced pose/no animation/correct result accessibility.
2. Every baseline viewport: ready/play/settings/result bounds, scene≥200px, gear≥44px/controls≥56px onmobile≤720, controlsnone ondesktop, turn-jumpgap4<outer12, HUD/gear/instructions/box not overlapping, no root overflow.320px root24/32 has scroll-reachable start/close/restart/range controls, correct labels and actual valid score0..153; hit-test after internal scroll rather than DOM presence alone. No unrelated huge-score fixtures needed for this bounded experiment.
3. Rapid corner/Space/nextinput cancels prior arc, native focusedbuttonSpace andtouchpointerdown+detail1click exactlyone action; overlay/fall/gain cleaned ontimeout/catch/finalclear/restart/unmount/settings. Render order ascendingindex and extrahistory stable. Capture representative desktop/mobile/reduced and actual stair/box/actor layering.
4. Required PNG names: `descent-ready-320.png`, `descent-playing-1440.png`, `descent-clear-390.png`, `descent-settings-320-font32.png`, `descent-left-jump-{departure,midpoint,landing}.png`, `descent-right-jump-{departure,midpoint,landing}.png`, `ascent-original-preserved.png`. Store JSON bounds/counters/storage byte comparison/tokens/timings and driver scripts beside them.

### I04. Completion bookkeeping

- Related Files:
  - This Task, parent phase.md, `.memory/plans/2026-10-28-stair-descent-local-test.md`, `.memory/current.md` — update only after required evidence passes

#### Details

- Record actual command results/count/build sizes/warnings/browser versions/owned methods/artifact path, seed/time boundary distinctions, failures and exact source/test or driver fixes, and limitations. Relevant source changes only in new descent files with regression; no casual original refactor.
- When all acceptance passes: mark Taskdone, commit related changes and this Task with exact message; then record T03 hash/phase3/3/plancompleted/current Active Tasknone and T01~T03 history in separate memory commit. Preserve earlier completed plan tables/hashes. If incomplete keep in_progress and report exact criterion/tool limit.
- Verify local dev link responds to actual descent entry and leave it available for user test when practical. Report real loopback URL/port and that it is local/development-only; don't invent a public deployment link. Close only owned headless browser helper, preserve user profiles/artifacts/other servers.

## Acceptance Criteria

- [ ] Original ascending `/`/source/config/records behavior is preserved; dev-only descent entry gate/build exclusion work.
- [ ] Descent full actual UI flow on four screens ends1stage150..153 withoutcheckpoint/stage2 and restarts fresh.
- [ ] App makes0 local/session storage reads/writes/getter calls, preserves all sentinels, and remains usable with blocked getters.
- [ ] Original obstacle/bonus/fall/pursuit rules, actual-time/lifecycle, independent upward-lift/downward-landing motion and accessible mobile/settings/result pass with evidence.
- [ ] All24testfiles/lint/build/actualbrowser passed; Task/phase/plan/current completion and user local test link recorded.

## Validation

- `npm.cmd test -- --run src/descent/descentEngine.test.ts src/descent/descentSceneModel.test.ts src/descent/descentGate.test.ts src/descent/DescentTestApp.test.tsx src/descent/descentViewState.test.ts src/descent/DescentGameScreen.test.tsx src/descent/DescentScene.test.tsx src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts` — actual count, no skipped tests.
- `npm.cmd run lint`
- `npm.cmd run build`
- `if (Test-Path -LiteralPath dist/descent-test.html) { throw 'Descent experiment must not be in the default build' }` — PowerShell after build; inspect default index content separately.
- `git diff --check`
- `git diff --name-only 8d9b31d -- index.html src/main.tsx src/App.tsx src/game src/audio src/auth src/leaderboard src/test src/global.css vite.config.ts package.json package-lock.json` — no plan changes; distinguish unrelated user changes rather than reverting.
- All I03 scripts/JSON/PNG/log in owned evidence directory. Unit-only, old ascent screenshots or normal Date.now simulated by constants cannot stand in for actual required browser/time evidence.

## Commit Message

```text
test(game): validate isolated downward staircase play and original game preservation

Plan: 2026-10-28-stair-descent-local-test
Phase: P01-local-descent
Task: T03-descent-browser-validation

- Verify single-stage descending controls pursuit and obstacle motion
- Prove storage-free local execution and unchanged climbing gameplay
- Record responsive browser timing and lifecycle evidence
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
