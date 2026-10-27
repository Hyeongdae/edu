# Phase: P01 Checkpoint Game

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | done ✅ | 체크포인트/400점/생명 제거/진행도/0단계/v4저장 | [T01](./T01-checkpoint-session-and-records.md) |
| T02 | done ✅ | 단계 선택/해금/새 판/결과 뒤 재선택 | [T02](./T02-stage-selection-and-progress.md) |
| T03 | done ✅ | 넘어짐500ms 중250ms 독립 추격/설정/경계 | [T03](./T03-fall-pursuit-acceleration.md) |
| T04 | in_progress 🔵 | 17파일 및 실제 브라우저 통합/반응형 검증 | [T04](./T04-checkpoint-browser-validation.md) |

## Progress

- done: 3/4 (active: T04)
- Status: in_progress
- 2026-10-23 계획 작성. 2026-10-27 T01 구현 완료 `afafa68`: 지정16파일 388tests, lint/build 통과. 빌드 JS548.68kB(gzip153.34kB), 기존500kB 경고 유지.
- 2026-10-27 T02 구현 완료 `fa1a5ec`: 단계 선택/해금/0점 새 판/결과 뒤 재선택. 지정17파일402tests, lint/build 통과. JS550.61kB(gzip153.85kB), 기존500kB 경고 유지.
- 2026-10-27 T03 구현 완료 `9a9e6b5`: 넘어짐500ms 중250ms 추격/회복 경계/설정 남은 시간 보존. 지정17파일432tests, lint/build 통과. JS550.84kB(gzip153.91kB), 기존500kB 경고 유지.
- 다음 T04 실제 브라우저 통합/반응형/실시간 검증. 아직 브라우저 검증 완료로 표시하지 않는다.

## Execution Rule

current.md가가리키는Task한개만구현·검증·커밋한뒤이표/상위계획/current를동기화한다. T01은연결된상태·UI·저장계약을한번에바꾸며T02에서선택창,T03에서넘어짐가속을추가한다. 최종T04통과후모두완료로기록한다.

## Source and Previous History

- [확정 결정](../../../decisions/2026-10-23-stage-checkpoints-and-fall-chase.md)
- 이전five-stage-obstacle-jump: T01`12a49d3`,T02`7d1f426`,T03`42dab25`,T04`7a61ed2`,T05`e369a28`;기록동기화`40d58a5`.
- 별도넘어짐소리청취/번들경고/독립App기대값은완료로표시하지않는다.
