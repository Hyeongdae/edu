# Current Context

## Active Plan

[Stage Unlocks and Per-Stage Scores](./plans/2026-10-27-stage-unlocks-and-per-stage-scores.md)

## Active Phase

[P01 Stage Scores](./phases/2026-10-27-stage-unlocks-and-per-stage-scores/P01-stage-scores/phase.md)

## Active Task

[T02 Stage Scores Unlocks and Ranking](./phases/2026-10-27-stage-unlocks-and-per-stage-scores/P01-stage-scores/T02-stage-scores-unlocks-and-ranking.md)

## Last Completed Task

[T01 Preserve Legacy Cleared Progress](./phases/2026-10-27-stage-unlocks-and-per-stage-scores/P01-stage-scores/T01-preserve-legacy-cleared-progress.md) — `f5ef960` (2026-10-27). 이전 계획 완료: T04 `9fda567`, 동기화 `cec0d37`.

## Status

- stage-unlocks-and-per-stage-scores: done1/3, Active T02. 이번 실행에서는 T01 한 개만 구현·검증·커밋했다. `f5ef960`: 진행도53tests/지정17파일469tests/lint/build/diff check 통과. 기존400점/해금/v4랭킹 의미는 아직 유지된다.
- 확정된 최종 규칙: 클리어 H의 다음 단계까지 min(5,H+1) 해금/최고 해금 단계 기본 선택; 단계별0점/목표150·200·250·300·350; 체크포인트 계속/그만두기 유지; 실제 종료 단계와 해당 단계 점수를 v5랭킹에 기록; 기존 랭킹만 초기화하고 클리어 이력은 보존.
- T01 완료: migrateLegacyStageProgress가 두 입력을 독립적으로 읽고 모든 계정의 유효한 클리어 최대값을 progress:v1로 병합한다. 최초 필요한 이관만 저장, 오류 시 알려진 값을 반환하고 원본을 보존하며 불완전한 입력으로 덮어쓰지 않는다. readStageProgress는 이관 저장을 수행할 수 있다. StrictMode 재마운트 이관1회/랭킹 쓰기0회를 검증했다.
- T02는 목표/0점 전환/다음 단계 해금/실제 도전 단계v5랭킹/UI를 함께 바꾼다. v5랭킹을 클리어 이력으로 해석하지 않는다. 이관 성공 전 v4를 지우지 않는다. 최종 GameState의 recordStage/stageStartScore를 제거하고 highestClearedStage를 해금용으로 분리한다.
- T03는 지정17파일/lint/build와 실제 격리 브라우저에서 사용자 재시도 흐름/전체5단계/이관 오류/실시간 추격/반응형을 검증한 뒤 완료를 기록한다. 현재469개 통과는 T01 기존 규칙 회귀 결과이며, 새 점수/해금 규칙이나 실제 브라우저 완료 증거가 아니다.
- T01 로그: C:\Users\DEX\AppData\Local\Temp\stair-stage-scores-t01-2026-10-27\. 빌드 JS551.80kB(gzip154.18kB), CSS55.50kB(gzip10.77kB). 이번 로그에 chunk 경고 문구는 없지만 기존500kB 초과 이슈는 남는다.
- 연계 주의: 기존 GameScreen은 readLeaderboard(v4)를 먼저 호출하고, 기존 랭킹 읽기는 잘못된 행이 섞인 v4를 정리할 수 있다. T02에서 구v4 정리 전에 이관 API를 호출하도록 연결한다. T01에서 read-only 랭킹/UI 구현은 변경하지 않았다.
- 별도 소리 청취, 공용 서버 랭킹, 번들 크기, 독립 App 테스트 정리, Entra 설정/배포는 이번 계획에 추가하지 않는다.

## Source Decisions

[Stage Unlocks and Per-Stage Scores](./decisions/2026-10-27-stage-unlocks-and-per-stage-scores.md)

## Previous Completed Plan: Stage Checkpoints and Fall Chase

| Task | Implementation commit | Validation |
| :--- | :--- | :--- |
| T01 Checkpoint Session and Records | `afafa68` | 지정16파일388tests/lint/build |
| T02 Stage Selection and Progress | `fa1a5ec` | 지정17파일402tests/lint/build |
| T03 Fall Pursuit Acceleration | `9a9e6b5` | 지정17파일432tests/lint/build |
| T04 Checkpoint Browser Validation | `9fda567` | 지정17파일433tests/lint/build + 격리 브라우저 |

## Previous Source Decisions

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

위 표는 이전 계획의 완료 이력이다. stage-checkpoints-and-fall-chase T01~T04 구현/검증 이력은 위 Previous Completed Plan 표에 기록했다.

## Next Step (IMPORTANT)

다음 `/memory-execute` 또는 "current 보고 이어서 해줘" 요청에서는 위 Active T02 청사진 한 개만 읽고 단계별0점/150~350 목표·H+1해금·도전 단계v5랭킹과 화면을 함께 연결한다. T01의 이관 성공 전에 구v4를 삭제하지 않고, 새v5의 도전 단계를 클리어로 추론하지 않는다. GameState의 recordStage/stageStartScore 제거와 highestClearedStage 분리를 포함한 청사진/지정17파일 검증을 따른다. T01은 재실행하지 않으며 실제 브라우저 완료는 T03에 남겨둔다.
