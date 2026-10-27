# Phase: P01 Checkpoint Game

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | done ✅ | 체크포인트/400점/생명 제거/진행도/0단계/v4저장 | [T01](./T01-checkpoint-session-and-records.md) |
| T02 | done ✅ | 단계 선택/해금/새 판/결과 뒤 재선택 | [T02](./T02-stage-selection-and-progress.md) |
| T03 | done ✅ | 넘어짐500ms 중250ms 독립 추격/설정/경계 | [T03](./T03-fall-pursuit-acceleration.md) |
| T04 | done ✅ | 17파일 및 실제 브라우저 통합/반응형 검증 | [T04](./T04-checkpoint-browser-validation.md) |

## Progress

- done: 4/4 (active: none)
- Status: completed
- 2026-10-23 계획 작성. 2026-10-27 T01 구현 완료 `afafa68`: 지정16파일 388tests, lint/build 통과. 빌드 JS548.68kB(gzip153.34kB), 기존500kB 경고 유지.
- 2026-10-27 T02 구현 완료 `fa1a5ec`: 단계 선택/해금/0점 새 판/결과 뒤 재선택. 지정17파일402tests, lint/build 통과. JS550.61kB(gzip153.85kB), 기존500kB 경고 유지.
- 2026-10-27 T03 구현 완료 `9a9e6b5`: 넘어짐500ms 중250ms 추격/회복 경계/설정 남은 시간 보존. 지정17파일432tests, lint/build 통과. JS550.84kB(gzip153.91kB), 기존500kB 경고 유지.
- 2026-10-27 T04 `9fda567` 완료: 지정17파일433/433tests, lint/build, 격리 브라우저의 네 화면 전체5단계·저장/오류·실시간250ms 추격·4초 lifecycle 복귀·320px 150/200%·양방향 점프 검증. 저장 오류가 확대 화면의 체크포인트 버튼을 가리던 문제 수정. JS550.83kB(gzip153.95kB), CSS55.50kB(gzip10.77kB). 이번 빌드 경고 문구는 없지만 기존500kB 초과 이슈는 남는다. 증거 경로/드라이버/제한은 T04에 기록했다.

## Execution Rule

current.md가가리키는Task한개만구현·검증·커밋한뒤이표/상위계획/current를동기화한다. T01은연결된상태·UI·저장계약을한번에바꾸며T02에서선택창,T03에서넘어짐가속을추가한다. 최종T04통과후모두완료로기록한다.

## Source and Previous History

- [확정 결정](../../../decisions/2026-10-23-stage-checkpoints-and-fall-chase.md)
- 이전five-stage-obstacle-jump: T01`12a49d3`,T02`7d1f426`,T03`42dab25`,T04`7a61ed2`,T05`e369a28`;기록동기화`40d58a5`.
- 별도넘어짐소리청취/번들경고/독립App기대값은완료로표시하지않는다.
