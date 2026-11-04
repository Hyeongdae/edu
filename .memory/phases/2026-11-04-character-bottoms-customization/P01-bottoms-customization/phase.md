# Phase: P01 Bottoms Customization

- Status: in_progress
- Plan: [Character Bottoms Customization](../../../plans/2026-11-04-character-bottoms-customization.md)
- Decision: [Confirmed decisions](../../../decisions/2026-11-04-character-bottoms-customization.md)

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `pending` | 고정 v1/v2와 별도 v3 하의 계약/정규화 | [T01](./T01-bottoms-appearance-contract.md) |
| T02 | `pending` | 공통 하의/신발 연결과 모든 게임·엔딩 포즈 | [T02](./T02-bottoms-pixel-rendering.md) |
| T03 | `pending` | v3 계정/API/프로필 전환 및 기존 점수/외형 보존 | [T03](./T03-versioned-bottoms-persistence.md) |
| T04 | `pending` | 하의 편집/장면 통합과 최종 검증 | [T04](./T04-bottoms-editor-and-scenes.md) |

## Progress
- done: 0/4 (active: T01)

## Execution Rules
- `.memory/current.md`의 Active Task 한 개만 구현·검증·커밋한 뒤 task/phase/plan/current를 동기화한다.
- 각 Task 커밋 메시지에 `Plan: 2026-11-04-character-bottoms-customization`을 사용한다.
- T01/T02는 public v2를 유지한다. T03에서 API/클라이언트 public 계약을 함께 v3로 전환한다. T04에서 새 선택 그룹을 노출한다. 중간 Task를 배포하지 않는다.
- 기존 13개 외형 선택/양쪽 역할/계정 기록·모드·게임 규칙을 보존한다. 기존 v1/v2 모듈은 변경하지 않는다.
- 신발 바닥 y=40과 야근 엔딩의 앞뒤 다리 애니메이션 그룹을 보존한다. 색상만으로 하의 모양을 대체하지 않는다.
- 테스트/타입 오류는 관련 버전/fixture/라벨 의미에 맞게 고친다. 기존 실패를 숨기거나 timeout/skip을 완화하지 않는다.
- 브라우저 차단을 우회하지 않고 정적 표본과 실제 브라우저 검증을 구분한다. 실제 계정/운영 Cosmos에는 테스트 쓰기를 하지 않는다.
- 기존 모바일 조작 간격 및 사용자 untracked 파일을 보존한다. push/배포/자원 수정은 별도 출시 작업이다.
