# Decisions: Pursuer Follow Animation

- Date: 2026-10-22
- Status: Confirmed

## D01. 추격자 이동 조건
- **Chosen**: 플레이어가 잘못 입력할 때마다 추격자 그림이 계단 한 칸씩 가까워진다. 기존 `pursuerDistance`와 게임 규칙에 맞춰 4칸에서 시작하고, 실수마다 한 단계 줄어든다.
- **Rationale**: 이미 실수할 때마다 추격자가 가까워지는 규칙이 있어 그림도 같은 시점에 움직이면 거리를 알아보기 쉽다.

## D02. 일반 추격 이동 방식
- **Chosen**: 부드럽게 미끄러지는 대신 계단 한 칸씩 점프하듯 이동한다.
- **Rationale**: 계단을 실제로 따라 올라오는 느낌을 주고, 게임의 거리 단위와 움직임을 맞춘다.

## D03. 따라잡았을 때의 연출
- **Chosen**: 추격자가 플레이어에게 닿는 짧은 연출을 보여주고, 시작 위치로 빠르게 점프해 돌아간다. 기존처럼 기회 하나를 잃고 추격 거리는 4칸으로 초기화한다.
- **Rationale**: 따라잡힌 순간을 명확히 보여주면서 기존 생명·거리 규칙을 유지한다.

## D04. 연출 시간
- **Chosen**: 접촉과 시작 위치 복귀를 기존 0.5초 회복 시간 안에 끝낸다. 연출 중에는 기존 규칙대로 입력을 받지 않는다.
- **Rationale**: 시각적 피드백을 추가하면서 입력 대기 시간과 플레이 속도를 늘리지 않는다.

## D05. 애니메이션 상태 관리
- **Chosen**: 따라잡힘과 복귀 단계는 화면 안의 임시 애니메이션 상태로 표현한다. `GameState`, 게임 규칙, localStorage 기록 형식은 변경하지 않는다.
- **Rationale**: 게임 엔진은 따라잡힌 입력에서 거리를 즉시 초기화하므로, 화면만 접촉 순간을 기억해 재생하면 데이터 모델을 늘리지 않고 선택한 연출을 보여줄 수 있다.

## Codebase Findings
- `createGameState`에서 추격 거리는 4로 시작한다. 잘못 입력하면 거리가 1 감소하고, 0 이하가 되면 기회가 1 줄며 거리는 4로 초기화된다.
- `recoveryEndsAt`은 실수 후 500ms 동안 추가 입력을 막는다.
- `StairScene`에는 현재 고정 위치의 SVG 추격자가 있고, CSS의 위아래 흔들림만 적용된다. `prefers-reduced-motion` 설정에서는 기존 흔들림을 끈다.
- `GameScreen`은 실수 시 기존 넘어짐 효과음을 재생한다. 이 요청에는 별도의 효과음 추가가 포함되지 않았다.

## D06. Final-catch presentation
- **Chosen**: To show the pursuer's contact-and-return animation on the final catch, keep the result and leaderboard panel hidden during the existing 500 ms recovery. The game-over state and final score save remain immediate; only the visual result panel waits until the recovery finishes.
- **Rationale**: The existing game-over panel covers the scene. Hiding that panel briefly lets the final catch animation remain visible without delaying game rules or score persistence.
