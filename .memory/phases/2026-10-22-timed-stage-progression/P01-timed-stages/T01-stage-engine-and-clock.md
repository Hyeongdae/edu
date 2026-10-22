# Task: T01 Stage Engine and Clock

## Status: done

## Goal
게임 시작 후 90초 안에 300점을 얻으면 2단계로 승급하고, 미달 시 입력 없이도 종료되게 한다. 설정창 일시정지와 기존 보너스/잡힘 수명을 같은 엔진 시계에 연결한다. 이 Task 후 앱은 실행 가능하고 새 시간/승급 동작은 작동하지만 새 HUD/랭킹 표현은 T02/T03에서 완성한다.

## Decision Summary
- 시작은 1단계/90초, 실제 점수 300 이상이면 즉시 2단계/무제한으로 한 번만 전환하며 기회=3/거리=4를 회복한다. route·누적 점수/계단·보너스는 유지한다.
- 만료를 입력보다 먼저 처리하고, 설정 중 stage/event 시계를 멈춘다. 시간 초과는 잡힘 연출 없이 종료하며 최종 잡힘의 기존 500ms 공개 순서는 유지한다.

## Implementation

### I01. 단계 상태와 순수한 시간/승급 엔진
- Related Files:
  - `src/game/types.ts` :: `GameStage`, `GameEndReason`, `GameState`; modify
  - `src/game/gameEngine.ts` :: constants, `createGameState`, `startGame`, `tickGame`, `applyInput`, `resetGame`, `resumeGameAfterPause`, `getStageSecondsLeft`; modify
  - `src/game/stairRoute.ts` :: route helpers; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  type GameStage = 1 | 2;
  type GameEndReason = "caught" | "time-limit";
  interface GameState {
    // Existing fields retain their names and types.
    stage: GameStage;
    stageEndsAt: number | null;
    endReason: GameEndReason | null;
  }
  const STAGE_ONE_DURATION_MS = 90_000; // exported
  const STAGE_ONE_TARGET_SCORE = 300; // exported
  function createGameState(random?: () => number): GameState;
  function startGame(state: GameState, nowMs: number): GameState;
  function tickGame(state: GameState, nowMs: number): GameState;
  function applyInput(state: GameState, input: GameInput, nowMs: number): GameState;
  function resetGame(random?: () => number): GameState;
  function resumeGameAfterPause(state: GameState, openedAtMs: number, closedAtMs: number): GameState;
  function getStageSecondsLeft(state: GameState, nowMs: number): number | null;
  ```
- **Data & Schema Fields**:
  - Existing GameState fields: status=`"ready"|"playing"|"game-over"`, score/stepsClimbed/lives/straightStepsRemaining/pursuerDistance/eventSteps:number, direction=`"left"|"right"`, eventEndsAt/recoveryEndsAt:number|null, lastMistake:boolean, route:StairRoute.
  - New defaults: stage=1, stageEndsAt=null, endReason=null. `createGameState/resetGame` make ready state without starting a clock.
  - Active stage 1: stageEndsAt is the absolute start timestamp+90_000. Stage 2: stageEndsAt=null. Game-over retains its deadline (if any) for final display and keeps an explicit endReason.
- **Execution Flow / Logic**:
  1. `startGame` validates nowMs, only ready→playing sets stageEndsAt=now+90_000/endReason=null; repeated calls in playing/game-over return the same state and cannot restart a clock. The real ready state always starts stage 1.
  2. `tickGame` computes existing event/recovery expiration, then checks only `status==="playing" && stage===1 && stageEndsAt!==null && nowMs>=stageEndsAt` for time expiry.
  3. On time expiry return game-over/endReason=`"time-limit"`, recoveryEndsAt=null, lastMistake=false. Preserve score/steps/lives/pursuerDistance/route/stage and apply any already-due event expiration. Do not manufacture a fall or capture. Once game-over, later tick cannot replace its endReason or promote it; existing recovery may still expire for a caught result.
  4. `applyInput` keeps tick-before-input. If tick ends play or recovery remains, no scoring/movement/fall occurs. Wrong inputs keep the existing gap/life/500ms logic and set endReason=`"caught"` only when nextLives===0; otherwise endReason remains null.
  5. On a correct input compute the whole existing move first: one route node, +1/+2, direction/remaining, bonus gauge/expiry and recovery reset. If that completed result has stage===1 and score>=300, return it with stage=2/stageEndsAt=null/lives=3/pursuerDistance=4/endReason=null. No new route, score reset, event reset, third stage or repeated healing in stage 2.
  6. `resumeGameAfterPause` validates both timestamps and first calls tickGame(state, openedAtMs). If already ended, do not extend deadlines; tick that result at closedAtMs to finish any pending recovery. For still-playing state, add `max(0, closed-opened)` once to every non-null stageEndsAt/eventEndsAt, leave recoveryEndsAt unchanged, then tick at closedAtMs. Ready state does not acquire a clock.
  7. `getStageSecondsLeft`: stage 2→null; ready stage 1→90; time-limit result→0; other stage 1 states→max(0, ceil((stageEndsAt-nowMs)/1000)), using 90 only when ready/no deadline. Return a number or null, never NaN/negative. Validate nowMs with the engine's convention.
- **Error & Exception Handling**: finite non-negative timestamps only, otherwise RangeError. Use the existing route functions and their RangeError behavior. Do not call Date.now or consume random numbers in start/tick/pause/input; never mutate input objects/route.
- **State Transition & Return**: same-object return when no change is due; reset clears all new fields. A stopped caught game remains caught even if its original stage deadline passes during the 500ms recovery.

### I02. GameScreen 시작 시각·주기 갱신·설정 복귀와 기존 표시 호환
- Related Files:
  - `src/game/GameScreen.tsx` :: imports, `openSettings`, `closeSettings`, `handleStart`, `handleInput`, interval/visibility effects, catch display gate; modify
  - `src/game/GameHud.tsx`, `src/leaderboard/leaderboard.ts`, `src/game/StairScene.tsx` :: existing props/score save/art contracts; read-only

#### Details
- **Signatures & Types**: GameScreen public props stay account plus optional existing audio props. Reuse existing `settingsOpenedAtRef:number|null`, `isSettingsOpenRef`, state/ref names; do not add a separate paused GameStatus.
- **Data & Schema Fields**: no storage format changes in T01. `readLeaderboard/saveBestScore` remain v1 until T02; the score-only call remains valid for this checkpoint. HUD props remain unchanged until T03.
- **Execution Flow / Logic**:
  1. `handleStart` samples Date.now once into startedAt, resets score-save/error UI as now, calls `startGame(gameOver ? resetGame() : gameState, startedAt)` outside the React state updater and sets nowMs=startedAt. Keep restart's one random sample and BGM start.
  2. `openSettings` ignores duplicate opens, samples openedAt, ticks game at that timestamp before freeze, sets nowMs/openedAt ref/isSettingsOpenRef/UI as existing. This prevents an already-expired round being revived by opening settings.
  3. `closeSettings` takes the stored openedAt and closedAt once, clears refs/UI, updates nowMs, calls resumeGameAfterPause in the functional updater, restores focus. Replace the old event-only timestamp extension; do not extend at both open and close.
  4. `handleInput` also returns early while settings ref is true; keyboard/text-entry guards, disabled touch controls and focus trap remain intact.
  5. Maintain the single 100ms interval: run it only while not in settings and either a playing round has a stage/event deadline, or recoveryEndsAt is non-null. Dependencies include status/stageEndsAt/eventEndsAt/recoveryEndsAt/settings. Ready has no counter; stage 2 without bonus/recovery has none; final catch still receives its recovery tick.
  6. Each interval tick uses Date.now for tickGame. To avoid rerendering thousands of static SVG nodes ten times per second, update nowMs only when getStageSecondsLeft or the existing whole-second event remainder differs from the previous nowMs calculation; engine tick still runs every 100ms. Inputs/open/close/visibility always update nowMs immediately. Do not compare wall-clock floor seconds: round deadlines may start at fractional seconds.
  7. Keep the existing visible-document handler; if not in settings it updates nowMs and ticks immediately, so background expiration is enforced. Unmount clears existing interval/timeouts as before.
  8. Derive `pursuerCatchVisible = isPursuerCaught && gameState.endReason !== "time-limit"` and use it for both frame data-pursuer-catching and StairScene's isPursuerCaught prop. Existing mistake effect still distinguishes recovery tokens and decreasing lives; life refill at promotion must not produce fall/catch/audio. Timeout result is immediately available; actual final catch remains delayed by existing CSS/recovery.
- **Error & Exception Handling**: optional audioController remains optional. Existing storage failure handling stays operational. No extra countdown timers or browser APIs/libraries are introduced.
- **State Transition & Return**: stage/timer fields remain runtime-only, not in localStorage. No new HUD/result-copy changes, route generation, art or audio assets in this Task.

### I03. 엔진과 UI 회귀 검증
- Related Files:
  - `src/game/gameEngine.test.ts` :: helpers/start, stage/time/pause edge cases; modify
  - `src/game/GameScreen.test.tsx` :: idle expiry/settings/visibility/animation/storage regressions; modify
  - `src/game/stairSceneModel.test.ts` :: explicit start timestamp callsites; modify
  - `src/game/stairRoute.test.ts` :: route regression; read-only

#### Details
- All startGame calls in engine tests and three scene-model test fixtures now pass an explicit timestamp (0 is suitable for existing 100/1000ms inputs). Adapt `playingState(overrides)` to start a normal initial state at 0 then apply test overrides, so stage-2 fixtures are not accidentally armed as new stage 1 games. No changed behavior assertions should be removed.
- Test ready/no deadline, start at 1000→91000, repeated start non-reset, reset to ready, invalid time rejection and immutable/replayed pure transitions.
- Test score 299→300 and 299→301 at 90999ms promoting once; exact 91000/after boundary ends at unchanged score/route with no life loss; no-input tick ends play.
- Promotion with lives=1/gap=1 restores 3/4, preserves actual completed node, bonus gauge/end time, and later stage-2 inputs cannot heal again or expire at arbitrarily late timestamps. Cover promotion on the bonus-starting 30th step.
- Test recovery crossing deadline cancels fall/catch for timeout; final fatal catch just before deadline remains caught during subsequent recovery tick, not time-limit.
- Pause fixture: start1000/deadline91000, open11000/close46000 shifts to126000; active event end31000 shifts to66000. No double shift, no expired revival, ready/ended cases, elapsed recovery on close, and invalid timestamps.
- getStageSecondsLeft: ready90, 91000 deadline at90999→1, at91000→0, stage2→null. Display helper never alters state.
- UI fake timers: test idle timeout via vi.setSystemTime(deadline) plus at most 100ms progression; settings freeze beyond90s and resume preserved remainder; expire-on-open/exact-expiry input, visibility reconciliation. Do not advance 900 rendered interval ticks just to reach a deadline.
- For UI promotion, use a test-only vi.spyOn namespace `gameEngine.createGameState` returning a copy of a normal ready state with score299/lives1/gap1 and a valid route; retain the unmocked factory before installing the spy, and use existing restoreAllMocks cleanup. One correct D causes one footstep/+1 (or active bonus +2), no fall/catch, route+1 and restored hearts. No production debug controls or initial-state props.
- Keep existing strict-mode save/restart, final catch immediate save/500ms gate, true→true mistake replay, mobile controls, audio and settings focus tests. v1 key assertions are changed only in T02.

## Acceptance Criteria
- [x] 순수 엔진에서90초/300점 경계와 한 번만 가능한2단계 승급이 일치한다.
- [x] 무입력·백그라운드 복귀에도 만료되며 설정 중에는 stage/event 시계를 함께 멈춘다.
- [x] 승급 시 기회3/거리4를 회복하며 같은 경로·점수·보너스를 이어 간다.
- [x] 시간 초과는 즉시 결과를 공개하고 최종 잡힘은 기존500ms 연출을 유지한다.
- [x] 앱과 기존 테스트 호출부가 빌드 가능하며 후속 HUD/랭킹 계약을 유지한다.

## Validation
- `npm test -- --run src/game/gameEngine.test.ts src/game/stairRoute.test.ts src/game/stairSceneModel.test.ts src/game/GameScreen.test.tsx` — all existing and new cases pass.
- `npm run lint` — pass.
- `npm run build` — pass; existing bundle warning remains informational.
- No browser visual sign-off is claimed here: timer/stage presentation is T03. Do not execute App.test.tsx fixes or change test timeouts to mask failures.

## Commit Message
```text
feat(game): add timed stage progression and pause-safe clocks

Plan: 2026-10-22-timed-stage-progression
Phase: P01-timed-stages
Task: T01-stage-engine-and-clock

- Advance to stage two within the score and time limit
- Reconcile countdown pause expiry and catch lifecycles
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 위 Commit Message로 생성; 해시는 `.memory/current.md`의 Last Completed Task 참조.

## Validation Results — 2026-10-22
- 지정 Vitest 명령: 4 files / 107 tests passed (최종 실행 28.73s).
- `npm run lint`: exit 0.
- `npm run build`: exit 0; JS 529.00 kB / gzip 147.94 kB.
- `git diff --check`: 공백 오류 없음. Git의 LF→CRLF 안내만 출력됨.
- 검증 범위: 299→300/301 승급, 90999ms 허용/91000ms 만료 우선, 무입력/visibility/설정 진입 만료, 종료 후 불변, 승급 회복/보너스 보존, 두 시계 pause/resume와 회복 정리, StrictMode 저장/재시작 및 소수 초 시작의 남은 시간 갱신.
- 기존 v1 랭킹·HUD props·장면/픽셀 아트 계약 유지. 단계 저장/표시는 T02/T03에서 진행한다. 이번 Task에서는 브라우저 시각 검증과 범위 밖 App.test.tsx를 실행하지 않았다.
- 새 인접 결함 발견 없음. 기존 도움말/App 테스트 기대값·옛 SVG CSS·bundle 검토 항목은 이번에 변경하지 않았다.
