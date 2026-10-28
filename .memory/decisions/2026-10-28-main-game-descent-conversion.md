# Decisions: Main Game Descent Conversion

- Date: 2026-10-28
- Status: Confirmed
- Feature: `main-game-descent-conversion`
- Workflow: grill-me interview complete; implementation and planning have not started.
- Related completed experiment: [Stair Descent Local Test](./2026-10-28-stair-descent-local-test.md)

## D01. Convert the existing main game

- **Chosen**: 사용자가 선택한1번. 기존 `/`의 메인 게임을 내려오는 방식으로 바꾸고5단계·로그인·랭킹·체크포인트·단계 선택 기능을 유지한다. 추격자는 플레이어 위쪽에서 같은 계단 경로를 따라 내려온다.
- **Rationale**: 사용자는 별도 로컬 실험을 확인한 뒤 원래 게임을 내려오기로 바꾸기를 요청했다.1단계 전용 실험 화면으로 메인 앱을 교체하는 범위가 아니다. 새 모드 선택 UI는 추가하지 않는다.

## D02. Keep current five-stage rules

- **Chosen**: 사용자의 기존 기능 유지 선택과 현재 `stageRules.ts`를 근거로 다음 값을 유지한다.

| Stage | Target points | Time | Long-run obstacle chance | Normal pursuer interval |
| :--- | ---: | ---: | ---: | ---: |
| 1 | 150 | 90초 | 10% | 800ms |
| 2 | 200 | 75초 | 20% | 650ms |
| 3 | 250 | 65초 | 30% | 500ms |
| 4 | 300 | 60초 | 40% | 400ms |
| 5 | 350 | 50초 | 50% | 300ms |

- **Rationale**: 진행 방향의 전환이 요청 범위이며 난이도 수치 변경은 요청되지 않았다. 각 단계는0점으로 시작하고 클리어 시 계속/그만두기 선택, 다음 단계 해금, 해금된 단계 선택,5단계 최종 종료를 유지한다. 랭킹은 실제 도전 단계 우선, 같은 단계에서는 해당 단계 점수 우선이다.

## D03. Keep input, obstacles, bonus and mistakes

- **Chosen**: D는 한 칸 내려가기, J는 방향을 바꾸며 한 칸 내려가기, Space는 다음 장애물 계단을 넘어 그 다음 계단으로 두 칸 이동한다. 모바일은 내려가기/방향 전환/점프 버튼을 유지하고 방향 전환·점프 간격4px을 유지한다.
- **Chosen**: 긴5~9칸/짧은1~3칸의 기존 랜덤 혼합 경로, 긴 구간 내부 장애물/짧은 구간 장애물 없음,30물리계단마다30초2배 이벤트를 유지한다. 점프는 일반2점/보너스4점, 성공 효과음은 점프도1회다.
- **Chosen**: 목숨은 없고 한 번 잡히면 종료한다. 잘못 입력하면500ms 동안 넘어지고, 넘어진 동안 추격자는250ms 간격으로 이동한다. 기존 회복·잡힘·시간 만료 우선순위와 설정/체크포인트 중 시간 정지를 유지한다.
- **Rationale**: 코드에서 확인한 기존 조작·규칙을 하강 화면에 그대로 적용한다. 방향 반전으로 점프 판정이나 물리 이동량을 바꾸지 않는다.

## D04. Start both rankings and unlocks fresh

- **Chosen**: 사용자가 선택한3번. 오르기에서 쌓인 랭킹과 단계 해금 기록을 모두 초기화한다. 내려오기 첫 진입은 빈 랭킹/해금 이력0/1단계 기본 선택이며2~5단계는 잠긴다.
- **Rationale**: 사용자가 두 기록 모두 초기화하고1단계부터 시작하기를 명시적으로 선택했다. 이전 랭킹의 bestStage 또는 이전 progress를 새 해금 이력으로 복원하지 않는다.

## D05. One-time reset and new record persistence

- **Chosen**: 코드 구조를 근거로 전환 버전의 랭킹·진행도 저장을 구버전과 구분한다. 새 저장 키/버전을 사용하고 구자료 이관 경로를 끊는다. 기존 랭킹v1~v5 및 progress:v1만 초기화 대상으로 명시하며 새 내려오기 기록은 초기화 대상에 포함하지 않는다. 구키 정리 순서와 새 키 이름은 후속 계획에서 구체화한다.
- **Chosen**: 전환 최초 초기화 이후 새 내려오기 점수·해금은 정상 저장한다. 재접속/새로고침/재시작/React StrictMode 재실행 시 새 기록을 다시 지우지 않는다. 구키 정리가 일부 실패해도 옛 기록이 복원되거나 새 기록이 반복 삭제되지 않게 한다. 저장소 접근이 차단된 경우 기존 저장 실패 안내와 플레이 가능한 메모리 상태를 유지한다.
- **Rationale**: 현재 `readLeaderboard()`가 `migrateLegacyStageProgress()`를 호출하고, `readStageProgress()`/`saveStageProgress()`도 v4 랭킹을 이관한다. 단순히 현재 두 키만 지우면 옛 해금이 되살아날 수 있다. 기존 보존 목적의 이관을 새 메인 게임에 그대로 적용하면 사용자 초기화 선택과 충돌한다.

## D06. Storage scope and retained preferences

- **Chosen**: 현재 기록은 서버가 아닌 브라우저 localStorage에 저장된다. 각 브라우저/접속 주소(origin)의 게임 기록이 전환 대상이며 해당 저장소의 모든 계정 랭킹·해금을 새로 시작한다. 다른 브라우저를 원격으로 지우는 관리 기능은 추가하지 않는다.
- **Chosen**: Entra/MSAL 인증 데이터, 세션, `stair-climb:audio:v1`, 무관한 저장 키는 보존한다. `localStorage.clear()`/`sessionStorage.clear()` 방식은 사용하지 않는다. 로그인 방식과 개발용 로컬 데모 조건을 유지한다.
- **Rationale**: 사용자 선택은 랭킹·단계 해금의 초기화다. 계정 로그인이나 음량 설정을 초기화할 근거는 없다. 현재 앱에는 사내 공용 서버 랭킹이 구현되어 있지 않다.

## D07. Downward projection and upright motion

- **Chosen**: 기존 메인 픽셀 디자인/전체화면 HUD/설정/결과/단계 UI를 유지하면서 계단 투영과 이동 연출을 내려오기 방향으로 전환한다. 플레이어는 다음 아래 계단으로 이동하고 세계 좌표는 카메라 기준으로 위로 움직인다. 추격자는 실제 지난 계단에서 양쪽 코너를 따라 내려온다.
- **Chosen**: 논리 route index/이동 계단 수/점수 모델은 기존처럼 증가시킨다. 좌표만 하강으로 투영하며 캐릭터·배경·텍스트 SVG 전체를 뒤집지 않는다. 계단 그리기 순서/가림/발 clip/NPC 가시성/한 칸·점프·잡힘 궤적을 함께 적용한다. 검증된 하강 좌표와 모션을 재사용한다.
- **Rationale**: 로컬 실험은 player anchor260,216/다음 계단y244/NPC 초기y104, 한 칸 fromY−28/midY−22, 점프 fromY−56/midY−84를 실제 브라우저에서 검증했다. 단순 CSS 반전이나 계단 좌표만 변경하면 캐릭터 방향·발 가림·점프·잡힘 위치가 맞지 않는다.

## D08. User-facing labels and sound

- **Chosen**: 페이지 제목·로그인 화면의 게임명·조작 안내·HUD 계단 설명·접근성 이름을 `계단 내려오기`/`내려가기` 표현으로 일치시킨다. 모바일 전진 화살표는 아래 방향으로 표시한다. 기존 BGM/이벤트 배속1.25/발소리/넘어짐 효과음 및 음량·음소거 설정 저장은 유지한다.
- **Rationale**: 원본 `index.html`, `AuthGate`, `GameScreen`, `ControlButtons`, `StairScene` 등에 상승 문구가 남아 있다. 메인 게임의 실제 진행 방향과 안내가 달라지지 않아야 한다.

## D09. Reuse boundary and existing experiment

- **Chosen**: 메인의 기존5단계 엔진·저장·인증 흐름을 사용한다. 로컬 실험의1단계 전용 `descentEngine`/view reducer/`DescentTestApp`을 메인 앱으로 연결하지 않는다. 독립 `/descent-test.html` 실험의 삭제·변경은 이번 범위에 추가하지 않는다.
- **Rationale**: 실험 adapter는 stage2/checkpoint 입력을 거절하고150점에서 최종 종료하며 저장을 수행하지 않는다. 이를 메인에 직접 연결하면 사용자가 유지하기로 한5단계·체크포인트·기록 기능이 사라진다. 공용 좌표/자산 재사용 시 실험이 이중 반전되지 않도록 의존 관계도 확인한다.
- **Chosen**: 이전 완료 계획의 원본 읽기 전용 제한은 그 로컬 실험의 범위였다. 새 계획에서는 사용자 요청을 위해 메인 게임과 랭킹·진행도·표시 문구 및 관련 테스트를 변경할 수 있다. 이전 결정/검증 이력은 수정하지 않는다.

## D10. Required follow-up validation and exclusions

- **Chosen**: 후속 실행에서5단계 하강/체크포인트/각 단계0점/다음 단계 해금/랭킹 순서/전환 최초 초기화·이관 차단·재접속 새 기록 보존·계정 간 분리·로그인/오디오 설정 보존을 검증한다. 양쪽 장애물 점프/위쪽 NPC/넘어짐250ms 추격/시간 경계/설정·모바일·reduced-motion을 실제 브라우저에서 확인한다.
- **Rationale**: 실험의1단계 성공만으로 메인의5단계/저장 전환을 검증했다고 볼 수 없다. 전환 데이터와 이후 새 기록을 분리해 확인해야 반복 초기화를 잡을 수 있다.
- **Adjacent findings, report only**: 기본 동시 테스트에서 기존 GameScreen30회 렌더링 검사 시간 초과가 재현된 이력과 기존 JS551.91kB 번들 크기가 있다. 성능 개선은 이번 사용자 선택에 추가하지 않는다. 공용 서버 랭킹/Entra 설정 변경/배포/새 의존성/난이도 재조정도 별도 요청 대상이다.

## D11. Include the main audio-retry focus correction

- **Chosen**: 사용자가 별도 발견 사항도 함께 처리하도록 요청했다(2026-10-28). 메인 설정창에서 `음악 켜기` 재시도 성공 후 버튼이 사라질 때 포커스를 설정창 안으로 복구하는 수정을 T02에 포함한다. T03에서 실제 키보드 재시도/Tab/Escape/설정 닫기 후 버튼 복귀를 확인한다.
- **Rationale**: 현재 main은 설정창을 처음 열 때만 close 버튼에 focus한다. 재시도 버튼 제거 후 body로 focus가 빠지면 dialog의 Escape/Tab 처리를 받지 못한다. 이미 독립 실험에서 수정한 동일 증상을 메인에도 적용할 필요가 있고 사용자가 범위 추가를 승인했다.
- **Chosen**: focus가 이미 유효한 dialog 내부 input/button에 있으면 유지한다. 닫기 후에는 재활성화된 설정 버튼으로 복귀하고, 닫힌 상태의 늦은 재생 결과가 사용자 focus를 가져오지 않게 한다. 설정 pause/게임 입력 차단/오디오 owner·재생·저장 방식은 그대로 둔다. 기존 GameScreen 테스트와 브라우저 시나리오를 보강하며 Task 수는3개로 유지한다.

## Next Step

`/memory-plan main-game-descent-conversion`으로 상세 계획과 실행 포인터를 만든다. 이 인터뷰에서는 결정문만 저장했고 구현·테스트 실행·실제 저장 기록 삭제·현재 작업 포인터 변경은 하지 않았다.
