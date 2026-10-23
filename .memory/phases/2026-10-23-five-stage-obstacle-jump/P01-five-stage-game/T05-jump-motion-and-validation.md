# Task: T05 Jump Motion and Validation

## Status: pending

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

- [ ] Two-node arcs start/land on real route points and aren't clipped/painted behind obstacles.
- [ ] Rapid accepted input/failure/terminal/reset cancels obsolete motion without duplicate sounds/input or blocked controls.
- [ ] All5timers/targets, mixedroutepatterns/long-onlyobstacles, independentcadences/captures/longhistory, scores/gauge andv3ranking work end-to-end.
- [ ] Four normal viewports and320px enlarged text preserve controls/readability/scroll access; reduced-motion retains immediate feedback.
- [ ] All listed tests/lint/build/browser checks pass with evidence and no unrelated source changes.

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

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
