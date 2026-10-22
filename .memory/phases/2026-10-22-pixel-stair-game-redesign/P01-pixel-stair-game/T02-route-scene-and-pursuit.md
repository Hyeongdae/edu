# Task: T02 Route Scene and Pursuit

## Status: in_progress

## Goal
같은 경로 데이터로 중앙 플레이어, 지나온 4칸과 앞으로 갈 6칸, 계단을 따라오는 추격자를 표시한다. 정답 이동·실수 접근·모퉁이·접촉과 복귀를 실제 계단 좌표에 연결하고 추격자 몸 아래쪽만 가린다. 그림은 이 작업에서는 기존 SVG 캐릭터를 재사용하여 동작과 디자인 교체를 나눈다.

## Decision Summary
- 플레이어와 추격자가 공유 경로를 따르며, 추격자는 자신의 과거 모퉁이에서 방향을 바꾼다. 정답 입력은 현재 간격 유지, 실수는 간격 -1이다.
- 카메라는 플레이어를 중앙에 유지하고 계단과 추격자를 상대 좌표로 배치한다. 잡힘은 기존 500ms 안에 접촉 후 실제 지나온 경로의 4칸 뒤로 복귀한다.

## Implementation

### I01. 순수한 장면 좌표 모델
- Related Files:
  - `src/game/stairSceneModel.ts` :: 투영·가시 경로·인물/잡힘 위치; new
  - `src/game/stairSceneModel.test.ts` :: 경로와 투영 불변식; new
  - `src/game/stairRoute.ts` :: `getRouteStep`; read-only
  - `src/game/types.ts` :: `GameState`, `StairRouteStep`, `StairRoute`; read-only

#### Details
- **Input Contract from T01**:
  - `GameState.route.steps`는 플레이어 `stepsClimbed - 4`부터 `stepsClimbed + 18`까지 연속 노드 23개다.
  - `StairRouteStep = { index: number; column: number; direction: "left" | "right" }`다. index는 높이, column은 수평 격자 위치, direction은 그 계단으로 들어온 방향이다.
  - `getRouteStep(route, index)`는 정확한 노드를 반환하고 누락 시 RangeError를 던진다. 렌더링에서 난수를 뽑지 않는다.
- **Signatures & Types**:
  ```typescript
  interface ScenePoint { x: number; y: number; }
  interface SceneStep extends ScenePoint { index: number; direction: Direction; }
  interface SceneActor extends ScenePoint { index: number; direction: Direction; }
  interface CatchFrame extends ScenePoint { offset: number; index: number; }
  interface StairSceneModel {
    steps: readonly SceneStep[];
    player: SceneActor;
    pursuer: SceneActor;
    catchFrames: readonly CatchFrame[];
  }
  function projectRouteStep(step: StairRouteStep, playerStep: StairRouteStep): ScenePoint;
  function buildStairSceneModel(state: GameState): StairSceneModel;
  ```
- **Data & Schema Fields**:
  - SVG viewBox는 `0 0 520 400`이고 플레이어의 발 중심 기준점은 `(260, 216)`이다.
  - 투영식은 `x = 260 + (step.column - playerStep.column) * 34`, `y = 216 - (step.index - playerStep.index) * 28`이며 모든 좌표는 정수다.
  - `ScenePoint`는 인물의 발 중심/발판 기준점이다. 기존 계단 간격 33.75 × 28.75와 비슷한 34 × 28을 사용하여 크기를 유지한다.
  - `SceneActor.index`: 플레이어는 stepsClimbed, 추격자는 stepsClimbed - pursuerDistance다. 일반 표시에서 pursuerDistance는 1~4다. 두 direction은 해당 경로 노드에서 가져온다.
  - `CatchFrame.offset`: 0~1의 애니메이션 시간 위치다. 순서와 계단은 아래와 같다.

    | offset | index |
    | :--- | :--- |
    | 0 | playerIndex - 1 |
    | 0.20 | playerIndex |
    | 0.40 | playerIndex |
    | 0.55 | playerIndex - 1 |
    | 0.70 | playerIndex - 2 |
    | 0.85 | playerIndex - 3 |
    | 1 | playerIndex - 4 |

- **Execution Flow / Logic**:
  1. playerIndex 노드를 기준으로 뒤 4칸~앞 6칸의 11개 노드를 투영한다. 화면 미리보기 끝에 가짜 모퉁이를 만들지 않는다.
  2. 플레이어와 추격자 index를 조회하고 각자 direction을 가져온다. 플레이어가 코너를 지나도 추격자는 자신이 코너를 지날 때까지 이전 방향을 유지한다.
  3. 잡힘 프레임은 모두 현재 플레이어와 지나온 4칸의 실제 노드에서 계산한다. 고정 x 방향으로 뻗는 기존 잡힘 오프셋은 사용하지 않는다.
- **Error & Exception Handling**:
  - 누락된 경로, 1~4 밖의 pursuerDistance는 RangeError로 실패한다. 정상 엔진 경로에서 발생하면 고쳐야 하는 불변식 오류이며 임의 가짜 계단으로 대체하지 않는다.
- **State Transition & Return**:
  - 함수는 GameState/route를 변경하거나 난수를 소비하지 않는다. 같은 상태에서 항상 같은 좌표 모델을 반환한다.

### I02. 경로 렌더링과 인물의 앞뒤 관계
- Related Files:
  - `src/game/StairScene.tsx` :: `getVisibleSteps`, `getPursuerTransform`, `StairScene`; modify
  - `src/game/game.css` :: scene/runner/pursuer placement and animation; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface StairSceneProps {
    state: GameState;
    climbAnimationKey: number;
    isClimbing: boolean;
    pursuerAnimationKey: number;
    isPursuerCaught: boolean;
  }
  ```
  기존 props API를 유지한다. 모델의 index/direction/point로 배치하며 고정 좌표 생성 함수 두 개를 제거한다.
- **Data & Schema Fields**:
  - 기존 `data-testid="runner"`, `runner-pose`, `pursuer`, `route-direction`, `data-motion-key`, runner의 `data-step-count`를 보존한다. 두 placement group에는 `data-route-index`를 추가한다.
  - `data-testid="stair-step"`, `data-route-index`, `data-direction`을 각 발판 group에 둔다. 접근성용 SVG 설명은 다음 노드의 방향과 현재 추격 거리를 읽는다.
  - React `useId()`를 사용하여 마스크/clipPath ID를 장면 인스턴스마다 고유하게 만든다.
- **Execution Flow / Logic**:
  1. viewBox를 520 × 400으로 바꾸고 모델을 사용한다. 방향 안내는 route의 playerIndex+1 direction과 remaining을 읽는다. 임의의 다음 5칸 생성은 삭제한다.
  2. 발판 기본 크기는 너비 68, 윗면 깊이 24, 앞면 높이 16이다. 기준점 `(x,y)`에 대해 윗면 점은 `(x-34,y-12),(x,y-24),(x+34,y-12),(x,y)`, 앞면은 이 윗면의 아래 두 모서리에서 16 아래로 내려간 면이다. T03에서 이를 픽셀 스타일로 바꾸되 기준점/가림 계약은 유지한다.
  3. 정적 발판은 index가 큰 먼 계단부터 작은 가까운 계단 순으로 그린다. 각 발판의 윗면 → 해당 발판 인물 → 앞면 순서로 그려 인물의 발 부근만 앞면에 가려지게 한다. 전체 계단 앞면을 장면 마지막에 일괄 덮어 얼굴을 가리지 않는다.
  4. 인물 placement group은 모델 좌표로 이동시킨다. 기존 runner 도형의 발 중심 `(30,81)`, pursuer 도형의 발 중심 `(29,47)`를 내부 translate로 원점에 맞춘다. 인물 크기를 임의로 축소하지 않는다.
  5. 공통 발 마스크는 인물의 발 기준으로 x=-34~34, y=-88~-4 범위를 보이게 한다. 아래 4px만 제거하여 몸과 얼굴을 남긴다. 잡힘 이동 overlay에도 이 마스크를 적용한다.
  6. 정답 때 플레이어와 추격자가 새 노드로 이동하고 둘 다 짧은 hop을 재생한다. 같은 방향 구간에서는 카메라 보정으로 상대 좌표가 같아질 수 있지만 경로 index는 각각 +1이고 hop은 재생되어야 한다. 카메라는 스텝마다 새 중앙 좌표로 갱신한다.
  7. 잡힘 중에는 엔진이 거리를 4로 리셋한 최종 위치를 배치 기준으로 삼고, 별도 이동 group에서 모델 catchFrames의 오프셋을 재생한다. 정상 위치의 추격자를 동시에 그리지 않는다. 이동 중 추격자는 발 마스크와 함께 발판들 위의 overlay에 한 번만 그리며 플레이어는 마지막에 자기 발판 앞면과 함께 그려 얼굴이 유지되게 한다.
  8. 잡힘 CSS 변수는 각 프레임 좌표에서 리셋 위치 좌표를 뺀 값을 사용한다. SVG `transform-box: view-box`에서 x/520×100%, y/400×100%로 전달한다. 0/20/40/55/70/85/100% keyframe과 `steps(1,end)`로 계단별로 점프하고 500ms 내에 리셋 위치로 끝낸다. 기존 고정 `6.538%` 등의 경로 오프셋은 제거한다.
  9. 기존 scene heading/hint의 한국어와 aria-label은 유지한다. 배경의 완성된 회사 디자인은 T03에서 적용한다.
- **Error & Exception Handling**:
  - JSX/style에서 숫자 기반 CSS 변수만 만든다. 임의 스타일 텍스트 삽입을 사용하지 않는다.
  - 빠른 정답 입력 시 새 motion key가 최근 hop을 재시작한다. 애니메이션 때문에 입력/점수 처리를 지연하지 않는다.
- **State Transition & Return**:
  - 표시만 바뀌며 score, lives, route 데이터, 이벤트 시간은 렌더링에서 변경하지 않는다.

### I03. 이동/실수 이벤트와 500ms 경계 연결
- Related Files:
  - `src/game/GameScreen.tsx` :: climb/mistake effects, refs, scene props; modify
  - `src/game/game.css` :: `.pursuer.is-following`, caught/result visibility, reduced-motion; modify
  - `src/game/GameScreen.test.tsx` :: 추격 움직임과 회복 경계; modify

#### Details
- **Signatures & Types**:
  - UI 상태 `pursuerAnimationKey: number`, `isPursuerCaught: boolean`을 유지한다.
  - 실수 감지용으로 `previousRecoveryEndsAtRef: MutableRefObject<number | null>`, `previousLivesRef: MutableRefObject<number>`를 사용한다. 타입은 useRef 추론으로 구현해도 된다.
  - 기존 `previousMistakeRef`와 `previousPursuerDistanceRef`의 false→true/거리 증가 판정을 이 이벤트 감지로 대체한다.
- **Execution Flow / Logic**:
  1. 기존 성공 climb effect 안에서 플레이어 성공과 함께 `pursuerAnimationKey`를 한 번 증가시킨다. 발소리·score 팝업 호출 횟수는 늘리지 않는다.
  2. 새 실수는 `lastMistake`가 true이고 non-null `recoveryEndsAt`이 이전 값과 다를 때다. 500ms 직후 오답을 바로 받으면 boolean이 true→true일 수도 있으므로 boolean 전환만 보지 않는다.
  3. 새 실수에서 fall 음원을 한 번 호출하고 pursuerAnimationKey를 늘린다. `lives < previousLives`이면 잡힘이다. 회복이 끝나 lastMistake가 false가 되면 caught flag를 내린다. 각 effect 처리 뒤 이전 ref 값을 갱신한다.
  4. 재시작에서 lives가 늘고 stepsClimbed가 초기화되면 caught flag를 지우고 이전 토큰을 새 게임에 맞춘다. 이전 게임의 임시 위치가 새 경로에 적용되지 않아야 한다.
  5. `.pursuer.is-following`/`.is-approaching`/`.is-caught`는 idle bob보다 우선한다. `prefers-reduced-motion`에서는 각 구체 selector의 animation/transition을 모두 끈다. 위치는 즉시 최종 route 좌표로 반영한다.
  6. `data-pursuer-catching`과 결과 패널 visibility 규칙을 유지한다. 게임 오버 저장은 즉시, 일반 동작 설정에서는 회복 후 결과 공개, reduced-motion에서는 즉시 공개다. 추가 타이머를 만들지 않고 기존 300ms climb·500ms recovery 수명에 연결한다.
- **Error & Exception Handling**:
  - 컴포넌트 unmount에 기존 climb timeout을 정리한다. 게임 상태와 다른 타이머를 새로 만들지 않는다.
  - audioController가 없어도 모든 시각 동작이 작동해야 한다.

### I04. 경로 추격 검증
- Related Files:
  - `src/game/stairSceneModel.test.ts` :: 모델 검증; new
  - `src/game/GameScreen.test.tsx` :: UI 상태/오디오/회복 검증; modify

#### Details
- 고정 SVG translate 값에 묶인 이전 "fixed stair anchor" 테스트는 실제 route index/현재 gap/모퉁이 방향을 확인하는 테스트로 교체한다.
- 직진과 모퉁이 양쪽에서 playerIndex-pursuerIndex가 pursuerDistance인지 검증한다. 정답이면 두 index +1, 실수면 player 동일/pursuer +1이며 점수/기회는 기존 규칙대로다.
- 플레이어가 코너를 지나고 추격자는 아직 지나기 전인 경로 fixture에서 두 direction이 다르게 표시되는지 검증한다.
- catchFrames가 n-1→n→n-1→n-2→n-3→n-4 경로를 따르고, 코너에서도 각 점이 route 투영과 일치하는지 검증한다.
- 초기 게임의 -4 노드, visible 11개, 4·5·6칸 구간, 좌우 이동 모두 화면 범위 안인지 확인한다. 모퉁이 이후 표시된 새 구간 길이가 직전 구간과 다르고 입력 판정과 일치하는지도 확인한다.
- fake timers를 전부 진행하지 않고 `vi.setSystemTime`만 500ms 늘린 직후 연속 오답을 입력하여 lastMistake true→true 경계에서도 새 key/발 넘어짐 소리가 각각 한 번 증가하는지 검증한다.
- 기존 마지막 잡힘 즉시 저장, 회복 후 결과, 새 게임 restart 테스트를 유지한다. CSS 시각 동작은 브라우저에서 검증하며 픽셀별 스냅샷 테스트는 추가하지 않는다.

## Acceptance Criteria
- [ ] 보이는 계단과 D/J 판정이 같은 route를 사용하며 중앙 기준 뒤 4/앞 6칸이 표시된다.
- [ ] 추격자가 실제 지나온 경로에서 움직이고 자신의 모퉁이에서 방향을 바꾼다.
- [ ] 아래쪽만 가려지고 얼굴/몸 대부분이 보인다. 현재/잡힘 위치가 중복 렌더링되지 않는다.
- [ ] 잡힘과 복귀가 500ms 안에 실제 계단 경로를 따르고, 회복 경계에서도 실수 연출/소리가 누락되지 않는다.
- [ ] 마지막 결과 공개, 저장, 오디오, reduced-motion이 기존 계약을 충족한다.

## Validation
- `npm test -- --run src/game/stairSceneModel.test.ts src/game/stairRoute.test.ts src/game/gameEngine.test.ts src/game/GameScreen.test.tsx` — 통과.
- `npm run lint` — 통과.
- `npm run build` — 통과.
- 로컬 데모 브라우저 390×667, 1440×900에서 초기 -4칸, 모퉁이 전후 정답 이동, 실수 접근, 코너에서 잡힘/복귀, 마지막 결과 공개를 확인한다. reduced-motion에서는 위치만 반영되고 결과가 바로 보여야 한다.

## Commit Message
```text
feat(game): follow the shared stair path in the scene

Plan: 2026-10-22-pixel-stair-game-redesign
Phase: P01-pixel-stair-game
Task: T02-route-scene-and-pursuit

- Center the player with visible stairs ahead and behind
- Drive pursuit and catch choreography from route positions
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
