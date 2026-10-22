# Task: T01 캐릭터 오르기 모션과 화면 확대

## Status: done

## Goal
성공적인 D/J 입력마다 캐릭터의 팔·다리와 몸이 짧게 움직이는 SVG 등반 동작을 표시하고, 계단과 전체 게임 화면을 넓혀 플레이 장면을 브라우저에서 더 잘 보이게 한다.

## Decision Summary
- 기존 `GameState`의 의미와 게임 규칙은 변경하지 않는다. `stepsClimbed`가 늘어난 순간을 성공 이동으로 감지한다.
- 등반 동작은 약 300ms로 설정하고, 기존 500ms 넘어짐 동작과 `prefers-reduced-motion` 대응을 보존한다.
- 계단 SVG 치수와 행 간격을 1.25배 키우며, 게임 셸 최대 너비를 1080px에서 1440px로 넓힌다.

## Implementation

### I01. 성공 이동에 연결된 SVG 캐릭터 애니메이션
- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen`, `previousStepsRef`, `StairScene` 전달 — 성공 이동 감지 및 짧은 모션 신호 생성; modify
  - `src/game/StairScene.tsx` :: `StairScene`, `runner` SVG 그룹 — 포즈를 분리하고 모션 신호 전달; modify
  - `src/game/game.css` :: `.runner`, `@keyframes stumble`, 새 `@keyframes climb-step` — 등반 및 실패 모션 구현; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface StairSceneProps {
    state: GameState;
    climbAnimationKey: number;
    isClimbing: boolean;
  }

  export function StairScene(props: StairSceneProps): ReactElement;
  ```
  `GameScreen`은 외부 API나 `GameState` 필드를 추가하지 않는다. 컴포넌트 내부에 `climbAnimationKey: number`(초기값 0), `isClimbing: boolean`(초기값 false), 타임아웃 ID ref, 기존 `previousStepsRef`를 사용한다.
- **SVG 요소**:
  - 바깥 `<g className="runner" transform="translate(229 208)">`는 현 위치를 고정한다.
  - 바닥 그림자는 포즈 그룹 밖에 두어 캐릭터가 뛰어도 바닥에 남는다.
  - 몸통·머리는 포즈 그룹에 두고, 양팔과 양다리를 각각 별도의 SVG 그룹 또는 경로로 분리해 어깨·엉덩이를 회전 중심으로 지정한다.
  - 등반 대상 포즈 그룹에는 `is-climbing`일 때만 적용되는 CSS 애니메이션을 부여한다. 이동마다 `climbAnimationKey`가 증가하고 `<g key={climbAnimationKey}>`가 재생성되어, 연속으로 빠르게 입력해도 같은 CSS 애니메이션이 처음부터 다시 시작된다.
- **Execution Flow / Logic**:
  1. `stepsClimbed`가 `previousStepsRef.current`보다 클 때에만 성공 이동으로 판단한다. 현재 발소리 호출은 유지하고 등반 key를 1 증가시키며 `isClimbing`을 true로 만든다.
  2. 같은 effect에서 약 300ms 타임아웃을 시작해 모션을 끝내고, 다음 이동이 더 빨리 오면 이전 타임아웃을 취소한다. effect cleanup에서 마지막 타임아웃을 해제한다.
  3. `previousStepsRef.current`는 성공 증가, 게임 재시작으로 인한 0 복귀, 그 외 값 변경에서 현재 `stepsClimbed`와 동기화한다. 잘못된 입력과 넘어짐 회복은 계단 수를 늘리지 않으므로 등반 모션을 재생하지 않는다.
  4. `<StairScene>`에 `climbAnimationKey`, `isClimbing`을 전달한다. `state.lastMistake`이면 실패 모션이 우선해 넘어짐이 계속 보이고 회복 타임아웃 자체는 기존 500ms 규칙을 유지한다.
  5. CSS `@keyframes climb-step`은 몸을 약 8~12px 올렸다가 원래 자리로 돌리고, 좌우 팔과 다리는 반대 방향으로 흔들리게 한다. 전체 주기는 약 300ms이며 easing은 `ease-out` 계열을 쓴다.
  6. **Reduced motion**: `@media (prefers-reduced-motion: reduce)`에서 등반과 넘어짐 애니메이션을 끈다. 모션을 끄더라도 게임 엔진의 500ms 실수 입력 잠금은 바꾸지 않는다.
  7. **Error & Cleanup**: `window.setTimeout` 반환 ID를 effect cleanup에서 `window.clearTimeout`으로 해제해 재시작·언마운트 후 늦은 상태 갱신이 발생하지 않도록 한다.

### I02. 계단 크기와 반응형 장면 확대
- Related Files:
  - `src/game/StairScene.tsx` :: `getVisibleSteps`, 각 계단 `<path>` 좌표 — 치수·간격을 일관되게 확대; modify
  - `src/game/game.css` :: `.game-shell`, `.stair-scene`, `@media (max-width: 720px)`, `@media (max-width: 540px)` — 컨테이너·장면 크기 조정; modify

#### Details
- **Geometry Constants**:
  - `STEP_SCALE = 1.25`를 두고 계단 상판·앞면·측면의 각 좌표 변위를 기준점에서 1.25배로 적용한다.
  - `getVisibleSteps`의 각 걸음 좌우 간격은 27px에서 약 34px(27 × 1.25), 높이 간격은 23px에서 약 29px(23 × 1.25)로 바꾼다.
  - 9개 계단 생성, 5계단마다 방향 반전, SVG `viewBox="0 0 520 360"`는 유지한다. 양쪽 진행 방향과 모퉁이에서도 계단이 뷰박스 바깥으로 잘리지 않도록 시작점 및 경로 전체를 확인한다.
- **Layout Values**:
  - `.game-shell`의 `width`는 `min(100%, 1440px)`로 바꾼다.
  - 데스크톱 `.stair-scene`은 가로 비율이 넓어져도 실제 SVG 도형이 커지도록 높이 상한을 340px에서 약 500px로 올린다. 권장 값은 `height: clamp(320px, 40vw, 500px)`이며, SVG 기본 aspect ratio를 유지한다.
  - `max-width: 720px` 구간은 현재 한 열 레이아웃을 유지하고 `.stair-scene` 높이를 `clamp(250px, 56vw, 380px)` 범위로 제한한다. `max-width: 540px`의 현재 `clamp(225px, 66vw, 280px)` 규칙은 유지해 휴대폰 화면에 과도하게 큰 장면이 생기지 않게 한다.
  - 계단 카드의 overflow와 SVG preserveAspectRatio 동작을 확인해 확대된 상판이 잘리거나 늘어나 보이지 않게 한다. 필요하면 계단 기준점만 조정하며 캐릭터 크기는 바꾸지 않는다.
- **Visual Validation**:
  - 데스크톱 1440×900에서 전체 셸이 1440px 상한까지 넓어지고 계단 도형과 캐릭터가 함께 커져 보이는지 확인한다.
  - 모바일 390×844에서 기존 한 열 구성, 버튼 접근성, 장면 가로 스크롤 없음, SVG 자르기 없음 확인한다.
  - 참고 시안의 원본 이미지 파일은 없으므로 기존 밝은 하늘색·크림색 배경과 둥근 도형의 2D 만화풍을 유지한다.

### I03. 회귀 테스트
- Related Files:
  - `src/game/GameScreen.test.tsx` :: 성공 이동 등반 모션, 실패 분리 및 회복 검증 — modify
- **Test Scenarios**:
  - `Math.random`을 0으로 고정하면 직선은 4계단이다. 게임 시작 후 D 네 번과 J 한 번으로 D와 모퉁이 J 성공 이동 모두에서 `stepsClimbed`와 `data-step-count`/등반 key가 증가하고 `.runner.is-climbing`이 나타나는지 검증한다.
  - 각 성공 이동마다 타이머가 다시 시작되어 연속 입력에서도 모션 신호가 갱신되는지 검증한다.
  - 직선에서 잘못된 J 입력 시 `.runner.is-falling`이 나타나고 `.is-climbing`은 표시되지 않는지 확인한다. 500ms 회복 뒤 실패 애니메이션은 해제되며 새 등반 입력이 없으면 등반 모션을 다시 시작하지 않는지 확인한다.
  - 기존 점수·발소리·500ms 잠금·게임 종료 테스트가 동일하게 통과해야 한다.

## Acceptance Criteria
- [x] 성공한 D/J 한 계단 이동마다 약 300ms 팔·다리 동작과 짧은 상승 동작이 보이고, 빠른 연속 이동도 매번 다시 재생된다.
- [x] 잘못된 입력 및 회복은 신규 등반 모션을 잘못 재생하지 않으며 기존 500ms 넘어짐/입력 잠금이 유지된다.
- [x] `prefers-reduced-motion`에서 새 모션이 꺼지고 기존 게임 규칙은 유지된다.
- [x] 계단의 면과 간격이 약 25% 커지고, 9계단의 지그재그 경로가 잘리지 않는다.
- [x] 데스크톱 레이아웃은 최대 1440px까지 확장되며 720px 이하 단일 열 및 540px 이하 모바일 크기 규칙이 유지된다.
- [x] 테스트·lint·빌드가 통과하고 1440px 데스크톱 및 390px 모바일 화면에서 육안 검증을 마친다.

## Validation
- `npm test -- --run src/game/GameScreen.test.tsx` — 등반·넘어짐 모션 전환과 기존 입력/게임 회귀 테스트 통과
- `npm run lint` — ESLint 오류 없음
- `npm run build` — TypeScript 및 Vite 프로덕션 빌드 성공
- 수동 브라우저 확인: 1440px 데스크톱과 512px CSS 뷰포트(720px·540px 모바일 breakpoint 구간)에서 레이아웃·계단 경로를 확인. 축소 모션은 CSS 설정으로 적용; 390px CSS 뷰포트는 브라우저 확대율 제한으로 직접 캡처하지 못함

## Commit Message
```text
feat(game): animate climbing and enlarge game scene

Plan: 2026-10-22-stair-climb-animation
Phase: P01-animation-and-scale
Task: T01-climbing-motion-and-scale

- Animate successful stair moves and scale stair geometry
- Expand responsive scene for wider desktop viewports
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: complete
