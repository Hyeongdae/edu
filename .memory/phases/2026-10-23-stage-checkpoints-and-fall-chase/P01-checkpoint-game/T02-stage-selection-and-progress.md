# Task: T02 Stage Selection and Progress

## Status: done

## Goal

계정의 최고 클리어 단계까지 선택해 0점 새 판을 시작하고, 결과 화면에서 선택창으로 돌아갈 수 있게 한다.

## Decision Summary

- 최고 클리어2면1~2만 선택 가능, 최초0도1단계는 가능하다. 기본 선택은max(1,최고클리어)다.
- 새 판 점수는0이며 이전 클리어 기록 기준은 이어받는다. 체크포인트 계속하기의 점수/경로 보존과 구분한다.

## Implementation

### I01. Stage selection panel and prior contracts

- Related Files:
  - `src/game/StageSelectPanel.tsx` :: StageSelectPanel — new
  - `src/game/types.ts`, `stageRules.ts`, `gameEngine.ts`, `stageProgress.ts` — read-only T01 APIs

#### Details

- **Prior model**: GameStage1..5/ClearedStage0..5; status ready|playing|checkpoint|game-over; reasons caught/time-limit/cleared/quit. No lives. Session fields stageStartScore:number,recordStage:ClearedStage,clearedStageThisRun:ClearedStage,checkpointEnteredAt:number|null; old route/obstacles/lastMove and actual NPC fields remain.
- **Rules**: scoreRequired400 each stage, durations90000/75000/65000/60000/50000, obstacle probability.1/.2/.3/.4/.5, intervals800/650/500/400/300. getStageTargetScore(start)=start+400.
- **Engine**: createGameState(random?,options?:{stage?:GameStage;highestClearedStage?:ClearedStage}) and resetGame same signature. Reject selected>max(1,highest). Ready has selected stage,0score/startScore/clearedThisRun/steps/event,NPC-4/gap4,null clocks/moves,recordStagehighest,new route and obstacles using selected stage. startGame(state,now) preserves ready preview and stage, arms full clocks. continueGame(checkpoint,now) alone preserves score/route/event and advances stage. quitAtCheckpoint ends quit.
- **Storage**: readLeaderboard(storage?) returns v4 entries {accountId,displayName,bestStage:ClearedStage,bestScore,achievedAt}. readStageProgress(accountId,storage?) returns {highestClearedStage,available}; saveStageProgress returns {highestClearedStage,saved,error?:"storage-unavailable"}. Progress key stair-climb:stage-progress:v1 is account array; rank key is leaderboard:v4; legacyv1/v2/v3 cleanup is limited to ranking keys. Known highest=max(current-account validv4 record,progress value); never recover from legacyv3.
- **Signatures & Types**:
  ```typescript
  interface StageSelectPanelProps {
    selectedStage:GameStage; highestClearedStage:ClearedStage;
    onSelect:(stage:GameStage)=>void; onStart:()=>void;
    disabled:boolean; progressUnavailable:boolean;
  }
  function StageSelectPanel(props:StageSelectPanelProps):ReactElement;
  ```
- Region aria-label=`단계 선택`, heading=`시작 단계를 선택하세요`. Show five native buttons in stage order: accessible label `N단계 선택` when unlocked, `N단계 잠김` when locked. Disabled=overall disabled or N>max(1,highest). Selected aria-pressed=true. Never add a playable stage0.
- Primary start button label remains `시작하기`; show selected stage/time and `이번 판 0점부터 · 단계마다 400점`. When prior highest>0 explain `이전 클리어 N단계가 기록 기준으로 적용됩니다.`. On read failure use `진행도를 읽지 못했습니다. 저장 가능한 기록과 이번 플레이 진행도를 사용합니다.`.
- Native onClick only, no menu pointerdown/click duplication. Initial focus selected unlocked button; locked buttons excluded from Tab. Same-stage click does not reroll. Escape does not auto-start/dismiss. Native Space/Enter handles only focused menu action; gameplay keyboard must ignore ready.
- **Data & Schema Fields**: all six panel props are required/non-null; selectedStage is playable1..5, highestClearedStage is0..5, disabled/progressUnavailable are boolean. The panel owns no run/progress/storage state.

### I02. New-run entrance and result return

- Related Files:
  - `src/game/GameScreen.tsx` :: initial profile/handleSelectStage/handleShowStageSelection/handleStart — modify
  - `src/game/pixel-theme.css` :: selection overlay/ready geometry — modify
  - `src/App.tsx` :: T01 account-keyed GameScreen — read-only

#### Details

- T01 lazy initial profile loads entries/knownhighest/progressAvailable before game state. Change initial constructor stage to max(1,knownhighest), recordStage=knownhighest. Derive selectedStage from ready gameState.stage, not a second independent selection state.
- handleSelectStage ignores settings/nonready/locked/same stage. Determine known=max(current recordStage,stored current-account profile). Create resetGame(undefined,{stage,highestClearedStage:known}) once in the event handler, then set state/now. Do not sample Math.random in a React state updater. Selection changes preview but arms no clocks/BGM and writes no rank/progress.
- handleStart only ready -> startGame(preview,Date.now once); never reconstruct preview. Reset final-save/progress-attempt refs and save error only for the genuine new run, update now, start BGM. Continue checkpoint uses continueGame and must not call this reset.
- Result button keeps `다시 시작` label but opens selection instead of immediately playing. Merge current recordStage/stored profile, construct new ready at max(1,known), fresh0score/route/event/NPC. Do not start clocks/BGM until Start. Existing status/step effects cancel old arc/popups/NPC; old catch gate must not leak into ready.
- Progress effect remains actual clear increase only; final rank remains one game-over comparison. Do not write just for preview/selection. Prior3+stage1 replay failure records3/current score. Actual new clear4 raises progress4. Keep in-memory unlocks if writes fail; reload can use validv4 fallback. App account key prevents cross-account state reuse.
- Selection panel is an opaque pixel overlay inside game-frame, z5/inset12px/max-width600px/overflow:auto. Stage grid and Start targets>=56px, wrapping descriptions. Keep internal scene scroller/min200px, automatic-height mobile controls/footer, >=721px gameplay-controls hiding. Overlay is out of normal flow; do not rely on former direct-child .game-frame > .start-button selector for it.
- Settings gear remains disabled while ready/checkpoint to avoid nested dialogs. No new menu route/back button from checkpoint, no full-screen API/body font override/auth changes or production test flags.
- **Execution Flow / Logic**: (1) read and merge this account's valid profile, (2) render the highest unlocked default, (3) validate each selection before constructing a fresh ready preview, (4) Start arms that preview once, (5) final result returns to selection. Invalid engine options throw RangeError; blocked UI actions are no-ops; unavailable storage is represented by the panel message and existing save errors.

### I03. Selection regression

- Related Files:
  - `src/game/StageSelectPanel.test.tsx` — new
  - `src/game/GameScreen.test.tsx` — modify
  - Other listed17files — regression, update only required callers

#### Details

- Panel highest0→only1; highest2→1/2 enabled3..5disabled; highest5→all. Assert aria-pressed/focus/order/disabled no action/native click once/Start once/all required props.
- AccountA progress3/accountB5 -> A default3 and4locked; choose1→ready90s/0/goal400/startNPC800; choose3→65s/0/goal400/NPC500/initial obstacle stage3/recordbaseline3/actualclear0. Use isolated jsdom storage.
- Fresh clear1 checkpoint saves progress not rank; quit saves rank once; result restart -> selection -> Start new0run. Clear2 then quit -> default2/75s/goal400. Legacyv3 only ->stage1, missing progress but validv4currentstage3 ->default3. Read/write failures preserve usable UI; reload/monotonic/other account checks.
- Update old result-restart tests to expect ready selection before Start, preserving the actual keyboard/engine assertions. Use T01 coherent create options; do not bypass locking with product props.
- Separate Continue preserving objects/score/event from Select creating a new run. Duplicate start/locked programmatic requests cannot double-arm clocks or save. StrictMode/unmount/native Space cannot auto-jump from menu. Real dimensions remain T04.

## Acceptance Criteria

- [x] 해금 범위와 기본 선택이 맞고 잠긴 단계는 시작할 수 없다.
- [x] 선택 단계의 조건으로 0점 새 판을 시작하며 결과→선택→시작이 연결된다.
- [x] 재도전 기록 기준·계정 분리·기존 체크포인트 계속하기·저장 guard를 보존한다.

## Validation

- `npm test -- --run src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts`
- `npm run lint`
- `npm run build`
- Record actual17file results.250ms acceleration remains T03 and full browser signoff T04; no new dependencies/debug hooks/unrelated App fixes.

## Commit Message

```text
feat(game): select unlocked stages for zero-score replays

Plan: 2026-10-23-stage-checkpoints-and-fall-chase
Phase: P01-checkpoint-game
Task: T02-stage-selection-and-progress

- Show account-specific unlocked stages and default to the highest clear
- Return results to selection while preserving record progress and fresh-run state
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Execution Notes — 2026-10-27

- Added a stateless StageSelectPanel with five native stage buttons, account-specific locks/pressed state, selected-stage initial focus, time/zero-score/record-baseline descriptions, and progress-read failure guidance.
- GameScreen defaults to max(1, known highest). Selection and result-return construct a fresh ready preview once in the event handler; Start preserves that preview and alone arms clocks/BGM. A synchronous ref prevents duplicate Start/return actions in the same React batch. Same-stage/locked clicks do not reroll or save.
- Known progress merges the current run's record baseline, initial profile and latest current-account progress/v4 record. Failed writes retain in-memory unlocks; valid final v4 records restore defaults after reload. Continue remains separate and preserves route/score/event state.
- Added the opaque scrollable pixel overlay, 56px targets and mobile two-column stage grid. Removed the superseded direct-child Start positioning/ready-space rules, preserving gameplay controls and the scene scroller.
- Updated result-restart tests to go through ready selection and Start. Added stage0/2/5 panel locks, default3/accountB5 isolation, selected1/3 clocks and obstacle stage, native input/StrictMode duplicate guards, actual stage4 clear and reload, legacy-v3 reset, storage-read/write failure and v4 fallback checks.
- Validation: exact 17 blueprint test files passed, 402/402 tests; npm run lint passed; npm run build passed; git diff --check passed. Build JS550.61kB(gzip153.85kB), CSS55.52kB(gzip10.78kB), existing >500kB chunk warning remains.
- Validation notes: the first full-suite run concurrent with lint/build hit an existing 5-second UI timer-test deadline and cascaded; the same exact full suite passed when run independently. Test timeouts were not increased. The new clear4 storage test composes real legal inputs in one React batch to avoid rendering hundreds of intermediate stairs; existing per-input animation/audio regressions remain intact.
- T01 engine/rule/storage/model APIs and App account key were unchanged. No dependencies, debug flags, browser signoff or audible fall-sound claim. Fall pursuit at250ms remains T03; browser/responsive signoff remains T04. Bundle splitting/independent App expectations/older CSS cleanup remain separate work.
