# Task: T04 Pixel Game Interface

## Status: pending

## Goal
T03의 네온 회사 실내 장면과 HUD·입력 버튼·설정창·오디오 설정·결과·랭킹이 하나의 픽셀 게임으로 보이게 만든다. 전체 화면 안에서 게임 장면을 크게 유지하고 모바일/키보드/설정 접근성과 기존 데이터 동작을 보존한다.

## Decision Summary
- 픽셀 디자인은 게임 장면뿐 아니라 게임 내부 UI 전체에 적용한다. 상단 HUD, 우측 상단 설정, 모바일 아래 두 조작 버튼, 게임 안의 결과/랭킹 구조를 유지한다.
- 계단실 중심의 회사 내부/창밖 네온 도시와 같은 팔레트를 사용하며 글자는 한국어를 읽기 쉽게 유지한다. 게임 규칙·인증·저장·음원 변경은 이 작업에 포함하지 않는다.

## Implementation

### I01. 픽셀 UI 테마와 공통 아이콘
- Related Files:
  - `src/game/pixel-theme.css` :: 게임 내부 UI 테마/반응형/상태; new
  - `src/game/pixel/PixelIcon.tsx` :: 장식 픽셀 아이콘; new
  - `src/game/GameScreen.tsx` :: 테마 class/import, 장식 아이콘; modify
  - `src/game/GameHud.tsx` :: 픽셀 하트; modify
  - `src/game/ControlButtons.tsx` :: 픽셀 화살표; modify
  - `src/game/game.css` :: 충돌하는 scene/게임 오버 반응형 규칙; modify only where necessary

#### Details
- **Previous Task Contracts**:
  - `GameState.route`가 실제 경로이고 게임 scene은 520×400 좌표, 발 기준 간격 34×28, 중앙 플레이어/뒤 4/앞 6칸을 쓴다.
  - `StairScene`은 절대 배경 `office-backdrop` SVG와 경로 `stair-scene` SVG를 분리한다. backdrop은 slice, 경로는 meet이며 캐릭터는 정수 격자 PixelOfficer young/older다.
  - `.game-frame`의 `data-game-status`와 `data-pursuer-catching`은 기존 저장·잡힘·결과 노출을 제어한다. 이 속성을 시각 상태 용도로만 유지한다.
- **Signatures & Types**:
  ```typescript
  type PixelIconName = "forward" | "turn" | "settings" | "close"
    | "heart" | "flag" | "restart" | "stair";
  interface PixelIconProps {
    name: PixelIconName;
    size?: number;
    className?: string;
  }
  function PixelIcon(props: PixelIconProps): ReactElement;
  ```
  - 기본 size는 24 CSS px, viewBox는 16×16이다. 정수 rect/path, `shapeRendering="crispEdges"`, `fill="currentColor"`, `aria-hidden="true"`, `focusable="false"`로 출력한다.
  - GameScreen/GameHud/ControlButtons/AudioControls/LeaderboardPanel의 공개 props는 변경하지 않는다.
- **Data & Schema Fields**:
  - `<main className="stair-game pixel-theme">`로 범위를 제한한다. `pixel-theme.css`는 GameScreen에서 기존 game.css 뒤에 import한다.
  - `.stair-game.pixel-theme`의 CSS 변수: `--pixel-bg:#0b1026`, `--pixel-wall:#171e3b`, `--pixel-panel:#242b4a`, `--pixel-text:#eef7ff`, `--pixel-muted:#a8b5cd`, `--pixel-cyan:#61e8e1`, `--pixel-pink:#f07cbd`, `--pixel-gold:#ffd27a`.
  - 런타임 모델/저장 필드 추가 없음. 아이콘은 기존 텍스트 label/aria-label을 대체하지 않는 장식이다.
- **Execution Flow / Logic**:
  1. 게임 영역의 흰 카드/큰 둥근 모서리/부드러운 그림자/유리 blur를 짙은 패널, 2~4px 직선 테두리, 단계진 모서리, 오프셋 box-shadow로 바꾼다. 네온 색은 경계·선택 상태·이벤트 강조에 사용한다.
  2. 점수와 영문/숫자는 monospace를 사용하고, 한글 본문은 로컬 시스템 한글 폰트로 읽기 좋게 유지한다. 외부 CDN 폰트를 새로 가져오지 않는다. 점수 `font-variant-numeric: tabular-nums`와 +1/+2 피드백은 유지한다.
  3. gear/close/flag/restart/stair 장식과 모바일 forward/turn 화살표, 하트 3개를 PixelIcon으로 바꾼다. 기존 ♥/⚙/🏁 등의 플랫폼별 문자 아이콘과 둥근 stroke 화살표를 게임 UI에서 제거한다. 주변 label과 `data-testid`는 유지한다.
  4. 하트는 같은 세 슬롯에서 is-full class와 기존 `남은 기회 N회` aria-label을 사용한다. 이벤트 게이지는 사각 픽셀 칸/눈금으로 표현하되 progressbar의 0~30 값과 기존 시간/점수 의미를 유지한다.
  5. 새 테마는 `.stair-game.pixel-theme ...` 선택자를 사용해 기존 game.css/audio.css보다 구체적으로 적용한다. 기존 레이아웃을 무작정 뒤에 덮어쓰는 규칙을 여러 위치에 쌓지 않는다. 새 테마 규칙은 파일 한 곳에 모으고, 직접 충돌하는 오래된 scene/게임 오버 축소 규칙만 정리한다.
- **Error & Exception Handling**:
  - 배경이 어두워져도 disabled/focus/muted/error 상태를 색상 하나만으로 구분하지 않게 테두리·text·aria 상태를 유지한다.
  - 테마 범위는 게임 화면으로 한정한다. Entra 로그인과 인증 구성 메시지의 기능에 영향을 주는 전역 :root/body 변경은 하지 않는다.
- **State Transition & Return**:
  - 기존 상태 값에 따른 표현만 바꾸며 이벤트/score/save/audio 동작은 그대로 연결한다.

### I02. 전체 화면 장면과 반응형 UI
- Related Files:
  - `src/game/pixel-theme.css` :: 전체 화면/overlay/반응형; new
  - `src/game/game.css` :: 기존 모바일 축소/desktop controls 규칙; modify where conflicting
  - `src/game/StairScene.tsx` :: 레이어용 class가 필요할 때만 modify

#### Details
- **Execution Flow / Logic**:
  1. 게임은 기존 100dvh/100svh 높이와 safe-area 처리를 사용한다. frame은 모바일 padding 0, desktop 최대 8px 수준으로 화면을 채운다. 배경은 frame 전체에 깔리고 흰 여백이나 별도 dashboard header를 만들지 않는다.
  2. HUD는 게임 안의 상단 overlay이며 설정은 우측 상단 44×44px 버튼이다. 모바일에서는 HUD가 설정 버튼 52px 영역을 침범하지 않게 폭을 제한하고, 세 카드에 `minmax(0,...)`를 적용한다. 숫자·하트·게이지가 폭을 강제로 늘리지 않아야 한다.
  3. scene의 기존 124~154px 흰 카드 padding과 카드 배경을 제거하고, 배경 SVG는 전체 frame을 채운다. 방향 안내는 HUD 아래의 짧은 인게임 overlay, hint는 조작 버튼 위에 둔다. 게임플레이 SVG에는 위 HUD/안내와 아래 버튼의 안전 공간을 확보해 중앙 캐릭터/뒤 4칸/앞 6칸이 가려지지 않게 한다.
  4. 데스크톱에서는 키보드 D/J 조작과 조작 안내를 제공한다. 기존 721px 이상에서 `.game-controls`를 숨기는 동작은 유지한다. 모바일에는 원래 두 버튼을 하단에 유지하고 높이 최소 56px, touch-action과 safe-area를 보존한다.
  5. 설정 backdrop은 게임 위의 짙은 반투명 픽셀 패널이며 blur는 쓰지 않는다. 내부 창은 높이 부족 시 자체 scroll로 account/audio/help/close를 모두 접근할 수 있게 한다. body 전체가 가로로 늘어나지 않게 한다.
  6. 결과/랭킹은 계단 장면 위의 인게임 패널이다. desktop은 결과+랭킹 2열, 좁은 화면은 읽을 수 있는 폭을 우선하여 필요 시 1열과 내부 scroll을 사용한다. TOP10이 길어도 restart/close 접근을 막지 않는다.
  7. 기존 `.stair-game[data-game-status="game-over"] .game-layout`의 모바일 `flex: 0 0 140px` 등 과거 장면 축소 규칙이 새 프레임에 적용되지 않도록 해당 충돌 규칙을 제거하거나 새 테마 범위에서 명시적으로 해제한다. 장면은 게임 오버 때도 배경 전체를 유지한다.
  8. `data-pursuer-catching="true"` 동안 결과 패널 visibility hidden/pointer-events none을 유지한다. reduced-motion에서는 구체성이 같은 새 테마 선택자로 visibility visible/pointer-events auto를 되돌린다.
  9. reduced-motion 규칙은 기존 runner/climb/pursuer-following/approaching/caught/score/event와 새 pixel officer 프레임 모두를 포함한다. neon 배경은 정적으로 표현한다. 테마 선택자의 우선순위 때문에 애니메이션이 다시 켜지지 않게 한다.
- **Error & Exception Handling**:
  - 320px 폭, 667px 높이, 큰 글자/긴 이름/큰 점수에서 UI가 frame 밖으로 나가지 않게 min-width 0, 내부 scroll, 말줄임 등을 각각 필요한 곳에 적용한다.
  - 창 크기가 바뀌어도 route를 재생성하거나 gameState를 reset하지 않는다.
- **State Transition & Return**:
  - ready/playing/game-over/settings 상태마다 동일한 게임 frame과 시각 체계를 유지한다.

### I03. 오디오·설정·결과 기능 보존
- Related Files:
  - `src/audio/AudioControls.tsx`, `src/audio/audio.css` :: 기존 native range/mute markup와 스타일 우선순위; read-only reference
  - `src/leaderboard/LeaderboardPanel.tsx` :: 결과 리스트 class/현재 사용자 강조; read-only reference
  - `src/game/GameScreen.test.tsx`, `src/audio/AudioControls.test.tsx`, `src/leaderboard/LeaderboardPanel.test.tsx` :: 회귀 검증; modify only if markup assertions require it
  - `src/App.test.tsx` :: 기존 설정창 기대값 문제; read-only, outside-scope finding

#### Details
- AudioControls는 기존 배경음/효과음 native range 입력, 0~100 값, aria-label, 음소거 aria-pressed, 음악 켜기 fallback을 유지한다. 새 skin은 `.stair-game.pixel-theme .settings-dialog .audio-controls`처럼 명확히 범위를 둔다. webkit/Firefox slider track/thumb를 사각 픽셀 스타일로 표현하되 native 키보드 조작을 유지한다.
- 설정은 Escape 닫기, Tab focus trap, 최초 닫기 버튼 focus, 닫은 뒤 설정 진입 버튼 focus 복귀를 유지한다. 열려 있을 때 D/J/터치 입력은 차단되고 이벤트 남은 시간은 현재 보존 로직대로 재개된다.
- leaderboard의 TOP10 정렬/현재 사용자 강조/저장 실패 문구는 유지한다. 아이콘 교체 때문에 textContent/aria 이름이 사라지지 않아야 한다.
- 테스트는 바뀐 장식 마크업이 기존 행동 테스트를 깨는 경우에만 해당 단언을 갱신한다. CSS class/색/픽셀 수를 복제하는 새 단위 테스트는 추가하지 않는다.
- App.test.tsx의 기존 "설정창을 열지 않고도 계정·오디오가 보인다" 기대값은 범위 밖 참고 항목으로 기록한다. 이 계획의 작업에 해당 테스트 수정을 추가하지 않는다.
- 기존 도움말의 "세 번 실수" 문구는 결정문에서 별도 검토 항목이다. 시각 변경을 하면서 임의로 게임 규칙이나 해당 문구 수정까지 포함하지 않는다.

## Acceptance Criteria
- [ ] HUD/조작/설정/오디오/결과/랭킹이 네온 회사 장면과 같은 픽셀 UI로 보인다.
- [ ] 게임이 브라우저 영역을 크게 채우고 모든 HUD·버튼·패널이 게임 내부에 있다.
- [ ] 모바일 두 버튼, 우측 상단 설정, 키보드 focus, audio range, 오류/빈 랭킹 표시가 정상이다.
- [ ] 뒤 4/앞 6칸과 인물 얼굴이 HUD/소품/패널에 불필요하게 가려지지 않는다.
- [ ] 잡힘 500ms 공개 순서, reduced-motion 즉시 결과, 점수/오디오/인증/저장 계약이 유지된다.

## Validation
- `npm test -- --run src/game/stairRoute.test.ts src/game/stairSceneModel.test.ts src/game/gameEngine.test.ts src/game/GameScreen.test.tsx src/audio/AudioControls.test.tsx src/leaderboard/LeaderboardPanel.test.tsx` — 대상 기능/접근성 회귀 통과.
- `npm run lint` — 통과.
- `npm run build` — 통과. 기존 bundle 크기 경고는 오류와 구분하여 보고한다.
- 로컬 데모 브라우저 320×667, 390×667, 768×1024, 1440×900에서 ready/playing/settings/game-over를 확인한다. 가로 page overflow가 없어야 하고, 설정·랭킹의 긴 내용은 패널 안에서 scroll되어야 한다.
- 실제 브라우저에서 normal/reduced-motion 각각 코너 이동, 실수, 잡힘, 최종 저장/공개를 확인한다. 설정창의 Tab/Escape/복귀 focus, 오디오 range/음소거, 이벤트 pause/resume도 확인한다.
- 검증용 브라우저는 기존 로컬 데모만 사용한다. Entra ID/외부 배포/사내 공유 설정을 바꾸지 않는다. 임시 검증 서버는 실행자가 시작한 것만 정리한다.

## Commit Message
```text
feat(game): unify the pixel game interface

Plan: 2026-10-22-pixel-stair-game-redesign
Phase: P01-pixel-stair-game
Task: T04-pixel-game-interface

- Skin the HUD controls settings and results as pixel UI
- Preserve responsive play and accessible game flows
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
