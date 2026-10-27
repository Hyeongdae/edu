# Current Context

## Active Plan

[Stage Checkpoints and Fall Chase](./plans/2026-10-23-stage-checkpoints-and-fall-chase.md)

## Active Phase

[P01 Checkpoint Game](./phases/2026-10-23-stage-checkpoints-and-fall-chase/P01-checkpoint-game/phase.md)

## Active Task

[T03 Fall Pursuit Acceleration](./phases/2026-10-23-stage-checkpoints-and-fall-chase/P01-checkpoint-game/T03-fall-pursuit-acceleration.md)

## Last Completed Task

[T02 Stage Selection and Progress](./phases/2026-10-23-stage-checkpoints-and-fall-chase/P01-checkpoint-game/T02-stage-selection-and-progress.md) — implementation `fa1a5ec` (2026-10-27).

## Status

- stage-checkpoints-and-fall-chase: done2/4, Active T03. 이번 실행에서는 Active T02 한 개만 구현·검증·커밋했다. T01 `afafa68`, T02 `fa1a5ec`.
- 각 단계 시작점수+400을 달성하면 1~4단계는 체크포인트에서 계속/그만두기를 선택한다. 체크포인트 동안 단계/NPC/보너스 시계가 멈추고 계속하기에서 보너스 대기를 한 번 보정한다. 5단계는 최종 클리어로 종료한다.
- 생명 제거/최초 잡힘 종료. 마지막 안전한 NPC=player-1/gap1을 유지하고 500ms 잡힘 결과 게이트를 보존한다. 일반 추격은800/650/500/400/300ms로 반영했다.
- 플레이 단계1~5와 기록 단계0~5를 분리했다. recordStage는 이전 최고 클리어와 이번 실제 클리어의 최댓값이며 이번 판 점수로 기록한다. 클리어 즉시 계정 진행도를 저장하고 종료 때 v4랭킹을 한 번 비교 저장한다.
- 구랭킹v1/v2/v3만 정리하도록 구현했다. v4/progress/audio/auth/다른 키는 보존한다. 사용자 브라우저 저장소를 도구로 직접 지우지 않았다.
- T02 단계 선택창 구현 완료. 기본 선택은max(1,현재 계정 최고 클리어), 해금은1~최고 클리어이며 최초0도1은 가능하다. 같은 단계/잠긴 단계 클릭은 경로를 다시 만들지 않는다.
- 선택/결과 복귀는 신선한 ready 미리보기만 만들고 시계·BGM·저장을 시작하지 않는다. 시작하기가 미리보기를 보존해0점 새 판을 시작한다. 결과의 다시 시작은 선택으로 복귀한다. Continue의 점수/경로/이벤트 보존과 분리했다.
- 저장 실패에도 현재 판 기록 기준으로 해금을 유지하고 유효v4기록으로 재로드 기본값을 복구한다. App 계정 key와 계정별 저장을 보존했다. 넘어짐500ms 중250ms 추격은 T03이며 현재는 일반 간격을 유지한다.
- T02 지정17파일 402/402tests, npm run lint, npm run build, git diff --check 통과. JS550.61kB(gzip153.85kB), CSS55.52kB(gzip10.78kB). 기존500kB 번들 경고 유지. T01 검증은16파일388tests였다.
- 경로/장애물 결정 유지, 2칸 점프/30칸30초 이벤트, 성공 발소리1회/실수 소리, 빠른 입력, 설정 대기, StrictMode 저장 중복 방지, 체크포인트95초 동결, 계정별 진행도/저장 오류/0단계 랭킹을 검증했다. 단계 잠금/기본값/계정 전환/중복 Start/실제4단계 클리어 후 해금·새로고침/결과→선택→시작/차단된 저장소도 검증했다. 실제 브라우저/소리 청취 확인은 하지 않았다.
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

위 표는 이전 계획의 완료 이력이다. 현재 새 계획 T01/T02 구현/검증 이력은 Last Completed Task와 Status에 기록했다.

## Next Step (IMPORTANT)

다음 /memory-execute 요청에서는 Active T03 청사진 한 개를 읽고 넘어짐500ms 동안250ms 간격 추격을 구현·검증·커밋한다. 이번 실행은 T02에서 마쳤다. 복구 경계의 예정 이동과 이후 일반 간격, 설정 대기/숨김 복귀/만료 우선순위를 보존한다. 체크포인트 동결·단계 선택·계정별 기록 계약을 유지하고 T04 실제 브라우저 검증을 완료로 표시하지 않는다.
