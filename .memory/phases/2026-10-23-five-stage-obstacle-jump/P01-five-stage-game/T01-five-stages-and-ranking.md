# Task: T01 Five Stages and Ranking

## Status: done

## Goal

기존 D/J 게임을5단계의 제한시간/목표/최종 클리어로 확장하고 같은 한 판의 기록을 새v3 랭킹에 저장한다. HUD/결과와 저장 스키마도 한 번에 연결해 실행 가능한 중간 결과를 만든다. 긴·짧은 경로는 T02, 독립 추격은 T03, 장애물·점프 연결은 T04에서 구현한다. 여기서는 현재4~6칸/기존 추격을 유지한다.

## Decision Summary

- 단계별 시간90/75/65/60/50초, 누적 목표300/600/900/1200/1500점. 승급 시3기회/4칸 거리 회복, 점수·route·이벤트 유지.5단계 목표는 최종 클리어 종료다.
- 구형v1/v2 랭킹만 정리하고v3를 사용한다. 단계→점수→이른 달성시각 정렬/동점 개인 최고 보존/게임 종료1회 저장을 유지한다.
- 원 결정과2026-10-23 후속 결정 중 후자가 우선이다. 공통 표에 장애물10/20/30/40/50%, 추격1000/800/600/500/400ms를 준비하되 아직 연결하지 않는다.

## Implementation

### I01. 공통 단계 규칙과 엔진

- Related Files:
  - `src/game/types.ts` :: `GameStage`, `GameEndReason`; modify
  - `src/game/stageRules.ts` :: `StageRule`, `STAGE_RULES`, `isGameStage`, `getStageRule`; new
  - `src/game/gameEngine.ts` :: start/tick/input/pause/display helpers and existing constants; modify

#### Details

- **Signatures & Types**:
  ```typescript
  type GameStage = 1 | 2 | 3 | 4 | 5;
  type GameEndReason = "caught" | "time-limit" | "cleared";
  interface StageRule {
    readonly stage: GameStage;
    readonly durationMs: number;
    readonly targetScore: number;
    readonly obstacleProbability: number;
    readonly pursuerStepIntervalMs: number;
  }
  const STAGE_RULES: readonly StageRule[]; // exported
  function isGameStage(value: unknown): value is GameStage;
  function getStageRule(stage: GameStage): Readonly<StageRule>;
  function getStageSecondsLeft(state: GameState, nowMs: number): number;
  ```
  Other exported engine signatures stay createGameState(random?), resetGame(random?), startGame(state,nowMs),tickGame(state,nowMs),applyInput(state,input,nowMs),resumeGameAfterPause(state,openedAtMs,closedAtMs):GameState.
- **Data & Schema Fields**: Stage rules `(stage,durationMs,targetScore,obstacleProbability,pursuerStepIntervalMs)` are `(1,90000,300,.10,1000),(2,75000,600,.20,800),(3,65000,900,.30,600),(4,60000,1200,.40,500),(5,50000,1500,.50,400)`. isGameStage accepts exactly numeric integers1..5. getStageRule rejects invalid runtime values with RangeError. Keep existing STAGE_ONE_DURATION_MS/TARGET_SCORE as aliases of rule1 for valid callers/tests. T02 uses obstacleProbability; T03 uses pursuerStepIntervalMs. No old20/35/50/65/80% table may remain.
- **Existing GameState Contract**: status ready|playing|game-over; stage; stageEndsAt/endReason; score/stepsClimbed/lives/direction/straightStepsRemaining/pursuerDistance/eventSteps/eventEndsAt/recoveryEndsAt/lastMistake/route. Default stage1/endReason=null/stageEndsAt=null; no additional persisted game state. GameInput remains forward|turn and route remains4~6 in T01.
- **Execution Flow / Logic**:
  1. startGame validates finite nonnegative now and arms rule1 only on ready→playing; repeated start cannot rearm. Reset returns the original ready defaults.
  2. tickGame expires an active stage deadline for any playing stage1..5. Preserve the current event/recovery expiration, time-limit clears recovery/lastMistake without changing lives/distance/score/route. Ended caught/cleared reasons cannot be overwritten by a later deadline.
  3. applyInput keeps tick-before-input and recovery guards. Complete the existing correct one-step move and1/2point/event update first; compare against getStageRule(currentStage).targetScore. For stages1..4, advance exactly one stage, stageEndsAt=now+newRule.durationMs,lives3,distance4,endReason=null, retaining the completed score/route/event. For stage5 reaching>=1500, return status=game-over/endReason=cleared/stage5/recovery=null/lastMistake=false with the actual score and completed move. Do not cap score or create stage6/heal again at final clear.
  4. getStageSecondsLeft returns rule.stage duration in seconds for ready/no deadline,0 for time-limit or cleared, otherwise max(0,ceil((stageEndsAt-now)/1000)). Remove the stage2→null/unlimited branch. Do not add a separate React clock.
  5. resumeGameAfterPause retains its tick-at-open/no-expired-revival/add-one-pausedMs-to-both-deadlines/tick-at-close behavior for every stage. Ended cleared/caught/timeout states do not gain time; recovery still elapses normally. No Date.now or new random samples inside pure transitions.
- **Errors & Return**: invalid timestamps/stage access throw RangeError consistently; game actions remain immutable/deterministic and no-op ticks return same reference.

### I02. HUD/결과/최종 공개와 저장 계약

- Related Files:
  - `src/game/GameHud.tsx` :: props, formatStageTime, stage goal/time labels; modify
  - `src/game/GameScreen.tsx` :: catch gate, result reason, final save dependencies; modify
  - `src/game/StairScene.tsx` :: game-over scene hint; modify
  - `src/leaderboard/leaderboard.ts` :: version cleanup/schema validation; modify
  - `src/leaderboard/LeaderboardPanel.tsx`, `src/audio/*`, `src/auth/*`, pixel art/CSS :: current display/audio/auth; read-only

#### Details

- **Signatures & Types**: GameHudProps keeps state,eventSecondsLeft:number,scoreGain:number|null,scoreAnimationKey:number and changes stageSecondsLeft to required number. formatStageTime(number):string pads nonnegative whole seconds toMM:SS. GameScreen/LeaderboardPanel public props stay unchanged.
- **Display Flow**: read target from getStageRule(state.stage). HUD caption=`목표 {targetScore}점`; cleared caption=`모든 단계 클리어`, stage-time text=`클리어` when endReason=cleared, otherwise formatted number. All2~5stages show their timer, never `제한 없음`. Keep score-value/score-gain/stage-time/stage-value testids, timer aria-live=off, hearts/gauge and data-stage.
- Result keeps h2 `N점`, reached-stage paragraph, steps, save failure text/restart/ranking. Reason mapping:cleared→`최종 클리어!`,time-limit→`시간 초과`,caught→`추격자에게 잡혔어요`. Scene hint uses `최종 클리어 · 최종 점수 N점` only for cleared; old fatal-catch `게임 종료` queries remain valid.
- Define the catch display gate from the actual ended reason: suppress it for time-limit/cleared; a playing nonfatal capture and caught game-over still use the existing isPursuerCaught logic. Final clear must not inherit a stale capture delay/sound. Keep scoreSavedRef and existing save-on-game-over/BGM-stop logic, stage already included in payload/dependencies. No saving at intermediate promotion.
- **Leaderboard Schema** remains `{accountId:string,displayName:string,bestStage:GameStage,bestScore:number,achievedAt:string}`. Use shared isGameStage in stored-entry and save validation. Key=v3; legacy keys=[v1,v2]. Check/remove each present legacy key before readingv3, outside malformed-JSON catch. Repeated reads don't write an emptyv3/marker and don't remove validv3. No old-record import/stage inference.
- Preserve comparePerformance(stage desc then score desc), date asc tie, whole-pair best replacement and previous timestamp/name on equal/worse records. Legacy/read failure returns read[]/savefalse; failed write retains available oldv3 entries. Malformedv3 is best-effort removed/replaceable as existing. Audio/auth/unrelated storage untouched; never localStorage.clear.
- **Errors & Return**: storage errors keep game/results/restart and existing exact final failure copy. No new result/error modal or external service. This is the first implementation that activates the user-authorizedv1/v2 cleanup; do not manipulate real browser data while preparing the change.

### I03. Stage/ranking contract와 기존 fixture 갱신

- Related Files:
  - `src/game/stageRules.test.ts` :: all rule rows/type guards; new
  - `src/game/gameEngine.test.ts`, `src/game/GameHud.test.tsx`, `src/game/GameScreen.test.tsx` :: extend/replace stage fixtures; modify
  - `src/leaderboard/leaderboard.test.ts`, `src/leaderboard/LeaderboardPanel.test.tsx` :: v3/1..5/legacy fixtures; modify

#### Details

- All stage-rule rows and invalid stages0/6/string/null/NaN; no duplicate independent duration/goal arrays in UI.
- Engine table tests for stages1..4 at target-1 score→target/target+1, just-before deadline vs exact deadline; assert new deadline now+75/65/60/50s, one recovery reward and unchanged completed route/event. At stage5 test1499→1500/1501 clear, no stage6, no later inputs/promotions, exact-deadline failure. Include immutable replay, simultaneous bonus start and target, idle expiry for every stage, fatal caught reason remains caught past deadline, cleared pause/visibility remains ended.
- Replace tests that assert stage2 unlimited, stage2 deadline=null or arbitrarily late continuation: these expectations are intentionally obsolete. For stage2 fixtures supply a real deadline; only ready state has null. Existing pause tests use active stage2 deadlines and assert both shifts. Keep earlier time-limit/recovery/strict-save/restart guards.
- UI fast-stage fixtures: capture unmocked factory before vi.spyOn(gameEngine.createGameState), supply copied valid ready route/near-target score; for stages3~5 use a test-only startGame spy returning a coherent playing stage/deadline, not a production debug prop. A correctness test drives actual repeated promotions through pure engine too. Jump is not present yet.
- GameHud tests remove null/unlimited and old caption expectations; cover1..5 durations/goals,0timeout and cleared label, plus old score/hearts/event behavior. UI promotion now expects01:15 at stage2, not unbounded play after the old deadline. Stage2 late time now ends and savesstage2. Final clear saves stage5 once immediately, with no capture gate; restart returnsstage1/01:30.
- Ranking fixture helper bestStage type becomes GameStage. Replace invalid3 with invalid6; accept3/4/5. Stage5 outranks4 even with fewer points; whole-record replacement/ties/top10 unchanged. Preloadv1+v2+v3 and sentinel audio/auth/other keys; remove onlyold keys, keepv3 across StrictMode/remount/restart. Test cleanup failure for each old key separately, v3 get/write failure, corruptv3 key-aware mock (old keys returnnull). UI storage assertions usev3.

## Acceptance Criteria

- [x] All5 rules/clock boundaries/promotion rewards and final clear agree in engine/HUD/result.
- [x] Every saved stage1..5 validates in v3; only authorized old ranking keys are removed.
- [x] Settings pause, recovery/caught gate, bonus, StrictMode save and restart remain operational.
- [x] No obstacle/jump/pattern/independent-pursuit behavior is partially introduced here; all five rule rows already contain the final agreed numeric settings.
- [x] Listed tests/lint/build pass without restoring old unlimited-stage expectations.

## Validation

- `npm test -- --run src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/audioPreferences.test.ts`
- `npm run lint`
- `npm run build`
- Browser final visual checks belong to T05. Do not fix unrelated App.test.tsx or declare the full repository suite passing. Report the existing chunk warning separately from build errors.

## Commit Message

```text
feat(game): add five timed stages and reset stage rankings

Plan: 2026-10-23-five-stage-obstacle-jump
Phase: P01-five-stage-game
Task: T01-five-stages-and-ranking

- Share stage goals deadlines and final-clear rules across engine and HUD
- Validate stages one through five and replace only legacy ranking keys
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
## Validation Results — 2026-10-23

- 지정된 Vitest7파일:192/192통과,7/7파일통과. 실제 명령은 Windows npm.cmd로 실행했으며 청사진의 npm CLI와 동일하다.
- `npm run lint`: 종료코드0, 오류 없음.
- `npm run build`: 종료코드0, TypeScript 검사와 Vite 프로덕션 빌드 통과(206modules, JS531.47kB/gzip148.63kB). 이번 출력에 청크 경고는 없었다.
- 실제 엔진 입력으로1→5단계/최종클리어, 각 단계 마감 우선·보너스/초과점수·승급회복, UI 저장1회/재시작, v1/v2만 제거/v3·오디오·인증 보존과 저장 실패를 검증했다.
- 브라우저 육안/전체 App.test.tsx/실제 오디오 청취는 실행하지 않았다. 장애물·패턴·독립 추격은 후속 Task이며 여기서는 수치 표만 준비했다.
- 인접 새 결함 발견 없음. 기존 넘어짐 효과음 문제와 독립 App 기대값/옛 CSS 정리는 별도 상태로 유지한다.
