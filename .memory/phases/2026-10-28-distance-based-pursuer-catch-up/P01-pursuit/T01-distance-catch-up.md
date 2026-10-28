# Task: T01 Distance Catch Up

## Status: done

## Goal

메인 `/`와 단독 `/descent-test.html`에서 30칸 거리부터 50ms 추격, 7칸에서 해제되고 단계별 600/500/400/300/250ms로 복귀한다.

## Decision Summary

- 50ms 가속이 넘어짐 250ms보다 우선한다. 회복 500ms와 모든 기존 진행/저장 규칙을 보존한다.
- 실제 계단 차이로 판단하며 가속 상태를 기억한다. 양쪽 화면이 공용 엔진을 사용하므로 원자적으로 함께 변경한다.

## Implementation

### I01. Shared rules and clock

- Related Files:
  - `src/game/types.ts` :: `GameState` — modify.
  - `src/game/stageRules.ts` :: `STAGE_RULES` — modify intervals only.
  - `src/game/pursuitRules.ts` — new pure shared constants/helpers.
  - `src/game/gameEngine.ts` :: `validatePursuit`, `getNextPursuerStepAt`, `createGameState`, `tickGame`, `applyInput`, `continueGame`, `quitAtCheckpoint` — modify.
  - `src/descent/descentEngine.ts` — read-only adapter; shared engine supplies new speed.

#### Signatures & Types

```typescript
// Existing GameState fields remain intact, add required non-null boolean:
isPursuerCatchingUp: boolean;
// pursuitRules.ts
export const PURSUER_CATCH_UP_START_DISTANCE = 30;
export const PURSUER_CATCH_UP_END_DISTANCE = 7;
export const PURSUER_CATCH_UP_INTERVAL_MS = 50;
export const PURSUER_POLL_INTERVAL_MS = 50;
export function getPursuerCatchUpState(wasCatchingUp: boolean, distance: number): boolean;
export function getPursuerMotionDurationMs(state: Pick<GameState, "isPursuerCatchingUp">): number;
```

#### Execution Flow / Logic

1. Initialize boolean false in factory, start/Continue and clear at checkpoint/final/timeout/caught/quit. Validate boolean type with existing RangeError guard. No storage schema migration: GameState is not persisted.
2. Helpers return previous ? distance>7 : distance>=30; motion returns active ? 50 : 240. Stage intervals become 600,500,400,300,250ms; goals/times/probabilities remain intact.
3. Correct input computes post-input distance and next mode, including jump +2. On first entry set nextPursuerStepAt=min(previousDeadline,now+50); otherwise retain deadline. Do not instantly move NPC or push deadline on repeated input.
4. Wrong input retains earlier deadline and caps at now+50 when active, else now+250. Recovery remains now+500; repeated recovering input cannot extend it.
5. Each NPC deadline moves one adjacent real route node. Compute new gap/mode AFTER movement and schedule next deadline from that state: active→at+50; inactive retains existing fall rule (at+250 only if it fits recovery deadline), otherwise stage interval. At gap7 no leftover fast deadline. Real route retention/lastPursuerMove stays valid offscreen.
6. Existing deadline loop retains stage-expiry priority, event/recovery ordering, immutable return values, delayed-vs-incremental equivalence. Settings pause shifts absolute deadlines; checkpoint freezes and Continue resets gap4/modefalse.

### I02. Both screens and motion

- Related Files:
  - `src/game/GameScreen.tsx` :: timer effect, pursuer motion effect, help — modify.
  - `src/descent/DescentGameScreen.tsx` :: tick effect, scene motion prop, help — modify.
  - `src/game/StairScene.tsx`, `src/descent/DescentScene.tsx` :: NPC travel style — modify.
  - `src/game/pixel/pixel-scene.css`, `src/descent/descent.css` :: NPC moving animation — modify.
  - `src/descent/descentViewState.ts` — read-only unless direct timing assumption requires repair.

#### Details

- Use shared poll50ms constant instead of100ms in both screens. Use shared motion duration in all NPC timeout/end checks and matching effect dependencies.
- Set CSS custom property `--pursuer-step-duration` to duration in ms on moving NPC group in both scenes, use var(--pursuer-step-duration,240ms). Keep positioning, facing, depth, player300ms, catch500ms, reduced-motion and pause cleanup intact.
- Help explains 30칸/0.05초/7칸 and fall priority without exposing developer implementation details.
- Main remains real five stages with scoped descent records; standalone remains DEV demo-only, single stage, no storage access. No auth/audio/assets/build config changes.

### I03. Regression and focused browser validation

- New `src/game/pursuerCatchUp.test.ts`: all stage intervals; factory/reset; legal input threshold29→30/jump29→31; no early mode; repeated input no deadline postponement; adjacent50ms route movement; gap8 remainsactive/gap7 exits; reentryonly30; fall priority and transition to250/base; delayed callbacks equivalence; immutable previous state; pause/Continue/terminal clear; malformed boolean rejection.
- `src/test/gameFixtures.ts` :: `withPursuitAt` — modify test-only reposition helper to initialize catch-up from requested gap (playing and gap>=30), choose50ms or stage base deadline, and reset mode for smaller gaps. This keeps old scene/score isolation fixtures coherent with the new state field.
- Update fixed old interval expectations in existing tests by semantic scenario, never global replacement of unrelated clocks. Relevant files: `src/game/{stageRules,gameEngine,timedPursuit,stairRoute,stairObstacles,stairSceneModel,StairScene,GameScreen}.test.*`, `src/descent/{descentEngine,descentSceneModel,descentViewState,DescentGameScreen,DescentScene,DescentTestApp}.test.*`. Other validation files are read-only unless a new rule demonstrably invalidates a fixture.
- Add screen/scene integration checks for50ms ticking and matching CSS duration in both entrypoints. Existing far-ahead manual states must model catch-up coherently; update obsolete idle90s expectation because active NPC now catches sooner.
- Run scoped suite below, lint/build/diff; log evidence outside repo under `%TEMP%/distance-based-pursuer-catch-up-2026-10-28/`. Inspect two actual local entrypoints in an owned isolated browser context for600ms baseline, legal threshold activation,50ms stepping to7, no duplicated timers/settings pause. Never touch user browser profile or records.

## Acceptance Criteria

- [x] Five base intervals exact, standalone600ms.
- [x] Threshold30/7 and50ms catch-up including fall/jump/late callbacks/pause/reset tested.
- [x] Both screens and NPC animation honor50ms with existing accessibility/input/records intact.
- [x] Scoped tests, lint, build, diff and two-entrypoint browser smoke pass; report actual counts and limitations.

## Validation

```powershell
npm.cmd test -- --run src/game/pursuerCatchUp.test.ts src/game/recordStorage.test.ts src/game/StairScene.test.tsx src/descent/descentEngine.test.ts src/descent/descentSceneModel.test.ts src/descent/descentGate.test.ts src/descent/DescentTestApp.test.tsx src/descent/descentViewState.test.ts src/descent/DescentGameScreen.test.tsx src/descent/DescentScene.test.tsx src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts src/auth/authConfig.test.ts --maxWorkers=2
npm.cmd run lint
npm.cmd run build
& 'C:/Program Files/Git/cmd/git.exe' diff --check
```

Browser driver stored in temporary evidence directory, both `http://127.0.0.1:5175/` and `/descent-test.html`; keep existing demo server. Existing stale App suite/chunk size warning are outside scope; no skip, timeout or config weakening.

## Commit Message

```text
feat(game): add distance-based pursuer catch-up to both local games

Plan: 2026-10-28-distance-based-pursuer-catch-up
Phase: P01-pursuit
Task: T01-distance-catch-up

- Set stage pursuit intervals to 600/500/400/300/250ms
- Accelerate at 30 stairs until the gap reaches 7, including falls
- Synchronize both screens and motion at 50ms and cover boundaries
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `43db38c`; plan docs `63a5773`.

## Validation Results — 2026-10-28

- 지정28파일 **754/754tests** 통과, skip0, workers2,63.48초. `regression-verified.log`. 신규 순수규칙25tests/각 화면 통합1test 추가. 기존 시간 기대값을 새 간격으로 갱신했고 timeout/skip/config는 바꾸지 않았다.
- lint 오류0/경고0: `lint-verified.log`; TypeScript/Vite build 통과: `build-verified.log`; git diff --check 통과.
- 처음 회귀727개 중44개는 기존 속도 기대값이어서 수정했다. 중간754검사 신규2개 실패는 화면 밖 NPC를 gap9에서 조회한 검증 오류였고, 한 개의 추가 실패는 DOM 방향 안내를 React batch 안에서 반복 읽은 fixture 오류였다. gap8에서 모션 검사/미리 계산한 합법 입력으로 수정했다. 잘못된 runtime boolean 테스트는 의도된 unknown 단언을 추가해 TypeScript검사를 통과했다. 실패 로그도 보존한다.
- 브라우저 `browser-smoke-final.log`/`browser-smoke.json`: Chrome156.0.8078.49, 격리 context2개, 메인1440×900/단독390×844. 기본600ms 경계·native D/J로gap30·21개 연속50ms 인접 이동·gap8 CSS0.05s·잘못된 Space 후500ms회복 중50ms유지·gap7에서250ms복귀·설정10초동결·남은250ms후기본600ms복귀 확인, Runtime예외0. 이 브라우저 시나리오는 Date.now 제어와 visibility reconciliation을 사용했고 실제 interval50ms는 양쪽 화면의 가짜 타이머 통합검사로 확인했다. 사용자 프로필/기록은 접근하지 않았다.
- 증거 폴더: `C:/Users/DEX/AppData/Local/Temp/distance-based-pursuer-catch-up-2026-10-28/`, 두 화면별 PNG2개·CDP helper/driver·전체 로그 보존.
- 빌드 JS554.49kB(gzip155.08)/CSS57.33kB(gzip10.97), 기존500kB chunk경고 유지. 기존 App suite/실제 Entra 로그인/스피커청취는 이번 검증 대상이 아니다.
- 메인 `/`와 단독 `/descent-test.html` HTTP200, 기존demo5175서버 유지. 신규 범위 밖 결함: 특이사항 없음.
