# Plan: Timed Stage Progression

## Goal
1단계에서 시작 후 90초 안에 누적 300점을 얻으면 기회 3회·추격자 거리 4칸으로 회복하여 2단계에 진입한다. 1단계 시간 초과는 게임 종료이고, 2단계는 시간제한 없이 기존 게임을 계속한다. 점수 옆에 단계/남은 시간을 표시하며 랭킹은 단계→점수 순으로 저장·표시한다. 기존 점수 랭킹은 사용자 승인에 따라 새 기능 적용 시 초기화한다.

## Source Decisions
- [확정 결정문](../decisions/2026-10-22-timed-stage-progression.md)
- 사용자 입력의 `timed-stage-progressi`on은 위 결정문의 `timed-stage-progression`으로 해석했다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `completed` | 단계/시간 엔진과 시계 수명, 단계 랭킹, HUD/결과 및 통합 검증 | [P01](../phases/2026-10-22-timed-stage-progression/P01-timed-stages/phase.md) |

## Task Roadmap
1. **T01 Stage Engine and Clock**: 순수 엔진의 단계/마감 시각/종료 사유, 승급 보상, GameScreen의 주기 갱신·설정 일시정지를 함께 구현한다. 실제 만료가 엔진에만 있고 화면에서 호출되지 않는 중간 상태를 피한다. HUD 문구와 랭킹 버전은 아직 바꾸지 않는다.
2. **T02 Stage Leaderboard**: 필수 단계 필드, v2 저장/정렬/개인 최고, 승인된 v1 키 정리, GameScreen 저장 호출과 랭킹 UI/타입 fixture를 함께 변경한다. 타입만 바꾸어 호출부가 깨지는 작업을 만들지 않는다.
3. **T03 Stage HUD and Results**: 점수 옆 시계, 단계/종료 사유, 픽셀 HUD의 모바일 배치와 결과 패널을 연결하고 전체 흐름을 브라우저에서 검증한다.

## Architecture and Contracts
- `GameStage = 1 | 2`, `GameEndReason = "caught" | "time-limit"`; `GameState`에 `stage`, `stageEndsAt: number | null`, `endReason: GameEndReason | null`을 추가한다. 기존 `GameStatus`는 유지한다.
- `createGameState/resetGame`는 stage=1/마감=null/사유=null인 ready 상태를 만든다. `startGame(state, nowMs)`가 처음 playing으로 전환할 때만 now+90_000을 설정한다. 엔진 내부에서 Date.now/새 난수를 읽지 않는다.
- `tickGame`은 playing/1단계 마감 이상이면 종료한다. `applyInput`은 tick을 먼저 하여 시간 경계를 지난 정답이 승급하지 못하게 한다. 유효한 정답의 실제 +1/+2 점수를 적용한 후 stage=1이고 300점 이상일 때 한 번만 승급한다.
- 승급은 route/점수/계단/방향/보너스를 유지하고 stage=2, stageEndsAt=null, lives=3, pursuerDistance=4로 전환한다. 600점 최종 목표·3단계·새 난이도·새 배경은 추가하지 않는다.
- 시간 초과는 현재 남은 기회/추격 거리를 보존하고 진행 중 회복 연출을 정리한다. 마지막 잡힘은 기존 500ms 접촉/복귀 후 결과, 시간 초과는 즉시 결과다. 이미 끝난 잡힘을 뒤늦은 마감으로 덮어쓰지 않는다.
- `resumeGameAfterPause(state, openedAtMs, closedAtMs)`가 설정을 열었던 순간의 만료를 먼저 확인한 뒤, 유효한 stage/event 마감에 같은 pausedMs를 한 번 더하고 회복은 현재 시각으로 정리한다. 설정에서 두 타이머를 멈추며 일반 백그라운드 체류 시간은 계속 센다.
- `LeaderboardEntry.bestStage`와 bestScore는 같은 한 판의 기록이다. 단계 내림차순→점수 내림차순→기록 시각 오름차순으로 표시한다. 개인 최고는 단계/점수 비교로만 갱신한다.
- 랭킹은 `stair-climb:leaderboard:v2`의 JSON 배열을 사용한다. 기존 `stair-climb:leaderboard:v1`만 정리하고 오디오·인증·다른 키는 유지한다. 읽기/저장 시 구형 키의 존재를 확인하므로 StrictMode 재호출/재시작에서 새 기록을 지우지 않는다.
- 이 계획 단계에서는 앱 코드·실제 브라우저 저장소를 변경하거나 검증 명령을 실행하지 않는다. 각 Task가 지정한 명령은 실행 단계의 완료 기준이다.

## Regression Traps
- 무입력 1단계에도 시계가 돌아야 한다. 현재 interval 조건은 보너스/회복뿐이므로 stage deadline을 추가해야 한다.
- 제한시간은 interval 호출 횟수가 아닌 마감 시각으로 판정한다. 숨김 탭에서 interval이 늦어져도 복귀/입력에서 정확하게 만료되어야 한다.
- 설정을 여는 시각이 이미 마감 이상이면 일시정지로 시간을 되살리지 않는다. 열기·닫기 각각에서 중복 연장하지 않는다.
- 승급 시 회복한 목숨/거리 증가를 잡힘으로 오인하지 않는다. 성공 발소리와 점수 팝업은 정답 한 번의 기존 +1/+2만 재생한다.
- 299→301과 30번째 계단에서 보너스 시작+승급이 겹치는 경우도 처리한다. 계단 수 300을 목표로 사용하지 않는다.
- `startGame`의 nowMs 필수 인수와 새 필드는 엔진/장면 테스트 호출부도 같은 Task에서 갱신한다. 기존 API를 Date.now 기본값으로 감추지 않는다.
- 기존 leaderboard 테스트의 getItem 전체 mock은 새 v1/v2 분기에 따라 의미가 달라진다. 구형 삭제 실패와 새 JSON 정리 실패를 키별로 구분한다.
- 320px에 네 카드를 한 줄로 억지로 넣지 않는다. 점수+시계를 한 카드 안의 두 칸으로 배치하고 필요한 모바일 HUD 행을 늘린 만큼 안내/경로 안전 공간과 결과 패널 위치도 맞춘다.
- 긴 fake-timer 검증은 시스템 시각을 이동하고 100ms 정도만 진행한다. 90초분의 SVG 갱신을 전부 실행해 테스트를 느리게 하거나 timeout을 늘려 숨기지 않는다.

## Validation Strategy
- 각 Task는 해당 엔진/화면/저장 테스트와 `npm run lint`, `npm run build`를 통과한 후 커밋한다. 마지막 Task는 기능 관련 회귀 전체와 320×667/390×667/768×1024/1440×900 로컬 데모 검증을 수행한다.
- 1000ms 시작이면 마감은 91000ms다. 90999ms 승급 허용/91000ms 만료 우선, 무입력 만료, 설정 pause/resume, 2단계 장시간 지속, 초기화 범위, 저장 실패와 마지막 잡힘 공개를 확인한다.
- 브라우저는 격리된 로컬 데모 프로필/저장소를 사용한다. 기존 랭킹 초기화는 실제 구현 후 해당 앱에서 적용되며 검증용 fixture를 일반 사용자 프로필에 쓰지 않는다.
- 기존 bundle 크기 경고는 build 실패와 구분한다. 코드 테스트와 무거운 브라우저 검증을 동시에 돌려 생기는 시간 초과는 먼저 환경 부하를 줄여 같은 명령으로 재확인한다.

## Adjacent Findings — Outside This Plan
- 기존 도움말의 '세 번 실수' 문구와 실제 세 번 잡힘 규칙 불일치, 설정을 열지 않고 계정/오디오가 보인다고 기대하는 `src/App.test.tsx`는 기존 별도 검토 항목이다. 수정 Task를 추가하지 않는다.
- 기존 bundle 크기 경고와 사용하지 않는 옛 SVG 팔다리 CSS 정리는 이번 단계/시간/랭킹 기능에 포함하지 않는다.
- 위 항목의 포함 여부는 사용자 선택 사항이며, 승인이 없으면 지정된 기능 검증에 집중한다.

## Completion — 2026-10-22
- Status: completed; P01 done3/3, 다음 Phase/Active Task 없음.
- 구현 커밋: T01 `1027b1f`, T02 `7349c38`, T03 `f5ade70`.
- 최종 지정 테스트10files/160tests, lint, build 통과. 네 화면 크기(320×667/390×667/768×1024/1440×900)의 승급·무제한2단계·시간 초과·설정 일시정지·기록 저장/재시작과 일반/reduced-motion 공개를 검증했다.
- 320px 글자150%/200%에서 발견한 접힌 장면은 모바일 grid의 자연 높이+장면 최소 공간+내부 스크롤로 수정하고 재검증했다. 정상 크기에서 HUD/경로/설정/컨트롤/결과가 겹치지 않고, 확대 상태에서도 스크롤로 접근 가능하다.
- 검증 방법·임시 스크린샷·보고서 위치는 T03 Validation Results에 기록했다. 기존 bundle 경고/도움말/App 기대값/옛 SVG CSS 정리는 범위 밖으로 남았다.
