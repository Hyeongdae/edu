# Task: T03 Descent Browser Validation

## Status: done

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

- [x] Original ascending `/`/source/config/records behavior is preserved; dev-only descent entry gate/build exclusion work.
- [x] Descent full actual UI flow on four screens ends1stage150..153 withoutcheckpoint/stage2 and restarts fresh.
- [x] App makes0 local/session storage reads/writes/getter calls, preserves all sentinels, and remains usable with blocked getters.
- [x] Original obstacle/bonus/fall/pursuit rules, actual-time/lifecycle, independent upward-lift/downward-landing motion and accessible mobile/settings/result pass with evidence.
- [x] All24testfiles/lint/build/actualbrowser passed; Task/phase/plan/current completion and user local test link recorded.

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

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Validation Results — 2026-10-28

### Source correction and regression

- 실제 오디오 재시도에서 관련 신규 결함1건을 확인했다. 재생 허용으로 `음악 켜기` 버튼이 제거되면 focus가 body로 빠져 dialog의 Escape 처리가 끊겼다. `DescentGameScreen.tsx`에 dialog ref를 두고 settingsOpen/autoplayBlocked 변경 후 focus가 dialog 밖일 때만 close로 복구한다. 안쪽 range/button의 유효한 focus는 유지한다.
- `DescentTestApp.test.tsx`의 기존 재시도 검사를 확장해 실제 enable 버튼에 focus→재시도→버튼 제거→close focus→Escape 종료를 확인했다. 수정 전 해당 파일6개 중1실패(`focus-regression-before-fix.log`), 수정 후6/6통과(`focus-regression-after-fix.log`). 제품 수정은 이 두 신규 내려오기 파일뿐이며 기존 오르기 소스/테스트/설정/패키지/인증/저장 코드는 그대로다.
- 지정24경로 회귀 최종 **642/642 tests 통과,47.17s**, skip0 (`regression-24-final.log`). 명령은 위 Validation의 동일24경로에 **`--maxWorkers=2`만 추가**했다. 기본 동시 실행은 기존 `GameScreen.test.tsx:198`의30회 렌더링 검사에서5000ms 시간 초과 후73개 연쇄 실패/569통과(21.03s, `regression-24-default.log`)였다. 기존 테스트·timeout·검증 범위·config를 완화하지 않았으며 기본 명령이 그대로 성공했다고 기록하지 않는다.
- `npm.cmd run lint`: 오류0/경고0 (`lint-final.log`). `npm.cmd run build`: 성공 (`build-final.log`),211modules/JS551.91kB(gzip154.18kB)/CSS55.50kB(gzip10.77kB). 최종 build 로그에는 chunk 경고가 재출력되지 않았으나 기존551.91kB 크기는 그대로이며 번들 개선은 하지 않았다. `dist/` HTML은 기존 index.html 하나, descent-test.html 부재 검사를 통과했다.
- `git diff --check`/staged diff check 통과. 지정 원본 범위의 `git diff --name-only 8d9b31d -- ...`는 비어 있다. src/descent 정적 검색 결과는 자체 component import와 테스트 storage 감시뿐이며 런타임 storage/이관/helper/원본 App·GameScreen import는 없다.

### Actual owned browser — 9 drivers passed

- 환경: Node24.21.0/npm11.19.0/Vite8.3.5/Chrome156.0.8078.48. 연결된 브라우저 도구가 없어 Node 내장 fetch/WebSocket/CDP9226를 사용했다. 숨김 headless 소유 프로필과 driver마다 `Target.createBrowserContext({disposeOnDetach:true})`를 사용하고 finally에서 해당 context를 폐기했다. 일반 사용자 브라우저/프로필을 사용하지 않았다. 브라우저 검사와 무거운 테스트·빌드는 겹치지 않았다.
- 최종 성공 driver: `full-flow`, `layout-settings`, `motion`, `boundaries`, `actions-cleanup`, `disabled-gate`, `ascent-preserved`, `real-time`, `production-default`. 각 mjs/JSON/`final-*.log`를 보관한다. 증거 디렉터리는 `C:\Users\DEX\AppData\Local\Temp\stair-descent-local-test-2026-10-28\`, `evidence-index.json`에97개 script/JSON/PNG/log의 크기·SHA256, PNG40개/필수11개를 기록했다.
- 실제 generator/adapter로 seed를 탐색해0.19를 선택했다. chance를 바꾸지 않고 실제10% 생성기·긴5~9/짧은1~3/1개·2개 짧은 구간 혼합/안전한 내부 box를 사용했다. React hook은 `{game,nowMs,...}` 구조로 찾아 queue.lastRenderedState를 읽기만 했다. 임의 GameState dispatch나 fiber 변경/강제 승급은 하지 않았다.

| Actual UI viewport | Actions | Physical stairs | Final points | Generated jumps |
| :--- | ---: | ---: | ---: | ---: |
| 320×667 | 87 | 90 | 150 | 3 |
| 390×667 | 87 | 90 | 150 | 3 |
| 768×1024 | 87 | 90 | 150 | 3 |
| 1440×900 | 87 | 90 | 150 | 3 |

- 각 화면에서 실제 시작 버튼/native CDP touch 또는 keyboard를 사용한 뒤 표시된 box→Space/코너→J/그 외D를 따랐다. 반복 조작은 실제 DOM keyboard 또는 primary pointerdown+detail1 click이었다. 오른쪽 일반 점프1회(2점), 왼쪽 보너스 점프2회(각4점), footstep87/fall0/BGMstart1/stop1을 확인했다. stage는 항상1, 최종cleared/모든 active clocknull/terminal obstacle 전부stage1, CP/continue/2단계 없음, clear 즉시 arc/gain 제거, restart ready0/90/event0/새 진행 경로/시계 미시작을 확인했다.
- 전체 traversal은 document Date.now를 고정한 실제 UI 플레이이며 실제90초 경과 플레이로 주장하지 않는다. 아래 actual-time 검사는 별도 real Date.now다.

### Storage, original preservation and gates

- entry script 전에 v1/v2/v3/v4/v5 ranking, progress:v1, audio:v1, auth/session/unrelated sentinel을 도구 원본 Storage API로 심었다. v4에는 유효한 v4-only 사용자(achievedAt 포함), v5에는 별도 유효 기록을 넣었다. 앱 getters/methods 감시를 그 후 설치했다. 전체 clear, 설정 volume/mute, 실패/restart/unmount에 local/session getter/getItem/setItem/removeItem/clear/key **모두0회**, 모든 sentinel byte equality가 true였다. 도구 seed/snapshot은 원본 API로 읽어 앱 호출에서 제외했다.
- 두 storage getter가 entry 전부터 throw하는 별도 문서도 mount/start/settings/mute/end/restart/unmount가 가능했고0접근이었다. 기본 audio .5/unmuted는 저장 sentinel 값을 읽지 않으며 메모리에서만 수정된다.
- 다른 context의 원본 `/`: 다음 계단y188/NPC328/상승 좌표 유지, 실제 cue-play150→checkpoint→Quit→restart에서2기본/0점/목표200/3개잠김을 확인했다. original progress/랭킹 쓰기와 v4-only 타 계정 이관은 정상 실행됐다. 이 원본의 합법적 저장 접근을 내려오기0접근과 혼합하지 않았다. `ascent-original-preserved.png`, `ascent-stage2-preserved.png`.
- devfalse는 별도 소유 서버5176의 process env VITE_LOCAL_DEMO_MODE=false로 실제 HTML을 열어 이용 불가/게임 없음/controls0/Audio생성0/storage0을 확인했다. env/설정 파일은 바꾸지 않았다. DEVfalse gate 조합은 단위 테스트에서도 통과한다.
- default build를 별도 preview5177에서 확인했다. `/descent-test.html` HTTP200은 **원본 index로의 SPA fallback**이며 script는 원본 bundle/제목은 계단 오르기/Entra 설정 안내/desc root·module 없음이었다. 이를 내려오기 배포로 오인하지 않았다. production-default.json/PNG에 기록했다.

### Timing, motion, settings, accessibility and cleanup

- real-time.mjs는 Date.now를 바꾸지 않았다. NPC logical atMs800/1600/2400, catch3200/ends3700을 확인했다. 마지막 실행의 관측 시점은 시작 후955/1640/2432/3282ms였으며100ms polling/호스트 지연과 logical deadline을 구분했다. 안전index−1/gap1/captureCount1/stopBgm1, 보통 결과는 gate 동안 숨김→500ms 후 접근, reduced는 즉시 접근을 확인했다.
- 실제 wrong J는 즉시 NPC 이동 없이500ms fall, 반복 키는 연장 없음,250/500ms logical 이동 후1300ms 정상 successor, 회복 후D 성공/발소리1/실수소리1이었다. NPC를 기다리는 실제 시간 검사에서 플레이어 고정/원본 경로의 양쪽 짧은 코너를 NPC 자신의 방향으로 이동/실제 extra history/far metadata/기본11계단/중복 actor 없음도 확인했다.
- CDP Page frozen/active4실제 초 후 같은 document token을 유지하고 늦은 tick에서 초기 caught 이유/capture1/clocksnull/옛 arc 제거/storage0을 확인했다. 소유 문서의 Vite HMR WebSocket만 stub해 개발 클라이언트 재로드를 막았다. OS 탭 전환을 검사했다고 주장하지 않는다.
- boundaries.mjs는 실제 import한 adapter/view 함수에 명시적 coherent fixture를 전달한 **함수 경계 검사**다.90초 목표 입력보다 expiry 우선,250/500ms tie expiry와250catch→251expiry, pending100→350→1150, recovery-end NPC/잡힘 우선,28/29+2→30초 이벤트,149+보너스 jump→153, pause100→10100의 pending150/next10250→11050을 검증했다. 이를 화면에서 실제90초를 플레이한 증거로 사용하지 않는다.
- 실제 UI로30물리계단/active bonus→설정95제어초 정지→D/J/Space/touch 차단→Escape 후 stage/event/NPC remainder 및 route/obstacles 보존을 확인했다. Tab/ShiftTab loop, gearfocus, range ArrowRight, native focused-button Space1행동/터치중복 방지, blocked BGM retry/메모리 mute를 확인했다. NPC를 충분히 따돌린60계단 run에서는 종료 없이30초 bonus 만료/BGM1.25→1/다음 점수1도 확인했다.
- WebAnimation time0/150/300으로 실제 D/J step(±34,−28)→(±17,−22)→0 및 실제 생성된 양쪽 jump(±68,−56)→(±34,−84)→0을 측정했다. 장면은 위로 이동/플레이어 고정anchor260,216/도착은 실제 아래 계단/자산 upright, 발 clip은 안쪽 pose에만 적용됐다. 점프 overlay가 상자·중간 계단 위에 있고 착지 front만 발을 가리는지 PNG도 확인했다. NPC240ms 독립 이동/점프와 동시 진행, catch500ms7실제 좌표, reduced static idle/이동 없음도 확인했다.
- ready/play/settings/result의 네 viewport/root overflow0/scene≥200/gear≥44/mobilecontrols≥56/turn-jumpgap4<outer12/desktop controlsnone/HUD·gear·footer 분리를 확인했다.320px root24/32에서 내부 scroll 후 start/range/close/restart 실제 hit-test와 native 입력이 통과했다. 유효150점 결과 PNG와 필수 양쪽 점프6PNG/모바일·데스크톱·설정·원본PNG를 보관한다.
- 실제 빈 점프/box 충돌/반복오입력/fall500/빠른 jump→J의 옛 arc 교체/설정 중 옛gain·NPC 이동 재생 방지를 확인했다. 공개 ReactRoot.unmount 후 신규 화면 timer1→0/listener(keydown,visibilitychange)2→0/audio.dispose1, 해제 후 입력 무반응/늦은 BGM Promise 완료 무해/storage0을 확인했다. root handle만 소유 CDP 응답의 entry에서 캡처했으며 저장소 파일/생산용 debug prop/game state는 변경하지 않았다.

### Evidence integrity, cleanup and limitations

- 초기 driver 오류인 DOM 객체 반환 직렬화, entry timestamp/cache 패턴, audio method wrapper의 this 누락은 도구에서 수정하고 로그를 별도로 보존했다. 최초 v4 fixture의 updatedAt 오타는 achievedAt으로 고친 뒤 최종 전체 flow를 재실행했다. 실제 autoplay focus 결함은 위 source/test 수정으로 해결했으며 최종9 driver 모두 통과했다.
- 소유 Chrome PID17080/profile/CDP9226, 보조 devfalse PID9540/5176, preview PID16140/5177의 identity를 확인한 후 종료했다. 일반 프로필/다른 서버/아티팩트는 건드리지 않았다. `helper-cleanup-and-link.json`에 종료 및 링크 확인을 기록했다.
- 사용자 링크 `http://127.0.0.1:5175/descent-test.html`: 기존 데모 PID21048을 유지했으며 최종 HTTP200/정확한 entry/DEVtrue/demo flagtrue를 확인했다. 로컬 개발 전용이며 공개 배포 링크가 아니다.
- 소리는 호출 횟수/media API/재생 속도·mute로 검증했으며 실제 스피커 청취 품질은 판정하지 않았다. 기본 test worker pool의 기존 화면 성능 문제/기존 번들 크기는 별도 후속 대상이다. 새 범위 밖 결함은 발견되지 않았고 기존 Entra 설정/공용 서버 랭킹/배포/5단계 확장은 수행하지 않았다.
