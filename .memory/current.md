# Current Context

## Active Plan
[Timed Stage Progression](./plans/2026-10-22-timed-stage-progression.md)

## Active Phase
[P01 Timed Stages](./phases/2026-10-22-timed-stage-progression/P01-timed-stages/phase.md)

## Active Task
[T02 Stage Leaderboard](./phases/2026-10-22-timed-stage-progression/P01-timed-stages/T02-stage-leaderboard.md)

## Last Completed Task
[T01 Stage Engine and Clock](./phases/2026-10-22-timed-stage-progression/P01-timed-stages/T01-stage-engine-and-clock.md) — commit `1027b1f`.

## Status
- T01 완료. P01 done: 1/3, active: T02 구현 시작 준비.
- 1단계 시작 시 90초를 부여하고 실제300점 이상이면2단계 승급한다. 기회3/거리4를 회복하고 경로·누적 점수·보너스를 유지한다. 무입력/visibility/입력 시 만료되며 설정 중 두 시계가 함께 멈춘다.
- 시간 만료를 입력보다 먼저 판정하고, 시간 초과 결과는 즉시 공개한다. 실제 마지막 잡힘의500ms 공개 순서와 StrictMode 저장/재시작을 유지했다. 2단계는 무제한이다.
- 지정 테스트 4 files / 107 tests, lint, build 통과. JS 529.00kB. 이번 Task의 브라우저 시각 검증은 없으며 HUD 시간/단계/종료 사유 표시는 T03에 남아 있다.
- 랭킹은 아직 기존v1 점수 형식이다. 기존 기록 삭제는 수행하지 않았다. 다음 T02에서 bestStage/v2/단계 우선 비교 및 사용자 승인된 v1 키 정리를 적용한다.
- 이전 픽셀 계획은4/4 완료했다. 기존 도움말/App 통합 테스트 기대값, 옛SVG CSS, bundle 검토 항목은 별도 대상이다. 이번 Task에서 새 인접 결함은 발견하지 않았다.

## Next Step (IMPORTANT)
다음 `/memory-execute` 또는 `current 보고 이어서 해줘` 요청 시 T02 청사진 하나만 실행한다. `src/leaderboard/leaderboard.ts`에 필수 bestStage/새v2 키/단계→점수 비교/구형v1 키만 정리를 구현하고, GameScreen 저장 호출·LeaderboardPanel·픽셀 랭킹 스타일·관련 테스트를 같은 Task에서 갱신한다. 검증/커밋 후 T03으로 포인터를 전진한다. T03 HUD 구현을 연달아 진행하지 않는다.
