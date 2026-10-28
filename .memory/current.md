# Current Context

## Active Plan

[Stair Descent Local Test](./plans/2026-10-28-stair-descent-local-test.md)

## Active Phase

[P01 Local Descent](./phases/2026-10-28-stair-descent-local-test/P01-local-descent/phase.md)

## Active Task

[T03 Descent Browser Validation](./phases/2026-10-28-stair-descent-local-test/P01-local-descent/T03-descent-browser-validation.md)

## Last Completed Task

[T02 Isolated Local Descent Screen](./phases/2026-10-28-stair-descent-local-test/P01-local-descent/T02-isolated-local-descent-screen.md) — `f9aa712` (2026-10-28). 이 계획 T01 `0225893`/동기화 `4b49dc8`. 이전 stage-score 계획: T01 `f5ef960`/동기화 `0ca7bf2`, T02 `f35254f`/동기화 `6dfa99a`, T03 `20f8425`/완료 동기화 `8d9b31d`. 이전 checkpoint 계획 완료: T04 `9fda567`, 동기화 `cec0d37`.

## Status

- stair-descent-local-test: done2/3, Active T03. 이번 실행에서는 T02 한 개만 구현·검증·커밋했다. `f9aa712`: 지정24파일642/642tests(72.08s, `--maxWorkers=2`), lint 오류0·경고0/build/diff check 통과. 실제 브라우저 검증은 아직 하지 않았다.
- 확정 범위: 기존 오르기 게임 유지, 별도 `/descent-test.html` 개발용 로컬 데모, D내려가기/J회전하며내려가기/Space2칸점프, 위쪽 NPC추격,1단계150점·90초, 기존10% 긴 구간 장애물·30칸 보너스·500ms넘어짐/250ms추격 유지, 기록 미저장.
- 새 제품 코드는 `src/descent/`와 별도HTML에만 추가한다. 기존 index/main/App/game/audio/auth/leaderboard/test/config는 읽기 전용. 원본 GameScreen의 저장/이관 부수 효과를 가져오지 않는다. 오디오 설정도 기본값 복사/메모리 전용이다.
- T01 완료: 순수 stage1 adapter와 하강 좌표 모델/두 테스트를 추가했다. 원본 체크포인트→최종cleared, 입력 전 obstacles로 마지막stage1 reveal, index계속증가/좌표y432−oldY, NPC visible재계산/모든 모션점 변환을 구현했다. terminal lastMove는 성공 데이터로 보존하므로 T02는 status!==playing에서 이동 연출을 억제해야 한다. adapter는 stage2/클리어>1/외부 raw checkpoint 입력을 거절한다.
- T01 증거: C:\Users\DEX\AppData\Local\Temp\stair-descent-t01-2026-10-28\의 tests.log/lint.log/build.log와 초기 실패 로그. JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB). 기존500kB chunk 경고가 출력됐으며 번들 설정은 바꾸지 않았다. 실제 생성기7seed/합법 입력·기존 시간/확률/보너스/범위 오류·좌표/불변성을 확인했다. UI 전체 저장 무접근과 실제 브라우저 모션은 후속 작업이다.
- T02 완료: 별도HTML/gate/저장없는 앱·view reducer·화면·scene·CSS와5테스트를 연결했다. sound counter로 React 배치/StrictMode 중복을 막고 restart RNG는 이벤트에서 생성한다. 설정 닫기 후 gear 재활성화 이후 focus 복귀/빠른 열기·닫기의 NPC 과거 cosmetic 모션 재생 방지/오디오 전용 scoped grid도 반영했다. 원본 CSS/기능/오디오/저장 helper는 변경하지 않았다.
- T02 검증: 기본 동시 실행24파일은 기존 GameScreen.test.tsx:198의30회 렌더링 검사에서5000ms 시간 초과 후 연쇄 실패했다. 원본 단독77/77(28.25s), 동일24경로에 `--maxWorkers=2`만 추가한 최종 검사는642/642(72.08s) 통과다. timeout/skip/config 변경은 없다. 중간 `tests-24-final.log`는 확장자 오타로23파일만 실행된 로그이므로 최종 근거는 `regression-24-final.log`다.
- T02 증거: `C:\Users\DEX\AppData\Local\Temp\stair-descent-t02-2026-10-28\`의 최종 regression-24-final.log/lint-final.log/build-final.log. JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB), 기본 dist는 기존 index.html만/기존500kB chunk 경고 유지. 테스트에서는 storage throwing getter/메서드0접근,1단계 실제 합법 입력 전체 클리어·마지막 점프·pause95초/음향 counter/StrictMode/터치·Space/300·600ms정리/잡힘 gate를 확인했다.
- 로컬 내려오기 링크 `http://127.0.0.1:5175/descent-test.html`: 기존 소유 데모 서버 PID21048/port5175를 재사용하고 HTTP200/새 module/DEVtrue/VITE_LOCAL_DEMO_MODEtrue를 확인했다. 새 서버/브라우저를 실행하지 않았으며 env 파일은 변경하지 않았다. 실제 하강브라우저/원본보존/저장 sentinel0접근·보존/타이밍·모바일·모션·큰 글꼴 판정은 T03에 남겨둔다.
- 새 범위 밖 결함 발견 없음. 기존 번들 크기/독립 App 전체 suite/공용 랭킹/Entra·배포/원본 리팩터링/내려오기5단계는 추가하지 않는다.

## Source Decisions

[Stair Descent Local Test](./decisions/2026-10-28-stair-descent-local-test.md)

## Previous Completed Plan: Stage Unlocks and Per-Stage Scores

[완료 계획](./plans/2026-10-27-stage-unlocks-and-per-stage-scores.md) — completed3/3, T01 `f5ef960`, T02 `f35254f`, T03 `20f8425`, 완료 동기화 `8d9b31d`. 아래는 이전 계획 완료 당시 기록이다.

- stage-unlocks-and-per-stage-scores: **completed, done3/3, Active Task none**. 이번 실행에서는 T03 한 개만 검증·커밋했다. `20f8425`: 지정17파일509/509tests(47.80s)/lint/build/diff check 및 격리 Chrome156 브라우저 드라이버9개 통과. 제품 source/test 수정이 필요한 결함은 발견되지 않았다.
- 확정된 최종 규칙: 클리어 H의 다음 단계까지 min(5,H+1) 해금/최고 해금 단계 기본 선택; 단계별0점/목표150·200·250·300·350; 체크포인트 계속/그만두기 유지; 실제 종료 단계와 해당 단계 점수를 v5랭킹에 기록; 기존 랭킹만 초기화하고 클리어 이력은 보존.
- T01 완료: migrateLegacyStageProgress가 두 입력을 독립적으로 읽고 모든 계정의 유효한 클리어 최대값을 progress:v1로 병합한다. 최초 필요한 이관만 저장, 오류 시 알려진 값을 반환하고 원본을 보존하며 불완전한 입력으로 덮어쓰지 않는다. readStageProgress는 이관 저장을 수행할 수 있다. StrictMode 재마운트 이관1회/랭킹 쓰기0회를 검증했다.
- T02 완료: 목표/0점 전환/다음 단계 해금/실제 도전 단계v5랭킹/UI를 함께 변경했다. 최종 GameState의 recordStage/stageStartScore를 제거하고 highestClearedStage를 해금용으로 분리했다. Continue는 단계 점수0/lastMove null로 시작하며 경로/계단 수/이벤트를 보존한다. 점수 알림도 새 단계0점 기준으로 계산한다.
- 새v5랭킹을 클리어 이력으로 해석하지 않는다. 구v4 정리 전에 T01 이관 API를 호출하도록 연결해 읽기 순서 주의를 해소했다. 전 계정 이관 성공 전 v4를 지우지 않으며 구키 정리 실패만으로 유효v5를 숨기지 않는다.
- T03 완료: clear1→Quit→재시작/재접속에서2기본·0점·목표200·3잠김, 네 화면의 실제 안내 입력으로5단계352점, 단계별0점/활성 보너스 체크포인트95초 동결·객체 보존, 실제 단계80/150점 랭킹, 전 계정 v4 이관/부분 실패 복구/새v5보존·해금 분리, 실제 추격/250·500ms 넘어짐/4초 lifecycle 단일 잡힘·저장, 양방향 점프/모션 감소/320px root24·32 접근성을 확인했다. 전체 단계는 제어시간으로 진행했으며 실제 시간 추격과 구분한다.
- T03 증거: C:\Users\DEX\AppData\Local\Temp\stair-stage-scores-t03-2026-10-28\. cdp 도우미/드라이버9개/동명JSON·log/PNG96개/evidence-index.json을 보관한다. 일반 프로필 접근 없이 소유 context만 사용·폐기했다. 개발용 로컬 데모 `http://127.0.0.1:5175/`를 직접 플레이용으로 유지한다. 새 서버는 프로세스 환경의 VITE_LOCAL_DEMO_MODE=true로 시작했으며 인증/환경 파일은 바꾸지 않았다.
- T02 로그: C:\Users\DEX\AppData\Local\Temp\stair-stage-scores-t02-2026-10-28\. 최종 regression-17-files-final.log/lint-final.log/build.log. 빌드 JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB). 초기 빌드의500kB chunk 경고와 기존 초과 크기는 해결하지 않았다. T01 로그는 C:\Users\DEX\AppData\Local\Temp\stair-stage-scores-t01-2026-10-27\에 보존한다.
- 별도 소리 청취, 공용 서버 랭킹, 번들 크기, 독립 App 테스트 정리, Entra 설정/배포는 이번 계획에 추가하지 않는다.

## Previous Stage Score Source Decisions

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

다음 `/memory-execute` 또는 "current 보고 이어서 해줘" 요청에서는 Active T03 청사진 한 개만 읽고 실제 브라우저 내려오기/원본 유지/저장소0접근·sentinel 보존/시간·모션·모바일·큰 글꼴을 검증한다. T02 테스트와 HTTP 확인을 실제 브라우저 증거로 대신하지 않는다. 관련 신규 파일에서 입증된 결함만 수정하고 기존 game/audio/auth/leaderboard/test/config는 읽기 전용으로 유지한다. 지정24파일 회귀는 기본 병렬 실행에서 기존 화면 테스트 시간 초과가 있었으므로 동시2개 실행 결과와 원래 명령 결과를 구분해 기록한다. 성공 후 phase done3/3/plan completed/current none으로 전환한다. T01/T02와 이전 완료 계획은 재구현하지 않는다.
