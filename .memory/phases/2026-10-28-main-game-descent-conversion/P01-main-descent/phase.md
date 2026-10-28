# Phase: P01 Main Descent

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | done ✅ | 새 기록 scope/한정 구키 정리 지원; main 연결 전 | [T01](./T01-descent-record-storage.md) |
| T02 | done ✅ |5단계 메인 하강/새 scope/오디오 재시도 focus 복구 | [T02](./T02-main-descent-integration.md) |
| T03 | in_progress 🔵 | 실제5단계/새 기록/모바일·시간·설정 focus 검증 | [T03](./T03-main-descent-browser-validation.md) |

## Progress

- done: 2/3 (active: T03)
- Status: in_progress
- 2026-10-28 T01 완료: `9b6ba54`. 지정 6파일 242/242 tests(32.11초/workers2), lint/build/diff check 통과. 기존 main/실험/auth/audio/config 경로 diff 없음. 실제 브라우저 저장소는 접근하지 않았다.
- T02 완료: `5217dfa`. 지정27파일727/727tests(54.39초/workers2/skip0), lint/build/diff check 통과. main5단계 하강 투영/모션·문구·새 기록scope와 D11 오디오 재시도 focus 복구를 연결했다. core/규칙/기본 상승 모델/실험/App/authConfig/audio/public/config/package diff 없음.
- JS553.68kB(gzip154.76kB)/CSS57.30kB(gzip10.95kB), 기존500kB 초과 번들 크기 유지(이번 로그 경고 재출력 없음). 로그: `%TEMP%\main-descent-t02-2026-10-28\`.
- 실제 브라우저/사용자 프로필에는 직접 접근하지 않았다. main 최초 접속에서 승인된 구 기록 초기화가 활성화되며 새 기록은 보존한다. native 모션·모바일·media Promise/focus·저장 재접속의 실제 브라우저 검증은 T03 미수행이다. 전체 계획은 아직 완료가 아니다.

## Execution Rule

current.md의 Active Task 한 개만 구현·검증·커밋한다. 성공 시 Task done/지정 commit→phase 진행률→plan/current 포인터를 별도 metadata commit으로 동기화한다. T01은 main 연결 금지, T02에서 처음 하강·descent 저장을 함께 활성화한다. T03 실제 브라우저 검증 전에는 전체 계획을 completed로 표시하지 않는다.

## Sources and Baseline

- [Decision](../../../decisions/2026-10-28-main-game-descent-conversion.md)
- [Plan](../../../plans/2026-10-28-main-game-descent-conversion.md)
- Baseline `bdf18d5`; previous local-descent completed3/3/T03 `04fdeea`. 이전 계획과 결정문은 수정하지 않는다.
