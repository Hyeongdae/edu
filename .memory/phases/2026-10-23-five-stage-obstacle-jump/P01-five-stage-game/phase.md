# Phase: P01 Five Stage Game

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | done ✅ | 새 규칙표/5단계·최종 클리어/HUD/v3 랭킹 | [T01](./T01-five-stages-and-ranking.md) |
| T02 | done ✅ | 긴5~9·짧은1~3 패턴/보관 API/긴 구간 장애물 생성 | [T02](./T02-route-and-obstacle-generation.md) |
| T03 | in_progress 🔵 | 시간 기반 독립 추격/경로 보존/잡힘/전진 모션 | [T03](./T03-timed-pursuer.md) |
| T04 | pending | 점프·충돌/Space/3버튼/보이는 상자/2·4점 표시 | [T04](./T04-obstacle-jump-gameplay.md) |
| T05 | pending | 전용 점프 아크/빠른 입력/실제 추격·전체 반응형 검증 | [T05](./T05-jump-motion-and-validation.md) |

## Progress

- done: 2/5 (active: T03)
- Status: in_progress
- Revision: 2026-10-23 후속 결정 반영. 기존4개 Task 초안은 구현·커밋되지 않았고 새5개로 교체했다.

## Execution Rule

current.md의 Active Task 한 개만 구현/검증/커밋하고 다음 포인터로 이동한다. 각 Task에는 선행 계약이 들어 있다. 완료 후 phase/current를 동기화하며 마지막에는 계획도 완료한다. 넘어짐 소리 청취 문제는 별도다.

## Last Validation

- T01 완료:12a49d3. 지정7파일192tests/lint/build 통과. 브라우저는 T05에서 검증한다.
- T02 완료:7d1f426. 지정6파일202tests/lint/build 통과,500kB초과 청크 경고는 별도. 브라우저는 T05에서 검증한다.
