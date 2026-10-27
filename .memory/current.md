# Current Context

## Active Plan

[Stage Checkpoints and Fall Chase](./plans/2026-10-23-stage-checkpoints-and-fall-chase.md)

## Active Phase

[P01 Checkpoint Game](./phases/2026-10-23-stage-checkpoints-and-fall-chase/P01-checkpoint-game/phase.md)

## Active Task

[T02 Stage Selection and Progress](./phases/2026-10-23-stage-checkpoints-and-fall-chase/P01-checkpoint-game/T02-stage-selection-and-progress.md)

## Last Completed Task

[T01 Checkpoint Session and Records](./phases/2026-10-23-stage-checkpoints-and-fall-chase/P01-checkpoint-game/T01-checkpoint-session-and-records.md) — implementation `afafa68` (2026-10-27).

## Status

- stage-checkpoints-and-fall-chase: done1/4, Active T02. 이번 실행에서는 Active T01 한 개만 구현·검증·커밋했다.
- 각 단계 시작점수+400을 달성하면 1~4단계는 체크포인트에서 계속/그만두기를 선택한다. 체크포인트 동안 단계/NPC/보너스 시계가 멈추고 계속하기에서 보너스 대기를 한 번 보정한다. 5단계는 최종 클리어로 종료한다.
- 생명 제거/최초 잡힘 종료. 마지막 안전한 NPC=player-1/gap1을 유지하고 500ms 잡힘 결과 게이트를 보존한다. 일반 추격은800/650/500/400/300ms로 반영했다.
- 플레이 단계1~5와 기록 단계0~5를 분리했다. recordStage는 이전 최고 클리어와 이번 실제 클리어의 최댓값이며 이번 판 점수로 기록한다. 클리어 즉시 계정 진행도를 저장하고 종료 때 v4랭킹을 한 번 비교 저장한다.
- 구랭킹v1/v2/v3만 정리하도록 구현했다. v4/progress/audio/auth/다른 키는 보존한다. 사용자 브라우저 저장소를 도구로 직접 지우지 않았다.
- T01 화면은 아직1단계 시작/재시작이다. 엔진의 선택 단계 옵션과 계정 진행도는 준비됐고 T02에서 선택창을 연결한다. 넘어짐500ms 중250ms 추격은 T03이며 현재는 일반 간격을 유지한다.
- 지정16파일 388/388tests, npm run lint, npm run build, git diff --check 통과. JS548.68kB(gzip153.34kB), CSS54.49kB(gzip10.68kB). 기존500kB 번들 경고 유지.
- 경로/장애물 결정 유지, 2칸 점프/30칸30초 이벤트, 성공 발소리1회/실수 소리, 빠른 입력, 설정 대기, StrictMode 저장 중복 방지, 체크포인트95초 동결, 계정별 진행도/저장 오류/0단계 랭킹을 검증했다. 실제 브라우저/소리 청취 확인은 하지 않았다.
- 독립 App 테스트 기대값, 옛 SVG CSS 전체 정리, 번들 분할, 별도 넘어짐 소리 청취 문제, Entra 설정/배포는 별도다. T01은 App의 계정 key 연결만 바꾸었다.

## Source Decisions

[Stage Checkpoints and Fall Chase](./decisions/2026-10-23-stage-checkpoints-and-fall-chase.md)

## Previous Completed Plan History

[Five Stage Obstacle Jump](./plans/2026-10-23-five-stage-obstacle-jump.md) — completed5/5. 아래 구현/검증 이력은 이전 계획에 속한다.
| Task | Implementation commit | Validation |
| :--- | :--- | :--- |
| T01 Five Stages and Ranking | `12a49d3` | 지정7파일192tests/lint/build |
| T02 Route and Obstacle Generation | `7d1f426` | 지정6파일202tests/lint/build |
| T03 Timed Pursuer | `42dab25` | 지정10파일298tests/lint/build |
| T04 Obstacle Jump Gameplay | `7a61ed2` | 지정12파일335tests/lint/build |
| T05 Jump Motion and Validation | `e369a28` | 지정14파일352tests/lint/build + 격리브라우저 |

위 표는 이전 계획의 완료 이력이다. 현재 새 계획 T01 구현/검증 이력은 Last Completed Task와 Status에 기록했다.

## Next Step (IMPORTANT)

다음 /memory-execute 요청에서는 Active T02 청사진 한 개를 읽고 단계 선택/해금/새 판/결과 뒤 선택 화면을 연결한다. 이번 실행은 T01에서 마쳤다. 엔진의 GameStartOptions와 저장된 계정별 진행도/현재 계정 v4기록을 사용하며 새 판0점과 이전 최고 클리어 기록 기준 승계를 보존한다. T03의250ms 가속을 앞당겨 구현하거나 T04 브라우저 검증 완료를 주장하지 않는다.
