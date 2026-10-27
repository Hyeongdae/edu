# Phase: P01 Stage Scores

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | done ✅ | 옛v4 클리어 이력을 계정별 진행도로 보존, 구랭킹 삭제 없음 | [T01](./T01-preserve-legacy-cleared-progress.md) |
| T02 | done ✅ | 다음 단계 해금·단계별0점/목표·실제 도전 단계v5랭킹 연결 | [T02](./T02-stage-scores-unlocks-and-ranking.md) |
| T03 | in_progress 🔵 | 재시도/이관 오류/전체5단계/반응형 실제 브라우저 검증 | [T03](./T03-stage-score-browser-validation.md) |

## Progress

- done: 2/3 (active: T03)
- Status: in_progress
- 2026-10-27 계획 작성 당시에는 문서/실행 포인터만 준비했다.
- 2026-10-27 T01 `f5ef960` 완료. 진행도 이관53tests, 지정17파일469/469tests, lint/build/diff check 통과. JS551.80kB(gzip154.18kB), CSS55.50kB(gzip10.77kB). 전 계정 v4 클리어 최대값을 보존하고 읽기/쓰기 실패 시 원본/알려진 값을 유지한다. StrictMode 이관1회/랭킹 쓰기0회를 확인했다. v4 삭제나 점수/해금/랭킹 의미 변경은 아직 없다.
- 2026-10-28 T02 `f35254f` 완료. 단계별0점/목표150·200·250·300·350, H+1해금/최고 해금 기본 선택, 실제 종료 단계·해당 점수 v5랭킹을 연결했다. 구v4 정리 전에 전 계정 진행도 이관을 수행하며 실패 시 원본을 보존한다. 지정17파일509/509tests, lint/build/diff check 통과. JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB); 기존500kB 초과 크기는 유지된다.
- 다음 T03에서 실제 브라우저 검증을 수행한다. 현재 결과는 Vitest/jsdom이며 브라우저 완료 증거가 아니다.

## Execution Rule

`.memory/current.md`의 Active Task 한 개만 순서대로 구현·검증·커밋한다. 성공 뒤 Task done→phase 진행률→current 다음 포인터를 동기화한다. T01은 기존v4/400점 실행과 양립해야 하며 v4를 삭제하지 않는다. T02가 점수·해금·랭킹 의미를 함께 전환한다. T03의 실제 브라우저 증거가 통과한 뒤에만 계획 completed/Active Task none으로 표시한다.

## Source and History

- [확정 결정](../../../decisions/2026-10-27-stage-unlocks-and-per-stage-scores.md)
- [이전 완료 계획](../../../plans/2026-10-23-stage-checkpoints-and-fall-chase.md): T01 `afafa68`, T02 `fa1a5ec`, T03 `9a9e6b5`, T04 `9fda567`; 완료 동기화 `cec0d37`.
- 별도 소리 청취/공용 랭킹/번들 크기/독립 App 테스트/Entra·배포는 이 Phase의 완료 대상이 아니다.
