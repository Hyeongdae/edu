# Task: T02 Stage Scores Unlocks and Ranking

## Status: done

## Goal

1단계 클리어→그만두기→다시 시작에서2단계가 해금/기본 선택되고0점/목표200점으로 시작하게 한다. 모든 단계의0점 목표150/200/250/300/350, 체크포인트, 실제 도전 단계v5랭킹을 동시에 연결하여 새 버전에 서로 다른 점수 기준이 섞이지 않게 한다.

## Decision Summary

- 해금은 실제 최고 클리어 H의 다음 단계까지 `min(5,H+1)`이며 기본 선택도 이 값이다. 랭킹은 종료한 실제 단계와 그 단계 점수다. 이전 클리어 단계를 이번 랭킹에 물려주지 않는다.
- Continue는 점수0/다음 단계 온전한 시간으로 전환하며 경로/계단 수/장애물/이벤트·보너스 잔여시간을 보존한다. 구v4 진행도 이관 성공 뒤 구랭킹을 정리하고 새v5만 읽고 쓴다.

## Implementation

### I01. Stage rules, unlocks and final game model

- Related Files:
  - `src/game/stageRules.ts` :: `STAGE_RULES`, `getStageTargetScore`, new `getHighestUnlockedStage`, `isGameStage`, `isClearedStage` — modify
  - `src/game/types.ts` :: `GameState`, `GameStartOptions`, `GameStage`, `ClearedStage` — modify
  - `src/game/gameEngine.ts` :: `validatePursuit`, `createGameState`, `startGame`, `applyInput`, `continueGame`, `quitAtCheckpoint`, `resetGame`, `STAGE_ONE_TARGET_SCORE` — modify
  - `src/game/stairRoute.ts`, `stairObstacles.ts`, `stairSceneModel.ts`, `StairScene.tsx` — read-only; keep geometry/obstacle/scene contracts

#### Details

- **Signatures & Types**:

  ```typescript
  export type GameStage = 1 | 2 | 3 | 4 | 5;
  export type ClearedStage = 0 | GameStage;
  export interface GameStartOptions { stage?: GameStage; highestClearedStage?: ClearedStage; }
  export interface StageRule {
    readonly stage: GameStage; readonly durationMs: number; readonly scoreRequired: number;
    readonly obstacleProbability: number; readonly pursuerStepIntervalMs: number;
  }
  export function getStageTargetScore(stage: GameStage): number;
  export function getHighestUnlockedStage(highestClearedStage: ClearedStage): GameStage;
  export function createGameState(random?: () => number, options?: GameStartOptions): GameState;
  export function startGame(state: GameState, nowMs: number): GameState;
  export function applyInput(state: GameState, input: GameInput, nowMs: number): GameState;
  export function tickGame(state: GameState, nowMs: number): GameState;
  export function continueGame(state: GameState, nowMs: number): GameState;
  export function quitAtCheckpoint(state: GameState, nowMs: number): GameState;
  export function resetGame(random?: () => number, options?: GameStartOptions): GameState;
  ```

- **Data & Schema Fields — final GameState**:
  - `status:"ready"|"playing"|"checkpoint"|"game-over"`, `stage:GameStage`, `stageEndsAt:number|null`, `endReason:"caught"|"time-limit"|"cleared"|"quit"|null`.
  - `score:number` now means only current-stage points, initial0; `highestClearedStage:ClearedStage` is new, initial options highest or0, monotonic actual clears; `clearedStageThisRun:ClearedStage` initial0, maximum actually cleared during this run; `checkpointEnteredAt:number|null`.
  - Remove `recordStage` and `stageStartScore` from final type/creation/validation/callers/fixtures. No compatibility aliases or unused cumulative-score fields. Ranking uses `state.stage`; unlock/progress uses `state.highestClearedStage`.
  - Keep `stepsClimbed:number`, `direction:"left"|"right"`, `straightStepsRemaining:number`, `pursuerDistance:number`, `pursuerIndex:number`, `nextPursuerStepAt:number|null`, `lastPursuerMove:{fromIndex:number,toIndex:number,atMs:number}|null`, `captureCount:number`, `captureEndsAt:number|null`, `eventSteps:number`, `eventEndsAt:number|null`, `recoveryEndsAt:number|null`, `lastMistake:boolean`, `route:StairRoute`, `obstacles:StairObstacleState`, `lastMove:GameMove|null` with existing exact route/obstacle/move types unchanged. `GameMove.scoreGain` remains1|2|4; no lives.

- **Execution Flow / Logic**:
  1. Set scoreRequired150/200/250/300/350 in `STAGE_RULES`; retain duration90000/75000/65000/60000/50000, obstacle.1/.2/.3/.4/.5 and NPC800/650/500/400/300. Remove `STAGE_SCORE_REQUIRED`; derive `STAGE_ONE_TARGET_SCORE=getStageRule(1).scoreRequired`. `getStageTargetScore(stage)` validates via getStageRule and returns that row's target, not a start-score sum. Reject invalid runtime0/6/fraction/string/null/etc with RangeError.
  2. `getHighestUnlockedStage(H)` validates ClearedStage0..5 then returns min(5,H+1). No Math.max(1,H) fallback elsewhere for unlock/default. In create/reset validate stage1..5, highest0..5, stage<=helper(highest) before sampling randomness. Defaults stage1/highest0. Set state.highestClearedStage=highest, score0/clearedThisRun0/no clocks/new route+selected-stage obstacles/NPC-4.
  3. Validation replaces old record/start-score checks with highest0..5, clearedThisRun0..5, highest>=clearedThisRun, clearedThisRun<=stage, stage<=helper(highest), valid nonnegative integer score, and existing checkpoint/time/position invariants. Checkpoint requires stage<5, clearedThisRun===stage, highest>=stage, enteredAt nonnull/stage clock null/NPC clock null; noncheckpoint enteredAt null. Keep actual index/gap/time validation and RangeErrors.
  4. Successful input retains actual distance1/2, scoreGain1/2/4, bonus/gauge30physicalsteps, route/obstacle retention. Clear when updated score>=getStageTargetScore(current.stage). On clear set highest=max(existing highest,stage), clearedThisRun=max(existing,stage). Stages1..4 checkpoint with same just-cleared stage/actual score including overshoot; stage5 final game-over/cleared. No auto promotion and no sixth stage.
  5. Continue only from checkpoint. At now set stage+1, score0, checkpointEnteredAt null, lastMove null, recoveryEndsAt/captureEndsAt null, lastMistake false; preserve highest/clearedThisRun/route/obstacles/steps/direction/eventSteps. New stageEndsAt=now+newduration, NPC=player-4/gap4/next=now+newbase/lastNPCmove null. Shift nonnull eventEndsAt by max(0,now-checkpointEnteredAt) once. Do not reset route RNG, existing obstacle decisions, total stair count or event. Repeated Continue on playing state returns identity. Noncheckpoint Quit returns identity.
  6. Quit keeps checkpoint stage and actual score and ends quit; clears clocks/event/lastMove using existing semantics. Current stage80 failure saves stage/80, not previous stage/old score. Prior high clear5 and lower-stage1 replay still has highest5 but rank candidate1/current score.
  7. Maintain tick order and invariants: same-time stage expiry beats NPC/input; earlier fatal catch remains caught; one catch, safeNPC=player-1/gap1, captureEndsAt=actualcatch+500, normal/reduced result gates. Fall500ms/fast250ms/earlier pending step/recovery-end due step and settings pause logic unchanged. Tick/input during checkpoint identity, bonus display frozen at enteredAt.

### I02. Version-five ranking and conditional cleanup

- Related Files:
  - `src/leaderboard/leaderboard.ts` :: `LeaderboardEntry`, `readFromStorage`, `clearLegacyScores`, `readLeaderboard`, `saveBestScore`, `getTopScores`, validation/comparison helpers — modify
  - `src/leaderboard/LeaderboardPanel.tsx` :: record label — modify
  - `src/game/stageProgress.ts` :: T01 migration/read/save exports — read-only unless a required integration check proves a defect

#### Details

- **Signatures & Types**:

  ```typescript
  export interface LeaderboardEntry {
    accountId: string; displayName: string; bestStage: GameStage;
    bestScore: number; achievedAt: string;
  }
  export interface SaveBestScoreResult { entries: LeaderboardEntry[]; saved: boolean; error?: "storage-unavailable"; }
  export function readLeaderboard(storage?: Storage): LeaderboardEntry[];
  export function getTopScores(entries: LeaderboardEntry[], limit?: number): LeaderboardEntry[];
  export function saveBestScore(entry: Omit<LeaderboardEntry,"achievedAt">, storage?: Storage, now?: Date): SaveBestScoreResult;
  // Existing after T01, use supplied Storage consistently:
  export interface StageProgressEntry { accountId: string; highestClearedStage: ClearedStage; }
  export interface StageProgressMigrationResult { entries: StageProgressEntry[]; available: boolean; }
  export function migrateLegacyStageProgress(storage?: Storage): StageProgressMigrationResult;
  export function readStageProgress(accountId: string, storage?: Storage): {highestClearedStage:ClearedStage;available:boolean};
  export function saveStageProgress(accountId: string, clearedStage: ClearedStage, storage?: Storage): {highestClearedStage:ClearedStage;saved:boolean;error?:"storage-unavailable"};
  ```

- **Data & Schema Fields**:
  - New `stair-climb:leaderboard:v5`: JSONarray of above entries. Require nonempty accountId, string displayName, numeric integer bestStage1..5, number integer bestScore>=0, valid ISO-compatible achievedAt parse. Reject old0stage as a new record. Keep old duplicate-account parsing behavior and valid v5 values; do not synthesize v5 rows from oldv4.
  - Progress remains `stair-climb:stage-progress:v1`, `{accountId,highestClearedStage:0..5}` array. Oldv4 `{accountId,displayName,bestStage:ClearedStage,bestScore,achievedAt}` is used only by migration. T01 migration reads all accounts, merges maximum valid actual clears, writes full merged progress once if required and never removes source; available:false retains known entries on getter/read/write failure.

- **Execution Flow / Logic**:
  1. Resolve one target Storage in try/catch, passing this same instance to migration and rank access. Before cleaning rankv4 call migrateLegacyStageProgress(target). Only if available=true may remove rankv4. If false, leave v4 byte-for-byte intact for retry; continue to use v5 independently. Never let `clearLegacyScores` blindly include v4 before migration.
  2. Rankv1/v2/v3 can be cleaned as before but never contribute progress. Cleanup failure alone is nonfatal: retain failing key, retry next read/save, still read/write valid v5. Do not erase progress/v5/audio/auth/other keys to recover a cleanup error. No global clear, no reset marker that reinitializes valid v5 on refresh.
  3. v5 get failure returns []; missing/corrupt/invalid v5 follows existing safe-empty handling, removes only its own corrupt key if possible. v5 set failure returns previous entries/saved:false/error. Cleanup failure must not masquerade as a v5 write failure if v5 actually saved. If storage getter is blocked, read returns[]/save saved:false.
  4. Sort higher stage first, then higher score, then earlier achievedAt. Preserve entire prior pair/name/date on worse/equal comparison; update together on a better candidate. Validate save arguments before storage mutation. Invalid stage0/6/string or score negative/fraction/nonfinite throws RangeError. A stage3score10 beats stage2score200. Personal best, TOP10, current account highlight remain.
  5. `LeaderboardPanel` shows `${bestStage}단계`/`${bestScore}점` only; remove new-record0stage branch. Label still highest-record ranking/local browser, not global server leaderboard.

### I03. Screen integration, selection and score presentation

- Related Files:
  - `src/game/GameScreen.tsx` :: initialProfile/gameState initializer, readKnownHighest, handleSelectStage, handleShowStageSelection, progress/final-save effects, handleContinue, scoreGain effect, result/selection/checkpoint/help rendering — modify
  - `src/game/GameHud.tsx` :: target caption — modify
  - `src/game/StageSelectPanel.tsx` :: lock/summary/previous-progress messages — modify
  - `src/game/CheckpointPanel.tsx` :: prop schema/score text — modify
  - `src/game/pixel-theme.css` :: panel styles — read-only unless verified related wrap/access regression
  - `src/App.tsx` :: account-keyed GameScreen — read-only; preserve account remount behavior

#### Details

- **Signatures & Types**:
  - Keep GameScreenProps/AudioController signatures unchanged; no debug/skip/testing production prop.
  - StageSelectPanelProps stays `{selectedStage:GameStage,highestClearedStage:ClearedStage,onSelect:(stage:GameStage)=>void,onStart:()=>void,disabled:boolean,progressUnavailable:boolean}`.
  - CheckpointPanelProps becomes `{stage:GameStage,score:number,onContinue:()=>void,onQuit:()=>void,disabled:boolean,progressError?:boolean}`. Remove recordStage prop/import, not replace with a ranking baseline. Keep optional progressError from the previous accessibility fix.

- **Execution Flow / Logic**:
  1. InitialProfile reads new leaderboard and migrated current-account progress. `knownHighest` derives only from actual cleared progress, not new rank entries. Initialize createGameState(stage=helper(knownHighest),highestClearedStage=knownHighest). Migration read failure still yields known partial highest and guidance; no synthetic v5 inference.
  2. `readKnownHighest` maxes gameState.highestClearedStage, initialProfile.knownHighest and readStageProgress(current account).highestClearedStage; update progressUnavailable. Never use v5 bestStage or recordStage. Selection guards stage<=helper(highest), ready status/no started run/settings; same selected/locked click must not reroll preview or start a clock.
  3. Result's 다시 시작 returns ready default helper(knownHighest) with new route/score0/event0/no clocks. Start preserves ready route/decisions and only once arms selected time/NPC/BGM. StageSelect uses same helper for locked state, native buttons, focus, aria-pressed/labels. Show `이번 단계 0점부터 · 목표 ${getStageTargetScore(selectedStage)}점`; previous progress copy says `최고 클리어 ${highestClearedStage}단계` when positive, never that it becomes the ranking stage. Existing unavailable guidance may refer to known cleared progress, not new ranking as fallback.
  4. On actual new clearedStageThisRun persist gameState.highestClearedStage using old progressSavedRef account/cleared guard, keep failure message and in-memory unlock. During checkpoint no rank save. Game-over save uses bestStage=gameState.stage and bestScore=gameState.score once guarded by scoreSavedRef; preserve StrictMode duplicate protection. Ready selection never saves.
  5. Result says `기록 단계 ${gameState.stage}단계` and stage-local score; checkpoint says `이번 단계 점수 ${score}점` without inherited record text. Keep dialog focus/Tab/Escape non-choice/Continue-Quit target sizes and progressError inside scrolling dialog flow. Gear disabled for ready/checkpoint as before.
  6. HUD target uses getStageTargetScore(state.stage) and stage-local score. Update help to `각 단계는 0점부터 시작하고 목표는 150/200/250/300/350점이에요. 클리어하면 계속할지 선택할 수 있어요.` Remove active UI400점/누적목표 language.
  7. Continue's score decrease must cancel scoreGain timeout, remove old +gain/bonus scoring animation, and set previousScoreRef to0; lastMove null prevents previous jump replay. No footstep/fall/BGM stop-start or event-off/on from score reset alone. First actual new-stage success increments from0 and produces its own1/2/4 gain once. Preserve existing effect timer cleanup and ESLint React hooks rules; no synchronous state effect workaround/lint disable.

### I04. Regression fixtures and exact scenarios

- Related Files:
  - `src/game/stageRules.test.ts`, `gameEngine.test.ts`, `timedPursuit.test.ts`, `GameHud.test.tsx`, `GameScreen.test.tsx`, `StageSelectPanel.test.tsx`, `CheckpointPanel.test.tsx` — modify for new contracts
  - `src/leaderboard/leaderboard.test.ts`, `LeaderboardPanel.test.tsx` — modify for v5/ranking semantics
  - `src/game/stageProgress.test.ts` — extend T01 migration interactions only
  - `src/game/stairRoute.test.ts`, `stairObstacles.test.ts`, `stairSceneModel.test.ts`, `ControlButtons.test.tsx`, `src/audio/AudioControls.test.tsx`, `audioController.test.ts`, `audioPreferences.test.ts` — run; only coherent fixture adjustments if required
  - `src/test/gameFixtures.ts`, `obstacleFixtures.ts` — modify only to construct coherent new model; production chance generation unchanged
  - `src/App.test.tsx`, auth/audio implementation, package/config — read-only, separate App full-suite issues not expanded here

#### Details

- Fix all source/type/test recordStage/stageStartScore/STAGE_SCORE_REQUIRED/getStageTargetScore old arguments together. Test helpers that manually override stage must supply valid highest/clear state and stage clocks, not weaken validator or permit impossible unlocks.
- Movement/route retention tests can now reach150point checkpoint sooner. Construct coherent starting/loop states, explicitly continue when full progression is intended; do not lift production target to keep an old loop going. Keep real RNG obstacle tests and separate no-hit movement fixtures.
- Rules table exact five targets and all unchanged durations/probabilities/NPC; helper H0..5→1/2/3/4/5/5 and invalid input; engine accepts stage2 with H1, rejects stage3 with H1 before RNG, caps at5.
- Actual legal full progression with explicit checkpoints; stage1 end150..153 then stage2score0/target200, subsequent0/250/300/350; final5score350..353, not1250/2000. Bonus overshoot retained only at completed checkpoint; normal jump two points/bonusfour,30physicalsteps event28/29 triggers still covered.
- User reproduction: clear1→Quit→v5(1,actual150..153)→restartready2score0/unlocked1..2/3disabled→Start2score0/time75/target200. Reload/account switch preserves only own progress.
- Continue→stage2score0; construct/play to80 then end caught/time-limit→v5(2,80), highestCleared1, stage3locked. Similar3stage150 case with actual prior clear2. Test prior highest3 replay1 ending80 yields candidate(1,80); existing higher-stage personal best preserved, no baseline inheritance.
- Checkpoint Quit stays just-cleared stage score, selection not started cannot rank, earliest failure1score0 is valid. Last-stage clear immediate/no6 and catch500ms/reduced gate retained. One terminal ranking save in StrictMode, one actual-clear progress save apart from migration writes; pure reducer replay deterministic.
- Migration v4-only other accounts→progress preserved beforecleanup, v5-only high-stage row does not unlock, malformedv4/v5, v5 durable across refresh, legacy get/write/remove failure retries. v4cleanup only after full migration success; read/error cannot overwrite other accounts; v5 writes and progress errors handled independently. Audio/auth keys unchanged.
- Native/focused Space, rapid D/J/Space, mobile pointerdown/detail1click one action, Continue score reset no audio, first new gain correct, stale gain/jump timers cancelled. Checkpoint95sec/playing settings95sec/paused fall150ms remain explicit tests. Existing250/500ms exact ties/earlier100/one catch positivegap maintained.

## Acceptance Criteria

- [x] Single source of truth for targets and H+1 unlock; user clear1/Quit/retry flow opens2 at0point/target200.
- [x] Continue clears only stage score/obsolete move effects and preserves frozen route/event contracts.
- [x] Rank is actual stage/current-stage score, newv5 only, progress never inferred from new rank.
- [x] v4 progress/all accounts survive reset, failures keep legacy recovery source and memory unlocks.
- [x] All related tests/lint/build pass without skips, relaxed validators or dependencies/debug props.

## Validation

- `npm.cmd test -- --run src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts` — all17 pass, record actual count.
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`
- Source search: `rg -n "recordStage|stageStartScore|STAGE_SCORE_REQUIRED|400점|미클리어\(0단계\)" src/game src/leaderboard src/test` — no remaining active old model/rule; legacy test descriptions may explicitly name old inputs, inspect each hit rather than blind substitution.
- Document actual build size/warning; don't mark real browser/audibility/Entra/deploy complete. Browser evidence belongs to T03.

## Commit Message

```text
feat(game): unlock next stages and reset stage scores with version-five ranking

Plan: 2026-10-27-stage-unlocks-and-per-stage-scores
Phase: P01-stage-scores
Task: T02-stage-scores-unlocks-and-ranking

- Start each stage at zero with targets from 150 to 350 points
- Unlock cleared stages plus one and rank the actual attempted stage
- Reset legacy rankings after preserving cleared progress
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `f35254f`
- After success: mark done, record validation/hash, phase done2/3/T03 in_progress and current Active `T03-stage-score-browser-validation.md`. Do not mark plan complete before T03 actual browser acceptance.

## Validation Results — 2026-10-28

### Implementation

- `types.ts`/`stageRules.ts`/`gameEngine.ts`: `recordStage`/`stageStartScore`를 제거하고 실제 최고 클리어 `highestClearedStage`를 분리했다. 해금/기본 선택은 공통 `getHighestUnlockedStage`의0..5→1/2/3/4/5/5, 목표는 공통 규칙150/200/250/300/350이다. Continue는 score0/lastMove null로 전환하되 route/obstacles/계단 수/이벤트와 동결 시계를 유지한다. 기존 추격/넘어짐/점프/만료 우선 로직은 유지했다.
- `GameScreen`/`GameHud`/선택·체크포인트·랭킹 패널: 다음 해금 단계 기본 선택, 단계별0점/목표 안내, 실제 종료 단계·해당 점수 표시를 연결했다. 점수 증가 ref는 stage/score를 함께 추적해 단계 변경 후 첫 득점도0점부터 계산한다. 새 랭킹의 도전 단계는 해금이나 과거 클리어로 추론하지 않는다. 오류 문단은 기존처럼 스크롤 가능한 체크포인트 dialog 안에 있다.
- `leaderboard.ts`: v5에서1~5 실제 도전 단계만 기록한다. 옛v4 정리 전에 T01의 전 계정 진행도 이관을 호출한다. 이관 실패 시v4를 유지하고, 구키 정리 실패만으로 유효v5 읽기/저장을 막지 않는다. 동일/열등 기록의 단계·점수·이름·시각 보존과 TOP10 정렬을 유지했다. T01의 읽기 순서 관련 주의를 이 연결에서 해소했다.
- source/test18개 파일과 이 Task를 수정했다. App/auth/audio 구현, CSS, 패키지/설정, 실제 경로·장애물 생성기는 변경하지 않았다. 일반 브라우저 저장소를 도구로 직접 읽거나 지우지 않았다.

### Regression Evidence

- 1단계 클리어→Quit→다시 시작에서2단계 기본 선택/3잠김/0점/목표200/75초를 component 통합 검증으로 확인했다.
- 합법 엔진 입력을 배치해2단계80점/3단계150점을 획득한 뒤 종료시켜, 실제 후보(2,80)/(3,150), 직전 클리어 이력 유지, 다음 미클리어 단계 잠금을 검증했다. 과거 최고 클리어3에서 낮은1단계를 재도전해도 후보는1단계이며 기존 더 높은 개인 최고는 보존된다.
- Continue에서 이전 점수 알림/점프 연출이 지워지고 다음 성공+1/+2만 표시됨, 전환 자체의 발소리/실수/BGM/이벤트 중복 없음, 체크포인트95초·설정 대기·250/500ms 추격 경계·2칸 점프2/4점·보너스 게이지·단일 종료 저장을 유지했다.
- v4의 유효/잘못된 행 혼합·중복·다른 계정까지 진행도를 보존한 뒤 정리함, progress/legacy 읽기·쓰기 실패 때 원본 유지/복구 재시도, v4 remove 실패 후 유효v5 사용, v5만으로 해금되지 않음을 검증했다.
- 초기에 남은400점/기록0단계/옛 잠금/누적 점수 기대값과 fixture를 새 계약으로 고쳤다. 설정 동결 테스트는30회 SVG 개별 렌더로5초 제한에 걸려, 실제 엔진에서 합법 입력을 계산한 뒤 한 React 배치로 실행하도록 개선했다. 개별 입력/효과음 검증은 별도 기존 케이스로 유지하며 timeout 증가/skip/lint 완화는 없었다. 새 removeItem mock의 반환 타입 오류도 실제 Map.delete 반환값을 전달하도록 수정했다.

| Command | Actual result |
| :--- | :--- |
| 위 Validation의 정확한17파일 명령 | 최종17파일 **509/509 PASS**,58.36s. T01의469개에서40개 순증. |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS, exit0, `tsc --noEmit && vite build`, Vite8.3.5 |
| `git diff --check` | PASS |
| 위 source search | 옛 필드가 없음을 확인하는 `not.toHaveProperty` assertion2건만 남음. 활성 모델/규칙/안내에는 없음. |

- 빌드 JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB). 초기 빌드에서는500kB chunk 경고가 출력되었고 최종 로그에는 경고 문구가 없었으나 기존 초과 크기는 남는다. 경고 제한·번들 설정을 바꾸지 않았다.
- 로그 디렉터리: `C:\Users\DEX\AppData\Local\Temp\stair-stage-scores-t02-2026-10-28\`. 최종 `regression-17-files-final.log`, `lint-final.log`, `build.log`; 초기/수정 중 로그도 같은 디렉터리에 보관했다.
- 검증 환경은 Vitest/jsdom이다. 실제 브라우저 네 화면/확대/일반 사용자 시연은 T03에 남아 있다. 별도 App 전체 suite/스피커 청취/Entra 설정·배포/공용 서버 랭킹 완료로 표시하지 않는다. 새로 발견해 범위를 늘린 인접 구현은 없다.
