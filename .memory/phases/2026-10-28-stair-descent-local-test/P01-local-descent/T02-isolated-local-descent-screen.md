# Task: T02 Isolated Local Descent Screen

## Status: pending

## Goal

`/descent-test.html`에서 개발용 로컬 데모1단계 내려오기를 실제로 플레이할 수 있게 한다. 기존 `/`와 저장소를 건드리지 않는 전용 화면에 입력/추격/하강 모션/HUD/오디오/결과를 연결한다.

## Decision Summary

- Existing implementation is read-only. Add separate HTML and `src/descent/` files only; no App/GameScreen/migration import or route/build config change. Only `DEV && VITE_LOCAL_DEMO_MODE?.trim()==='true'` mounts gameplay.
- Done criteria: stage1 score0→150..153/90sec/800ms NPC above; Space2stairs/10% long-run obstacles/30stairs bonus/fall500ms-fast250ms; immediate final clear, catch500ms gate with reduced exception; restart ready, no stage2/checkpoint/rank/storage.

## Implementation

### I01. Independent entry, gate and audio owner

- Related Files:
  - `descent-test.html` :: root/script/title — new
  - `src/descent/main.tsx` :: root bootstrap — new
  - `src/descent/descentGate.ts` :: isDescentTestEnabled — new
  - `src/descent/DescentTestApp.tsx` :: DescentTestApp/private audio shell — new
  - `src/global.css`, `src/audio/audioController.ts`, `audioPreferences.ts`, `AudioControls.tsx` — read-only
  - `index.html`, `src/main.tsx`, `src/App.tsx`, `src/auth/**`, package/config — read-only

#### Details

- **Signatures & Types**:

  ```typescript
  export interface DescentEnvironment { DEV: boolean; VITE_LOCAL_DEMO_MODE?: string; }
  export function isDescentTestEnabled(environment: Readonly<DescentEnvironment>): boolean;
  // DescentTestApp.tsx exports components only (React Fast Refresh rule):
  interface DescentTestAppProps { enabled: boolean; }
  export function DescentTestApp(props: DescentTestAppProps): React.ReactElement;
  // Existing read-only APIs:
  interface AudioPreferences { bgmVolume:number;bgmMuted:boolean;effectsVolume:number;effectsMuted:boolean; }
  interface AudioController {
    startBgm():Promise<boolean>;stopBgm():void;setEventActive(active:boolean):void;
    setPreferences(preferences:AudioPreferences):void;playFootstep():void;playFall():void;dispose():void;
  }
  // createAudioController():AudioController
  // DEFAULT_AUDIO_PREFERENCES = {.5,false,.5,false} under named fields above.
  // AudioControls({preferences,onChange,autoplayBlocked,onEnableAudio}) is reusable.
  ```

- **Data & Schema Fields**:
  - Separate HTML langko/charsetUTF8/viewport width=device-width,initial-scale1/root div/title `계단 내려오기 · 로컬 테스트`, module script `/src/descent/main.tsx`. No import/link to original entry. main imports existing global.css (read-only) and own app, creates root or throws descriptive missing-root Error, renders StrictMode with enabled from current import.meta.env.
  - Audio shell owns controller lazy instance, **cloned** DEFAULT_AUDIO_PREFERENCES in useState, autoplayBlocked false and mounted ref. These are component memory only, no account props/Storage/keys. Disallowed: loadAudioPreferences/saveAudioPreferences/leaderboard/stageProgress/auth/App/GameScreen imports and all storage calls.

- **Execution Flow / Logic**:
  1. Gate returns true only DEV===true and trimmed flag exactly 'true'; absent/false/'TRUE'/production is false. Disabled App renders Korean static 안내 `로컬 개발 전용 테스트입니다`; no shell/controller/timers/game listeners mount. Keep code/package configuration unchanged; Vite default single index build excludes extra HTML, verified in T03.
  2. Enabled mounts private audio shell and DescentGameScreen. Set preferences on owner initialization/change without reading storage; don't mutate exported DEFAULT object. No auto BGM on ready mount. Actual start calls passed enable callback, which calls controller.startBgm and updates blocked status if still mounted; blocked playback must not block gameplay. '음악 켜기' retries via same callback.
  3. Pref changes update component state/controller only. Cleanup marks unmounted and disposes owned controller/effects; do not double-own disposal in screen. StrictMode setup/cleanup/setup may dispose initially; controller.startBgm supports reuse and resets disposed state. Guard late promise results and pending audio on unmount. The original BGM source/loop/normal rate1/bonus1.25 and effect sources are reused unchanged.
  4. This is an independent dev entry, not an Entra bypass for main. Do not load MSAL/sessionStorage or add a main page button/URL switch. No build inputs/new dependencies/production test props.

### I02. Pure view state for timers and animation outcomes

- Related Files:
  - `src/descent/descentViewState.ts` :: DescentViewState/DescentViewAction/createDescentViewState/descentViewReducer — new
  - `src/descent/descentEngine.ts` :: six T01 adapter functions — read-only unless a demonstrated T01 contract defect
  - `src/game/types.ts`, `gameEngine.ts` :: getStageSecondsLeft — read-only

#### Details

- **Signatures & Types**:

  ```typescript
  import type { GameState, GameInput } from '../game/types';
  export interface DescentViewState {
    game:GameState;nowMs:number;settingsOpenedAt:number|null;
    playerMoveAt:number|null;playerMotionKey:number;
    scoreGain:1|2|4|null;scoreGainIsBonus:boolean;scoreGainUntil:number|null;
    successfulActionCount:number;mistakeCount:number;
  }
  export type DescentViewAction =
    | {type:'start'|'tick'|'open-settings'|'close-settings';nowMs:number}
    | {type:'input';input:GameInput;nowMs:number}
    | {type:'restart';readyState:GameState;nowMs:number};
  export function createDescentViewState(readyState:GameState,nowMs:number):DescentViewState;
  export function descentViewReducer(view:DescentViewState,action:DescentViewAction):DescentViewState;
  ```

- **Data & Schema Fields**:
  - T01 adapter signatures: createDescentState(random?)→GameState, startDescent(state,now), applyDescentInput(state,input,now), tickDescent(state,now), resumeDescentAfterPause(state,opened,closed), resetDescent(random?) all return GameState. Public stage always1/CPenterednull/status nevercheckpoint. State keeps real increasing stepsClimbed/index, positive pursuit gap, absolute clocks/lastMove/route/obstacles. Clear output statusgame-over/reasoncleared/score150..153/clear1/all active clocks null, final obstacle metadata allstage1.
  - Ready init requires stage1/ready/score0/steps0/clear0/no clocks; call adapter tick for invariants, reject invalid ready with RangeError. View fields initialize null/false/0; view.nowMs supplied validated finite nonnegative.
  - successfulActionCount/mistakeCount are **monotonic for the screen lifetime**, including restart. They count input outcomes, not physicalstairs/frames. Audio effect plays each newly counted action once even when multiple reducer actions are React-batched. No external sound/RNG/storage in reducer.

- **Execution Flow / Logic**:
  1. start ready→startDescent, nowMs updated, no movement/score gain. Other status→identity. input only outside settings delegates adapter (including pending clocks/recovery). tick outside settings delegates tickDescent. Closing settings delegates resumeDescentAfterPause once; opening first tick reconciles clocks, and opens only if still playing. While settings open, input/tick/start/restart/open duplicates identity; close when closed identity.
  2. Compare before/after successful input steps: if increased, successfulActionCount+1 even for final success. When next is playing, no mistake/capture, set playerMoveAt=action.now, motionKey+1, scoreGain=actual score delta1/2/4, bonus flag from lastMove, gainUntil=now+600ms. Final/caught/fall/nonplaying/open-settings clear motion/gain immediately (do not remove GameState's terminal step data used for counters). MistakeCount increments only when an input starts a new non-null recovery/lastMistake vs before, not each repeated recovery input/tick/catch.
  3. Tick clears playerMoveAt at +300 and gain at +600; update nowMs even if game identity to finish cosmetic timers. New success replaces old move; open-settings cancels motion/gain, close must not replay old lastMove. Capture/mistake/ready/end cancel animations. NPC animation is derived from game.lastPursuerMove.atMs+240 and view.nowMs, independently of player.
  4. Restart is allowed only from game-over; event handler creates `readyState=resetDescent()` **before dispatch**, not inside reducer. Validate new ready, replace game/now, clear settings/motion/gain, bump key as needed, retain monotonic sound counters. It returns ready; another click on start begins clocks/BGM. No hydrate/progress/default2 logic.
  5. Keep transitions pure/deterministic/immutable. End reasons are engine decisions: do not promote based on view score after time-limit. Raw checkpoint/stage2 is invalid. Do not introduce synchronous setState-in-effect fixes, lint disables or production snapshot props.

### I03. Dedicated screen, HUD, input, settings and effects

- Related Files:
  - `src/descent/DescentGameScreen.tsx` :: DescentGameScreen/private HUD/controls/result/settings helpers — new
  - `src/descent/descent.css` :: layout/input/dialog styles — new
  - `src/audio/AudioControls.tsx`, `src/game/pixel/PixelIcon.tsx` — read-only
  - Original GameHud/ControlButtons/GameScreen/StageSelectPanel/CheckpointPanel/LeaderboardPanel — reference only, do not mount/import

#### Details

- **Signatures & Types**:

  ```typescript
  import type { AudioController } from '../audio/audioController';
  import type { AudioPreferences } from '../audio/audioPreferences';
  interface DescentGameScreenProps {
    audioController:AudioController;audioPreferences:AudioPreferences;autoplayBlocked:boolean;
    onAudioPreferencesChange:(next:AudioPreferences)=>void;onEnableAudio:()=>void;
  }
  export function DescentGameScreen(props:DescentGameScreenProps):React.ReactElement;
  ```

- **Execution Flow / Logic**:
  1. useReducer initializer with createDescentViewState(createDescentState(),Date.now()). Root `.descent-game` fullviewport data-status/capture flags. Visible title/tag `내려오기 · 로컬 테스트`, HUD current score/`내려온 계단 N칸`, stage1/target150/countdown01:30, gauge0..30/event seconds; no hearts/account/ranking/checkpoint/stage selection. Embed scene and settings gear; ready overlay start, terminal overlay reason/actualscore/stairs/`기록은 저장하지 않아요`/restart. Clear immediate; catch hides result/focus targets until captureEndsAt null, with CSS reduced-motion exception immediate. Result/start accessible native buttons, no automatic restart/start.
  2. Start handler guards ready/settings and synchronous started ref to prevent double BGM or clocks while React dispatch pending; dispatch start then onEnableAudio once. Restart guards game-over, creates new ready outside reducer, resets started ref, dispatches restart. Don't play success/fall/reset sound on start/restart itself.
  3. Key listener only playing/outside settings, skip defaultPrevented and contenteditable/input/textarea/select. D/d→forward, J/j→turn with preventDefault, follow existing repeat handling. Space(code or key) prevents scroll and ignores repeat; if target is button/rolebutton leave native activation (no extra global jump). Use functional reducer dispatch so rapid actions reconcile current state. Cleanup listener on unmount.
  4. Dedicated native controls labels `한 칸 내려가기`, `방향을 바꾸며 내려가기`, `장애물 점프`; new scoped classes. Use primary pointerdown button0, preventDefault then dispatch; click handler invokes only detail0 (keyboard/assistive) to suppress touch's detail1 duplicate. Disabled outside playing/recovery/settings. Down arrow can rotate **only** existing PixelIcon forward glyph180deg; never mirror scene/officers/text. Mobile <=720px shows controls, desktop hides them. Turn/jump groupgap4px, externalgap12px, controls≥56×56, gear≥44×44.
  5. 100ms interval while playing/recovery/capture or cosmetic deadline pending; each action uses Date.now, no elapsed-per-frame math. Additional timeout to earliest player300/NPC240/gain600 end may dispatch tick to end motion precisely; clear every timer on dependency replacement/unmount. On visibilitychange visible/outside settings reconcile once with actual now. Late callbacks must preserve early catch reason. Ready/allfinalclocksnull creates no loop.
  6. Audio effects compare monotonic successfulActionCount/mistakeCount to refs and play once for each new count; update refs before next effect/replay. Changing step count2 for one jump still produces one footstep. Event flag transitions call setEventActive once, end resets false; stopBgm once on entering game-over. Screen doesn't dispose the owner's controller. This keeps side effects outside reducer and handles StrictMode/coalesced inputs.
  7. Settings open dispatch reconciles before pausing; gear enabled only playing and not already open. Root has actual role dialog/modal/label; focus close on open, Tab/ShiftTab loop visible inputs/buttons, Escape/backdrop outside close, refocus gear. D/J/Space/controls blocked by reducer while open; native range ArrowRight/Space behavior preserved. AudioControls props use owner memory only; defaults .5/unmuted, muted/volume edits don't persist. Timer pause shifts stage/event/NPC while original recovery/capture behavior is respected. Avoid conditional hooks/setting React state synchronously in an effect.
  8. All CSS new rules scope `.descent-game` (and dedicated unavailable root), all keyframe names `descent-*`. Import global.css from entry only; AudioControls imports its existing audio.css unchanged. Do not import/modify game.css/pixel-theme.css/pixel-scene.css or use `.stair-game` to inherit ascending behavior. Build own pixel color/borders/fullviewport with minmax0, safe-area/dvh and scrollable ready/settings/result panels. Scene≥200px, HUD and gear reserved separate space, instructions not under controls. At320px font24/32 panel scroll must reach close/start/restart and valid0..153 point text must stay readable.
  9. Keep no bare window/local/sessionStorage access, rank/progress/migration calls or save errors UI. If storage getters throw on initial mount, app still starts/settings/ends/restarts. BGM promise rejection or missing audio is nonfatal.

### I04. Upright downward scene and motion

- Related Files:
  - `src/descent/DescentScene.tsx` :: DescentScene — new
  - `src/descent/descent.css` :: scene layers/poses/unique animations — new (same stylesheet as I03)
  - `src/descent/descentSceneModel.ts` :: buildDescentSceneModel — read-only T01
  - `src/game/pixel/PixelOfficer.tsx`, `PixelStair.tsx`, `PixelOfficeBackdrop.tsx`, `PixelObstacle.tsx`, `PixelIcon.tsx` — read-only

#### Details

- **Signatures & Types**:

  ```typescript
  import type { GameState } from '../game/types';
  interface DescentSceneProps {
    state:GameState;playerMotionKey:number;isPlayerMoving:boolean;
    isPursuerMoving:boolean;isCaught:boolean;
  }
  export function DescentScene(props:DescentSceneProps):React.ReactElement;
  // Reused pixel APIs: PixelOfficer({variant:'young'|'older',direction:'left'|'right',pose:'idle'|'climb'|'jump'|'fall'}),
  // PixelStair({face:'top'|'front',direction}), PixelOfficeBackdrop(), PixelObstacle(),
  // PixelIcon({name:'forward'|'turn'|'jump'|'settings'|'close'|'flag'|'restart'|'stair',size?,className?}).
  // T01 model extends StairSceneModel with playerMotion:{kind,from:{x,y},to:{x,y}}|null;
  // points x260+columnDelta*34/y216+indexDelta*28; all actual route indices remain increasing.
  ```

- **Execution Flow / Logic**:
  1. Scene model from T01; SVG520×400 preserveAspectRatio xMidYMid meet, pixel backdrop as separate upright full-area element. Heading uses real next obstacle/corner and text `장애물! 점프하세요`/`지금 방향을 바꾸세요`/`N칸 더 내려가세요`; next left/right comes from actual getRouteStep. aria describes downward stairs/NPCgap/nextbox. Expose scoped testids/data index/direction/motion-key/motion-kind/visible for browser evidence without mutation props.
  2. Render base stairs in ascending index (back/up→front/down). Per stair: top, existing visible futurebox, idle actor(s) when anchored there, front. Draw consumed box only during actual jump it crossed. Original pixel art stays upright; foot clip useId x−34/y−88/width68/height84 (ends−4) preserves shoes behind same stair front. Render at most one player/NPC; moving actors excluded from base layers.
  3. Visible NPC outside base11 gets real extra historical stair; far invisible NPC retains SVG metadata without fabricated geometry. NPC direction is its own route direction, not player's. Actor movement overlays sit above base layers with landing frontface to keep feet clipped; jump overlay above all base stairs, so intervening lower step/box does not cut off airborne body. Catch overlay draws both once and uses actual mapped catch frames.
  4. Use nested anchor `<g transform=translate(x,y)>` + child CSS motion; never override the anchor transform with animation. Player one-step300ms fromX±34/fromY−28, midXhalf/midY−22 (baseline−14 minus8hop), landing0. Corner travel uses model's actual from/to delta and newly correct facing. Jump300ms fromX±68/fromY−56, midpointXhalf/**midY−84** (baseline−28 minus56lift), landing0. Do not reuse uphill fromY+56/midY−28. Use CSS vars scoped names and new element key per successful action. This is player-relative camera motion as world shifts up around fixed player anchor.
  5. NPC240ms uses its actual from/to offsets (fromY−28, midY−22, tox0/y0) independently. On catch use mapped offset0/.2/.4/.55/.7/.85/1 coordinates relative to safe NPC anchor with pixel x/y variables and own facing at each real frame; total500ms. It advances to player and recoils on actual stairs, no x/y percentages with wrong SVG transform box. Moving/catch overlay suppresses idle copy and old motion on terminal/reset.
  6. Define scoped officer-frame visibility: default all hidden; idle→idle, jump→run-b, fall→stumble, move's climb pose→alternating run-a/run-b. Reuse art not original ascending keyframes. Falling500ms visual; stop movement when mistake, settings, capture or end. If state.lastMove retained at clear, no jump/step overlay should replay since status no longer playing.
  7. prefers-reduced-motion disables travel/hop/stride/catch animation and shows static idle pose at correct real anchor. It also reveals catch result immediately without waiting500ms. All generated decisions stable after resize/settings/re-render.

### I05. Tests and allowed scope

- Related Files:
  - `src/descent/descentGate.test.ts`, `DescentTestApp.test.tsx`, `descentViewState.test.ts`, `DescentGameScreen.test.tsx`, `DescentScene.test.tsx` — new
  - `src/descent/descentEngine.test.ts`, `descentSceneModel.test.ts` — T01 read-only except demonstrated relevant correction
  - Existing17 regression files below and existing fixtures — run/read-only

#### Details

- Gate cases DEV true/false and absent/trimmedtrue/false/uppercase; disabled App no controller/handlers/state/storage. StrictMode owner starts no BGM before click, one real start/blocked retry, memory preferences, late promise after unmount, dispose own resources.
- Pure view reducer clock/actions/replay/frozen input; two batched successful actions counter2/one jump counter1; fall repeats counter1; restart preserves counters but clears movement; no audio/RNG inside reducer; readyState generated outside reducer. Stage1-only final/no CP/stage2; input at exact deadline loses, earlier catch remains; cosmetic300/600 and independent240; settings95sec and pending pausedfall150ms.
- Screen test actual D/J/Space/native focused Space, input/range exclusions/defaultPrevented, Space repeat, touch pointerdown+detail1 one move, fast turn/jump, disabled recovery, no input while ready/settings/result, start doubleclick, restart fresh0/no automatic start. HUD livegain1/2/4 and realstairs gauge; final success footstep1, repeatedtick/StrictMode no duplicatefall/BGM/event. UI labels all descent, no rank/stage selector/checkpoint/lives.
- Spy both Storage.prototype methods and localStorage/sessionStorage getter before render; app start/input/settings sliders/mute/clear/fail/restart/unmount has0 calls and works when getters throw. Spy/throw leaderboard/progress/load/saveAudioPreferences if accidentally imported. Test scope must not count fixture setup/teardown accesses; restore spies and timers. Do not import original GameScreen to compare rendering (it legitimately accesses storage).
- Scene DOM ordering ascending index, correct transformed anchor/direction/future down/NPC up, extra history/far metadata, one copy/catch/jump overlay above box, only clip inside pose not entire motion, original art no scaleY(−1), terminal/reset cleanup/reduced style. JS unit tests can't certify CSS bounds or WebAnimation positions: leave actual screenshots to T03.
- Use actual engine/legal seeded input for normal flow and consistent fixtures for edge layouts; don't turn off production obstacles or add skip/test props/timeouts. Do not fix unrelated original App test expectations. No package/config/auth/audio source changes.

## Acceptance Criteria

- [ ] Separate dev-only URL plays stage1 descent with original app untouched and no storage access.
- [ ] Downward stairs/NPC/step/jump/catch motion and mobile/native controls are integrated with original rules.
- [ ] Memory-only audio/settings pause/end/restart behave without duplicate effects/old timers.
- [ ] New tests + original17/lint/build pass; actual browser validation remains explicitly T03.

## Validation

- `npm.cmd test -- --run src/descent/descentEngine.test.ts src/descent/descentSceneModel.test.ts src/descent/descentGate.test.ts src/descent/DescentTestApp.test.tsx src/descent/descentViewState.test.ts src/descent/DescentGameScreen.test.tsx src/descent/DescentScene.test.tsx src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts` — all24files; record actual count, baseline original509.
- `npm.cmd run lint`
- `npm.cmd run build` — default original index only, record actual size/warnings; no production descent HTML.
- `git diff --check`
- `git diff --name-only -- index.html src/main.tsx src/App.tsx src/game src/audio src/auth src/leaderboard src/test src/global.css vite.config.ts package.json package-lock.json` — no Task modifications; distinguish unrelated pre-existing changes.
- `rg -n 'localStorage|sessionStorage|readLeaderboard|saveBestScore|readStageProgress|saveStageProgress|migrateLegacy|loadAudioPreferences|saveAudioPreferences|GameScreen|App' src/descent` — inspect every result: expected component names/test assertions only; no original App/GameScreen imports, storage/helper calls in runtime code. No blind replacement.

## Commit Message

```text
feat(game): add a storage-free local staircase descent screen

Plan: 2026-10-28-stair-descent-local-test
Phase: P01-local-descent
Task: T02-isolated-local-descent-screen

- Add a separate development-only descent entry and memory-only audio
- Render downward stairs pursuit and obstacle jumps with native controls
- Keep the original game and all saved records unchanged
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- After success: Task done/commit, phase done2/3/T03 in_progress, current Active T03. Do not mark plan completed before actual browser validation.
