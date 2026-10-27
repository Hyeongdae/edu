# Plan: Stage Checkpoints and Fall Chase

- Date: 2026-10-23
- Status: in_progress
- Source: [확정 결정](../decisions/2026-10-23-stage-checkpoints-and-fall-chase.md)
- Previous completed plan: [Five Stage Obstacle Jump](./2026-10-23-five-stage-obstacle-jump.md), implementation `e369a28`, memory completion `40d58a5`.

## Goal

생명 없이 한 번 잡히면 종료하는 5단계 게임으로 바꾼다. 새 판은 선택 단계에서 0점으로 시작하고 각 단계에서 추가 400점이 필요하다. 1~4단계를 클리어하면 모든 시계가 정지한 체크포인트에서 계속/그만두기를 고른다. 이전 최고 클리어 단계까지 선택 가능하며 그 진행도를 기록 기준으로 이어받는다. 새 랭킹은 기록 단계0~5 → 이번 판 점수 순이다. 평상시 추격은800/650/500/400/300ms, 넘어지는500ms 동안은250ms 간격이다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | in_progress | 체크포인트 세션·저장, 단계 선택, 넘어짐 가속, 통합 검증 | [P01](../phases/2026-10-23-stage-checkpoints-and-fall-chase/P01-checkpoint-game/phase.md) |

## Task Roadmap

| Task | Result | Main files |
| :--- | :--- | :--- |
| T01 | 400점 체크포인트/생명 제거/기록 단계/진행도/v4랭킹을 함께 연결 | types, stageRules, gameEngine, stageProgress, CheckpointPanel, GameScreen, GameHud, StairScene, App, leaderboard, fixtures/tests, pixel-theme |
| T02 | 저장 진행도로 단계 선택·새 판·결과 뒤 선택 화면 연결 | StageSelectPanel, GameScreen, pixel-theme, selection/UI tests |
| T03 | 넘어짐500ms 중250ms 추격, 경계·설정·숨김 시간 일관성 | gameEngine, GameScreen help, pursuit/engine/UI tests |
| T04 | 전체5단계·선택/포기/실패·저장·실제 추격·반응형 브라우저 검증 | listed regression tests, verified related UI corrections, memory completion |

## Why These Boundaries

- 상태만 먼저 바꾸면 기존 화면이 체크포인트를 종료로 오인하고 랭킹에 플레이 단계를 저장한다. T01에 엔진·최소 체크포인트 UI·HUD·0단계/v4저장을 묶어 한 번의 검증 가능한 변경으로 만든다.
- T01 엔진은 시작 단계 옵션을 제공하지만 화면은 우선1단계 시작이다. T02가 사용자 선택창과 잠금/재시작을 연결한다. 임시 호환 저장 모듈이나 이후 삭제할 중복 랭킹 API를 만들지 않는다.
- 일반 추격 새 수치는 공통 규칙표를 바꾸는 T01에 넣고, 시간순 이벤트를 더하는 넘어짐 가속은 T03에서 별도로 검증한다. T01/T02 시점에는 넘어짐 가속이 아직 없다는 점을 기록한다.
- 외부 서비스/배포 경계가 없으므로 단일 Phase다. 계획 단계에서는 구현·테스트·브라우저·실제 저장소 초기화를 실행하지 않는다.

## Shared Contracts

- 실제 플레이 단계 `GameStage=1|2|3|4|5`, 기록/진행도 `ClearedStage=0|GameStage`를 분리한다. `stage`와 `recordStage`를 혼용하지 않는다.
- `recordStage=max(새 판 시작 때 알고 있던 최고 클리어 단계, 이번 판 실제 클리어 단계)`. `clearedStageThisRun`은 새 판0부터 실제 클리어로만 증가한다. 낮은 단계 재플레이도 이전 최고 진행도를 기록 기준으로 사용한다는 마지막 사용자 선택을 따른다.
- `stageStartScore`를 저장하고 목표는항상`stageStartScore+400`. 초과 득점을 버리지 않으며 계속하기 시 다음 `stageStartScore=현재 score`다. 새 판/단계 선택은score0/새route/event0/NPC-4다.
- 체크포인트는 `status=checkpoint`, `checkpointEnteredAt=클리어 입력 시각`, stage는방금완료한단계, stage/NPC deadline=null. tick과 입력은상태를변경하지않고 bonus는입장시각기준으로동결한다. 계속하기에서만보너스절대시각을대기시간만큼보정하고다음stage의온전한시계를시작한다.
- 최초 잡힘에논리종료하고NPC가플레이어와같은인덱스에들어가거리0이되는상태는만들지않는다. 종료직전NPC=player-1/거리1을유지해기존양수거리장면검증과실제잡힘overlay를사용한다. 리스폰은없다.
- 새 랭킹 `stair-climb:leaderboard:v4`는기존필드accountId/displayName/bestStage/bestScore/achievedAt를유지하되bestStage0~5다. 구v1/v2/v3만정리한다. 진행도는`stair-climb:stage-progress:v1`의계정별최고단계다. 신형키/audio/auth/다른키를초기화하지않는다.
- 진행도는실제클리어즉시저장하고랭킹은quit/caught/time-limit/cleared종료때최종점수로1회비교저장한다. StrictMode/tick/설정열기/재클릭으로최종저장guard를풀지않는다. 기록실패는안내하고플레이/종료/재시작을막지않는다.
- route/obstacle/2칸점프/30칸30초보너스/정적모션감소/독립240msNPC·300ms플레이어를보존한다. 체크포인트/종료는미용타이머를취소하되마지막성공발소리는1회낸다.

## Regression Traps

- 0단계를`GameStage`에넣으면규칙표·장애물·장면에서잘못된플레이단계가허용된다. 별도의ClearedStage검증기를사용한다.
- 목표를`stage*400`으로계산하면3단계선택새판이1200점을요구한다. 실제현재단계시작점수+400을사용한다.
- 체크포인트에서Date.now로bonus잔여시간을그리거나tick하면선택중에소모된다. 동결시각을사용하고설정과체크포인트대기를중복가산하지않는다.
- 생명만제거하고NPC충돌후인덱스를그대로증가시키면distance0으로scene RangeError가난다. 최종접촉은catch overlay가표현하고양수인덱스차이를유지한다.
- 생명카드를없앤뒤desktop3열/mobile2열HUD가남으면빈칸이생긴다. 실제두카드그리드와내부스크롤/자동높이controls를함께조정한다.
- 가속을오입력마다다시예약하거나복구끝250ms예정이동을삭제하면입력반복으로추격을늦출수있다. 절대시각순재현·동시단계만료우선·회복중입력무시를검증한다.
- 기존12초3잡힘/3생명/300점자동승급/v3고정 테스트는새규칙과맞지않는다. 의도상바뀐기대값과일관된fixture를갱신하고route/obstacle/점프/오디오호출검증을약화하지않는다.
- 현재React19 ESLint는effect안의불필요한동기setState를잡는다. 기존refs/타이머callback/파생원시값패턴을사용하고lint를끄지않는다.

## Validation Strategy

- 각Task에정확한Vitest파일목록과lint/build명령을기재한다. 최종17파일+브라우저를검증한다. 전체App.test.tsx기대값정리는별도다.
- 브라우저는전용context/storage에서320×667/390×667/768×1024/1440×900,320px root24/32px,일반/reduced-motion을검증한다. 전체가속진행은제어시간을쓸수있지만일반추격·250ms가속·단일잡힘은별도실제시간증거를남긴다.
- 성공/포기/실패·재선택·해금계정분리·v3정리/v4보존·진행도오류/랭킹오류·95초설정/체크포인트·숨김복귀·빠른D/J/Space/터치·전경점프·긴점수/이름접근을포함한다.

## Adjacent Findings — Separate Work

- 별도넘어짐소리청취문제는기존결정으로남는다. 이계획의오디오검증은실제성공/실수호출횟수다.
- 옛SVG CSS전체정리/기존App테스트의독립기대값/500kB번들분할/Entra설정/배포는별도다. 이번규칙으로직접바뀌는안내·관련fixture·HUD배치는포함한다.

## Progress

- done: 2/4 (active: T03). 2026-10-27 T01 `afafa68`: 체크포인트/400점/생명 제거/기록0~5/v4/계정 진행도/일반 추격 수치 구현.
- 지정16파일 388tests, lint/build 통과. JS548.68kB(gzip153.34kB), 기존500kB 경고 유지. 사용자 브라우저 직접 확인은 T04다.
- 2026-10-27 T02 `fa1a5ec`: 계정별 단계 선택/해금/최고 클리어 기본값/0점 새 판/결과 뒤 선택 복귀 구현. 지정17파일402tests, lint/build 통과. JS550.61kB(gzip153.85kB), CSS55.52kB(gzip10.78kB); 기존500kB 경고 유지.
- 다음 T03 넘어짐250ms 가속. T04 전체 브라우저 검증은 미완료.
