# Task: T01 Checkpoint Session and Records

## Status: done

## Goal

400점 체크포인트·생명 제거·기록 단계·진행도·v4랭킹을 함께 연결한다. T01 화면은1단계 시작이며 단계 선택 화면은T02, 넘어짐250ms가속은T03이다.

## Decision Summary

- 플레이 단계1~5와 기록/진행도0~5를 구분한다. 기록 단계는 이전 최고 클리어와 이번 판 실제 클리어의 최댓값, 점수는 이번 판0점부터다.
- 체크포인트의 모든 시계를 동결하고 최초 잡힘에 종료한다. 엔진·최소 UI·저장을 한 Task에서 바꿔 잘못된 자동 승급/기록을 방지한다.

## Implementation

### I01. Models and rules

- Related Files:
  - `src/game/types.ts` :: GameStatus, GameEndReason, ClearedStage, GameStartOptions, GameState — modify
  - `src/game/stageRules.ts` :: StageRule, STAGE_RULES, isClearedStage, getStageTargetScore — modify
  - `src/game/stageRules.test.ts` — modify

#### Details

- **Signatures & Types**:
  ```typescript
  type GameStage = 1 | 2 | 3 | 4 | 5;
  type ClearedStage = 0 | GameStage;
  type GameStatus = "ready" | "playing" | "checkpoint" | "game-over";
  type GameEndReason = "caught" | "time-limit" | "cleared" | "quit";
  interface GameStartOptions { stage?: GameStage; highestClearedStage?: ClearedStage; }
  interface StageRule {
    readonly stage: GameStage; readonly durationMs: number;
    readonly scoreRequired: number; // replaces targetScore
    readonly obstacleProbability: number; readonly pursuerStepIntervalMs: number;
  }
  const STAGE_SCORE_REQUIRED = 400; // export
  function isClearedStage(value: unknown): value is ClearedStage;
  function getStageTargetScore(stageStartScore: number): number;
  ```
- **Data & Schema Fields — GameState**: remove `lives`. Add required `stageStartScore:number=0`, `recordStage:ClearedStage=options.highestClearedStage??0`, `clearedStageThisRun:ClearedStage=0`, `checkpointEnteredAt:number|null=null`.
- Retain existing fields/types: status,stage,stageEndsAt:number|null,endReason:GameEndReason|null,score:number,stepsClimbed:number,direction:left|right,straightStepsRemaining:number,pursuerDistance:number,pursuerIndex:number,nextPursuerStepAt:number|null,lastPursuerMove:{fromIndex,toIndex,atMs}|null,captureCount:number,captureEndsAt:number|null,eventSteps:number,eventEndsAt:number|null,recoveryEndsAt:number|null,lastMistake:boolean,route:StairRoute,obstacles:StairObstacleState,lastMove:GameMove|null.
- GameMove remains `{kind:"climb"|"jump";fromIndex:number;toIndex:number;scoreGain:1|2|4;isBonus:boolean}`. GameInput remains forward|turn|jump.
- Rule rows (stage,durationMs,scoreRequired,probability,intervalMs): 1/90000/400/.1/800,2/75000/400/.2/650,3/65000/400/.3/500,4/60000/400/.4/400,5/50000/400/.5/300. Remove targetScore and update every affected caller. Keep STAGE_ONE_DURATION_MS=90000/STAGE_ONE_TARGET_SCORE=400 compatibility exports.
- isGameStage/getStageRule still reject0; only isClearedStage accepts0. getStageTargetScore validates a nonnegative safe integer whose +400 is safe, otherwise RangeError; returns start+400.
- Keep existing finite nonnegative clock/real route/positive gap validation. Validate new stage ranges, recordStage>=clearedStageThisRun, checkpoint stage1..4/nonnull entered/null stage+NPC clocks, playing null entered/nonnull stage+NPC clocks. Constructor lock validation must not reject normal continued stage3 with recordStage2.

### I02. Pure checkpoint engine

- Related Files:
  - `src/game/gameEngine.ts` :: createGameState/startGame/applyInput/tickGame/continueGame/quitAtCheckpoint/resumeGameAfterPause/getStageSecondsLeft/resetGame — modify
  - `src/game/stairRoute.ts`, `src/game/stairObstacles.ts` — read-only

#### Details

- **Signatures**:
  ```typescript
  function createGameState(random?:()=>number, options?:GameStartOptions):GameState;
  function resetGame(random?:()=>number, options?:GameStartOptions):GameState;
  function startGame(state:GameState, nowMs:number):GameState;
  function continueGame(state:GameState, nowMs:number):GameState;
  function quitAtCheckpoint(state:GameState, nowMs:number):GameState;
  // Keep applyInput/tickGame/resumeGameAfterPause/getStageSecondsLeft signatures.
  ```
- **Creation**: default stage1/highest0; reject invalid options or selected>max(1,highest) with RangeError. Create one route from one random seed, obstacles=createObstacleState(route,selectedStage). New run ready/score0/startScore0/clearedThisRun0/recordStagehighest/steps0/right/NPC-4/gap4/captureCount0/eventSteps0; clocks/moves null, lastMistakefalse. Start only ready, preserve selected stage and preview objects, arm now+selected duration/interval. Other statuses return identity. Reset creates fresh state using options.
- **Existing movement to preserve**: tick before input; playing and no recovery required. D=one same-direction empty node; J=one real corner empty node; Space=two same-direction nodes with a box on skipped node and empty landing. Wrong input remains500ms recovery/no immediate NPC movement in T01. Successful movement keeps NPC index/next clock and widens gap1/2.
- Advance route once, oldest=min(landing-4,NPC,lastPursuerMove.fromIndex??NPC). Route long5..9 then1or2short1..3, direction flips each run; 18 future nodes and necessary old NPC history. Do not change route generation.
- Bonus snapshot after tick: scoreGain=distance*(eventActive?2:1). Inactive charge+distance, >=30 resets0/endsAtnow+30000, no carry or multiplier mid-jump. Active event does not charge. Record actual lastMove and overshoot.
- **Complete step before checkpoint**: score>=getStageTargetScore(stageStartScore) sets clearedStageThisRun=max(old,stage),recordStage=max(old,stage). Stages1..4 retain current stage, set checkpoint/enteredAtnow/stageEndsAtnull/NPCnextnull/lastNPCnull/captureEndsnull/recoverynull/lastMistakefalse. Preserve final successful lastMove so one footstep still fires; nonplaying visual guards stop arc. Stage5 instead ends game-over/cleared with clocks stopped/enterednull and successful move metadata retained.
- Reveal obstacles only after real successful movement. Newly exposed runs on the checkpoint-producing move use next stage probability (matching former promotion behavior); normal moves use current stage and final clear uses5. Existing hit/null records keep their objects/stageAtGeneration. Continue/no-op/resize/mistakes never reroll.
- **Checkpoint freeze**: after validation tick/input return identical checkpoint state, including expired wall-clock bonus. Continue only checkpoint, sets stage+1,startScore=current score,enterednull,new full stage deadline, NPC=player-4/gap4/nextnow+newinterval/lastNPCnull. Preserve score,route,obstacles,eventSteps,recordStage,clearedThisRun. Shift bonus deadline once by max(0,now-enteredAt); retain route history as required. E.g. checkpointscore402 -> next target802, not800. Duplicate continue is identity after first transition.
- Quit only checkpoint -> game-over/quit, enterednull, stage/NPC/event clocksnull,lastMovenull; keep score/record/physical steps. Noncheckpoint quits are identity. Stage seconds: checkpoint/all game-over0, ready selected duration, playing ceil remaining.
- **Single catch**: at scheduled NPC step whose destination reaches player, end at that time with caught/NPCnextnull/lastMovesnull/lastMistakefalse/recoverynull/captureCount+1/captureEndsAt=at+500. Preserve last safe NPC index=player-1/gap1; never store gap0 or respawn to player-4. Existing catch overlay expresses contact using retained real route nodes. Normal prior NPC moves keep actual from/to/atMs.
- Chronological tick retains expiry-before-NPC/input ties and earlier fatal catch over later expiry. Terminal captureEndsAt still expires on later ticks for the normal500ms result gate; terminal state cannot advance NPC. Settings playing shifts stage/event/NPC deadlines once, recovery/capture cosmetics elapse. Settings on checkpoint is identity; checkpoint continue alone accounts for its whole waiting period.
- Pure functions must not read storage/DOM or consume global RNG inside input updates. Preserve no-op identity and RangeError behavior.
- **Execution Flow / Logic**: (1) validate input state/options/time, (2) reconcile due deadlines before input, (3) apply one legal move or one mistake, (4) calculate dynamic completion and reveal newly visible runs, (5) return playing/checkpoint/terminal state. Continue and quit are separate checkpoint-only operations. Storage/UI effects consume the returned state after the pure transition.

### I03. Account progress and v4 ranking

- Related Files:
  - `src/game/stageProgress.ts` :: readStageProgress/saveStageProgress — new
  - `src/leaderboard/leaderboard.ts` :: schema/validators/version — modify
  - `src/leaderboard/LeaderboardPanel.tsx` :: zero-stage label — modify

#### Details

- **Schema/Signatures**:
  ```typescript
  interface LeaderboardEntry { accountId:string;displayName:string;bestStage:ClearedStage;bestScore:number;achievedAt:string; }
  interface StageProgressEntry { accountId:string;highestClearedStage:ClearedStage; }
  interface ReadStageProgressResult { highestClearedStage:ClearedStage;available:boolean; }
  interface SaveStageProgressResult { highestClearedStage:ClearedStage;saved:boolean;error?:"storage-unavailable"; }
  function readStageProgress(accountId:string,storage?:Storage):ReadStageProgressResult;
  function saveStageProgress(accountId:string,clearedStage:ClearedStage,storage?:Storage):SaveStageProgressResult;
  // Existing readLeaderboard/saveBestScore/getTopScores signatures remain.
  ```
- Rank key=v4; legacy exact keys leaderboard:v1/v2/v3 under stair-climb prefix. Existing readFromStorage cleanup removes only legacy keys, never Storage.clear or new v4. User authorized old ranking reset; do not infer unlocks from v3.
- Ranking retains nonempty accountId/string name/nonnegative integer score/parseable achievedAt validation, except bestStage now isClearedStage. Corrupt v4 cleanup remains limited to its own key with caught errors. Valid0 must not be removed. Compare stage descending/score descending/earlier time; preserve whole prior entry/name/time on tie or worse performance. Read storage failure returns[], write failure returns existing saved:false/error result. UI label0=`미클리어(0단계)`; positive label=`N단계`. Preserve TOP10/current-account highlight.
- Progress key=`stair-climb:stage-progress:v1`, JSON array of StageProgressEntry. Validate nonempty account/stage0..5 before storage, invalid caller throws RangeError. Parse arrays by retaining valid entries and merging duplicate accounts by max; malformed/nonarray is empty, without deleting other keys. Use Map/array rather than object prototype properties.
- Read missing/corrupt ->0/availabletrue; access/read exception ->0/availablefalse. Save max(previous,input) only, preserve other valid accounts, no write when unchanged. On write error return candidate highest/savedfalse/error so in-memory unlocks can remain.
- Initial known highest=max(progress value,current account validv4.bestStage), never another account. Saving actual clear persists recordStage, even when inherited recordStage is higher. New final rank remains a separate operation.

### I04. Checkpoint UI and session integration

- Related Files:
  - `src/game/CheckpointPanel.tsx` :: CheckpointPanel — new
  - `src/game/GameScreen.tsx` :: profile/continue/quit/save/timer/help — modify
  - `src/game/GameHud.tsx` :: dynamic goal/no lives — modify
  - `src/game/StairScene.tsx` :: checkpoint/quit hint — modify
  - `src/game/pixel-theme.css` :: two-card HUD/checkpoint panel — modify
  - `src/App.tsx` :: GameAppShell passes account key to GameScreen — modify only this wiring

#### Details

- Panel props exactly `{stage:GameStage;score:number;recordStage:ClearedStage;onContinue:()=>void;onQuit:()=>void;disabled:boolean}`. Return ReactElement. Scrollable pixel section role=dialog/aria-modal/labelled heading `N단계 클리어!`, native buttons `계속하기`/`그만두기`, targets>=56px, disabled no action. Focus Continue initially; Tab/ShiftTab cycle buttons, Escape does not auto-quit/continue; one activation one callback. Use checkpoint-panel inside frame, absolute/inset12px/z5/max-width560px/centered/max-height calc(100% - 24px)/overflow:auto. Actions use two equal columns with8px gap, one column<=720px and wrapping labels. Do not reuse game-over-panel because its catch gate has different visibility semantics.
- Load entries/progress once via a lazy initial-profile state before constructing game state; profile holds entries/knownhighest/progressAvailable. Initialize createGameState(undefined,{stage:1,highestClearedStage:known}). T01 restarts also use stage1/known max; T02 replaces this entrance with selection. App renders GameScreen with key=account.homeAccountId so changing account cannot reuse an old run for a new account.
- Continue/quit handlers capture Date.now once/setNowMs/call pure engine updater. No storage/audio side effects inside updater. Reset scoreSavedRef only on a genuine new start, never Continue/settings/tick.
- Progress effect attempts saveStageProgress(account,recordStage) only when clearedStageThisRun positively increases. A ref keyed by account+cleared value prevents StrictMode/100ms duplicate attempts; reset for new run. Store failure message `진행도를 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.` role=status on checkpoint/result; in-memory recordStage remains usable. Final5clear also saves progress. Use existing refs/derived primitives/0ms callback pattern where needed to avoid React set-state-in-effect lint failures.
- Final rank effect remains game-over-only/scoreSavedRef guard, now bestStage=recordStage. Checkpoint waiting makes no rank write; quit/caught/timeout/finalclear compare once. Keep storage-error text/restart access. Result uses `기록 단계 N단계` or zero label; quit reason=`체크포인트에서 종료했어요`; do not label current stage as the record.
- Window keyboard dispatch only during playing; preserve defaultPrevented/text/range/repeatSpace/native-button guards. No gameplay dispatch from checkpoint native-button Space. Settings gear disabled on ready/checkpoint to avoid nested dialogs; open-settings reconciliation that already ended play must not conceal a newly created checkpoint.
- Freeze eventSecondsLeft reference at checkpointEnteredAt, and at settings openedAt while playing. Stop logical interval on checkpoint; visibility reconciliation returns checkpoint identity. HUD timer displays 클리어 at checkpoint; final5clear displays 모든 단계 클리어. Target caption uses getStageTargetScore(stageStartScore), not stage*400.
- Remove lives-card/hearts and three-catch help. Desktop HUD columns are minmax(0,1.3fr) minmax(0,1fr). At<=720px use one minmax(0,1fr) column; score/event both span1/-1, retaining score's internal summary/clock columns. Remove the old mobile two-column life/event arrangement rather than leaving an empty cell. Preserve gear44px separation, wrap long score, internal scroller/scene>=200px/automatic-height control row and >=721px control hiding.
- Scene hint includes checkpoint selection and quit terminal reason. Preserve actual NPC history/offscreen handling, 11base stairs, positive gap, one runner/at most one pursuer,500ms catch gate/reduced-motion immediate result. Successful final action still plays one footstep; checkpoint/terminal cancels player300ms/NPC240ms visuals. Autonomous catch is not fall audio. BGM continues through checkpoint and stops on true termination.

### I05. Fixtures and regression cases

- Related Files:
  - `src/test/gameFixtures.ts`, `src/test/obstacleFixtures.ts` — adapt only coherent fixtures
  - `src/game/CheckpointPanel.test.tsx`, `src/game/stageProgress.test.ts` — new
  - `src/game/stageRules.test.ts`, `gameEngine.test.ts`, `timedPursuit.test.ts`, `stairSceneModel.test.ts`, `GameScreen.test.tsx`, `GameHud.test.tsx` — modify
  - `src/leaderboard/leaderboard.test.ts`, `LeaderboardPanel.test.tsx` — modify
  - Other listed route/obstacle/control/audio tests — preserve regression

#### Details

- Existing withPursuitAt sets actual NPC/gap/clock now+rule interval only ifplaying, clears lastNPC/capture/recovery/mistake. Keep no-hit create/reveal spies in movement/scene/UI/pursuit files, restore mocks. Actual obstacle module tests stay unmocked. withObstacle only exposed long-run interior/same-direction takeoff/landing. No product debug props.
- Replace targetScore callers/300-point automatic-promotion cases; explicitly continue from checkpoints. New rules change timestamps, not route/jump/audio intent. For first-time stage3 attempt construct stage2 checkpoint then continue; selecting ready3 with highest3 intentionally yields inherited recordStage3.
- Test all options/defaults/locks/invalid0 play stage/0 record stage; one RNG sample and selected-stage initial obstacles. Goal399/400/jump2/bonus4/overshoot402->next802, event28/29 and exact expiry. Checkpoint95s identity/bonusfreeze/no rank writes; Continue full new clocks/gap4/preserved objects/duplicate noop; Quit final pair/saveonce; final5 no Continue.
- Initial no lives/hearts; idle catch at4*interval (stage1=3200ms) ends once/gap1/no respawn, normal result500ms gate/reduced immediate, stale callback cannot recatch. Expiry tied with NPC wins; earlier catch remains caught.
- Previous clear3 + stage1 replay failure records3/actual score, actualclear4 increases to4; fresh failure0. Zero ranking/order/timestamps/whole pair/currentaccount/TOP10. Immediate progress vs final rank, monotonic account isolation, corrupt/security/quota/legacy cleanup errors, validv4/audio/auth/other key preservation, oldv3 reset without deriving progress.
- Preserve rapid D/J/Space/no animation lock/one footstep per jump/one fall per mistake/native input protections/settings95s/pure route replay. Ready settings is now disabled, so settings tests must start play before opening it. Update only intentionally changed old lives/goals/cadence/storage expectations. Do not repair unrelated App.test.tsx or increase test timeouts to hide failures; if an out-of-list typed caller breaks TypeScript, make only the necessary caller type adaptation and document it.

## Acceptance Criteria

- [x] 400점 달성 후 사용자 선택까지 체크포인트가 멈추며 계속/종료가 연결된다.
- [x] 생명 없이 최초 잡힘에 종료하고 기록 단계0~5와 실제 점수를 v4에 저장한다.
- [x] 실제 클리어 진행도/계정 분리/저장 실패/구형 키만 정리가 동작한다.
- [x] 기존 경로·장애물·점프·오디오 호출·장면 계약과 지정 검증이 통과한다.

## Validation

- `npm test -- --run src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts`
- `npm run lint`
- `npm run build`
- Record actual16file results/build warning. Stage selection UI and250ms acceleration remain T02/T03; full browser signoff remains T04. No new dependencies/debug flags/unrelated App fixes/audibility claim.

## Commit Message

```text
feat(game): add checkpoint sessions and cleared-stage records

Plan: 2026-10-23-stage-checkpoints-and-fall-chase
Phase: P01-checkpoint-game
Task: T01-checkpoint-session-and-records

- Connect 400-point checkpoints and single-capture termination to the HUD
- Persist account progress and version-four cleared-stage ranking together
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `afafa68`

## Execution Notes — 2026-10-27

- Implemented dynamic 400-point checkpoint sessions, checkpoint-only Continue/Quit, five-stage final clear, single-capture termination at the last safe stair, and normal pursuit intervals 800/650/500/400/300ms.
- Added account-scoped monotonic progress and cleared-stage 0..5 v4 records. Actual clears save progress immediately; true termination compares the whole ranking pair once. Cleanup targets legacy v1/v2/v3 only.
- Connected modal focus/keyboard controls, frozen bonus clocks, two-card HUD, zero-stage labels, progress errors and account-keyed GameScreen mounting. Continue retains route/obstacle references; it does not resample or reset score.
- Updated only obsolete lives/automatic-promotion/cadence/goal/storage expectations. Kept route/obstacle/jump/audio/native-input regressions; added checkpoint, options, progress, StrictMode, zero-ranking and error coverage. No out-of-list production/type fixes were needed beyond the specified App account key.
- Validation: blueprint's exact 16 test files, 388/388 tests passed; npm run lint passed; npm run build passed; git diff --check passed. Build JS 548.68kB (gzip153.34kB), CSS54.49kB (gzip10.68kB). Existing >500kB chunk warning remains.
- No browser signoff or audible fall-sound claim. Stage selection UI is T02; 250ms fall acceleration is T03; integrated browser checks are T04. The unrelated App test expectations, older CSS cleanup and bundle splitting remain separate.
