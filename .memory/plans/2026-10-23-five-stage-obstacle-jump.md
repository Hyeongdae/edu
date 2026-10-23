# Plan: Five Stage Obstacle Jump

- Date: 2026-10-23
- Revision: 시간 기반 독립 추격과 긴/짧은 구간 혼합 반영. 이전 4개 Task 초안은 미구현 상태에서 아래 5개로 대체한다.

## Goal

5단계 제한시간90/75/65/60/50초 안에 누적300/600/900/1200/1500점을 달성하고 최종 클리어한다. 긴5~9칸 뒤 짧은1~3칸 구간1개 또는2개를 랜덤으로 연결한다. 긴 구간에만10/20/30/40/50%로 최대1개 장애물을 배치한다. 추격자는 단계별1000/800/600/500/400ms마다 실제 경로에서 한 칸 전진한다. Space 점프는2칸/기본2점·보너스4점이고 모바일은 앞으로 / 가까이 묶은 방향 바꾸기·점프다. 랭킹v3는 단계→점수 순이며 승인된 구형v1/v2만 정리한다.

## Source Decisions

- [원 결정](../decisions/2026-10-23-five-stage-obstacle-jump.md):5단계/점수/점프/보너스/랭킹/조작.
- [우선 적용할 후속 결정](../decisions/2026-10-23-five-stage-chase-route-revision.md):계단 패턴/장애물 확률·대상/추격·오입력 변경.
- [별도 넘어짐 소리 문제](../decisions/2026-10-23-fall-sound-playback-fix.md)는 포함하지 않는다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | in_progress | 5단계·랭킹, 경로·장애물 기반, 독립 추격, 점프 조작, 모션·검증 | [P01](../phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/phase.md) |

## Task Roadmap and Cohesion

| Task | Result | Main files |
| :--- | :--- | :--- |
| T01 | 5단계/최종 클리어/HUD/v3랭킹, 새 수치의 공통 규칙표 | types, stageRules, gameEngine, GameHud, GameScreen, StairScene, leaderboard, tests |
| T02 | 긴·짧은 패턴/구간 메타데이터/과거 보관 API/독립 장애물 생성 기반 | types, stairRoute, stairObstacles, route/scene/engine fixtures |
| T03 | 독립 추격·시간순 잡힘·오입력 정지·경로 보존·실제 전진 모션 | types, gameEngine, stairSceneModel, StairScene, GameScreen, pixel CSS, pursuit tests/fixtures |
| T04 | 보이는 상자와 충돌/Space/3버튼/2·4점 피드백 연결 | types, gameEngine, GameScreen, ControlButtons, GameHud, PixelIcon, PixelObstacle, CSS, tests |
| T05 | 클립 밖 점프 아크, 빠른 후속 입력,5단계·추격·랭킹·반응형 통합 검증 | stairSceneModel, StairScene, GameScreen, PixelOfficer, CSS, tests, memory completion |

- T01에서 단계 타입과 저장 검증을 함께 바꿔3~5단계 기록이 거부되는 중간 상태를 피한다. 추격 수치만 공통 표에 준비하고 실제 독립 추격은 T03에서 연결한다.
- T02에서 경로/장애물 순수 모듈을 준비하되 충돌/그림은 연결하지 않는다. T03은 추격 시계·실제 위치·경로 보존·표시를 함께 구현해야4칸보다 멀어진 순간 깨지지 않는다.
- T04는 장애물 표시와 피하는 조작을 함께 연결해 보이지 않는 충돌/피할 수 없는 장애물을 만들지 않는다. T05는 전용 점프 모션과 브라우저 검증이다. 외부 연동 경계가 없으므로 단일 Phase다.

## Shared Architecture

- `stageRules.ts`: GameStage1..5, durationMs/targetScore/obstacleProbability/pursuerStepIntervalMs 단일 표. 모든 수치는 표에서 읽고 UI/저장 검증이 공유한다.
- 경로는 시작에 과거-4..0과 미래18칸, 이후에는 최소 플레이어 뒤4칸과 실제 추격자/최근 전진 출발 노드까지 보관한다. 장면의 기본11칸(뒤4+앞6)과 논리 경로 보관량은 다르다.
- 구간 종류long|short, 길이1|2|3|5|6|7|8|9. 긴 구간마다 짧은 구간1/2개를 균등 선택하고 구간마다 방향 반전. 처음은 오른쪽 긴 구간, 인접 짧은 구간 길이는 비반복. 이전 긴 구간 길이를 따로 금지하지 않는다.
- 장애물은 별도 uint32 RNG와 구간 결정 목록. 짧은 구간은 항상null, 긴 구간만 확률 판정. 이미 보인 '없음'도 재추첨하지 않는다. 새로 보일 긴 구간은 완료 이동 후 단계의 확률을 쓴다.
- 추격 위치는 pursuerIndex가 원본이고 pursuerDistance=stepsClimbed-pursuerIndex는 호환용 파생 캐시다. nextPursuerStepAt으로 예정 시각을 보존한다. 성공 입력은 추격자를 이동시키지 않고 오입력도 즉시 전진시키지 않는다.
- tick은 단계/이벤트/회복/잡힘 공개/추격 예정시각을 시간순 처리한다. 같은 시각은 단계 만료가 우선, 추격은 입력보다 우선이다. 이전 시각의 실제 잡힘을 미래의 단계 만료로 지우지 않는다. 숨김 복귀도 실제 경과를 재현한다.
- 설정창은 단계/이벤트/추격 시계를 함께 보정한다. 기존500ms 회복·잡힘 공개는 미용/회복 시계로 그대로 경과한다. 중복 닫기로 시계를 두 번 늘리지 않는다.
- lastPursuerMove/captureCount/captureEndsAt으로 플레이어 오르기/오입력과 독립된 추격 모션·잡힘을 표시한다. 시간 경과 잡힘을 넘어짐 오디오 이벤트로 바꾸지 않는다. 먼 추격자는 화면 밖에 있을 수 있고 실제 거리 표시는 계속된다.
- 점프 lastMove는 종류/출발/착지/획득점수/보너스 여부를 기록한다. 일반 점프2점을 보너스로 오인하지 않는다. 보너스 시작은 입력 전체 이동 완료 후, 마감/잡힘은 입력 전에 판정한다.
- v3랭킹은 한 판의 단계/점수 쌍을 저장하고 v1/v2만 제거한다. 유효한v3/audio/auth/다른 키와 로그인 경계는 보존한다.

## Regression Traps

- player-4만 보관하거나 거리<=4 검사를 남기면 독립 추격자가 뒤처진 즉시 RangeError가 난다. 과거 보관/장면 검사/조건부 actor 렌더를 같이 바꾼다.
- 타이머 콜백마다 Date.now+간격으로 재설정하면 숨김 탭에서 추격이 느려진다. 이전 예정시각+간격으로 모든 실제 경과를 반영하고 잡힘 때만 재배치한다.
- 시각마다 게임이 바뀌어도 플레이어 효과의 cleanup이300ms 타이머만 취소하면 모션이 영구 유지될 수 있다. 각 효과는 실제 이동/실수/종료를 나타내는 원시값에만 의존한다.
- 오입력 벌점 gap-1과 플레이어 성공에 맞춘 NPC 전진을 제거한다.500ms 정지 동안 정상 시간 추격은 계속된다. 무입력 잡힘도 저장/결과를1회 발생시킨다.
- 기존 잘못된키4회로 잡는 테스트는 새 규칙과 다르다. 테스트를 실제 시각/추격 위치로 바꾸며 시간 초과 테스트는 그전에 잡히지 않는 일관된 fixture를 사용한다.
- 짧은1칸 구간에서는 J 다음에도 J가 필요하다. J가 회전만 하거나 한 번 더 D를 강요하면 안 된다.0/0.5/.999 난수는 최초 긴5/7/9칸을 만든다.
- 일반 점프2점/보너스4점, 이벤트28/29칸에서2칸 점프,299/1499 목표 초과를 검증한다. 점프 아크는 feet clip 밖에서 움직인다.
- 모바일>=721px controls 숨김과 최종 reduced-motion CSS를 유지하면서 새 그룹/모션을 반영한다. 한 탭의 pointerdown+click을2번 처리하지 않는다.

## Validation Strategy

- 계획 단계에서는 테스트·lint·build·브라우저·실제 저장소 정리를 실행하지 않는다. 각 Task가 자신의 정확한 명령을 갖고 실행 단계에서 검증/커밋한다.
- T03의 시간 테스트는 실제 엔진의 시계를 사용한다. 구형 시간 초과/승급 단위 테스트의 상태는 test-only fixture에서 보정하며 제품에 치트 설정을 넣지 않는다.
- T05는 기능 관련 회귀14파일/lint/build,320×667/390×667/768×1024/1440×900,320px 글자150%/200%,일반/reduced-motion을 검증한다. 격리 브라우저/저장소를 쓴다.
- 전체5단계 점프/장애물/저장 흐름은 고정·제어 시간으로 빠르게 재현할 수 있으나, 독립 추격은 별도의 실제 경과 시간/숨김 복귀/무입력 검증을 반드시 수행한다. 고정 시간 결과만으로 추격 성공을 주장하지 않는다.

## Adjacent Findings — Outside This Plan

- 넘어짐 소리 청취 문제는 별도 확정 결정으로 남긴다. 새 추격 안내의 필수 수정은 포함하되 독립적인 오디오 수정/새 음원은 합치지 않는다.
- 오래된 App.test.tsx 기대값, 옛 SVG CSS, 번들 경고는 별도 검토다. 이 계획 때문에 필요한 fixture와 실제 도움말은 갱신하되 독립 정리 Task를 추가하지 않는다.

## Progress

- done: 2/5 (active: T03). T01:12a49d3(192tests), T02:7d1f426(202tests), 각 지정검증/lint/build 통과.
- 5단계/최종 클리어/HUD/v3랭킹, 긴·짧은 경로 패턴/선택적 과거 보관 API/독립 장애물 생성 기반까지 구현 완료. 시간 기반 추격/장애물 실제 표시·충돌·점프/브라우저 검증은 후속 작업이다.
