# Task: T01 게임 프레임 및 플레이 레이아웃

## Status: done

## Goal
로그인 후 ready/playing 화면에서 제목, 계단 장면, 점수 HUD, 시작 또는 모바일 조작을 단일 게임 프레임 안에 배치해 계단 장면이 뷰포트의 대부분을 차지하게 한다.

## Decision Summary
- `.stair-game`은 기존처럼 `100dvh` 뷰포트를 채운다. 화면은 기존 일러스트 스타일을 유지하고 브라우저 Fullscreen API는 호출하지 않는다.
- HUD는 장면 위쪽의 단일 반투명 가로 패널이다. 시작 버튼은 게임 프레임 아래쪽에 두며 플레이 조작 버튼은 720 CSS px 이하에서만 표시한다.

## Implementation

### I01. ready/playing 프레임 구조
- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen` — `.game-frame` 안에서 ready/playing 요소를 구성하고 화면 상태를 전달; modify
  - `src/game/StairScene.tsx` :: `StairScene` — 계단 장면을 확장 가능한 stage 영역으로 제공; modify only if a wrapper or class is required
  - `src/game/GameHud.tsx` :: `GameHud` — 기존 점수·기회·이벤트 정보와 접근성 라벨 유지; read-only unless a wrapper class is required
  - `src/game/ControlButtons.tsx` :: `ControlButtons` — 기존 앞으로/회전 버튼과 `GameInput` 콜백 유지; read-only
  - `src/game/game.css` :: `.stair-game`, `.game-shell`, `.game-header`, `.game-layout`, `.scene-card`, `.stair-scene`, `.game-hud`, `.game-controls`, `.start-button`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  type GameStatus = "ready" | "playing" | "game-over";
  interface GameScreenProps {
    account: AccountInfo;
    audioController?: AudioController;
    audioPreferences?: AudioPreferences;
    autoplayBlocked?: boolean;
    onAudioPreferencesChange?: (next: AudioPreferences) => void;
    onEnableAudio?: () => void;
  }
  ```
  기존 시그니처와 `GameStatus`를 유지하고 이 Task에서 게임 상태/점수 규칙을 추가하지 않는다.
- **Data & Schema Fields**:
  - 새 영속 필드나 서버 스키마를 만들지 않는다.
  - 새 `<div className="game-frame" data-game-status={gameState.status}>`가 기존 header, stage, status별 액션과 footer를 감싼다. `<main className="stair-game">`의 기존 status data attribute도 유지한다.
  - 새 `.game-stage`는 `position: relative`인 containing block이며 `GameHud`와 `StairScene`을 함께 소유한다. `.game-hud`는 stage 상단 overlay가 된다.
- **Execution Flow / Logic**:
  1. `GameScreen` 안에 단일 `.game-frame`과 중앙 `.game-stage`를 둔다. 기존 `.game-header`의 제목/로고는 프레임 안에 두고 ready 상태에서 시작 안내와 함께 표시한다. playing/game-over에서는 title header를 숨겨 scene 공간을 확보한다. 계정 표시는 T02에서 설정 창으로 옮긴다.
  2. `GameHud`를 stage 상단에 겹치며 반투명하게 배치한다. 점수 팝업, event progressbar, `aria-label` 및 test id를 유지한다.
  3. `StairScene` SVG가 남은 stage 공간을 채우도록 flex/grid track과 `min-width: 0`, `min-height: 0`를 지정한다. 기존 scene heading, runner SVG 및 live hint를 제거하거나 가리지 않는다.
  4. ready 상태는 프레임 아래쪽에 시작 버튼을 표시한다. playing 상태의 `ControlButtons`는 720 CSS px 이하에서 표시하고, 넓은 뷰포트에서는 `display:none`으로 숨긴다. PC 키보드 D/J 입력은 현재처럼 작동한다. frame 내부에는 T02의 설정 trigger가 위치할 오른쪽 위 공간을 남긴다.
  5. 기존 게임 종료 패널은 이 Task에서 기능 변경하지 않고 레이아웃 호환성을 유지한다. 결과의 장면 오버레이 전환은 T03 범위다.
  6. 높이 667px 및 좁은 폭에서도 header/HUD/stage/action이 프레임 안에서 줄어들도록 작은 화면 규칙을 추가한다. 상호작용 요소를 `display:none`으로 없애지 않는다.
- **Error & Exception Handling**: 게임 상태 전이와 props가 기존 동작을 유지한다. 작은 뷰포트에서 넘치는 scene artwork는 stage 내부에서 비율을 보존해 줄이고 document-level scroll을 만들지 않는다.
- **State Transition & Return**: `ready`에서 start click 후 기존 `playing`; playing input은 기존 `applyInput` 규칙. 반응형 CSS 외에 상태 전이를 바꾸지 않는다.

### I02. ready/playing 회귀 테스트
- Related Files:
  - `src/game/GameScreen.test.tsx` :: `GameScreen controls` — ready와 playing의 HUD·게임 scene·버튼 존재 및 입력 연동 검증; modify

#### Details
- ready에서 게임 프레임, HUD의 현재 점수/기회/event gauge, 시작 버튼, scene을 검증한다.
- 시작 후 D가 점수를 올리고, 기존 event HUD 접근성 정보와 test id가 유지되는지 검증한다.
- 모바일 조작 버튼 콜백이 기존 게임 규칙을 호출하는지 유지한다. CSS media query 자체는 브라우저 viewport 확인으로 검증한다.

## Acceptance Criteria
- [x] ready/playing에서 계단 장면과 HUD가 단일 게임 프레임 안에 놓인다.
- [x] 시작 버튼은 프레임 하단에 있고, 조작 버튼은 720px 이하에서만 표시된다.
- [x] 지정 viewport 1440×900, 1280×720, 390×844, 390×667에서 ready/playing 화면이 페이지 스크롤 없이 표시된다.
- [x] 점수 피드백, event gauge, D/J 키 및 모바일 버튼의 기존 기능이 유지된다.

## Validation
- `npm test -- --run src/game/GameScreen.test.tsx` — GameScreen 테스트 통과
- `npm run lint` — ESLint 오류 없음
- `npm run build` — TypeScript 검사 및 Vite build 통과
- `npm run dev` 후 1440×900, 1280×720, 390×844, 390×667에서 ready/playing 확인 — document의 scrollWidth/scrollHeight가 viewport를 넘지 않고 계단 장면이 남은 공간을 차지함

## Commit Message
```text
feat(game): integrate the main play screen

Plan: 2026-10-22-immersive-stair-game-ui
Phase: P01-immersive-game-ui
Task: T01-game-frame-layout

- Place the stair scene and HUD inside one game frame
- Keep start and mobile controls inside the frame
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in Git history
