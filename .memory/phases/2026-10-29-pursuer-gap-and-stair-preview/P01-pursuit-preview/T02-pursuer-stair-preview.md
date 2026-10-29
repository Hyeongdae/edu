# Task: T02 Pursuer Stair Preview

## Status: done

## Goal

메인과 단독 장면에서 추격자 주변에 현재 경로의2~3개 발판이 캐릭터보다 먼저 나타나도록 하여, 캐릭터가 발판 없이 먼저 보이는 현상을 막는다.

## Decision Summary

- 실제 경로 index `pursuerIndex-1`, `pursuerIndex`, `pursuerIndex+1`만 후보로 쓴다. 경로 보관 범위 밖의 과거 index는 생략하고, 시작 직후에는 실제로 존재하는 현재/다음 발판만 쓴다.
- 기존 기본11개 발판과 후보를 index로 중복 제거하고 실제 route step의 좌표/방향을 사용한다. 임의 좌표·추가 RNG·가짜 계단 또는 폐기된 경로 재생성은 금지한다.
- 발판 표시 여부는 `pursuerVisible`과 분리한다. NPC는 기존 viewport/clipping/레이어 규칙을 따르고, 양쪽 renderer는 같은 scene model 계약을 사용한다.

## Implementation

### I01. 공유 장면 모델에 보조 추격 발판 추가

- Related Files:
  - `src/game/stairSceneModel.ts` :: `SceneStep`, `StairSceneModel`, `buildStairSceneModel` — 실제 경로로 보조 발판 계산; modify
  - `src/game/stairRoute.ts` :: `getRouteStep`, route 보관 인덱스 — 경로 검증/조회; read-only
  - `src/game/stairSceneModel.test.ts` :: 보조 발판 index/좌표/경계 테스트; modify
  - `src/descent/descentSceneModel.ts` :: `DescentSceneModel`, `buildDescentSceneModel` — 공유 발판 모델 전달; modify only if explicit projection is required
  - `src/descent/descentSceneModel.test.ts` :: 단독 투영 전달; modify only if model changes

#### Details

- **Signatures & Types**: `SceneStep`은 `{index:number; direction:Direction; x:number; y:number}` 의미를 유지한다. `StairSceneModel`에 아래 필드를 추가한다.
  ```typescript
  export interface StairSceneModel {
    steps: readonly SceneStep[]; // playerIndex-4 ... playerIndex+6, 기존 11개
    pursuerPreviewSteps: readonly SceneStep[]; // 기본 steps와 겹치지 않는 추격자 주변 실제 발판
    player: SceneActor;
    pursuer: SceneActor;
    catchFrames: readonly CatchFrame[];
    pursuerMotion: ScenePursuerMotion | null;
    pursuerVisible: boolean;
    playerJump: SceneJump | null;
  }
  ```
- **Data & Schema Fields**: 앱 상태나 저장 데이터는 바꾸지 않는다. `pursuerPreviewSteps`는 렌더링 모델 전용 `readonly SceneStep[]`; 실제 index 순서로 정렬하며 `steps`에 포함된 index를 제외한다.
- **Execution Flow / Logic**:
  1. 기본 `steps`와 현재 actor를 만드는 기존 `actorAt(index)`/`getRouteStep(route,index)` 경로를 재사용한다.
  2. 후보 index를 순서대로 `[state.pursuerIndex-1, state.pursuerIndex, state.pursuerIndex+1]`로 만든다. `route.steps[0].index`보다 작거나 마지막 보관 step의 index보다 큰 후보만 건너뛴다. 현재 actor와 잘못된 route는 기존 `RangeError` 검증을 유지한다.
  3. 기본11개 `steps`에 이미 있는 index를 제외하고 남은 후보를 `actorAt`으로 투영한다. 생성/랜덤 수열/route 유지 범위는 변경하지 않는다.
  4. 단독 모델은 공유 모델의 route/index/preview를 그대로 전달한다. 내려오는 장면의 기존 Y 반사와 DOM 층 순서를 유지한다.

### I02. 메인 및 단독 renderer에 선행 발판 그리기

- Related Files:
  - `src/game/StairScene.tsx` :: 기본 steps와 `.pursuer-history-stair` rendering, NPC/step overlay — preview merge와 순서; modify
  - `src/descent/DescentScene.tsx` :: 기본 steps와 `.descent-history-stair` rendering, NPC/step overlay — preview merge와 순서; modify
  - `src/game/StairScene.test.tsx` :: 기본 범위 겹침/화면 밖/이동 중 프레임; modify
  - `src/descent/DescentScene.test.tsx` :: 단독 동일 회귀; modify

#### Details

- 각 renderer는 기존 `steps` 및 `pursuerPreviewSteps`를 route index 순으로 합쳐 각 실제 계단을 한 번만 출력한다. 기본 계단 위에 별도 history stair를 이중으로 그리지 않는다.
- `pursuerPreviewSteps` 발판은 NPC가 화면 밖이어도 SVG/scene 내 발판 영역에 들어오면 먼저 보이게 한다. actor visibility predicate를 발판 visibility로 재사용하지 않는다. `pursuerVisible`, `data-pursuer-visible`, NPC 화면 경계 판단은 그대로 유지한다.
- 캐릭터가 이동 중일 때 실제 출발/도착 발판이 이동 전·중·후 계속 존재해야 한다. NPC pose/feet clipping 및 기존 top→actor→front 이동 overlay 의미를 유지하고, 새 preview 때문에 계단 앞면/노란선이 중복되거나 NPC가 계단 뒤로 가려지지 않게 한다.
- 실제 경계 장면에서 start `p=-4`, 기본11개 끝 `playerIndex+6`, 기본 범위와 중첩되는 route, p가 화면밖인 상태, 코너, 100ms 이동 전/후를 DOM 검사한다. PNG/browser 확인은 구현 검증 시 수행하고 viewport별로 발판이 캐릭터보다 먼저 나타나는 증거를 기록한다.

## Acceptance Criteria

- [x] 추격자 주변 2~3개의 실제 발판만 표시하고, 사용자가 선택하지 않은 전체 후방 경로를 만들지 않는다.
- [x] 기존11개와 보조 발판이 index별 한 번씩만 나타나며 실제 route column/direction으로 투영된다. route 생성 RNG 호출 수는 증가하지 않는다.
- [x] 발판은 NPC actor보다 먼저 준비되고 NPC가 화면 밖인 경우에도 해당 장면 안의 발판은 표시된다.
- [x] 메인/단독에서 코너, 화면 경계, 시작 직후 및 추격자 이동 시 발판/캐릭터의 가림·clip·위치가 일치한다. DOM 테스트로 검증; 브라우저 화면 캡처는 수행하지 못함.
- [x] 장애물/플레이어 점프, 이벤트30칸, 내부 gap 판정과 NPC visibility 경계는 변하지 않는다.

## Validation

- `npm.cmd test -- src/game/stairSceneModel.test.ts src/game/StairScene.test.tsx src/descent/descentSceneModel.test.ts src/descent/DescentScene.test.tsx src/game/pursuerCatchUp.test.ts src/game/timedPursuit.test.ts` — 모델·양쪽 renderer·이동/규칙 회귀 통과.
- `npm.cmd run lint` — lint 오류와 경고0.
- `npm.cmd run build` — TypeScript와 Vite build 통과.
- 브라우저 검증: 기존 로컬 demo `http://127.0.0.1:5175/`와 `http://127.0.0.1:5175/descent-test.html`에서 시작/코너/추격자 화면 진입 시 캡처하고, NPC가 도착하기 전에 발판이 렌더된 장면을 확인한다. 테스트 중 실제 사용자 기록/프로필은 변경하지 않는다.

## Commit Message

```text
fix(scene): preview stairs around the pursuer

Plan: 2026-10-29-pursuer-gap-and-stair-preview
Phase: P01-pursuit-preview
Task: T02-pursuer-stair-preview

- Project two to three nearby stairs from the retained route
- Render preview stairs before the pursuer in both scenes
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (6개 파일, 158 tests; lint/build 통과)
- 브라우저 캡처: 자동화 도구 부재로 미수행; DOM renderer 테스트로 보완
- commit: pending
