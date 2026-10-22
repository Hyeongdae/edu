# Task: T03 Stage HUD and Results

## Status: pending

## Goal
픽셀 게임 내부의 점수 옆에 남은 시간과 현재 단계를 표시하고, 종료 원인과 도달 단계를 결과에 연결한다. 모바일 HUD·설정·경로·결과 패널의 공간을 맞추고 시간/승급/랭킹의 전체 흐름을 검증한다.

## Decision Summary
- 1단계는 대기 중 `01:30`, 진행 중 올림한 남은 분:초, 시간 초과 시 `00:00`을 표시한다. 2단계는 `제한 없음`이며 별도 클리어 목표 없이 계속한다.
- 점수와 시간은 같은 카드의 인접 영역에 표시한다. 좁은 화면에서는 HUD를 두 행으로 구성하여 기회·보너스·우측 상단 설정과 함께 읽을 수 있게 한다.

## Implementation

### I01. 점수 옆 단계/초시계와 결과 데이터 연결
- Related Files:
  - `src/game/GameHud.tsx` :: `GameHudProps`, `GameHud`, private `formatStageTime`; modify
  - `src/game/GameScreen.tsx` :: engine helper import, HUD props, frame attributes, final-result summary; modify
  - `src/game/gameEngine.ts` :: `getStageSecondsLeft`; read-only
  - `src/game/types.ts` :: `GameState`, `GameStage`, `GameEndReason`; read-only

#### Details
- **Previous Task Contracts**:
  - T01 added `GameStage=1|2`, `GameEndReason="caught"|"time-limit"`, GameState.stage/stageEndsAt/endReason. Existing score/stepsClimbed/lives/direction/straightStepsRemaining/pursuerDistance/eventSteps/eventEndsAt/recoveryEndsAt/lastMistake/route/status remain.
  - `getStageSecondsLeft(state:GameState, nowMs:number):number|null` returns90 for ready stage1,0 for timeout, nonnegative ceiling seconds for other stage1 states, null for stage2. T01 owns all deadlines/promotion/expiry; this Task must not reimplement those rules in React.
  - `startGame(state, nowMs)` arms90s; `applyInput(state,input,nowMs)` ticks before scoring. A valid input reaching300 promotes once, preserves route/score/event and refills lives3/gap4. Stage2 has no deadline. Settings already pause both clocks and block input. Input/visibility/100ms interval reconcile absolute time; React nowMs changes on whole-second remainder changes or direct actions.
  - T01 `pursuerCatchVisible = isPursuerCaught && endReason!=="time-limit"` gates both frame and StairScene. Final caught result is hidden during existing500ms; timeout is immediate. Preserve normal/reduced-motion behavior.
  - T02 saves at game-over once with required bestStage, key=`stair-climb:leaderboard:v2`. Personal best compares stage then score as one pair; TOP10 additionally uses earlier achievedAt for ties. Only the old v1 ranking key is removed. LeaderboardPanel already displays stage and score.
- **Signatures & Types**:
  ```typescript
  interface GameHudProps {
    state: GameState;
    eventSecondsLeft: number;
    scoreGain: number | null;
    scoreAnimationKey: number;
    stageSecondsLeft: number | null;
  }
  function formatStageTime(secondsLeft: number | null): string;
  ```
  New stageSecondsLeft is required. Keep GameScreen public account/audio props unchanged. The formatting helper stays private and is tested through rendered HUD.
- **Data & Schema Fields**:
  - GameScreen passes `getStageSecondsLeft(gameState, nowMs)` to GameHud using its existing clock. HUD has no Date.now, interval or independent countdown state.
  - Preserve `.hud-card.score-card`, existing score label/value/gain/caption and testids `score-value`/`score-gain`. Group those score contents in `.score-summary`.
  - Add adjacent `.stage-clock` containing visible `N단계` (`data-testid="stage-value"`), `남은 시간` and `<strong data-testid="stage-time">`.
  - Stage clock has `role="timer"`, `aria-label="단계 제한시간"`, `aria-live="off"` to expose readable time without an announcement every second. Keep existing score feedback accessibility.
  - Time text: null→`제한 없음`; otherwise nonnegative whole seconds formatted as minutes=floor(seconds/60) and seconds=remainder, each padded to two digits. Do not round the helper's remaining seconds down early.
  - Goal caption is `300점 달성 시 2단계` for stage1 and `계속 도전 중` for stage2. No600-point target/third stage/final-clear copy.
  - Add `data-stage={gameState.stage}` to the existing frame, preserving status/catching attributes for integration assertions.
- **Execution Flow / Logic**:
  1. Ready shows0points/1단계/01:30 without countdown. Playing stage1 shows actual score and time adjacent; event retains its separate gauge/time.
  2. Promotion render shows2단계/제한 없음 with preserved score/event and full hearts. Persistent stage text communicates promotion; no new animation timer is required. Existing +1/+2 popup and success sound run once for the successful step.
  3. Result retains existing h2 `N점` and climbed-step paragraph so named queries remain valid. Add visible `도달 단계 N단계` and reason: `시간 초과` for time-limit, `추격자에게 잡혔어요` for caught. Stage2 is reached, never a final-clear award.
  4. Preserve restart, leaderboard, save-once/BGM-stop effects and caught reveal gate. Timeout during recovery must not inherit the caught result delay.
- **Error & Exception Handling**: keep the exact existing failure text `기록을 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.` and functional restart after failure. Null is the explicit unlimited-time sentinel, not an error or0. No new storage/network access.
- **State Transition & Return**: display follows engine state. No new status, debug prop, audio asset, difficulty, background or auth change.

### I02. 픽셀 HUD와 결과 패널의 반응형 공간 확보
- Related Files:
  - `src/game/pixel-theme.css` :: score/clock, HUD grid, existing media query, scene safe-space variables/heading, game-over panel; modify
  - `src/game/game.css`, `src/game/StairScene.tsx`, `src/game/stairSceneModel.ts` :: base styles and scene geometry; read-only
  - `src/leaderboard/LeaderboardPanel.tsx`, `src/audio/AudioControls.tsx` :: existing markup; read-only

#### Details
- **Current Layout Contract**:
  - Scope selectors to `.stair-game.pixel-theme`. Desktop HUD is top12/left12/right72 with width min(calc(100%-84px),960px) and3cards. Root --scene-top is9.5rem, --scene-bottom5.5rem (ready10rem); desktop scene heading top7rem.
  - Existing <=720px HUD is top8/left8/right60 with3narrow columns, scene top8.5rem/bottom9rem, heading6.25rem. Controls are60px and hidden at>=721px. Expanding HUD requires corresponding heading/path/result offsets.
  - Scene viewBox520×400,34×28 step projection, player foot260/216,4nodes behind+6ahead (11visible) remain. Do not change art/projection/route/tracking to place the timer.
  - Mobile result's `grid-template-rows: max-content minmax(280px,1fr)` prevents save-error/restart content overlapping ranking. Preserve this constraint and internal vertical scrolling.
- **Execution Flow / Logic**:
  1. Extend existing theme rules at their current sections; avoid repeated competing overrides. Desktop stays3cards; increase the score-card share (initial grid `1.7fr .85fr 1.7fr`), with two columns inside score-card for score-summary/stage-clock. Use tabular monospace digits.
  2. At<=720px HUD becomes2columns/2rows. Score-card spans both columns with score and clock adjacent; chances/event share second row. Keep right60px strip for44px settings target. Initial row sizes: score minimum72px, lower minimum60px; allow content reflow rather than clipping large text.
  3. Move direction/scene heading below expanded HUD (initial top9.5rem), increase mobile --scene-top (initial12.25rem) and result top (initial12rem). Tune these existing theme offsets using the four viewport checks so HUD/heading/projected path/result are disjoint. Desktop offsets may also increase if score-card contents raise HUD height. Values are starting geometry, not a substitute for checking bounds.
  4. Preserve bottom controls/hint space, ready start, full-frame layout, settings above HUD and focus outlines. Do not shrink touch targets or hide required controls with overflow to fix top overlap.
  5. Use min-width0 on flexible groups. Keep stage/time readable; long scores may scale/wrap in their group without pushing clock out. `제한 없음` must fit on320px. Timer/stage must not inherit the leaderboard score's narrow ellipsis rule.
  6. Preserve T02 leaderboard-record layout/internal scroll; result summary/error may increase max-content row height. Keep restart visible and ranking scrollable on667px screens rather than clipping behind controls.
  7. Preserve media-query ordering for hidden desktop touch controls and the existing theme-specific reduced-motion catch-result override. Mobile HUD styles must not reintroduce the500ms delay under reduced motion.
- **Error & Exception Handling**: no global body/font change, new layout state or ResizeObserver. Use existing theme safe-space variables; large text uses local reflow/internal scroll.
- **State Transition & Return**: root classes/pixel style remain. Settings is still a modal with native audio ranges; no extra HUD buttons.

### I03. 엔진·화면·랭킹·브라우저 통합 검증
- Related Files:
  - `src/game/GameHud.test.tsx` :: stage/time formatting and unchanged gauge/score/hearts; new
  - `src/game/GameScreen.test.tsx` :: stage/time/result integration; modify
  - `src/game/gameEngine.test.ts`, `src/game/stairRoute.test.ts`, `src/game/stairSceneModel.test.ts` :: engine/geometry regression; read-only
  - `src/leaderboard/leaderboard.test.ts`, `src/leaderboard/LeaderboardPanel.test.tsx`, `src/audio/AudioControls.test.tsx`, `src/audio/audioController.test.ts`, `src/audio/audioPreferences.test.ts` :: regression; read-only

#### Details
- HUD tests supply normal createGameState plus controlled stageSecondsLeft:90=`01:30`,61=`01:01`,1=`00:01`,0=`00:00`,stage2/null=`제한 없음`. Assert stage/goal text and semantic timer, not CSS snapshots. Keep score testids/+2 gain, hearts aria `남은 기회 N회`, and event progressbar0..30/status.
- UI uses fake timers/system time. Jump vi.setSystemTime(deadline) and run<=100ms to expire, not900 rendered SVG ticks. Include fractional-second start to guard against comparing wall-clock floor seconds rather than deadline remainders.
- For fast promotion capture the unmocked engine factory before a namespace vi.spyOn(createGameState). Return a copied valid ready state with score299/lives1/gap1/shared valid route. One correct D/J promotes; restore mocks afterwards. Cover normal299→300 and bonus299→301. No production debug button/route/initial-state API.
- Ready stays01:30 after waiting. Idle stage1 expires without input; exact-deadline input cannot score/climb/play a footstep/promote. Timeout shows00:00/reason/reached1 immediately and saves v2 once.
- Promotion shows2단계/제한 없음, restores3hearts, keeps score/route/event, and plays no fall/catch or BGM restart. Jump beyond old deadline: stage2 still plays; later fatal catches save reached2 once.
- Settings freezes both remaining times beyond90s, blocks D/J/touch, restores focus via close/Escape, resumes unchanged remainder, never double-extends or revives expiry. Existing native range keyboard controls/preferences remain functional.
- Final fatal catch still saves immediately but has500ms visual gate. Timeout bypasses that gate even with a previous nonfatal-catch timeout pending. Restart resets stage/reason/deadline to stage1/90s and consumes one random seed. StrictMode neither double-saves nor deletes v2.
- Browser checks use an isolated local-demo profile/storage and existing local auth mode, no new bypass. Viewports:320×667,390×667,768×1024,1440×900. Check ready, stage1, promotion/stage2, settings, timeout, fatal catch/restart and failed save. Record controlled-clock fixtures/automation, without production cheats to reach300.
- At every viewport: score/time adjacent/readable; gear disjoint; heading/11-node projected path clear of HUD/controls; touch sizes preserved; result/error do not obscure restart/ranking. Include keyboard focus, large text and normal/reduced-motion catch reveal. jsdom cannot prove bounding-box safety, so actual browser checks are required.
- v1+v2/audio/auth sentinel fixture keys belong only to isolated test storage. Verify only v1 removal and v2 persistence after reload/restart; never use localStorage.clear or fixtures in a general user profile.

## Acceptance Criteria
- [ ] 게임 안의 현재 단계와 점수 옆 시계가 대기90초/만료0초/2단계 무제한을 정확히 표시한다.
- [ ] 90초 안의 실제300점 승급과 시간 초과가 표시·저장 결과까지 일치한다.
- [ ] 설정창의 두 시계 일시정지, 보너스·오디오·D/J/터치·추격·재시작을 유지한다.
- [ ] 단계 우선 TOP10/개인 최고와 구형 랭킹 키만 초기화하는 동작을 통합 검증한다.
- [ ] 네 화면 크기에서 HUD/경로/설정/결과가 겹치지 않고 저장 실패 후에도 재시작 가능하다.
- [ ] 지정 회귀·lint·build가 통과하며3단계/최종 클리어/새 서버·아트·인증을 추가하지 않는다.

## Validation
- `npm test -- --run src/game/gameEngine.test.ts src/game/stairRoute.test.ts src/game/stairSceneModel.test.ts src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts` — all listed existing/new cases pass.
- `npm run lint` — pass.
- `npm run build` — pass; report existing bundle size warning separately from errors.
- I03 local-demo browser checks — record actual viewport/state results, method and any unverified limitation. Do not claim unrelated App.test.tsx fixes or full repository suite success.
- After all criteria pass, mark Task done, phase done3/3, Plan completed and current with no Active Task. Retain completion history; do not invent a next implementation task.

## Commit Message
```text
feat(game): show stage countdown and reached-stage results

Plan: 2026-10-22-timed-stage-progression
Phase: P01-timed-stages
Task: T03-stage-hud-and-results

- Place the stage timer beside the score in the pixel HUD
- Verify promotion timeout ranking and responsive flows
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
