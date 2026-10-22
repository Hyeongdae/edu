# Task: T01 전체 뷰포트 게임 레이아웃

## Status: done

## Goal
로그인 후 게임 화면의 모든 기존 UI를 브라우저 뷰포트 안에 표시한다. 데스크톱과 모바일에서 페이지 세로 스크롤을 만들지 않고, 창 크기에 따라 간격과 계단 장면을 줄여 HUD·오디오 설정·안내·조작과 종료 랭킹을 계속 볼 수 있게 한다.

## Decision Summary
- `.stair-game`이 브라우저 창의 전체 가용 너비와 높이를 사용한다. 브라우저 Fullscreen API는 추가하지 않으며 로그인 화면은 수정하지 않는다.
- 화면 요소를 숨기지 않는다. 작은 화면은 간격과 장면 크기를 유연하게 줄이고, 종료 화면의 TOP 10 랭킹만 필요할 때 카드 내부에서 스크롤되게 한다.

## Implementation

### I01. 게임 상태를 레이아웃 CSS에 전달

- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen` 반환부의 `<main className="stair-game">` — ready/playing/game-over 상태를 root data attribute로 전달; modify

#### Details
- **Signatures & Types**:
  ```typescript
  type GameStatus = "ready" | "playing" | "game-over";
  ```
  기존 `GameState.status` 타입을 재사용하고 새 prop이나 별도 상태는 만들지 않는다.
- **Data & Schema Fields**:
  - `<main className="stair-game">`에 `data-game-status={gameState.status}`를 추가한다.
  - 게임 모델, 계정 데이터 및 인증 흐름은 변경하지 않는다.
- **Execution Flow / Logic**:
  1. 현재 `gameState.status`를 `data-game-status`에 렌더한다.
  2. CSS는 이 값을 이용해 종료 랭킹 영역의 공간 배분을 조정한다.
  3. 화면 상태 변경은 기존 게임 엔진 결과를 따르며 레이아웃 전용 로직을 React에 추가하지 않는다.
- **Error & Exception Handling**: 유효한 상태는 `GameStatus` union 타입으로 제한되어 별도 오류 경로가 없다.
- **State Transition & Return**: ready, playing, game-over 상태 변경마다 root attribute가 동일 렌더 주기에 갱신된다.

### I02. 뷰포트 높이 및 너비에 맞는 레이아웃

- Related Files:
  - `src/game/game.css` :: `.stair-game`, `.game-shell`, `.game-layout`, `.stair-scene`, `.game-side-panel`, `.game-over-panel`, `.leaderboard-card`, 반응형 미디어쿼리 — 게임 영역과 내부 요소의 크기 배분; modify
  - `src/audio/audio.css` :: `.audio-controls`, 오디오 반응형 미디어쿼리 — 전체 뷰포트에 포함되는 사운드 설정 높이 조정; modify

#### Details
- **Layout Rules**:
  - `.stair-game`은 `height: 100vh` fallback 뒤에 `height: 100dvh`를 사용하고, `min-height: 100svh`, `min-height: 0` 조합을 검토해 주소창 변화에 따른 모바일 뷰포트를 처리한다. 게임 main은 세로 overflow를 막아 바깥 페이지가 스크롤되지 않게 한다.
  - `.game-shell`의 기존 `max-width: 1440px` 제한을 없애고 `width: 100%`, `height: 100%`, `min-height: 0` 및 세로 flex/grid 레이아웃을 적용한다. 기존 배경과 시각 스타일은 유지한다.
  - 헤더, 오디오 설정, HUD, 시작/조작 버튼, footer는 필요한 높이를 유지한다. 남은 높이는 `.game-layout`과 `.stair-scene`이 사용하도록 `min-height: 0`과 flex/grid track을 명시한다.
  - 현재 미디어 쿼리의 모바일 단일 열 배치를 유지한다. 모바일에서도 안내·추격 카드는 한 화면에 남기고, 작은 화면에서 카드 간격과 padding을 줄인다.
  - 좁거나 낮은 뷰포트에서 기존 고정 `clamp()` scene 높이가 flex 영역을 밀어내지 않도록 scene을 부모 높이에 맞춰 줄인다. 계단 SVG는 기존 `preserveAspectRatio` 동작으로 비율을 유지한다.
  - `@media (max-height: 760px)` 등 낮은 높이 구간에서 header, HUD, audio controls, card paddings와 gap을 단계적으로 압축한다. 요소를 `display:none`으로 숨기지 않는다.
  - 게임 종료 상태에서도 scene, 결과, 재시작, 랭킹, footer가 viewport 레이아웃 안에 남도록 game-over 영역을 `min-height: 0`으로 제한한다. TOP 10 행이 가용 높이를 넘으면 `.leaderboard-card` 내부에서 세로 스크롤한다.
  - 오디오 설정은 계속 표시하고 입력 가능 상태를 유지한다. 화면이 낮을 때 `.audio-controls`의 grid gap/padding을 줄이되 range input과 mute/enable 버튼을 숨기지 않는다.
- **Mobile viewport**: 모바일 주소창이 확장/축소될 때 실제 가용 높이에 맞추도록 `dvh`를 사용하고, 하단 안전 영역 padding은 `env(safe-area-inset-bottom, 0px)`로 유지한다.
- **Error & Exception Handling**: 추가 런타임 로직이나 외부 의존성 없음.
- **State Transition & Return**: 레이아웃은 ready/playing/game-over 각 상태에서 같은 viewport 크기를 사용하고, 콘텐츠 공간 배분만 상태에 맞게 CSS로 수행한다.

### I03. 화면 레이아웃 회귀 확인

- Related Files:
  - `src/game/GameScreen.test.tsx` :: `describe("GameScreen controls")` — 세 게임 상태에 root data attribute가 반영되고 필수 주요 UI가 유지되는지 확인; modify

#### Details
- ready 상태에서 `data-game-status="ready"`, 시작 버튼, HUD, 안내 카드, chase 카드, audio controls를 확인한다. 오디오 prop은 기존 테스트 fixture 방식으로 전달한다.
- D 입력으로 playing 상태가 되면 `data-game-status="playing"`, 조작 버튼 및 필수 카드가 존재하는지 확인한다.
- 기존 12회 실패 게임오버 테스트에서 `data-game-status="game-over"`, 결과, 재시작 버튼과 랭킹을 확인한다.
- 이 React 테스트는 상태 및 UI가 제거되지 않았음을 확인한다. 픽셀 크기와 overflow는 브라우저에서 다음 뷰포트로 수동 확인한다: 데스크톱 `1440×900`, 작은 노트북 `1280×720`, 모바일 `390×844`, 낮은 모바일 `390×667`.
- 각 뷰포트에서 document 세로 스크롤 없이 주요 UI가 보이는지 확인한다. TOP 10이 game-over 화면 높이를 넘는 경우 페이지가 아니라 랭킹 카드 안에서만 스크롤되는지 확인한다.

## Acceptance Criteria
- [x] 게임 화면이 브라우저 viewport 전체 너비와 높이를 채우며 1440px 최대 너비 제한이 사라진다.
- [x] 데스크톱과 모바일의 ready/playing 화면에서 page-level 세로 스크롤 없이 header, 오디오, HUD, scene, 안내 카드, 시작/조작 버튼, footer가 표시된다.
- [x] game-over 상태에서도 결과, scene, 랭킹, 재시작 UI를 유지하고 TOP 10 초과 높이만 랭킹 내부 스크롤을 사용한다.
- [x] 낮은 높이에서 요소를 숨기지 않고 간격과 scene 높이를 조절한다.
- [x] 로그인 및 오류 안내 화면에는 변경이 적용되지 않고 브라우저 Fullscreen API를 호출하지 않는다.
- [x] 지정한 4개 viewport에서 레이아웃을 확인하고, 전체 프로젝트 lint/build와 GameScreen 회귀 테스트가 통과한다.

## Validation
- `npm test -- --run src/game/GameScreen.test.tsx` — 상태별 GameScreen 회귀 테스트 통과.
- `npm run lint` — ESLint 오류 없음.
- `npm run build` — TypeScript 검사 및 Vite 빌드 통과.
- 수동 브라우저 확인: `npm run dev` 실행 후 1440×900, 1280×720, 390×844, 390×667 뷰포트에서 ready/playing/game-over를 확인. 각 상태에서 document 세로 스크롤이 없고 게임오버 랭킹만 필요 시 내부 스크롤인지 확인.

## Commit Message
```text
feat(game): fit game layout to viewport

Plan: 2026-10-22-fullscreen-game
Phase: P01-viewport-layout
Task: T01-viewport-game-layout

- Fill the browser viewport across desktop and mobile sizes
- Keep all game states visible and constrain leaderboard scrolling internally
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in Git history
