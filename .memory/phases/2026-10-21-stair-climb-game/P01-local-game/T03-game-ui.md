# Task: T03 게임 화면 및 조작

## Status: done

## Goal
인증된 사용자에게 밝은 2D 만화풍 계단 게임을 제공하고, 데스크톱 D/J 키와 모바일 앞으로/회전 버튼으로 게임 엔진을 조작하게 한다.

## Decision Summary
- 단일 반응형 화면에 점수, 3개 기회, 이벤트 게이지·남은 시간, 계단, 플레이어, 추격자를 표시한다.
- 잘못된 입력에는 현재 계단에서 0.5초 넘어짐 연출을 표시하고 그동안 입력을 잠근다. 효과음 재생은 T05에서 연결한다.
- 계단 시각 요소는 SVG/CSS로 그리며 외부 이미지 의존성은 추가하지 않는다.

## Implementation

### I01. 게임 화면과 상태 표시
- Related Files:
  - `src/game/GameScreen.tsx` :: 보호된 플레이 화면 — 신규
  - `src/game/GameHud.tsx` :: 점수·기회·이벤트 표시 — 신규
  - `src/game/StairScene.tsx` :: 계단·캐릭터·추격자 SVG — 신규
  - `src/game/game.css` :: 테마 및 반응형 스타일 — 신규
  - `src/App.tsx` :: 인증된 앱에서 `GameScreen` 표시 — 수정
- **Signatures & Types**:
  ```ts
  export function GameScreen(props: { account: AccountInfo }): JSX.Element;
  export function GameHud(props: { state: GameState; eventSecondsLeft: number }): JSX.Element;
  export function StairScene(props: { state: GameState }): JSX.Element;
  ```
- **Data & Schema Fields**: 컴포넌트는 `GameState`를 받아 표시한다. 이벤트 표시 초는 `Math.max(0, Math.ceil((eventEndsAt - nowMs) / 1000))`로 계산한다. 기회 UI는 `lives` 수만큼 채운 하트와 나머지 빈 하트를 보여준다.
- **Execution Flow / Logic**:
  1. `GameScreen`은 `createGameState` 결과를 React state에 두고, `ready` 상태에서는 `시작하기` 버튼을 표시한다. 버튼을 누르면 `startGame`을 호출하며 첫 D/J 또는 터치 입력부터 계단을 이동한다.
  2. `StairScene`은 좌우로 꺾이는 계단과 플레이어, 아래쪽 추격자를 단순한 SVG 도형으로 표시한다. 실제 경로 진행 방향과 화면의 다음 모퉁이 표시가 `GameState`와 맞아야 한다.
  3. `GameHud`는 점수, 남은 기회, 이벤트 진행률(`eventSteps / 30`), 이벤트 활성 중 남은 초를 표시한다.
  4. 이벤트 타이머가 활성 중이거나 `recoveryEndsAt !== null`이면 100ms 간격으로 `tickGame(Date.now())`를 호출한다. interval은 effect cleanup에서 해제한다.
  5. 시안은 밝은 하늘색/크림색 배경, 명확한 대비, 둥근 카드형 정보 표시를 사용한다. 한글 안내를 포함한다.
- **Error & Exception Handling**: `lastMistake`가 true이면 캐릭터에 `.is-falling` class를 주고 500ms 동안 기울어지고 낮아지는 연출을 한다. `prefers-reduced-motion`이면 변형 애니메이션을 생략해도 500ms 입력 잠금 규칙은 유지한다. 브라우저 탭이 비활성화된 뒤 돌아오면 현재 시간 기준으로 이벤트 만료와 넘어짐 회복을 반영한다.
- **State Transition & Return**: UI는 엔진 함수가 반환한 상태만 렌더링하고 규칙값을 별도 복제하지 않는다.

### I02. 키보드와 모바일 입력
- Related Files:
  - `src/game/GameScreen.tsx` :: 키보드 이벤트, 버튼 입력 — 수정
  - `src/game/ControlButtons.tsx` :: 터치 조작 — 신규
  - `src/game/game.css` :: 버튼 위치, 포커스·터치 상태 — 수정
  - `src/game/GameScreen.test.tsx` :: 입력 UI 테스트 — 신규
- **Signatures & Types**:
  ```ts
  export function ControlButtons(props: { onForward: () => void; onTurn: () => void; disabled: boolean }): JSX.Element;
  ```
- **Execution Flow / Logic**:
  1. `keydown`에서 `event.key.toLowerCase() === "d"`는 `forward`, `=== "j"`는 `turn` 입력을 전달한다.
  2. D/J 입력은 게임 영역이 포커스되지 않아도 동작하게 하되, `input`, `textarea`, `select`, `contentEditable` 내부에서는 가로채지 않는다. 입력을 처리할 때 `preventDefault`를 호출한다.
  3. 화면에는 좌우가 아닌 의미가 분명한 위쪽 화살표(전진)와 꺾임 화살표(회전) 두 버튼을 둔다. 버튼의 `aria-label`은 `앞으로 한 칸 오르기`, `방향을 바꾸며 오르기`로 지정한다.
  4. 터치 연속 입력은 버튼의 `onClick`으로 한 번씩만 전달한다. 포인터 down/up과 click을 중복 연결하지 않는다.
  5. 게임 종료 상태 또는 `recoveryEndsAt !== null`인 넘어짐 연출 중에는 이동 버튼을 비활성화한다.
- **Error & Exception Handling**: 이벤트 리스너는 effect cleanup에서 제거한다. 브라우저 단축키 충돌을 최소화하고 텍스트 입력 요소에서 키 입력을 삼킨다.
- **State Transition & Return**: 모든 입력은 `applyInput` 하나를 통해 상태를 갱신한다.

## Acceptance Criteria
- [x] D/J와 모바일 버튼이 동일한 게임 규칙을 호출한다.
- [x] 오입력 시 500ms 동안 넘어짐 연출과 입력 잠금이 보인다.
- [x] 좁은 모바일 화면에서도 HUD, 계단, 버튼이 겹치지 않고 조작 가능하다.
- [x] 점수·기회·이벤트 게이지·추격자 상태가 게임 엔진 값과 일치한다.
- [x] 키 입력의 중복 전달과 텍스트 필드 입력 간섭이 없다.

## Validation
- `npm run test -- --run src/game/GameScreen.test.tsx` — 키 매핑, 버튼 라벨, 종료 상태 비활성화 검증.
- `npm run lint` — ESLint 오류 없음.
- `npm run build` — TypeScript 및 프로덕션 빌드 성공.
- 수동 확인: 데스크톱 1280px와 모바일 390px 폭에서 레이아웃 및 D/J·터치 동작 확인.

## Commit Message
```text
feat(ui): build responsive stair climbing game screen

Plan: 2026-10-21-stair-climb-game
Phase: P01-local-game
Task: T03-game-ui

- Render route, player, pursuer, score, lives, and event gauge
- Connect D/J keys and mobile forward/turn controls
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (`npm run test -- --run`, `npm run lint`, `npm run build`; 1280px·390px 시각 확인)
- commit: `feat(ui): build responsive stair climbing game screen`
