# Current Context

## Active Plan

[Stage Unlocks and Per-Stage Scores](./plans/2026-10-27-stage-unlocks-and-per-stage-scores.md)

## Active Phase

[P01 Stage Scores](./phases/2026-10-27-stage-unlocks-and-per-stage-scores/P01-stage-scores/phase.md)

## Active Task

None — 현재 계획의 모든 Task가 완료되었습니다.

## Last Completed Task

[T03 Stage Score Browser Validation](./phases/2026-10-27-stage-unlocks-and-per-stage-scores/P01-stage-scores/T03-stage-score-browser-validation.md) — `20f8425` (2026-10-28). T01 `f5ef960`, 동기화 `0ca7bf2`; T02 `f35254f`, 동기화 `6dfa99a`. 이전 계획 완료: T04 `9fda567`, 동기화 `cec0d37`.

## Status

- stage-unlocks-and-per-stage-scores: **completed, done3/3, Active Task none**. 이번 실행에서는 T03 한 개만 검증·커밋했다. `20f8425`: 지정17파일509/509tests(47.80s)/lint/build/diff check 및 격리 Chrome156 브라우저 드라이버9개 통과. 제품 source/test 수정이 필요한 결함은 발견되지 않았다.
- 확정된 최종 규칙: 클리어 H의 다음 단계까지 min(5,H+1) 해금/최고 해금 단계 기본 선택; 단계별0점/목표150·200·250·300·350; 체크포인트 계속/그만두기 유지; 실제 종료 단계와 해당 단계 점수를 v5랭킹에 기록; 기존 랭킹만 초기화하고 클리어 이력은 보존.
- T01 완료: migrateLegacyStageProgress가 두 입력을 독립적으로 읽고 모든 계정의 유효한 클리어 최대값을 progress:v1로 병합한다. 최초 필요한 이관만 저장, 오류 시 알려진 값을 반환하고 원본을 보존하며 불완전한 입력으로 덮어쓰지 않는다. readStageProgress는 이관 저장을 수행할 수 있다. StrictMode 재마운트 이관1회/랭킹 쓰기0회를 검증했다.
- T02 완료: 목표/0점 전환/다음 단계 해금/실제 도전 단계v5랭킹/UI를 함께 변경했다. 최종 GameState의 recordStage/stageStartScore를 제거하고 highestClearedStage를 해금용으로 분리했다. Continue는 단계 점수0/lastMove null로 시작하며 경로/계단 수/이벤트를 보존한다. 점수 알림도 새 단계0점 기준으로 계산한다.
- 새v5랭킹을 클리어 이력으로 해석하지 않는다. 구v4 정리 전에 T01 이관 API를 호출하도록 연결해 읽기 순서 주의를 해소했다. 전 계정 이관 성공 전 v4를 지우지 않으며 구키 정리 실패만으로 유효v5를 숨기지 않는다.
- T03 완료: clear1→Quit→재시작/재접속에서2기본·0점·목표200·3잠김, 네 화면의 실제 안내 입력으로5단계352점, 단계별0점/활성 보너스 체크포인트95초 동결·객체 보존, 실제 단계80/150점 랭킹, 전 계정 v4 이관/부분 실패 복구/새v5보존·해금 분리, 실제 추격/250·500ms 넘어짐/4초 lifecycle 단일 잡힘·저장, 양방향 점프/모션 감소/320px root24·32 접근성을 확인했다. 전체 단계는 제어시간으로 진행했으며 실제 시간 추격과 구분한다.
- T03 증거: C:\Users\DEX\AppData\Local\Temp\stair-stage-scores-t03-2026-10-28\. cdp 도우미/드라이버9개/동명JSON·log/PNG96개/evidence-index.json을 보관한다. 일반 프로필 접근 없이 소유 context만 사용·폐기했다. 개발용 로컬 데모 `http://127.0.0.1:5175/`를 직접 플레이용으로 유지한다. 새 서버는 프로세스 환경의 VITE_LOCAL_DEMO_MODE=true로 시작했으며 인증/환경 파일은 바꾸지 않았다.
- T02 로그: C:\Users\DEX\AppData\Local\Temp\stair-stage-scores-t02-2026-10-28\. 최종 regression-17-files-final.log/lint-final.log/build.log. 빌드 JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB). 초기 빌드의500kB chunk 경고와 기존 초과 크기는 해결하지 않았다. T01 로그는 C:\Users\DEX\AppData\Local\Temp\stair-stage-scores-t01-2026-10-27\에 보존한다.
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

현재 계획은 완료되어 실행할 Active Task가 없다. 직접 플레이는 `http://127.0.0.1:5175/`에서 할 수 있다(개발 서버 실행 중에만 유효). 새 변경 요청은 인터뷰/결정→새 계획으로 이어간다. 완료된 T01~T03를 재실행하거나 범위 밖 인증/배포/공용 서버/번들 개선을 자동으로 시작하지 않는다.
