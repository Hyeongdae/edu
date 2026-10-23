# Task: T04 Obstacle Jump Gameplay

## Status: done

## Goal

T02의 장애물 결정을 실제 게임 상태/충돌/Space/모바일 점프/픽셀 상자에 함께 연결한다. 점프는2칸과2·4점으로 처리하고 빈 점프/장애물 충돌은 기존 실수로 처리한다. 전용 공중 아크는 T05에서 완성하되 이 Task 후에는 보고 피할 수 있는 완전한 조작 규칙이 동작해야 한다.

## Decision Summary

- 다음 칸이 장애물이고 같은 직선의 비어 있는 그다음 칸이 있으면 점프 성공. 모퉁이 점프/자유 점프/점프 완료 대기 입력 잠금을 추가하지 않는다.
- 모바일은 앞으로 / 방향 바꾸기 / 점프, 뒤 두 버튼을 가깝게 둔다. 한 물리 입력을 중복 실행하지 않고 일반 점프2점과 보너스 점프4점을 구분한다.

## Implementation

### I01. GameState와 점프/충돌/이벤트 전이

- Related Files:
  - `src/game/types.ts` :: GameInput, GameMove, GameState; modify
  - `src/game/gameEngine.ts` :: create/reset/start/tick/applyInput; modify
  - `src/game/stairObstacles.ts`, `src/game/stairRoute.ts`, `src/game/stageRules.ts` :: T01/T02 APIs; read-only

#### Details

- **Previous Contracts**:
  - GameStage1..5; status ready|playing|game-over; reasons caught|time-limit|cleared. Rule rows `(durationMs,targetScore,obstacleProbability,pursuerStepIntervalMs)` are90000/300/.10/1000,75000/600/.20/800,65000/900/.30/600,60000/1200/.40/500,50000/1500/.50/400. getStageRule validates stage; getStageSecondsLeft returns numeric ceiling seconds; HUD displays cleared separately.
  - Existing state fields status/stage/stageEndsAt/endReason/score/stepsClimbed/lives/direction/straightStepsRemaining/pursuerDistance/eventSteps/eventEndsAt/recoveryEndsAt/lastMistake/route plus T03 pursuerIndex:number,nextPursuerStepAt:number|null,lastPursuerMove:{fromIndex,toIndex,atMs}|null,captureCount:number,captureEndsAt:number|null. pursuerDistance is exactly stepsClimbed-pursuerIndex, not capped4. Start/respawn gap4. Success doesnot move NPC, wrong input doesnot move NPC. Only tick scheduled movement changes it, even during500ms fall recovery.
  - Route nodes have index/column/direction; full runs `{startIndex,length:1|2|3|5|6|7|8|9,kind:long|short,direction}`, RNG/tailDirection/tailRunLength/tailRunKind/tailStepsRemaining/tailShortRunsRemaining. Long5..9 followed by1or2short1..3, opposite direction each run and adjacent short lengthdifferent. advanceStairRoute(route,index,oldestRequiredIndex?) retains throughindex+18 and requestedolderhistory; use oldest=min(player-4,pursuerIndex,lastPursuerMove?.fromIndex??pursuerIndex), never drop NPC history todefault4.
  - Obstacle state `{rngState:number,runs:readonly StairObstacleRun[]}` records `{runStartIndex,runLength,kind,direction,stageAtGeneration,obstacleIndex:number|null}`. createObstacleState(route,stage) makes player0 visible decisions from mixed route seed withnoMathrandom. revealObstacles(state,route,playerIndex,stage) preserves existing decisions, decides previously unseen starts<=player+6 using2LCGdraws/run, prunes end<player-4. Shortalwaysnull; longpositions2..L-1/max1. hasObstacle only reads recorded index; historical<=0false. No retesting old empty decisions on promotion.
  - tick reconciles due events chronologically; tied stageexpiry before NPC movement, every due NPC step/capture beforeinput. Earlier fatalcapture surviveslaterexpireddeadline. Capture resetsNPCplayer-4/lives-1/recovery+capture500ms/lastMistakefalse/captureCount+1; next=catchAt+interval ifalive. Settings shifts stage/event/NPC deadlinesonce; recovery/capture500mselapse. Promotion completesmove thenrestores3lives/gap4 andnewstage+NPCdeadlines, preservingroute/score/bonus. Stage5>=1500 clears and stopsNPC. Onlytermination savesv3once; oldkeys onlycleanup.
  - Scene base11nodes/playercentered; actualNPC may be outsidebasewindow/screen, modelhaspursuerVisible/pursuerMotion, propsincludeisPursuerMoving. Independent NPC motion/realcatch gate already exist. Preserve them during jump integration.
- **Signatures & Types**:
  ```typescript
  type GameInput = "forward" | "turn" | "jump";
  interface GameMove {
    kind: "climb" | "jump";
    fromIndex: number;
    toIndex: number;
    scoreGain: 1 | 2 | 4;
    isBonus: boolean;
  }
  interface GameState {
    // Existing fields retain their names/types.
    obstacles: StairObstacleState;
    lastMove: GameMove | null;
  }
  ```
- **Execution Flow / Logic**:
  1. createGameState constructs the normal route once, obstacles=createObstacleState(route,1),lastMove=null. reset returns that new ready state; starting keeps the same preview/obstacles and clears stale move metadata. Do not call Math.random again for obstacles or inside input updaters.
  2. applyInput first calls tickGame. Inactive/recovery returns without movement/new move/sound. Read next route node. For forward require same direction and no obstacle. For turn require a real corner and no next-node obstacle. For jump require obstacle at next index, next and landing index+2 both equal current direction and landing unoccupied; no direction auto-switch. All other recognized wrong inputs use the same mistake path.
  3. Wrong input sets lastMove=null/recovery=now+500/lastMistake=true only. Preserve the post-tick NPC index/distance/next clock/lives/captureCount and route/obstacle/score/steps/event objects. Empty jump and attempted forward onto a box are one error, not two; no gap-1 or extra chase step. A blocked input can still reconcile legitimate elapsed NPC time through the initial tick, but never restarts fall or invents another penalty.
  4. Successful distance1forforward/turn,2forjump. Compute actual landing/direction and count remaining straight stairs. Keep post-tick pursuerIndex andnext unchanged unlesspromotion; distance increases1/2. Advance route once with oldest=min(landing-4,pursuerIndex,lastPursuerMove?.fromIndex??pursuerIndex). Physical stepsClimbed is landing node, not an action counter.
  5. Snapshot event active after tick. Gain=distance*(isBonus?2:1). If inactive adddistance to eventSteps, threshold>=30 resets0 and sets now+30000; no excess carry or mid-jump new multiplier. Active event keeps its existing gauge/deadline. At an exact event expiry, jump gives2 and charges2, not4.
  6. Store lastMove with correct kind/from/to/gain/isBonus; apply T01 goal/promotion/final-clear rule after the entire move. Then call revealObstacles on the new route/landing with the resulting stage (also stage5 for a final-clear move). Old decisions persist; newly exposed segments use the new stage. Failures/no-op ticks never reroll.
  7. Time-limit and actual capture set lastMove=null, independently of lastPursuerMove. Normal NPC steps/event/recovery ticks don't invent a player move or clear a completed move merely because NPC advanced; source step endpoints remain inmandatory4history. Finalclear retains completedmetadata but stopsNPC/blocksinput. T05 gates animation atterminalstatus. Reset clearsmoves/obstacles. No-op identity remains when nochange.
- **Errors & Return**: route/obstacle/time validators keep RangeError behavior; no missing-node fallback or mutable maps shared outside state. Pure replay of the same state/input/time returns equal output and never consumes global random. No jumpEndsAt/extra recovery period is introduced.

### I02. 빠른 Space와 세 개의 화면 버튼

- Related Files:
  - `src/game/GameScreen.tsx` :: keyboard handler, ControlButtons callbacks, score feedback, instruction/footer; modify
  - `src/game/ControlButtons.tsx` :: props, action handlers, turn/jump group; modify
  - `src/game/pixel/PixelIcon.tsx` :: PixelIconName/ICON_PATHS; modify
  - `src/game/GameHud.tsx` :: scoreGainIsBonus prop/class; modify
  - `src/game/pixel-theme.css` :: grouped controls/jump button/responsive instruction; modify

#### Details

- **Signatures & Types**:
  ```typescript
  interface ControlButtonsProps {
    onForward: () => void;
    onTurn: () => void;
    onJump: () => void;
    disabled: boolean;
  }
  // Add to GameHudProps (existing other props remain):
  // scoreGainIsBonus: boolean;
  ```
- Keyboard keeps D/J existing mapping. Add Space by `event.code==="Space" || event.key===" "`. Preserve early settings/text-entry guards, respect defaultPrevented, and leave Space on native buttons/role=button to their native keyboard activation. For Space on the game surface call preventDefault, ignore event.repeat and dispatchjump once. Existing D/J repetition convention is unchanged. Do not map letters in text fields or native audio ranges to jump.
- ControlButtons DOM order:forward button, `.control-actions` group containing turn then jump. Jump label=`장애물을 뛰어넘기`, visible label=`점프`, new PixelIcon jump. Parent region `게임 조작`, existing forward/turn labels and disabled behavior stay stable.
- For all3action buttons use immediate primary left/touch pointerdown (preventDefault then action) and a click handler that accepts only detail0 keyboard/assistive/programmatic activation. Pointer-generated detail>0 click must not call action again. Reject disabled/nonprimary/nonleft down; pointercancel/up do not schedule an extra action. No delayed action/debounce/cooldown. Native disabled still applies.
- New PixelIconName jump has16×16 upward arrow/ground glyph; path can be `M7 1h2v2h2v2h2v2H9v5H7V7H3V5h2V3h2ZM1 14h14v2H1Z`. Keep aria-hidden/focusable=false icon conventions. No bitmap/image generation/dependency.
- Mobile `.game-controls` remains hidden>=721px. At<=720px use outer columns minmax(0,1fr) minmax(0,2fr),gap12px; `.control-actions` is2equal columns,gap4px. Normal buttons remain min-height60px/min-width56px, touch-action:manipulation, labels can wrap. Apply jump border/background in existing pixel-gold palette while turn keepspink. Avoid child display overriding the desktop parent hide. Do not shrink targets to fit320px; final expanded-text geometry is checked in T05.
- Score feedback: add scoreGainIsBonus state snapshot in GameScreen; on real score increase snapshot `lastMove?.isBonus===true`, keep amount from actual score delta and existing popup key/timer. Pass bool to HUD; `.is-bonus` derives from bool, never amount===2.4point gain uses existing numeric aria-label. Include the primitive bonus snapshot/lastMistake dependencies deliberately; if the effect reruns without an increase, clear its old timer and popup so cleanup cannot leave feedback forever. Do not depend on a new lastMove object every100ms.
- Update necessary instructions/footer to show D/J/Space and empty jump/box contact as500ms mistakes, mobile jump label, while preserving T03 timedchase/threecaptures explanation. Stage/time/result labels stay intact. No unrelated help refactor.
- Audio: use existing successful stepsClimbed increase effect once per jump action, not twice; failures reuse existing fall invocation. No new sound, volume boost or claim that the separately reported missing fall sound is fixed.

### I03. 판정과 일치하는 장애물 표시 및 안내

- Related Files:
  - `src/game/pixel/PixelObstacle.tsx` :: PixelObstacle; new
  - `src/game/StairScene.tsx` :: recorded obstacle render/next warning; modify
  - `src/game/pixel/pixel-scene.css` :: static obstacle skin if needed; modify only scoped rules

#### Details

- **Signature**: `function PixelObstacle(): ReactElement` returns a fixed pixel office box. Parent handles projection; obstacle rendering does not sample random/read storage/handle collision.
- Box local boundsx[-12,12],y[-34,-12] above the stair top, dark outline#151d32, orange faces#e29b58/#ffd27a, light tape#fff0bc. Use rect/path shapes with integer coordinates and crispEdges, aria-hidden=true. It is one kind with no animation/behavior differences.
- StairScene reads hasObstacle(state.obstacles,step.index). Each actual drawn box has testid=`stair-obstacle` and data-route-index, in a translated `<g>` at step.x/y; retain the existing11stair-step IDs/route indices. Render box after tile top/before its front; do not hide player/next route behind giant art.
- Show boxes on future nodes index>player. While a successful jump's existing isClimbing window is true, also keep the jumped box at lastMove.fromIndex+1 visible if that move landed at current player. Passed boxes otherwise leave the active scene, so pursuit does not appear blocked by a historical box; retained decision data is not rerolled/deleted for this visual cleanup.
- Next-step box takes route-direction message=`장애물! 점프하세요` and a scene hint mentioning Space/점프; existing corner/straight text stays when clear. Ready/terminal/fall hint priority stays as existing, with T01 cleared variant. Add next-obstacle meaning to scene aria-label. No obstacle can be displayed only on one independent array while engine checks another.
- At this checkpoint successful jump uses existing generic climb feedback for300ms, one physical2node state advance. Dedicated arc/overlay/body pose are T05; no temporary production test props or additional animation delay.

### I04. 예측 가능한 회귀 fixture와 새 조작 테스트

- Related Files:
  - `src/test/obstacleFixtures.ts` :: makeObstacleFixture/withObstacle; new test-only helper
  - `src/game/gameEngine.test.ts`, `src/game/GameScreen.test.tsx`, `src/game/stairSceneModel.test.ts` :: legacy isolated generation fixtures and new cases; modify
  - `src/game/ControlButtons.test.tsx` :: immediate/single activation; new
  - `src/game/GameHud.test.tsx` :: bonus flag/4point fixture; modify
  - `src/game/stairObstacles.test.ts` :: real seeded generator; read-only

#### Details

- Test helper signatures: `makeObstacleFixture(route:StairRoute,playerIndex:number,stage:GameStage,previous?:StairObstacleState):StairObstacleState`; select exposed runmetadata, retain kind, preserve matching existing hits/null, fill absent withnull/currentstage, previousRNGor0. `withObstacle(state:GameState,index:number):GameState` copies state/obstacles/list after validating containing run.kind=long and interior/same-direction takeoff+landing; never inserts into short. Use T03 test-only withPursuitAt(state,nowMs,distance=4) for coherent time snapshots: copies actualNPCindex/cache,next=now+stageinterval,lastPursuerMove/capture/recoverynull,lastMistakefalse, allrequirednodesmustexist. No production override.
- Existing engine/UI/scene movement tests assume every straight D is correct and often count exactly30one-node inputs. In those test files beforeEach, spy createObstacleState/revealObstacles to these coherent no-new-hit fixtures; restore mocks after each test. New collision tests explicitly insert obstacles; real chance/stability tests in stairObstacles.test.ts remain unmocked, as does final browser execution. Do not weaken30step expectations or silently let random obstacles stall old tests.
- Concrete base fixture: first long5(seed0), start thenplayer1, box2/landing3clear. SnapshotNPCnext after testinputtime. Jump→player3/score+2/event+2/samefacing/sameNPCindex/gap+2, lastMovefrom1to3; no globalrandom. Activeevent+4/expired+2. WrongD/J/emptyjump/cornerjump/occupiedlanding produce no score/move andone500msrecovery, no immediateNPCchange. A valid generator never creates occupiedlanding, but explicit invalid-action fixtures can verify engineguard without weakening generatorvalidators. Repeatedrecoveryinput addsnothing; naturally due NPC movesstilloccur. Exactduecatch beforeSpace preventsescape/gain; no jumpreveal aftercapture.
- Test eventSteps28/29 jump→+2/new30s/reset0, active gauge not recharging;299/599/899/1199/1499 jump over target and preserve actual score, reward or cleared; exact stage deadline blocks jump. Newly revealed runs after a promoting jump use newstage, prior decision references staystable. Ended play never generates another movement.
- UI validbox2fixture, D thenSpace assert1→3/onefootstep/+2/NPCindexunchangeduntilclockdue/gap+2. Normal2notbonus/active4bonus/eventclimb2bonus. Two accepted actions within300ms prove no input lock. EmptySpaceonefall/repeatnoextra;setting/text/nativebuttonSpaceprotected. Mobilepointerdown+detail1clickonce/detail0once/disabled/nonprimary/rightignored. Test timerstep during jump, captureinterrupts pending jump/one save, and snapshot/dependencycleanupdoesn't freeze animation whenonlyNPCstatechanged.
- If jsdom lacks PointerEvent fields, install/restore an appropriate test-only constructor/polyfill in ControlButtons tests; don't change application event semantics to satisfy unsupported synthetic defaults. For pointer sequence assertions pass primary/button fields explicitly.
- HUD test callers supply new required scoreGainIsBonus prop; preserve all prior stage/time/hearts/gauge queries. Mock audio calls demonstrate invocation counts, not audible speaker output.

## Acceptance Criteria

- [x] Visible boxes and actual Space/forward collision use the same stable recorded state.
- [x] Successful jump advances2real nodes, gives2/4points and correct event/promotion; wrong/blocked inputs follow existing recovery rules.
- [x] Space and3mobile buttons respond immediately without duplicate native/pointer activation.
- [x] General2point jump is not mislabeled bonus;4point popup and existing audio counts are correct.
- [x] Old movement regression tests are deterministic while actual generation is covered unmocked separately.

## Validation

- `npm test -- --run src/game/stageRules.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/audioController.test.ts`
- `npm run lint`
- `npm run build`
- Visual full-flow sign-off remains T05. No game debug flags/new packages/real storage fixtures/App.test.tsx repairs.

## Commit Message

```text
feat(game): connect obstacle jumps to keyboard and touch gameplay

Plan: 2026-10-23-five-stage-obstacle-jump
Phase: P01-five-stage-game
Task: T04-obstacle-jump-gameplay

- Integrate shared obstacle state with two-step movement and collision penalties
- Add immediate Space and grouped mobile controls with accurate bonus feedback
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: 7a61ed2

## Validation Results — 2026-10-23

- 지정 Vitest12파일335/335tests 통과, `npm run lint`/`npm run build` 종료코드0.
- TypeScript 검사와 Vite208modules 빌드 성공. CSS53.11kB/gzip10.47kB, JS542.45kB/gzip151.79kB. 기존500kB초과 청크 경고는 별도다.
- 실제 생성기를 사용하는 seeded 경로500입력/다중 승급에서도 상자와 점프 판정·기존 결정 객체 보존을 확인했다. 이동 회귀용 fixture와 실제 확률 모듈 테스트를 구분했다.
- 예정된 잡힘/만료 우선, 점프2/4점·게이지28/29·모든 단계 목표 초과, 빠른 후속 입력·모바일 단일 활성·키보드 보호·피드백 타이머·오디오 호출 횟수·최종 기록1회 저장 회귀를 확인했다.
- timedPursuit.test.ts도 입력 기반 회귀를 유지하도록 동일한 test-only 장애물 fixture를 적용했다. 제품 확률/검증기를 완화하지 않았다.
- 현재 점프는 기존300ms 오르기 모션을 사용한다. 전용 공중 아크/실제 브라우저·반응형·reduced-motion 육안 확인은 T05다. 별도 넘어짐 소리 스피커 청취 문제/전체App.test.tsx/번들 분할은 확인·수정하지 않았다.
