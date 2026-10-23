# Task: T05 Jump Motion and Validation

## Status: done

## Goal

실제2칸 이동과 일치하는 점프 아크/착지를 표시하고, 방향 바꾸기 옆 점프 버튼의 빠른 연속 조작 및 전체5단계/랭킹/모바일 흐름을 브라우저에서 검증한다. 임계 시각·재시작·reduced-motion과 확대 글자에서도 결과가 일치하면 계획을 완료한다.

## Decision Summary

- 점프는 전용 공중 모션을 쓰되 엔진 이동을 늦추거나 다음 입력을 잠그지 않는다. 사용한 장애물은 점프 동안 보이고 이후 과거 화면에서는 정리된다.
- 기존 픽셀/오디오/인증을 유지한다. 스피커에서 넘어짐 소리가 안 들리는 별도 문제는 이 Task로 해결되었다고 간주하지 않는다.

## Implementation

### I01. 순수 장면 모델의 점프 출발/착지 좌표

- Related Files:
  - `src/game/stairSceneModel.ts` :: SceneJump, StairSceneModel, buildStairSceneModel; modify
  - `src/game/stairSceneModel.test.ts` :: left/right arc geometry/immutability; modify
  - `src/game/types.ts`, `src/game/gameEngine.ts`, `src/game/stairRoute.ts`, `src/game/stairObstacles.ts` :: T01~T04 contracts; read-only

#### Details

- **Previous Contracts**:
  - GameStage1..5, timed targets300/600/900/1200/1500 with90/75/65/60/50s. End reasons caught/time-limit/cleared, last stage success game-over/cleared; all active deadlines tick before input, stages1..4 promotions refill3lives/gap4 and preserve route/bonus. Stage getStageSecondsLeft returns number; clear display is a separate label. v3 ranking stores reached stage/actual score once at termination and cleans onlyoldv1/v2.
  - GameInput forward|turn|jump. State obstacles `{rngState,runs:[{runStartIndex,runLength,kind:long|short,direction,stageAtGeneration,obstacleIndex:number|null}]}` and lastMove:`{kind:"climb"|"jump",fromIndex,toIndex,scoreGain:1|2|4,isBonus:boolean}|null`. Jump moves2real nodes/samedirection,normal2/bonus4points,charge+2onlyinactive. Wrong/emptyjump stopsplayer500ms without gap penalty; timedNPCcontinues. There is no jumpinputlock. Timeout/capture/failureclearplayerlastMove,clearedpreservescompletedmove.
  - Route lengths1|2|3|5|6|7|8|9, runs `{startIndex,length,kind:long|short,direction}`, plusrng/tailDirection/tailRunLength/tailRunKind/tailStepsRemaining/tailShortRunsRemaining. Long5..9 then1or2short1..3,alternatingdirection,adjacentshortnonrepeat.18future and requiredolderhistory retained via advanceStairRoute(route,playerIndex,oldestRequiredIndex?):oldest=min(player-4,pursuerIndex,lastPursuerMove?.fromIndex??pursuerIndex). Scene base11(4behind/6ahead),projection260+columnDelta*34,216-indexDelta*28,playerfoot260/216. Onlylongrunshaveobstacles,p=.10/.20/.30/.40/.50;first/lastsafe,atmost1/long,shortalwaysnull. Existingempty/hitdecisionsstableacrossstages;newrunusesnewstage.
  - Independent pursuit fields pursuerIndex:number,pursuerDistance=playerIndex-pursuerIndex>=1,nextPursuerStepAt:number|null,lastPursuerMove:{fromIndex,toIndex,atMs}|null,captureCount:number,captureEndsAt:number|null. Stageintervals1000/800/600/500/400ms;successwidensgap1/2withNPCstationaryuntilnextscheduledstep. tickchronologicallyprocessesevents,tiedstageexpiryfirst,NPCbeforeinput. Capturecostslife,resetNPCplayer-4,setsrecovery/capture+500ms/lastMistakefalse,next=catchAt+intervalifalive. Promotionrestores3lives/gap4/newstage+NPCclocks;clear/timeout/fatalstopNPC. Settingsshiftsstage/event/NPCdeadlinesonce;ordinaryhiddenflows. No synthetic fall sound for timed capture.
  - Scene already includes pursuerVisible and pursuerMotion:{from:ScenePoint,to:ScenePoint,atMs:number}|null. ActualNPCcanbeoutsidebase11/viewport; visibleoutsidemainwindowgetsrealhistorytile,otherwise nofake/clampedactor. Independent240msNPCwrappermotionandcapturegateuseownfields,notplayerisClimbing. Preserve these through jumpoverlay work.
  - GameScreen uses300msplayerclimbtimer/key,240msNPCtimer/key andenginecaptureEndsAt500msgate independently. Onefootstepperacceptedplayeraction,fallonlyactualmistake. HUD scoreGainIsBonus snapshot distinguishespointrate. Mobilepointerdownonce/detail>0clickignored/detail0nativeactivationretained;Spaceignoresrepeat/entry/settings/nativebutton. Controlsforward/group(turn,jump),gap4vsouter12,min60pxnormalheight.
- **Signatures & Types**:
  ```typescript
  interface SceneJump {
    from: ScenePoint; // x:number,y:number in current landing-centered viewBox
    to: ScenePoint;
  }
  interface StairSceneModel {
    steps: readonly SceneStep[];
    player: SceneActor;
    pursuer: SceneActor;
    catchFrames: readonly CatchFrame[];
    pursuerMotion: ScenePursuerMotion | null; // existing: from,to:ScenePoint,atMs:number
    pursuerVisible: boolean;
    playerJump: SceneJump | null;
  }
  ```
- **Execution Flow / Logic**: retain real player/NPC/catch coordinates and T03visibility unchanged. A lastMove kindjump with toIndex===stepsClimbed is eligible for playerJump. Validate fromIndex+2===toIndex and same direction using retained route nodes; project both relative to current player. Missing/invalid route invariants retain RangeError. No last jump/mismatched target givesnull. Don't restore the obsolete distance<=4 validation while adding jump fields.
- Expected jump offsets: right from=(192,272),to=(260,216), difference(-68,+56); left from=(328,272),to=(260,216), difference(+68,+56). Both start nodes are retained inside4node history after a2node advance. Tick/resize/repeated model construction must produce identical coordinates without changing state/RNG.
- **Errors & Return**: this is a pure model addition, no time/RNG/DOM reads and no camera origin or viewBox changes.

### I02. 잘림 영역 밖의 점프 이동과 전경 표시

- Related Files:
  - `src/game/StairScene.tsx` :: runner motion wrapper/jump overlay/style vars/pose; modify
  - `src/game/pixel/PixelOfficer.tsx` :: OfficerPose union; modify
  - `src/game/pixel/pixel-scene.css` :: static jump pose and arc/reduced-motion; modify
  - `src/game/pixel-theme.css` :: final scoped reduced-motion override/any verified responsive corrections; modify

#### Details

- **Signatures & Types**: existing StairScene props stay state/climbAnimationKey/isClimbing/pursuerAnimationKey/isPursuerMoving/isPursuerCaught. Add OfficerPose=`idle|climb|fall|jump`; keep OfficerFrame idle/run-a/run-b/stumble. No external sprite sheet or image asset.
- **Execution Flow / Logic**:
  1. Derive active jump only if isClimbing, valid model.playerJump, lastMove kindjump, !lastMistake, state.status===playing and !isPursuerCaught. Fall/terminal/reset wins over old jump. Existing runner transform remains translate(260 216) at the actual landing node.
  2. Place a keyed `.runner-motion` group outside the existing feet clip wrapper. Inside it keep clipPath/runner-pose/PixelOfficer. Use current climbAnimationKey and kind in the motion key. Move the whole clipped character with the outer group so the sprite is not cut off by shifting inside the oldx[-34,34],y[-88,-4] clip.
  3. For activejump add runner class is-jumping (not simultaneously is-climbing) anddata-motion-kind=jump; otherwise retain normal climb/fall/idle classes. Expose data-testid=runner-motion on the moving wrapper for geometry assertions. Officer posejump shows the existing run-b art frame statically, without the ordinary officer-body hop or stride loop. Climb and fall remain unchanged.
  4. Set CSS variables --jump-x/--jump-y from projected from-to offsets in user-unitpx on the moving wrapper. `pixel-player-jump` lasts300ms ease-out/both:0%=translate(fullX,fullY),50%=translate(halfX,-28px),100%=translate(0,0). Height is above the intervening box; both directions use the same vertical arc. Do not delay engine score/position or add jumpEndsAt/input checks.
  5. Render an active jumping runner once in a `.jump-overlay` after normal stair/box groups, followed by landing stairFront for foot occlusion. Suppress its normal tile-group copy; keep pursuer in its own normal/catch layer. This prevents the intervening obstacle/front faces being painted over the flying body. Keep the T04 recently-jumped obstacle at from+1 visible throughout the300mswindow; remove its visual when window ends/next move supersedes it.
  6. Under prefers-reduced-motion disable the outer arc/transform as well as body/stride animations and show the static idle frame forjump. Add the wrapper to the final `.stair-game.pixel-theme` reduced-motion rules so later specificity cannot reactivate it. Preserve the existing immediate final-catch result override.
- **Errors & Return**: no independent movement coordinate state in React; coordinates come from the engine route/move. Render no obsolete from coordinate when a subsequent action/reset changes lastMove. Audio continues once per successful action, not at both animation start/end.

### I03. Animation lifecycle와 최종 반응형 확인

- Related Files:
  - `src/game/GameScreen.tsx` :: successful-move animation effect cleanup and terminal guard; modify
  - `src/game/pixel-theme.css` :: verified grouping/heading/hint/result safe-area tuning only; modify
  - `src/game/GameScreen.test.tsx`, `src/game/ControlButtons.test.tsx` :: replay/cancel/responsive semantic regressions; modify
  - `src/game/GameHud.test.tsx`, `src/game/gameEngine.test.ts`, `src/game/stairObstacles.test.ts` :: existing behavior; read-only

#### Details

- Successful playersteps increase increments onlyplayeranimationkey and callsplayFootsteponce, notNPCkey. New300mstimerreplacesprevious; acceptedD/J/Spaceimmediatelyreplacesvisual. Mistake or captureCount change cancelsplayerarc; terminalclear/timeout/caughtcancelsbothvisualtimers without suppressing successfulfinalfootstep or onesave. Reset/unmountcleanup. NPCtick duringjumpmustnotclearits300mstimerunlessactualcapture/terminal; useprimitive player-move/status/mistake/capture dependencies, notentiregameState/newNPCobject.
- Existing100mslogicalreconciliationandwhole-secondHUDoptimizationstay. Settingspausesall3stage/event/NPCclocks;cosmeticjump/NPCstepmayfinishbehindmodalandmustnotreplay. No separatejumpphysics/inputlocktimer.
- Add pure scene cases for right/left offsets, null after normal move/failure, replay/frozen state. UI jump then immediate D/J before300ms must progress correctly and cancel old arc; jump/fall/reset/time-limit/final-clear priorities yield exactly one runner and at most one visible pursuer, with no stale overlays (a genuinely offscreen NPC is absent). Separate successive jumps replay with new keys. Validate1footstep per accepted jump and existing fall calls for actual mistakes only.
- Check the existing responsive structure: mobile game-stage is natural-height grid with an internal scroller and minscene=`scene-top+200px+scene-bottom`, controls/start/settings outside it. Ready uses a larger scene-bottom, result panel uses max-content +minmax(280px,1fr), desktop hides controls>=721px. Tune existing scoped selectors instead of appending competing overrides or shrinking text/targets. Keep normal controls at least56px target and directional/jump group visibly closer than forward/group gap.
- At320px/150%/200% text,3labels may wrap and need a taller control row. Reserve matching scene/hint/footer space so fixed controls don't hide the only restart/next-box cue. Keep internal scrolling if the content cannot fit; no page-wide overflow, native range loss, fullscreen API or global body font override. Correct only issues demonstrated in the required checks.

### I04. 실제5단계/장애물/랭킹 브라우저 검증

- Related Files:
  - all14listed test files in Validation :: regression; run as specified
  - temporary browser driver/screenshots/metrics outside production source :: verification artifacts only
  - this Task, parent phase/plan and `.memory/current.md` :: validation results/completion records; update after passing

#### Details

- Use existing local-demo development mode with a separate browser context/profile, never the user's general profile. Prefer a connected browser tool if available; CDP Target.createBrowserContext with disposeOnDetach is a supported fallback. If browser launch is rejected by automatic review, report that and use an allowed isolated existing connection, not a visible helper window. Dispose only the owned context afterwards.
- Required viewports:320×667,390×667,768×1024,1440×900. At each:ready90s/goal300, advance by actual D/J/Space according to the displayed next obstacle/direction, snapshot stages2/3/4/5 with75/65/60/50s and correct cumulative goals, reach>=1500/cleared with an actual final step/jump, verify one v3save/no catch delay, restartstage1. No skipped-stage debug prop/cheatbutton. A frozen/test-controlled Date.now and seed in the isolated document may speed repeatable inputs; record this method.
- Test visibleboxes/input usingrouteindex:nextbox→Space,elsecornerJ,elseD. Accountfor2nodejumps. Verify+2/+4popup,stableboxesacrossresize/pause/promotion,short1..3neverbox,long5..9max1/interior/samedirectionlanding;bothshortcountsandback-to-backJinsingle-stepturns. Thresholdstestsestablish10/20/30/40/50%,notoneplaythrough'sempiricalfrequency.
- Separately run real advancing time forindependentpursuit:idle1000msNPC-4→-3withoutplayerinput;successwidensgapuntilnextdue;wronginputdoesnotimmediatelyadvanceNPC;recoverystillallowsNPCatitsdue;threeidlecatchesin12sstage1→onefinalsave/caught,500msnormalresultgate/reducedmotionimmediate. Stage5test400msstepduring500mscapture. InanisolatedtestdocumentcontrolledDate.now/safeenginefixturevalidatesall5cadencesandexacttie(deadlinevsNPCvsSpace). Recordwhichchecksusedcontrolledtime;afrozenwholegameplayisnotpursuitvalidation.
- Exercisegap>4:actualNPCstaysonownindexwhileplayerquicklyescapes,scene11base/historyextras/offscreenmetadataanddistanceaccurate,noRangeError/missingroute. LetNPCcrossashortturnwithownfacingandone-nodearcwithoutplayerkey. CheckNPCstepduringplayerjumpdoesnotcancel/replayplayeranimation,independentcatchinterruptsit;latehiddenreconciliationcanexhaustliveswithoutinput.
- Snapshot motion at departure/midpoint/landing in both directions; outer wrapper moves outside the clip with one sprite copy, peak clears the box and landing matches the target stair. Check rapid turn→jump/nextinput, normal mistakes/empty jump, recovery repeats, final catch500ms/reduced-motion immediate, timeout during a pending jump/capture, final clear during a jump, restart while timers pending. Reduced-motion still updates state/feedback immediately.
- Test95ssettingspause withactivebonusandpendingNPCdeadline:all3remainingtimespreservedonce,D/J/Space/touchblocked,Escape/focus/nativeaudiorange/preferenceskept. Ordinaryhidden-tabreconciliationadvancesNPCandmayendcaughtbeforelaterstageexpiry. Forpuretime-limitresultscenario use anisolatedtestsnapshotwithsafeactualgapordeadlinebeforefirstcapture;don'texpectidle90stotimeoutwhenthreepursuitcapturesalreadyendedit. ExactdeadlinebeatsgoalreachingSpace. Audioinstrumentationchecksactualplayercalls,noNPCmovementfallcalls;separatemissingfallsoundsymptomremainsunverified.
- In isolated storage preload v1/v2/v3+audio/auth/other sentinel entries. Verify onlyold ranking removal, validv3 retained after reload/restart, stage-first whole-pair best with high old-stage points unable to replace higher stage, ties preserve timestamp and currentplayer/TOP10. Inject a controlled setItem/cleanup failure in that isolated document, verify error text/restart, then restore the injected function. No localStorage.clear or fixture writes to a normal profile.
- Check score/time/goal/gear bounds,11node route safe area, obstacle/sprite occlusion,3touch targets/group gaps, scrollable results/ranking/error, long name/16digit score, footer/hint vs buttons. Repeat320px at24px/32px root font. Record screenshots/metric assertions/actual tool or driver path/limits in this Task's Validation Results. Rendering asserts alone do not establish audibility.
- Run browser checks separately from CPU-heavy test/build work. Poll any long-running driver and report meaningful progress; don't hide failures by extending unit-test timeouts. Keep app source free of test hooks.

## Acceptance Criteria

- [x] Two-node arcs start/land on real route points and aren't clipped/painted behind obstacles.
- [x] Rapid accepted input/failure/terminal/reset cancels obsolete motion without duplicate sounds/input or blocked controls.
- [x] All5timers/targets, mixedroutepatterns/long-onlyobstacles, independentcadences/captures/longhistory, scores/gauge andv3ranking work end-to-end.
- [x] Four normal viewports and320px enlarged text preserve controls/readability/scroll access; reduced-motion retains immediate feedback.
- [x] All listed tests/lint/build/browser checks pass with evidence and no unrelated source changes.

## Validation

- `npm test -- --run src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts`
- `npm run lint`
- `npm run build`
- Browser I04 checklist with screenshots/actual results/limits. Report any existing bundle warning separately. Do not claim unrelated App.test.tsx/full-suite or real speaker audibility success.
- Once passing: Taskdone, phasedone5/5, Plancompleted, current ActiveTasknone with all implementation commit hashes. Preserve previous plan history and separate pending fall-sound decision. Commit the final memory completion synchronization too so a fresh checkout doesn't restart completed T05.

## Commit Message

```text
feat(game): animate two-step jumps and validate five-stage play

Plan: 2026-10-23-five-stage-obstacle-jump
Phase: P01-five-stage-game
Task: T05-jump-motion-and-validation

- Render replayable jump arcs outside foot clipping with immediate follow-up input
- Verify complete stage ranking and responsive keyboard touch flows
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: e369a28

## Validation Results — 2026-10-23

### Automated regression

- 지정14파일352/352tests 통과(Vitest5.0.5,32.97초). `npm run lint`와 `npm run build` 종료코드0, TypeScript/Vite208modules 통과.
- 최종 CSS53.81kB/gzip10.57kB, JS543.45kB/gzip152.03kB. 기존500kB초과 청크 경고는 남아 있다. 별도 App.test.tsx/전체 suite는 실행하지 않았다.
- 좌우 실제 출발/착지, 잘못된 경로 RangeError, frozen state 반복 모델, 단일 전경 sprite/clip 밖 wrapper, 빠른 D/J/다음 점프 교체, NPCtick과300ms타이머 독립, 설정 중 미용 타이머 종료, 넘어짐/시간 초과/잡힘/최종 클리어/재시작, 발소리/최종저장1회, 빠른 turn/jump pointer 활성 회귀를 확인했다.

### Browser method and evidence

- Chrome156.0.8078.47, 기존 localhost:9222 CDP 연결에서 `Target.createBrowserContext({disposeOnDetach:true})`로 전용 context를 생성했다. 사용자 일반 profile을 사용하지 않았고 각 driver finally에서 본인 context만 dispose했다. 기존 개발 서버 `http://localhost:5173/`의 local-demo를 사용했으며 제품에 테스트 버튼/환경 분기/상태 hook/의존성을 추가하지 않았다.
- Driver/JSON/PNG는 저장소 밖 `C:/Users/DEX/AppData/Local/Temp/stair-five-stage-t05/`에 있다. `cdp.mjs`는 Node24내장WebSocket/CDP helper다. 아래 명령들은 각각 종료코드0이며 최종 소스에서 브라우저 검증을 마친 뒤 회귀/lint/build를 실행했다.

| Driver | Evidence | Result |
| :--- | :--- | :--- |
| `node .../full-flow.mjs` | `full-flow.json`, `{320,390,768,1440}-stage-{1..5}.png`, `*-cleared.png` | 320×667/390×667/768×1024/1440×900 네 화면에서 목표300/600/900/1200/1500·시계90/75/65/60/50초, 실제 전 단계 입력/최종클리어/기록1회/재시작 통과 |
| `node .../layout-motion.mjs` | `layout-motion.json`, `*-font{16,24,32}-{ready,playing,settings,result}.png`, `{right,left}-jump-{departure,midpoint,landing}.png`, `reduced-jump.png` | 네 일반 화면 +320px 글자150%/200%, 긴 점수·설정·재시작 접근, 좌우clip밖 포물선/단일sprite/모션감소 통과 |
| `node .../pursuit-storage.mjs` | `pursuit-storage.json`, `real-final-{catch,result}.png`, `npc-short-turn.png`, `ranking-long-name.png`, `storage-error.png` | 실제 시간 독립 추격/회복 중 전진/3회잡힘, 제어시각5단계간격·정확한동시마감·95초설정정지, 랭킹/실패/복원 통과 |
| `node .../jump-boundaries.mjs` | `jump-boundaries.json`, `npc-during-jump.png`, `320-font{16,24,32}-box-cue.png` | 2/4점·게이지28/29, native터치/버튼Space 중복방지·빈점프효과음호출, 빠른회전→점프, NPC중독립모션, 점프/잡힘중마감·최종점프클리어·재시작 통과 |
| `node .../hidden-real.mjs` | `hidden-real.json` | CDP frozen→active lifecycle로 실제12.2초 중지·복귀 후 무입력3회잡힘/caught/점수0 반영 통과 |

### Actual checks and limits

- 전체 진행은 격리 document에서 `Math.random=()=>0.5`, `Date.now` 고정을 사용해 가속했다. 모바일은 표시된 다음 상자/방향에 따른 실제 세 버튼 PointerEvent, 데스크톱은 D/J/Space KeyboardEvent를 엔진까지 전달했다. 네 화면 모두29회 점프(보너스+4),47회연속J, 긴 구간 뒤 짧은1개/2개 모두 확인했고 임시 점프/단계 skip은 사용하지 않았다. 일반+2/보너스+4·native CDP touchStart/end와 native 버튼 Space는 별도 경계 driver에서 확인했다.10/20/30/40/50% 확률은 실제 순수 모듈의 임계값 테스트 근거이며 표본 빈도를 확률 증명으로 삼지 않았다.
- 포물선은 landing-centered user units에서 우출발(192,272)/좌출발(328,272), 착지(260,216). 바깥 wrapper의0/150/300ms CSS animation을 일시정지·현재시각 지정해 각각(±68,56)/(±34,-28)/(0,0) 위치와 스크린샷을 확인했다. 점프 run-b는 정적이고 모션 감소 시 arc/transform=none, idle만inline/run-b=none이었다. 재촬영 중 미용300ms종료가 끼지 않도록 해당 screenshot 구간만 virtual time을 멈췄다.
- 실제 Date.now가 진행한 첫 추격에서 NPC-4→-3, 성공 입력은 거리만+1, 잘못된J는 즉시NPC이동 없음,500ms회복 중 예정NPC전진을 확인했다. 별도의 완전 무입력 게임은 약12054ms에3회잡힘/caught/기록1회였고 정상결과500ms가림→표시/모션감소즉시표시를 확인했다. 시간고정 전체 진행을 추격 검증으로 대체하지 않았다.
- 모든 단계간격1000/800/600/500/400ms, 단계5잡힘회복500ms 중400ms NPC전진, 정확한 만료 vs NPC vs 점프 우선순위와 이전 fatal catch 보존은 브라우저에서 가져온 실제 engine의 일관된 snapshot으로 검증했다. 단독NPC짧은코너6(left)→7(right)과 gap>4/history/offscreen은 실제 장면/전체 진행에서 확인했다.95초설정정지는 제어 Date.now로 단계/보너스/NPC 남은시간을 각각90000/30000/1000ms로 동일하게 유지했다. ordinary late visibility reconciliation과 실제 lifecycle중지를 둘 다 확인했다. OS의 실제 탭 UI 조작 대신 CDP lifecycle중지를 사용했다.
- 격리 storage의v1/v2만 제거, v3/audio/auth/other보존, 높은 이전단계점수의 낮은순위/한판쌍 보존, 동점timestamp보존, 새단계로전체쌍교체, reload/restart보존,TOP10/현재사용자·긴이름/16자리점수, setItem/구형정리 실패 안내·복원 후재시작을 확인했다. 일반 사용자 저장소는 초기화하지 않았다.
- 확대 검사에서 고정 버튼과 안내가 겹치는 실제 결함을 발견했다. 모바일 frame을 스크롤 게임장면/자동높이 조작/자동높이 footer의grid로 배치해 수정했고 기존selector를 조정했다. 최종320px의16/24/32px root에서 버튼높이84/102/159px, 안내bottom545/520/430px < 버튼top561/536/446px로 통과했다. 확대 화면은 내부 스크롤로 HUD/장면/안내에 접근한다. 세 버튼은 모두56px이상이며 오른쪽group간격4px < forward/group12px, 데스크톱>=721px숨김을 유지한다. 상자 안내도세글자크기에서버튼과분리됐다. 재시작bottom453/505/561px로667px화면안에접근했다.
- 최종 통과 driver에서 Runtime.exceptionThrown이없었다. 중간 확대 겹침을 수정했고, 애니메이션 스타일이 확정되기 전 평가하는 driver는1프레임을 기다리게 보정했다. 편집/HMR에 끼어 중단된 실제중지 검사는 편집을 마친 뒤 새 context에서 다시 통과했다. 초기실패 PNG/JSON도 temp에 남아 있을 수 있으며 위표의 최종 PASS JSON이 결과다.
- 실제 스피커의 넘어짐 소리 청취는 확인하지 않았다. 오디오 검증은 호출 횟수이며 별도 fall-sound 결정을 해결한 것으로 간주하지 않는다. App.test.tsx/옛CSS/번들분할/Entra설정·배포는 이번 범위 밖이다.
