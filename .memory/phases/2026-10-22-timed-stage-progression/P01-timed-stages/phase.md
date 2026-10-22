# Phase: P01 Timed Stages

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 90초/300점 승급·만료 엔진과 주기 갱신/설정 일시정지 | [T01](./T01-stage-engine-and-clock.md) |
| T02 | `in_progress 🔵` | 단계 우선 랭킹 저장/표시와 기존 v1 점수 키 초기화 | [T02](./T02-stage-leaderboard.md) |
| T03 | `pending` | 점수 옆 남은 시간·단계/종료 결과와 반응형 통합 검증 | [T03](./T03-stage-hud-and-results.md) |

## Progress
- done: 1/3 (active: T02)
- Status: in_progress
- T01 commit: `1027b1f`; 지정 테스트 107개, lint, build 통과. HUD/랭킹 표시 및 브라우저 시각 검증은 후속 Task 범위다.

## Execution Rule
`current.md`가 가리키는 Task 하나만 구현·검증·커밋한 뒤 다음 포인터로 이동한다. 각 Task의 이전 결과 계약은 해당 청사진에 포함되어 있다. 최종 완료 시 phase/plan/current를 함께 완료 상태로 갱신한다.
