# Task: T03 Fall Pursuit Acceleration

## Status: done

## Goal

넘어진500ms 동안250ms 간격 추격을 연결하고, 회복·설정·마감·늦은 tick에서도 같은 시간순 결과를 만든다.

## Decision Summary

- 일반800/650/500/400/300ms를 넘어짐 중250ms로 단축한다. 즉시 전진 벌점이나 반복 입력에 의한 가속 연장은 없다.
- 최초 잡힘은 종료이며 단계 만료가 동시 NPC/입력보다 우선한다. 체크포인트에서는 모든 시계가 정지한다.

## Implementation

### I01. Prior contracts and scheduling

- Related Files:
  - `src/game/gameEngine.ts` :: applyInput/tickGame/getNextPursuerStepAt — modify
  - `src/game/types.ts`, `stageRules.ts`, `stairRoute.ts`, `stairObstacles.ts` — read-only

#### Details

- **State**: GameStage1..5/ClearedStage0..5; ready|playing|checkpoint|game-over; reasons caught/time-limit/cleared/quit; no lives. Session fields stageStartScore,recordStage,clearedStageThisRun,checkpointEnteredAt; existing score/physical steps/facing/route/obstacles/lastMove and eventSteps/eventEndsAt/recoveryEndsAt/lastMistake remain. NPC fields pursuerIndex,pursuerDistance=player-NPC>=1,nextPursuerStepAt,lastPursuerMove:{fromIndex,toIndex,atMs}|null,captureCount,captureEndsAt.
- **Rules**: base800/650/500/400/300ms; durations90/75/65/60/50s; target=getStageTargetScore(stageStartScore)=start+400. Success D/J1node or Space2nodes leaves NPC stationary and widens gap. Inputs tick first, inactive/recovery ignore movement.
- Checkpoint1..4 has enteredAt/nonplaying/null stage+NPC clocks and frozen bonus; continue alone starts next stage/full clocks/NPCplayer-4. Final5 clears; quit/expiry/catch end once. Constructor/reset(random?,{stage?,highestClearedStage?}) create fresh run; select max(1,highest) lock. Storage v4bestStage0..5 and account stage-progress:v1 are already wired; do not change storage in this task.
- **Signatures & Types**:
  ```typescript
  const FALL_PURSUER_INTERVAL_MS = 250; // export
  function getNextPursuerStepAt(state:GameState, atMs:number):number; // private
  // Existing applyInput/tickGame/resumeGameAfterPause signatures unchanged.
  // No duplicate boost timer/state: lastMistake + recoveryEndsAt is the active window.
  ```
- **Wrong input**: after tick, only playing/no recovery enters mistake path. Set lastMovenull,lastMistaketrue,recoveryEndsAt=now+500,nextPursuerStepAt=min(postticknext,now+250). Preserve NPC index/gap/score/steps/event/route/obstacles. No instant step/RNG/reveal/save. Earlier due movement cannot be postponed. Repeated recovery input neither restarts fall nor extends the fast window.
- **Step helper**: if lastMistake and nonnull recoveryEndsAt and atMs+250<=recoveryEndsAt, next=atMs+250; otherwise next=atMs+base interval. This schedules fast successors only inside the fall window, using the actual scheduled atMs rather than callback Date.now.
- **Tick order**: checkpoint identity; otherwise chronological min(stageEnd,NPCnext,eventEnd,recoveryEnd,captureEnd). At ties stage expiry first, then bonus/recovery/capture expiry, then already-scheduled NPC movement. A step due exactly at recoveryEnd still happens; its next interval is normal because recovery cleared. Do not erase that scheduled step.
- **Catch**: destination reaches player ->game-over/caught/NPCnextnull/lastMovesnull/recoverynull/lastMistakefalse/captureCount+1/captureEndsAt=at+500, last safe NPCplayer-1/gap1. No respawn/repeated catch. An earlier fatal catch remains caught even when a later stage deadline also elapsed.
- **Concrete timelines**:
  - Stage1 fall0, oldnext800 ->250. At249 none;250 one/next500;499 still one;500 second/recoveryclear/next1300. No third at750.
  - If oldnext100, retain it: steps100,350; next1150=350+800, not a fast step600 after the window.
  - Stage5 fall0: steps250,500,next800 (base300). Renderer240ms motion and logical250ms deadlines remain separate.
  - Late tick1300 reproduces the same stage1 three movements in order unless capture ends it earlier.
- Preserve RangeError time/index/route validation, pure replay/immutable input and no-op identity. No new fields are required.
- **Data & Schema Fields**: recoveryEndsAt remains number|null, lastMistake boolean, nextPursuerStepAt number|null, lastPursuerMove {fromIndex:number,toIndex:number,atMs:number}|null. No storage schema changes or second fall deadline.
- **Execution Flow / Logic**: (1) tick/validate first, (2) recognize only a newly accepted mistake, (3) shorten its next absolute NPC deadline without moving the NPC, (4) process due steps and recovery chronologically, (5) select fast successors only inside the existing window, otherwise base successors, (6) terminate immediately on first contact or prior stage expiry.

### I02. Pause and presentation

- Related Files:
  - `src/game/gameEngine.ts` :: resumeGameAfterPause — preserve pending deadline behavior
  - `src/game/GameScreen.tsx` :: help text — modify
  - `src/game/StairScene.tsx`, `stairSceneModel.ts`, `pixel/pixel-scene.css` — read-only unless a demonstrated rapid-NPC defect requires correction

#### Details

- Playing settings shifts stage/event/NPC deadlines once by paused duration, while500ms recovery/capture cosmetics elapse. Tick at open first handles due events. Fall0/open100/close10100 preserves pending next250 as10250 (150ms remaining), clears elapsed recovery500, keeps the already paused pending step; after10250 schedule normal base. Duplicate close must not shift again.
- Checkpoint cannot be entered during recovery; all clocks freeze there and continue arms a fresh next-stage base interval. Ready/checkpoint never start acceleration. Quit/caught/timeout/finalclear stop future NPC steps.
- Hidden return and delayed100ms tick reconcile actual deadlines; do not round250ms scheduling to300ms just because the renderer polls100ms. DOM observation may lag<100ms, lastPursuerMove.atMs remains250/500.
- Add help `넘어진 동안 추격자는 0.25초마다 한 칸씩 올라와요.` alongside500ms recovery and single-catch ending. One playFall call per actual mistake, none for autonomous step/catch. No sound asset/volume/audibility fix in this task.
- Keep player300ms jump and NPC240ms timer dependencies primitive/independent; faster NPC keys cannot restart/cancel the player's arc except actual capture/termination.

### I03. Boundary regression

- Related Files:
  - `src/game/timedPursuit.test.ts`, `gameEngine.test.ts`, `GameScreen.test.tsx` — modify
  - `src/test/gameFixtures.ts`, `obstacleFixtures.ts` — reuse
  - Other listed17files — regression

#### Details

- All stages at249/250/499/500 and following base deadline; earlier existing100 retained,350 step/nextbase; immutable/pure replay/no RNG/reveal. Repeat at450 does not extend recovery/fast clock.
- Gap1 catch250, gap2 catch500 before a same-time escape input. Stage deadline250 or500 wins over NPC; earlier catch250 before deadline251 remains caught. Event expiry250 independently updates bonus.
- Playing pause100→10100 yieldsnext10250/recoverynull; after that base interval. Duplicate close/hidden late tick/checkpoint95s identity/continue base/terminal stop.
- UI fakeclock and actual engine timestamps: initial wrongJ one fall audio/no instant NPC; DOM after300 sees engine moveat250, after500 second. Capture interrupts jump/saves once; NPC steps create no footstep/fall calls. Input accepts only after recovery resolves.250ms motion replay cannot leave stale wrappers. Do not increase test timeouts to mask failures.

## Acceptance Criteria

- [x] 오입력500ms 동안만250ms 예약을 사용하며 기존 더 이른 예정과 반복입력 무시를 보존한다.
- [x] 회복 종료와 겹친 전진·정상 속도 복귀·단일 잡힘·단계 만료 우선이 일관된다.
- [x] 설정/체크포인트/숨김/시각 모션/오디오/저장 계약을 유지한다.

## Validation

- `npm test -- --run src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts`
- `npm run lint`
- `npm run build`
- Record actual17file results/timelines. Real-time browser evidence remains T04; no unrelated App fixes/dependencies/audibility claim.

## Commit Message

```text
feat(game): accelerate pursuit during fall recovery

Plan: 2026-10-23-stage-checkpoints-and-fall-chase
Phase: P01-checkpoint-game
Task: T03-fall-pursuit-acceleration

- Schedule 250ms pursuit steps only within the 500ms fall window
- Preserve earlier deadlines and reconcile pause and recovery boundaries
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Execution Notes — 2026-10-27

- Added exported FALL_PURSUER_INTERVAL_MS=250 and a private scheduled-time helper. A newly accepted mistake shortens nextPursuerStepAt with min(existing,next250); it never immediately moves the NPC or restarts a repeated recovery input.
- Fast successor deadlines use lastMistake/recoveryEndsAt only. A move due at the recovery boundary is preserved; afterward the helper uses the current stage's base interval. No boost state, duplicate timer or storage schema was added.
- Exact timelines verified across all stages: fall0 -> steps250/500 -> next500+base; earlier pending100 -> steps100/350 -> next350+base. Stage1 late1300 reproduces250/500/1300. Pause100..10100 preserves pending10250, clears elapsed recovery, then schedules normal11050.
- Added all-stage boundary/repeat/immutability/no-RNG/no-reveal checks; gap1/2 capture, expiry priority, earlier fatal catch, bonus expiry, checkpoint freeze and base-only Continue checks. UI checks distinguish the 100ms poll observation at300 from the actual250ms move metadata and preserve independent240ms NPC/300ms player timers, one fall sound and final ranking write.
- Updated only affected timing/visibility expectations. The existing scene projection fixture now inspects a real playing move at3101ms before the accelerated catch, rather than accidentally testing its terminal safe position at4200ms. Scene rendering/model/CSS production files remain unchanged.
- Added the0.25-second fall-pursuit explanation in GameScreen help. No sound assets, preferences, audibility fixes, stage selection/storage/auth changes or dependencies.
- Validation: exact17 blueprint test files passed,432/432 tests; npm run lint passed; npm run build passed; git diff --check passed. JS550.84kB(gzip153.91kB), CSS55.52kB(gzip10.78kB); existing >500kB chunk warning remains. Test timeouts were not increased.
- Real-time browser/responsive evidence remains T04. Existing bundle splitting, independent App expectations, older CSS cleanup and the separate audible fall-sound report remain outside this Task.
