# Plan: Stage Unlocks and Per-Stage Scores

- Date: 2026-10-27
- Status: in_progress
- Source: [확정 결정](../decisions/2026-10-27-stage-unlocks-and-per-stage-scores.md)
- Previous completed plan: [Stage Checkpoints and Fall Chase](./2026-10-23-stage-checkpoints-and-fall-chase.md), T04 `9fda567`, 완료 동기화 `cec0d37`.
- Planning only: 이 단계에서는 `.memory/` 문서만 작성한다. 게임 구현·테스트 실행·실제 저장소 초기화는 후속 실행 단계다.

## Goal

1단계 클리어 후 그만두기→다시 시작에서2단계가 해금·기본 선택되어야 한다. 각 단계는0점부터150/200/250/300/350점을 목표로 플레이한다. 1~4단계 체크포인트 계속하기에서 다음 단계0점으로 전환하고, 그만두기는 방금 클리어한 단계 점수로 종료한다. 랭킹은 실제 종료 단계와 해당 단계 점수로 비교한다. 기존 랭킹은 새v5와 분리하고 기존 모든 계정의 실제 클리어 이력을 보존한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | in_progress | 진행도 보존 이관 → 게임/해금/랭킹 연결 → 통합 검증 | [P01](../phases/2026-10-27-stage-unlocks-and-per-stage-scores/P01-stage-scores/phase.md) |

## Task Roadmap

| Task | Result | Main files |
| :--- | :--- | :--- |
| T01 | 유효한 옛v4 클리어 이력을 계정별 진행도로 안전하게 합치되 옛 랭킹은 보존 | stageProgress.ts, stageProgress.test.ts, 영향받는 GameScreen.test.tsx |
| T02 | 단계별0점/목표·다음 단계 해금·도전 단계v5랭킹을 한 번에 연결 | types, stageRules, gameEngine, GameHud, StageSelectPanel, CheckpointPanel, GameScreen, leaderboard, LeaderboardPanel 및 지정 회귀 테스트 |
| T03 | 사용자 재현 흐름·실제5단계·이관 오류·반응형/추격/점프를 격리 브라우저에서 검증 | 지정17테스트, 검증으로 드러난 관련 결함, Task/phase/plan/current |

## Final Rules

| Stage | Target from zero | Seconds | Long-run obstacle probability | Normal pursuit interval |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 150 | 90 | 10% | 800ms |
| 2 | 200 | 75 | 20% | 650ms |
| 3 | 250 | 65 | 30% | 500ms |
| 4 | 300 | 60 | 40% | 400ms |
| 5 | 350 | 50 | 50% | 300ms |

- `highestUnlockedStage = min(5, highestClearedStage + 1)`. 최초0→1, 클리어1→2, 클리어4/5→5. 기본 선택은 최고 해금 단계다. 해금된 낮은 단계 선택도 허용한다.
- 점수는 해당 단계 점수다. Continue는0점·다음 목표·새 제한시간으로 시작하며 route/obstacles/steps/event와 보너스 잔여시간을 보존한다. 목표 초과분은 클리어/그만두기 점수에 유지하되 다음 단계로 넘기지 않는다.
- 실제 플레이 단계 `stage:GameStage(1..5)`와 `highestClearedStage:ClearedStage(0..5)`를 분리한다. 최종 모델에서 옛 `recordStage`, `stageStartScore`는 제거한다. 랭킹에 과거 클리어 단계를 물려주지 않는다.
- 랭킹v5는 계정별 최고 한 쌍 `{bestStage:GameStage,bestScore:number}`를 단계 desc→점수 desc→달성시각 asc로 비교한다. 동일/낮은 기록은 이름·시각·쌍을 보존한다. 체크포인트에서는 실제 클리어 진행도만 저장하고 종료 때 한 번 랭킹을 비교한다.
- 구v4의 단계는 실제 클리어여서 진행도 복구에만 사용할 수 있다. v5의 도전 단계에서는 클리어를 추론하지 않는다. v1/v2/v3은 진행도 복구 근거로 사용하지 않는다.

## Why These Task Boundaries

- T01은 기존 규칙과 양립하는 진행도 보존 작업이다. v4를 지우거나 랭킹을v5로 전환하지 않는다. 먼저 모든 계정의 유효 클리어 이력을 저장해 두면 T02의 초기화 순서가 안전해진다. 이관 실패 시 구 근거를 보존하고 메모리에서 확인된 해금을 유지한다.
- T02에서 랭킹v5 활성화와 점수 규칙을 함께 바꾼다. v5에 옛400점 규칙의 새 기록을 먼저 만들면 같은 버전 안에 비교 기준이 섞인다. 엔진만 해금하거나 UI만 점수를0으로 바꾸어도 선택 검증/실제 목표/기록이 엇갈리므로 연결된 변경을 한 Task에 묶는다.
- T03은 완료를 판정할 별도 검증 결과다. 단위 테스트만 통과한 상태를 사용자 재시도/이관/화면 검증 완료로 표시하지 않는다.

## Migration and Failure Rules

- T01의 `migrateLegacyStageProgress(storage?)`는 progress:v1과 구rank:v4를 모두 읽고 계정별 최대 클리어 값을 합친다. 필요하면 전체 계정을 한 배열로 한 번 저장한다. 읽기/쓰기 실패 시 알려진 값을 반환하되 불완전한 자료로 덮어쓰지 않는다. T01에서는 v4를 절대 삭제하지 않는다.
- T02의 v5 랭킹 접근은 먼저 이관을 시도하고, 성공했을 때만 v4를 정리한다. 실패하면 구v4를 남겨 재시도한다. 기존 유효v5와 audio/auth/다른키는 보존한다. 잘못된 v4 행은 해금 근거로 사용하지 않는다.
- 구키 정리 실패만으로 유효v5를 숨기거나 진행을 막지 않는다. v5 자체 get/set 실패는 기존 반환/저장오류 UI 계약으로 처리한다. 실제 클리어 진행도 저장 실패에도 현재 화면의 최고 클리어 값으로 다음 단계 선택을 유지한다.
- 마이그레이션은 브라우저 로컬 데이터 형식 변경이다. 서버/API/새 의존성/인증 우회를 추가하지 않는다. 일반 사용자 프로필을 도구로 지우지 않는다.

## Regression Traps

- 단계 선택 잠금/기본값/클릭검증/엔진 시작검증이 같은 해금 함수를 사용해야 한다. H=1에서2단계 선택은 허용,3단계는 거절한다.
- 과거 `recordStage`는 개인 최고 클리어였지만 새 랭킹 단계는 실제 도전 단계다. `2단계80점`을 클리어2로 간주하면3단계를 잘못 해금한다.
- 진행도 write가 실패했다고 v4부터 지우면 새로고침 후 이력이 소실된다. v4만 있던 다른 계정까지 보존한 뒤 정리해야 한다.
- Continue에서 score만0으로 바꾸고 stageStartScore/목표 호출/scoreGain/lastMove를 남기면 잘못된 목표나 이전 단계 연출이 보인다. 최종 모델과 모든 호출부를 함께 정리한다.
- Continue는 stepsClimbed를0으로 바꾸지 않는다. 그래야 실제 경로·NPC·이벤트·장애물 결정과 발소리 호출이 유지된다. 새 단계 시작 자체는 발소리/실수 소리를 내지 않는다.
- 점프/보너스로 목표를 초과하는 점수와 체크포인트95초·설정95초·넘어짐250/500ms·정확한 만료 우선 규칙은 유지한다. 확률을 끈 테스트만으로 실제 장애물 생성을 검증했다고 주장하지 않는다.
- 기존433개 테스트의400점·누적목표·기록0단계·해금범위 기대값은 의도상 바뀐다. 관련 시나리오를 새 계약으로 고치되 skip/timeout 증가/validator 완화/오디오 assertion 제거로 통과시키지 않는다.

## Validation Strategy

- 각 Task에 정확한 검증 명령을 적는다. 구현 Task는 해당 회귀 + lint/build, T02/T03는 지정17파일 전체를 실행한다. 계획 단계에서는 실행하지 않는다.
- 브라우저는 개발용 로컬 데모와 소유한 별도 context에서320×667/390×667/768×1024/1440×900,320px root24/32px, reduced-motion을 확인한다. 전체 단계는 실제 생성기와 표시 입력으로 진행한다. 경계/이관 오류의 제어시간·엔진 상태와 실제 시간 추격을 구분한다.
- 반드시 사용자 흐름을 기록한다: clear1→Quit→다시 시작→2기본/해금→Start0/목표200; clear1→Continue2score0→80점종료→v5(2,80)/clear1/3잠김; 재접속에서도2선택 가능.
- 전체5단계와5최종350~353점, 단계별 점수 초기화, 동일/열등 기록 보존, v4 전 계정 이관/부분 오류 복구/새v5 보존, 실제 추격·점프·설정·확대 오류 접근성을 검증한다.
- 이전 T04 아티팩트 `C:\Users\DEX\AppData\Local\Temp\stair-checkpoints-t04\`는 참고만 한다. 과거v4/2000점/recordStage/stageStartScore 드라이버를 수정 없이 재사용하면 안 된다.

## Adjacent Findings — Separate Work

- 랭킹은 같은 브라우저의 로컬 저장소다. 사내 공용 서버 랭킹은 이번 계획에 포함하지 않는다.
- 별도 넘어짐 소리 청취, 번들 크기 개선, 독립 App 전체 테스트 기대값 정리, 옛 SVG CSS 전체 정리, Entra 설정/배포는 별도다. 이번 계획에서 직접 바뀌는 안내/fixture/검증만 포함한다.
- T04에서 수정된 확대 화면 저장 오류 안내는 CheckpointPanel 내부 일반 흐름으로 유지한다. absolute overlay로 되돌리지 않는다.

## Progress

- done: 1/3 (active: T02). 2026-10-27 T01 `f5ef960` 완료: 전 계정 v4 클리어 이관 기반/실패 보존/재시도. 진행도53tests, 지정17파일469/469tests, lint/build/diff check 통과. JS551.80kB(gzip154.18kB), CSS55.50kB(gzip10.77kB). 일반 브라우저 저장소를 직접 읽거나 지우지 않았으며 기존400점/v4/해금 규칙은 유지한다. 다음 T02에서 새 규칙을 연결하고 T03에서 실제 브라우저를 검증한다.
