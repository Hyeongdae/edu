# Task: T03 Timed Pursuer

## Status: done

## Goal

추격자가 플레이어 입력과 독립적으로 단계별 시간마다 실제 계단을 한 칸 올라오고, 무입력 상태에서도 잡힘/기회 차감/종료가 일어나게 한다. 실제 위치·시계·필요한 경로 보관·전진/잡힘 표시를 함께 연결한다. 오입력은500ms 정지만 벌점이고 즉시 NPC 전진은 제거한다. 장애물은 아직 연결하지 않는다.

## Decision Summary

- 간격1000/800/600/500/400ms. 성공 오르기/점프는 실제 거리만 벌리고 추격자를 같이 이동시키지 않는다. 시작/승급/잡힘 후 거리4, 기회는 시작·승급3/잡힘당-1이다.
- 설정은 추격 시계도 멈추며 일반 숨김 탭은 경과한다. 타이머 지연을 시간순으로 따라잡고 같은 시각의 단계 만료가 추격/입력보다 우선이다.

## Implementation

### I01. 독립 위치와 명시적인 추격 이벤트 상태

- Related Files:
  - `src/game/types.ts` :: PursuerMove, GameState; modify
  - `src/game/gameEngine.ts` :: create/start/reset/tick/applyInput/resumeGameAfterPause; modify
  - `src/game/stageRules.ts`, `src/game/stairRoute.ts` :: existing APIs; read-only

#### Details

- **Prerequisite contracts**: T01 has GameStage1..5, endReason caught|time-limit|cleared, stageEndsAt:number|null,90/75/65/60/50s/targets300..1500/getStageRule with probability.10/.20/.30/.40/.50 and pursuerStepIntervalMs1000/800/600/500/400. getStageSecondsLeft returnsnumber. Stage promotion refills3lives/distance4 and preserves score/route/bonus, last target clears. GameInput remains forward|turn here.
- T02 route includes steps `{index,column,direction}`, runs `{startIndex,length:1|2|3|5|6|7|8|9,kind:long|short,direction}`, rng/tailDirection/tailRunLength/tailRunKind/tailStepsRemaining/tailShortRunsRemaining. First right long starts1. advanceStairRoute(route,playerIndex,oldestRequiredIndex?) retains throughplayer+18 and any requested older prefix (defaultplayer-4), never recreates deleted nodes. getRouteStep validates actual nodes. stairObstacles is still standalone and unused by GameState.
- **Signatures & Types**:
  ```typescript
  interface PursuerMove { fromIndex:number; toIndex:number; atMs:number; }
  interface GameState {
    // Keep all existing status/stage/score/steps/lives/direction/route/bonus/recovery fields.
    pursuerIndex:number;
    pursuerDistance:number; // derived compatibility cache, stepsClimbed-pursuerIndex
    nextPursuerStepAt:number|null;
    lastPursuerMove:PursuerMove|null;
    captureCount:number;
    captureEndsAt:number|null;
  }
  // Existing exported engine signatures remain unchanged.
  function tickGame(state:GameState,nowMs:number):GameState;
  function resumeGameAfterPause(state:GameState,openedAtMs:number,closedAtMs:number):GameState;
  ```
- **Defaults/invariants**: ready pursuerIndex=-4,distance4,next=null,lastMove=null,captureCount0,captureEndsAt=null. Steps/index/captureCount are safeintegers, count>=0; playing must have stage deadline and finite nonnegative nextPursuerStepAt; ready/ended next=null. Actual pursuer node and needed recent move endpoints must exist. distance must equal playerIndex-pursuerIndex and>=1 at returned states (captures reset immediately). Invalid engine invariants throw RangeError rather than clamping. No separate Date.now/random inside pure engine.
- start ready→playing arms next=start+rule.interval as well as stage deadline. Non-ready starts don't rearm. Reset creates new route/ready defaults. Promotion after completed scoring sets pursuerIndex=completedPlayer-4,distance4,next=now+newinterval,lastPursuerMove=null,captureEndsAt=null,recovery=null,lastMistake=false; captureCount stays monotonic until reset. Final clear setsnext=null/lastPursuerMove=null/captureEndsAt=null and preserves actual completed score/route/event.

### I02. 시간순 tick, 잡힘과 pause

- Related Files:
  - `src/game/gameEngine.ts` :: pure scheduled-event reconciliation/private helpers; modify
  - `src/game/timedPursuit.test.ts` :: exact cadence/chronology/pause; new

#### Details

- **Tick flow**:
  1. Validate timestamp/invariants. For playing state repeatedly select earliest due timestamp<=now from stageEndsAt,eventEndsAt,recoveryEndsAt,captureEndsAt,nextPursuerStepAt. Do not move everything to now before processing prior captures. Same-time priority:stage deadline first (end immediately), then bonus/recovery/capture expiry, then pursuer move. Thus a previous fatal capture stays caught even if a later stage deadline was also missed; exactly tied deadline ends time-limit without another life loss.
  2. A scheduled pursuer step at t advances index by1 along the stored route regardless of player movement/mistake. lastPursuerMove={fromIndex,toIndex,atMs:t}; next=t+interval, never now+interval. Recompute distance. If index reaches player, resolve capture immediately in that same event, not only from applyInput.
  3. Capture: lives=max(0,lives-1),captureCount+=1,pursuerIndex=player-4,distance4,lastPursuerMove=null,captureEndsAt=t+500,recoveryEndsAt=t+500,lastMistake=false. If alive next=t+interval; if dead statusgame-over/reasoncaught/next=null. No score/steps/route/direction/bonus charge change. NPC keeps normal timing during capture recovery too; atstage5 a new step at+400 may occur before500ms recovery ends, so the display must finish at the current real pursuer position (I03), not force distance4 again.
  4. Continue reconciling all remaining due events; a long hidden wait may cause multiple actual captures and end with0lives. Stop logical movement immediately on game-over and never process extra life losses. Expire any elapsed cosmetic recovery/capture and bonus deadlines without overwriting the ended reason. At time-limit clear recovery/capture/mistake/move andnext, preserving current reached score/lives/position; do not invent a catch at the timeout instant.
  5. At final return ensure route retains oldest=min(player-4,pursuerIndex,lastPursuerMove?.fromIndex??pursuerIndex). Call advanceStairRoute only if trimming/extending is needed; no-op ticks keep same reference. Keep last move endpoints when currently needed for animation. Captures/promotions can trim old NPC history only after resetting to a node already retained by the mandatory4player history.
- **applyInput**: tick first, return if inactive/recovery. For correct D/J complete existing scoring/event/goal behavior, keep pursuerIndex and next unchanged unless promotion; derive new distance=landing-pursuerIndex and advance route with oldest as above. For wrong D/J set lastMistake=true/recovery=now+500 only; preserve index/distance/next/captureCount/score/route. No gap-1, no immediate catch/life loss and no synthetic NPC animation. Blocked inputs still call tick before guard so legitimate time can pass, but cannot restart fall recovery.
- **Pause flow**: tick exactly atopen first. If ended do not revive. For active state add max(0,closed-open) once to stageEndsAt/eventEndsAt/nextPursuerStepAt (nullable checks), then tick atclose. Recovery/captureEndsAt and lastPursuerMove.atMs are not shifted; those500ms/cosmetic windows elapse normally behind settings as existing recovery did. Ready stays unarmed. UI close ref protects double application. No input while settings open.
- **Errors/returns**: immutable deterministic state, invalid timestamps/nodes/index-cache mismatch throw RangeError; no browser API in engine, no max-gap cap, no nested mutable queue or loop that continues after terminal state. Runtime validation allows gap>4 and requires actual retained nodes.
- **Tests**: noinput firststep at1000/800/600/500/400 relative tostart; justbefore no-op; start/promotion/catch rearm full interval; one late tick equals incremental ticks at due boundaries. idle stage1 captures at4/8/12s, final at12s, recovery cleared after12.5s. stage5 capture at1.6s and nextstep2s during recovery ends2.1s. Exact tieddeadline takesprecedence, priorfatalcapture wins evenwhen caller now exceedsdeadline. Wrongkey499ms blocks/noNPCextra,500ms inputvalid after time reconciliation, success increases gap1. Promotion never rearms unless targetreallymet.
- Create long-gap fixture by route-only advance to player100 retainingoldest=-4, coherent direction/count/score299,pursuerIndex=-4,distance104,next=start+interval; proves90s timeout without earlier capture and old NPC history retained. Test100+ gap,monotonic trimming,immutable replay,stage4/5longlatecalls boundedbyremaininglives,bonus-expiry and capture boundary tie,pause no drift/double shift/expired-open,no hidden-tab free time.

### I03. Real pursuer movement, offscreen route and catch presentation

- Related Files:
  - `src/game/stairSceneModel.ts` :: ScenePursuerMotion, model fields/build/validation/catchFrames; modify
  - `src/game/StairScene.tsx` :: props/actor placement/own movement/catch endpoint; modify
  - `src/game/GameScreen.tsx` :: separate success/mistake/NPC effects, ticker, capture gate/help; modify
  - `src/game/pixel/pixel-scene.css`, `src/game/pixel-theme.css` :: independent NPC movement/reduced-motion; modify
  - `src/game/GameScreen.test.tsx`, `src/game/stairSceneModel.test.ts` :: actual positions and clocks; modify

#### Details

- **Model types**: add `interface ScenePursuerMotion {from:ScenePoint;to:ScenePoint;atMs:number;}`; StairSceneModel keepssteps/player/pursuer/catchFrames and adds `pursuerMotion:ScenePursuerMotion|null`, `pursuerVisible:boolean`. Use pursuerIndex as actorAt source; validate cache equality>=1, not<=4. Validate latest move toIndex==pursuerIndex/from+1==to and stored actual nodes; project both relative tocurrent player with x260+columnDelta*34,y216-indexDelta*28. No motion iflastmove=null.
- Base steps stayplayer-4..player+6 exactly11. pursuerVisible is sprite/stair bounds intersection withviewBox520×400 (x±34,y-88..y+16). For gap>4 with visible sprite render a dedicated real NPC stair+actor after base stair groups (distinct class, not an extra `stair-step` testid). Outside the view render no fake/clamped actor and retain actual index/distance metadata on scene. Distance label/aria always shows true gap. Engine route may holdmanymorethan11nodes.
- StairScene adds required isPursuerMoving:boolean; all callers including direct tests pass it. Pursuer pose/class depends only on this flag or capture, never isClimbing/lastMistake. Use a keyed outer `.pursuer-motion` wrapper outside feetclip with from-to offsets; existing transform translates final realpoint, wrapper240ms animates0%fulloffset/50%halfX,-8px/100%0. A corner changes facing using the destination's actual direction. Multiple late logical steps show only last adjacent step, never a straight line crossing multiple corners. Disable old duplicate pixel-pursuer-hop on the actor; keep existing catch CSS. Render movement overlay once if needed to avoid incorrect tile occlusion. No NPC sound.
- Catch gate derives captureEndsAt!==null with statusplaying orendReasoncaught. Don't infer from lastMistake/lives effects. captureCount is animation key; a late clearedcapture does not replay. Keep catchFrames offsets[0,.20,.40,.55,.70,.85,1] with behind[1,0,0,1,2,3,currentDistance]; finalpoint is current real NPC, so+400ms autonomous step duringstage5catch ends at3notforced4. Directions useactualnodes. Base actor muted duringcatch, runner once inexistingcatchoverlay. Actualplayer-4node remains retained for path frames.
- GameScreen separates effects: accepted steps change→one footstep/player300ms key; a new lastMistake+recovery token→one fall only; lastPursuerMove.atMs changes→NPC240ms key/flag; captureCount/EndsAt→catch display without playFall. Success no longer increments NPC key, and a mistake does not force an approach. A mistake cancels only the player motion; legitimate NPC motion continues. Capture/promotion/reset/terminal/unmount cancel superseded visual timers. Fatal catch saves once immediately and keeps the normal500ms result gate/reduced-motion immediate result. Time-limit/clear suppress stale capture. Use engine capture expiry and the own240ms visual timer rather than HUD whole-second nowMs to clear flags.
- Every playing state ticks100ms even without bonus/recovery, includes nextPursuerStepAt in active timers, and input/openSettings/visibility call tick at realtimestamp. Don't restart any engine deadline when interval effect resubscribes. nowMs may still optimize whole-second HUD updates while state ticks every100ms. UI must not freeze legitimate independent steps between score changes.
- Settings blocksD/J, pauses all3logicalclocks, and doesn't replay completed cosmetic animations after close. Necessary help says timedchase/mistake500ms/capturedcostlife/threecapturesend. No independent audio fix or unrelated CSS cleanup.
- Reduced-motion outer NPCwrapper transform/animationnone, idle pose, actual position and finalresult immediate; add wrapper to final themeoverride too. Catch/fall/normalplayer CSS semantics otherwise preserved.

### I04. Coherent legacy fixtures and focused regression

- Related Files:
  - `src/test/gameFixtures.ts` :: withPursuitAt; new test-only helper
  - `src/game/gameEngine.test.ts`, `src/game/GameScreen.test.tsx`, `src/game/stairSceneModel.test.ts`, `src/game/GameHud.test.tsx` :: new state fields/clock cases; modify
  - `src/game/timedPursuit.test.ts` :: true independent-clock tests; new as I02

#### Details

- **Helper**: `withPursuitAt(state:GameState,nowMs:number,distance=4):GameState` requires existing route node atplayer-distance, returnscopy withpursuerIndex=player-distance/distance, next=playing?now+getStageRule(stage).interval:null,lastPursuerMove=null,captureEndsAt=null,recoveryEndsAt=null,lastMistake=false; preservescaptureCount/otherfields. Reject missing history/invaliddistance/time withRangeError. Used only in test fixture setup, never inside engine or production props.
- Old wrongkey4times→capture expectations must become actual timedcatch tests, not mocks of output states. Old success→NPC+1 tests become success→NPCstationary until due time. invaliddistance5 is now valid withretainednode; invalid0/negative/fraction/NaN/missingnode/cachemismatchstillthrow.
- Existing bonus/goal/pause tests that set now=30000 or90000 cannot startwithNPC-4at0 then expectnocatch. For pure unrelated transition tests use coherent snapshots withwithPursuitAt and stage deadline still valid. UI timeout test startGame spy may use100msstagebudget/firstNPC1000ms to isolateexpiry; normalbudget tests still assert exact90/75/65/60/50s. Long truebudgetexpiry is covered by100gap enginefixture. Do not globally stub tickGame or disable pursuit to keep old tests passing.
- Add UI idlewait1000ms movesNPCwithoutD/J/footstep; wrongkeyat100ms noNPCmovement+onefall,500mswindowexpires, next1000msrealstep; actualthreecaptures→onesave/reasoncaught,500msresultgate/reducedmotion; timeoutduringcapture;capturedwithoutlastMistake;stage5stepduringcapture;settings95swaitnopursuit;visibilityjumpcanend/losswithoutinput;offscreenNPCdoesnotthrowanddistancecontinues;player/turn/jump-prep animations don'treplayonNPCticks. DirectStairScene renderpropsincludeisPursuerMoving.

## Acceptance Criteria

- [x] All five cadences and time-order boundaries work with no input and delayed/hidden reconciliation.
- [x] Successful moves widen gap; wrong input only stops player500ms; only real capture costs life.
- [x] Long retained history and offscreen true NPC positions work without gap clamping or fake scene actors.
- [x] Actual NPC steps/captures drive independent motion, result gate and one final save; settings pauses all logical clocks.
- [x] Legacy fixtures reflect valid new states without bypassing production pursuit. Obstacles are still standalone here.

## Validation

- `npm test -- --run src/game/stageRules.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairSceneModel.test.ts src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/leaderboard/leaderboard.test.ts src/audio/audioController.test.ts`
- `npm run lint`
- `npm run build`
- Full responsive browser evidence belongs to T05. Do not repair unrelated App.test.tsx or claim sound audibility.

## Commit Message

```text
feat(game): make the pursuer climb on stage timers

Plan: 2026-10-23-five-stage-obstacle-jump
Phase: P01-five-stage-game
Task: T03-timed-pursuer

- Reconcile autonomous pursuit captures and paused clocks in time order
- Preserve actual pursuer history and render movement independent of player input
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 42dab25
## Validation Results — 2026-10-23

- 지정 Vitest10파일:298/298tests,10/10파일 통과. 실제 Windows npm.cmd로 실행했으며 청사진 npm CLI와 동일하다.
- `npm run lint`: 최종 종료코드0. 초기 react-hooks/set-state-in-effect 지적은 NPC 모션 key/활성을 실제 이동 시각과 종료 시각에서 계산하고 timer callback만 상태를 갱신하도록 바꿔 해결했다. lint 규칙을 비활성화하지 않았다.
- `npm run build`: 최종 종료코드0, TypeScript/Vite 통과(206modules, JS537.79kB/gzip150.41kB). 기존500kB초과 청크 경고는 남아 있고 번들 분할/한도 변경은 하지 않았다.
- 모든 단계1000/800/600/500/400ms cadence, 실제 경과와 지연 tick의 동일 결과, 무입력4/8/12초 잡힘과 종료, 이전 잡힘/동시 단계 만료 우선순위, 보너스 만료와 잡힘 동시 처리/활성 보너스 보존을 검증했다.
- 성공은 NPC를 즉시 이동시키지 않고 실제 거리만 늘며 오입력은500ms 정지만 적용한다. 성공/실수/추격/잡힘별 오디오 호출을 분리하고 시간 잡힘으로 넘어짐 소리를 호출하지 않는 것을 검증했다.
- 100칸 이상 거리와 경로 보존/정리, 화면 밖 실제 NPC/추가 실제 계단, 자체 코너 방향/240ms 이동 wrapper/clip 위치, 플레이어300ms 모션과 간섭 없음,5단계 잡힘500ms 중400ms 후 NPC 전진과 같은 catch DOM 유지, 설정 pause/숨김 복귀/최종 저장1회/재시작을 검증했다.
- UI의 순수 시간 초과 테스트는 첫 잡힘 전에 끝나는 명시적100ms fixture를 사용하고 실제90초 경계는100칸 간격의 엔진 fixture로 검증했다. 실제 추격 tick을 전역 mock하거나 제품에 치트/초기 상태 prop을 넣지 않았다.
- 실제 브라우저/reduced-motion 육안/전체 App.test.tsx/실제 스피커 청취는 실행하지 않았다. CSS reduced-motion과 즉시 결과 공개 처리는 구현했으며 전체 브라우저 검증은 T05다. 장애물·점프는 T04에 남아 있다.
- 새 인접 결함 없음. 별도 넘어짐 소리 청취 문제/독립 App 기대값·옛 SVG CSS·번들 분할 정리는 임의로 합치지 않았다.
