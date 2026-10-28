# Phase: P01 Main Descent

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | done ✅ | 새 기록 scope/한정 구키 정리 지원; main 연결 전 | [T01](./T01-descent-record-storage.md) |
| T02 | in_progress 🔵 |5단계 메인 하강/새 scope/오디오 재시도 focus 복구 | [T02](./T02-main-descent-integration.md) |
| T03 | pending | 실제5단계/새 기록/모바일·시간·설정 focus 검증 | [T03](./T03-main-descent-browser-validation.md) |

## Progress

- done: 1/3 (active: T02)
- Status: in_progress
- 2026-10-28 T01 완료: `9b6ba54`. 지정 6파일 242/242 tests(32.11초/workers2), lint/build/diff check 통과. 기존 main/실험/auth/audio/config 경로 diff 없음. 실제 브라우저 저장소는 접근하지 않았다.
- helper/optional scope만 구현했다. main은 아직 상승·기존 scope이며 T02/T03는 미수행이다. 빌드 JS552.85kB/CSS55.50kB, 기존 500kB chunk 경고 유지. 로그: `%TEMP%\main-descent-records-t01-2026-10-28\`.
- 사용자 추가 요청(D11)의 main 오디오 재시도 focus 복구는 T02 구현/T03 실제 키보드 검증에 포함한다. 기존3 Task와 T01 활성 포인터를 유지한다.

## Execution Rule

current.md의 Active Task 한 개만 구현·검증·커밋한다. 성공 시 Task done/지정 commit→phase 진행률→plan/current 포인터를 별도 metadata commit으로 동기화한다. T01은 main 연결 금지, T02에서 처음 하강·descent 저장을 함께 활성화한다. T03 실제 브라우저 검증 전에는 전체 계획을 completed로 표시하지 않는다.

## Sources and Baseline

- [Decision](../../../decisions/2026-10-28-main-game-descent-conversion.md)
- [Plan](../../../plans/2026-10-28-main-game-descent-conversion.md)
- Baseline `bdf18d5`; previous local-descent completed3/3/T03 `04fdeea`. 이전 계획과 결정문은 수정하지 않는다.
