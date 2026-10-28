# Task: T02 Main Descent Integration

## Status: pending

## Goal

기존 `/`를 기존5단계 기능과 픽셀 레이아웃을 가진 내려오기 게임으로 전환하고, 같은 변경에서 main의 모든 기록 접근을 T01 descent scope로 연결한다. 최초 전환은 빈 랭킹/1단계이며 이후 새 해금·점수는 저장된다.

## Decision Summary

- main App/5단계 엔진을 유지한다.1단계 전용 DescentTestApp/descentEngine/view reducer를 연결하지 않는다. 순수 하강 scene model만 재사용하고 독립 로컬 실험은 그대로 둔다.
- renderer/모션/문구와 main storage scope를 함께 활성화한다. T01까지 main은 여전히 상승/기존scope였다. 이 Task부터 최초 구 기록 초기화가 적용된다.
- 사용자 추가 요청(D11): main 오디오 재시도 버튼 제거 후 dialog focus 유실도 함께 수정한다. 오디오 owner/API/저장 방식은 변경하지 않고 기존 GameScreen 회귀 테스트를 보강한다.

## Implementation

### I01. Connect every main record call to descent scope

- Related Files:
  - `src/game/GameScreen.tsx` :: initialProfile/readKnownHighest/clear-save/end-save — modify
  - `src/game/recordStorage.ts`, `stageProgress.ts`, `src/leaderboard/leaderboard.ts` — T01 APIs reuse/read-only unless demonstrated relevant bug
  - `src/App.tsx`, `src/main.tsx`, `src/auth/authConfig.ts`, audio modules — read-only

#### Details

- **Signatures & Types**:

  ```typescript
  // T01 APIs, defaultsascent; main MUST passdescent at every call:
  readLeaderboard(storage?:Storage,scope?:'ascent'|'descent'):LeaderboardEntry[];
  readStageProgress(accountId:string,storage?:Storage,scope?:'ascent'|'descent'):ReadStageProgressResult;
  saveStageProgress(accountId:string,stage:ClearedStage,storage?:Storage,scope?:'ascent'|'descent'):SaveStageProgressResult;
  saveBestScore(entry:Omit<LeaderboardEntry,'achievedAt'>,storage?:Storage,now?:Date,scope?:'ascent'|'descent'):SaveBestScoreResult;
  // Existing GameScreen props unchanged:
  interface GameScreenProps {account:AccountInfo;audioController?:AudioController;audioPreferences?:AudioPreferences;
    autoplayBlocked?:boolean;onAudioPreferencesChange?:(next:AudioPreferences)=>void;onEnableAudio?:()=>void;}
  ```

- **Data & Schema Fields**:
  - New keys: `stair-descent:leaderboard:v1`, `stair-descent:stage-progress:v1`, marker`stair-descent:records-reset:v1`=`1`.
  - LeaderboardEntry={accountId:string,displayName:string,bestStage:1..5,bestScore:nonnegativeinteger,achievedAt:ISOstring}; StageProgressEntry={accountId:string,highestClearedStage:0..5}. Old keys: ascent rankv1..v5 + ascentprogressv1; never import their contents for new initialProfile.
  - Fresh main initialProfile entries[],knownHighest0,availabletrue → createGameState stage1/highest0. Existing default factory/reset functions retain optional `{stage,highestClearedStage}`; do not hardcode stage1 on every restart.

- **Execution Flow / Logic**:
  1. `initialProfile`: `readLeaderboard(undefined,'descent')`, then `readStageProgress(account.homeAccountId,undefined,'descent')`. Existing initializer/StrictMode can call these more than once; T01 preparation must make cleanup idempotent. No unconditional per-mount fresh-array write.
  2. `readKnownHighest` must use descent progress too; continue max(state.highestClearedStage,initialProfile.knownHighest,new storedhighest). Both stage selection and game-over→restart use it. Otherwise old ascent clears can reappear on the second run.
  3. Immediate checkpoint/clear progress effect: `saveStageProgress(accountId,gameState.highestClearedStage,undefined,'descent')`. Keep its ref guard and errors. End/Quit/final ranking effect: `saveBestScore(record,undefined,undefined,'descent')`, preserving current actual stage/that-stage score and once-per-run guard. No new clear/save side effects in reducer/updater.
  4. Do not call migrateLegacyStageProgress from main. The old helpers remain for default legacy callers/tests, but main must never use the default. Authenticate/account-keyed remount and score/progress failure UI remain unchanged.
  5. New clear1→Quit storesprogress1/rankstage1actualscore, restart/reload defaults2/0/goal200/3..5locked. New rankstage5 without progress does not unlock any stage. New other-account progress does not unlock current account. Failure to clean a legacy key does not hide new valid records or reinitialize them.

### I02. Keep the five-stage state and timer contracts

- Related Files:
  - `src/game/types.ts`, `gameEngine.ts`, `stageRules.ts`, `stairRoute.ts`, `stairObstacles.ts`, `timedPursuit.ts` — read-only
  - `src/game/GameScreen.tsx` :: motion props/labels — modify only as below; preserve timers/input/audio semantics

#### Details

- **Signatures & Types**:

  ```typescript
  type GameInput='forward'|'turn'|'jump'; type Direction='left'|'right';
  type GameStage=1|2|3|4|5; type ClearedStage=0|GameStage;
  type GameStatus='ready'|'playing'|'checkpoint'|'game-over';
  type GameEndReason='caught'|'time-limit'|'cleared'|'quit';
  interface GameMove {kind:'climb'|'jump';fromIndex:number;toIndex:number;scoreGain:1|2|4;isBonus:boolean;}
  interface PursuerMove {fromIndex:number;toIndex:number;atMs:number;}
  interface GameState {
    status:GameStatus;stage:GameStage;stageEndsAt:number|null;endReason:GameEndReason|null;
    score:number;stepsClimbed:number;highestClearedStage:ClearedStage;clearedStageThisRun:ClearedStage;
    checkpointEnteredAt:number|null;direction:Direction;straightStepsRemaining:number;
    pursuerDistance:number;pursuerIndex:number;nextPursuerStepAt:number|null;lastPursuerMove:PursuerMove|null;
    captureCount:number;captureEndsAt:number|null;eventSteps:number;eventEndsAt:number|null;
    recoveryEndsAt:number|null;lastMistake:boolean;route:StairRoute;obstacles:StairObstacleState;lastMove:GameMove|null;
  }
  // route.steps:{index,column,direction}[]; runs:{startIndex,length,kind,direction}[];
  // obstacles.runs:{runStartIndex,runLength,kind,direction,stageAtGeneration,obstacleIndex:number|null}[]
  ```

- **Execution Flow / Logic**:
  1. Keep the engine and increasing logical indices. Rules: targets150/200/250/300/350, seconds90/75/65/60/50, probability10/20/30/40/50% per long run, NPC800/650/500/400/300ms; fall500/fast250, initialgap4, one catchends. Long5..9/short1..3;30physicalstairs/30sec2x; jump2stairs→2/4points.
  2. Keep start selection, checkpoint1..4, Continue→nextstage score0/lastMove null and same route/obstacles/physicalsteps/event preserved, Quit actualstage score record, final5cleared. No recordStage/stageStartScore/lives additions. Do not import the experimental adapter that rejectsstage2/checkpoint.
  3. Keep existing screen timing: player300ms, NPC240ms, catch500ms, score gain700ms,100ms reconciliation and visibility handler. Do not copy experimental600ms score-gain timeout or its sound counters into main as unrelated refactor. Main callbacks remain functional state updates. Success/fall sounds/BGM/event1↔1.25/preferences use existing owner/controllers.
  4. Keep main pause semantics: game clocks freeze in settings/checkpoint; any already running cosmetic timer may finish while settings are open (existing coverage explicitly tests this). On resume do not introduce a fresh old jump/score gain. Terminal/checkpoint/ready/reset suppress travel even if lastMove was retained. Controls/keyboard remain blocked in settings/recovery/nonplaying; focused-native Space/touch dedup/repeat handling preserved.

### I03. Downward main scene with unchanged public props

- Related Files:
  - `src/game/StairScene.tsx` :: model/runner/pursuer/layers/labels — modify
  - `src/descent/descentSceneModel.ts` :: buildDescentSceneModel/projectDescentRouteStep — reuse READ-ONLY
  - `src/game/stairSceneModel.ts` :: types/base projection/validators — READ-ONLY (experiment reflects this base)
  - `src/game/pixel/{PixelOfficer,PixelStair,PixelObstacle,PixelOfficeBackdrop,PixelIcon}.tsx` — reuse read-only

#### Details

- **Signatures & Types**:

  ```typescript
  interface StairSceneProps {state:GameState;climbAnimationKey:number;isClimbing:boolean;
    pursuerAnimationKey:number;isPursuerMoving:boolean;isPursuerCaught:boolean;}
  interface ScenePoint {x:number;y:number;}
  interface DescentPlayerMotion {kind:'climb'|'jump';from:ScenePoint;to:ScenePoint;}
  // DescentSceneModel extends existing StairSceneModel with playerMotion:DescentPlayerMotion|null.
  // Existing fields: steps:{x,y,index,direction}[], player/pursuer:{x,y,index,direction},
  // pursuerVisible:boolean, playerJump:{from,to}|null, pursuerMotion:{from,to,atMs}|null,
  // catchFrames:{offset,index,x,y}[] (offsets0/.2/.4/.55/.7/.85/1).
  buildDescentSceneModel(state:GameState):DescentSceneModel;
  // This pure model has NO stage1 guard and is safe for main stages1..5/checkpoints.
  ```

- **Execution Flow / Logic**:
  1. Import only the pure model from`../descent/descentSceneModel`. It already reflects base y via432−oldY/recomputes visibility/maps ALL motion points; do not reflect again or change base buildStairSceneModel. Anchor260,216; next+1y244; initialNPC−4y104; future+6y384/front400.
  2. Preserve main `.scene-card`/`.pixel-scene-stage`/`.stair-scene`, viewBox520×400/xMidYMid meet, upright backdrop/art, and main testids runner/runner-motion/runner-pose/pursuer/pursuer-motion/stair-step/stair-obstacle/route-direction. Existing public props/internal climb naming may remain; do not rename the engine's climb terminology or expose mode/debug props.
  3. Draw base11steps in ascending index, not current reverse(). Each layer: top/futurebox or actual crossed box during jump/idle actors/front. Moving actors are excluded from base. Keep at most1player/1visibleNPC, real extra historical stair, farNPC metadata without fabricatedstairs. PixelOfficer poses idle/climb/jump/fall remain the existing art enum; only projection/travel changes.
  4. Both one-step and jump player travel use a keyed INNER runner-motion inside an untouched translate landing anchor. playerMoving requires playing/!lastMistake/!caught/isClimbing/model.playerMotion. Nonmoving actor rendered in base. Add `.step-overlay` for ordinary travel and keep `.jump-overlay` above base box/intermediate stair; each overlay has landing front last. Clip only an inner pose with x−34/y−88/w68/h84; outer motion must not be clipped or have its anchor transform animated.
  5. Step300ms offsets ±34,−28→±17,−22→0 (8px lift). Jump300ms ±68,−56→±34,−84→0 (56px lift). Derive x/from/to from actual model, including turns. CSS custom properties must include midY, not reuse old constants−8/−28 or uphill fromY+56. Next rapid action replaces keyed DOM; NPC tick alone must not restart the player node.
  6. NPC240ms own from/to offsets ±34,−28→±17,−22→0; own route direction, separate keyed child/landing front. Catch500ms map the seven model frames relative to safe NPC anchor using PIXEL CSS vars. Stop old root-level percentage translate animation; catch child owns travel and inner facing owns per-frame direction. PixelOfficer directionright during animated catch + explicit facing sign; for reduced motion retain safe anchor's actual direction with a base-facing variable. No double horizontal mirroring or wrong SVG percent reference box.
  7. Current static SVG `.scene-distance-tag` at26,45 would cover an initial top NPC at124,104. Move its text into a small `.scene-distance-note` in the existing HTML scene heading, without covering HUD/gear/direction cue. Keep distance accessible in SVG aria too. Heading says next box/corner/`N칸 더 내려가세요`; aria says below/above pursuer. Do not rotate the entire scene or sprite.
  8. checkpoint/game-over/ready/fall/caught must suppress player travel and clear jumping-box overlays. Keep catch rendering once and existing normal/reduced result gate behavior. A final lastMove is data, not permission to replay a jump.

### I04. Main CSS and user-facing wording

- Related Files:
  - `src/game/pixel/pixel-scene.css` :: step/jump/NPC/catch scoped animation — modify
  - `src/game/pixel-theme.css` :: distance heading badge/downward-icon styles only — modify
  - `src/game/ControlButtons.tsx`, `GameHud.tsx`, `GameScreen.tsx` :: text/icon direction — modify
  - `src/auth/AuthGate.tsx` :: unauthenticated title TEXT ONLY — modify
  - `index.html`, `README.md` :: title/meta/usage docs — modify
  - `src/game/game.css`, `src/App.tsx`, package/config/audio/authConfig/assets — read-only

#### Details

- **Execution Flow / Logic**:
  1. New main keyframes use `pixel-main-descent-*` names with `.stair-game` selectors. Keep existing other main panel/controls/layout styles. Override root `.pursuer.is-caught` animation/translate with more-specific main scoped rule; apply catch transform to inner child and per-frame facing to its nested wrapper. game.css old percent keyframes must no longer own this NPC.
  2. Define step300/jump300/NPC240/catch500 with numeric pixel vars/midY from I03. Disable the existing young-climb body pixel-officer-hop when outer travel already supplies hop; keep stride-frame alternation and fall500 art. Do not animate outer anchor transform or combine CSS translate and transform unexpectedly.
  3. Reduced-motion disables new travel/stride/hop/catch, static idle at real anchors for moving/jumping actors; fall art can stay static. Preserve the safe NPC's facing and existing immediate caught result accessibility. Higher-specificity new rules must not override reduced animation:none later accidentally.
  4. Mobile forward PixelIcon only: a dedicated class rotates the forward arrow180deg, never all icons/sprites. Native labels become `한 칸 내려가기`, `방향을 바꾸며 내려가기`, `장애물을 뛰어넘기`; visible forward label`내려가기`. Keep button native pointerdown(detail0 keyboardclick/detail1 dedup), turn/jumpgap4/outer12,≤720mobile/desktop hidden.
  5. Page title/meta/AuthGate heading: `계단 내려오기`/`계단 내려오기 게임`. GameHud says `내려온 계단 N칸`, `30칸을 내려오면 30초 보너스`. Footer/help/result/scene use 내려가기/내려왔어요; chaser help says 위에서 따라 내려오기/넘어진 동안0.25초마다 내려오기. Stage selection/checkpoint/ranking labels and numeric rules remain the same. Update README game section title/key usage and one-time local record reset/new namespace; preserve env/login/audio licensing instructions.
  6. Keep Entra checks/DEV local demo gate/redirect logic and `src/App.tsx` audio ownership unchanged. No new route or build input, no exposure of the experimental page in production, no main mode switch.

### I05. Retain dialog focus when audio retry removes a button

- Related Files:
  - `src/game/GameScreen.tsx` :: settings refs/focus effect/closeSettings/dialog section — modify
  - `src/game/GameScreen.test.tsx` :: autoplayBlocked rerender/focus/Escape/Tab regression — modify
  - `src/App.tsx`, `src/audio/AudioControls.tsx`, audioController/preferences — read-only

#### Details

- **Signatures & Types**:

  ```typescript
  // New local refs, no new public component props:
  settingsDialogRef: React.RefObject<HTMLElement|null>;
  previousSettingsOpenRef: React.RefObject<boolean>;
  // Existing refs retained:
  settingsTriggerRef: React.RefObject<HTMLButtonElement|null>;
  settingsCloseRef: React.RefObject<HTMLButtonElement|null>;
  // Existing props autoplayBlocked?:boolean and onEnableAudio?:()=>void remain unchanged.
  ```

- **Data & Schema Fields**:
  - settingsDialogRef points to the actual `section#game-settings-dialog[role=dialog]`, initiallynull; previousSettingsOpenRef startsfalse. Reuse existing isSettingsOpen state; do not add focus-related state/storage/timers.
  - Losing focus means document.activeElement is not contained by the committed dialog DOM. Range/button descendants count as valid internal focus. A removed retry button normally sends activeElement tobody.

- **Execution Flow / Logic**:
  1. Attach settingsDialogRef to the existing dialog section. Replace the existing open-only focus effect with one depending on `[isSettingsOpen, autoplayBlocked]`. When settings are open, focus the close button only if activeElement is outside the current dialog. Initial opening naturally focusesclose because the trigger is outside. Do not refocusclose on every rerender or game timer tick.
  2. When autoplayBlockedtrue→false removes `음악 켜기`, run after DOM commit: if the focused retry button disappeared, restoreclose. If a still-mounted range/button already has focus, keep it. The effect performs DOM focus only, no synchronous React setState.
  3. When settings have just closed (previousSettingsOpenReftrue), restore the current enabled trigger after commit, then update the previous ref. Remove the immediate focus call from closeSettings so the post-commit effect is the single focus-restoration owner. Keep its clock resume/game state logic unchanged.
  4. If settings were already closed, later autoplay result changes must not move focus or reopen anything. Null refs/unmount are safe optional calls. No retries via setTimeout/requestAnimationFrame; no new keyboard listener/global Escape handler or audio-controller changes.
  5. Preserve the current dialog Tab/ShiftTab loop/Escape/backdrop handling and game-input guard. After retry, close is inside the same trap, Escape closes, and D/J/Space remain blocked until closing. A range ArrowRight remains native and usable.
  6. Unit regression uses existing public GameScreen props/rerender: render blockedtrue with audio props; start/open; explicitly focus the retry button (jsdom click does not do this); click/invoke callback; rerender blockedfalse; assert retry absent/close focused; dispatch Escape from actual activeElement; assert dialoggone/triggerfocused. Assert still-internal range focus survives the same prop change and valid Tabloop remains. With dialogclosed, focus an owned outside input and rerender late audio result: focus staysoutside. Include StrictMode mount/unmount coverage without new production testprops.

### I06. Tests and allowed changes

- Related Files:
  - `src/game/StairScene.test.tsx` — new, direct5stage scene DOM/geometry contract
  - `src/game/GameScreen.test.tsx`, `ControlButtons.test.tsx`, `GameHud.test.tsx` — modify relevant expectations/fixtures; preserve coverage
  - `src/game/recordStorage.test.ts`, `stageProgress.test.ts`, `src/leaderboard/leaderboard.test.ts` — run T01 coverage unchanged unless a relevant defect needs a regression
  - existing descent7/authConfig/audio/core/StageSelect/Checkpoint/LeaderboardPanel tests — run unchanged

#### Details

- Main integration: all old keys seed (all accounts high5)→freshstage1/highest0/score0/4locked/emptyrank/target150. Only six old removals/marker1; auth/audio/unrelated unchanged. StrictMode no duplicate reset/new-array overwrite. New clear1→Quit→retry/reload2score0goal200; Continue0 preserves route/event;5final with stage5actualscore; worse/lower-stage/tie keeps whole best row. Accounts independently unlock. New rank5 without progress keeps1 default. Oldkeys reintroduced after marker ignored.
- Main tests that used ascent rankv5/progressv1 as CURRENT records must now seed/assert descent keys. Legacy RESET fixtures still seed old keys explicitly. The old main migration test must now assert reset/no restored old unlocks. Do not blind-replace every v5 string and erase the old-reset scenario. T01's default-ascent helper tests keep their original behavior separately.
- Scene tests parameterizestage1..5, checkpoint and final: player260/216/next244/NPC104, order−4..+6, actual extrahistory/far, NPCown facing/catchvars, ordinary step and both jump signs/midY values, one copy, footclip nested inside motion, jump layer after box/landingfront, no global scaleY−1, no retained terminal jump. Pure base stairSceneModel tests still expect ASCENT geometry because it remains an upstream helper, while main renderer uses reflected model.
- Preserve D/J/Space repeat/nativeSpace/editable/defaultPrevented, primary touchdedup, 300/240/500/700ms, final successsound, independentNPC/rapid new input, fall250/500/noescapeattiedcatch, CPpause/Continue0points/cleanup cases. Adjust only direction text/geometry/new key expectations, not engine timing or obstacles to force a pass. Real main sound timing follows existing effects; tests for coalesced batches must not mistake multiple actions in one render for a production counter redesign.
- Add the I05 focus regression to the existing GameScreen test file, including a focused retry disappearing, an internal range remaining focused, late results after close, Escape and trigger restoration. No stale App.test.tsx rewrite is needed to test public GameScreen props. Actual native browser focus/media Promise behavior remains T03.
- Existing App.test.tsx has stale always-visible-settings assumptions and is outside this suite. No repair of that unrelated file, new dependencies, timeout/skip/config changes or actual browser work in T02. Known original slow30-loop test uses maxWorkers2 in the command, no weaker assertions.

## Acceptance Criteria

- [ ] Main `/` renders downward with top NPC/correct step·jump·catch layering through all5stages, keeping pixel UI and checkpoints.
- [ ] Every main record read/save explicitly uses descent; first reset/afterward persistence/account separation and old migration blocking pass.
- [ ] Downward labels/arrow/title are consistent; auth/audio/rules/independent experiment behavior stay intact.
- [ ] Audio retry button removal restores dialog focus; internal focus is preserved, Escape/Tab work and closing restores the trigger without late-result focus stealing.
- [ ] All27testfiles/lint/build/diff checks pass; actual browser validation remains T03.

## Validation

- `npm.cmd test -- --run src/game/recordStorage.test.ts src/game/StairScene.test.tsx src/descent/descentEngine.test.ts src/descent/descentSceneModel.test.ts src/descent/descentGate.test.ts src/descent/DescentTestApp.test.tsx src/descent/descentViewState.test.ts src/descent/DescentGameScreen.test.tsx src/descent/DescentScene.test.tsx src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts src/auth/authConfig.test.ts --maxWorkers=2` — actual count, skip0.
- `npm.cmd run lint`
- `npm.cmd run build`
- `if (Test-Path -LiteralPath dist/descent-test.html) { throw 'Standalone experiment must remain outside default build' }`
- `git diff --check`
- `git diff --name-only bdf18d5 -- src/game/gameEngine.ts src/game/stageRules.ts src/game/types.ts src/game/stairRoute.ts src/game/stairObstacles.ts src/game/timedPursuit.ts src/game/stairSceneModel.ts src/game/game.css src/descent descent-test.html src/App.tsx src/App.test.tsx src/main.tsx src/auth/authConfig.ts src/audio public vite.config.ts package.json package-lock.json` — these read-only paths remain unchanged.
- `rg -n 'readLeaderboard|saveBestScore|readStageProgress|saveStageProgress|migrateLegacy|descentEngine|DescentTestApp' src/game/GameScreen.tsx src/game/StairScene.tsx` — inspect every call/import; no main defaultascent/legacy migration/experimental app or engine.
- `rg -n '오르기|올라|오르면|올랐' index.html src/auth/AuthGate.tsx src/game/ControlButtons.tsx src/game/GameHud.tsx src/game/GameScreen.tsx src/game/StairScene.tsx` — no user-facing ascent wording. Technical type names and historical documents need not be renamed.

## Commit Message

```text
feat(game): convert the main five-stage game to downward staircase play

Plan: 2026-10-28-main-game-descent-conversion
Phase: P01-main-descent
Task: T02-main-descent-integration

- Render downward step jump and pursuit motion in the existing main UI
- Activate fresh descent records while retaining five-stage progression
- Align controls titles and help text without changing authentication or audio
- Restore settings focus after the audio retry control disappears
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- After success: Task done/commit, phase done2/3/T03 in_progress, current Active T03. Do not claim browser completion or implement T03 in this invocation.
