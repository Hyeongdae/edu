# Plan: Stair Descent Local Test

- Date: 2026-10-28
- Status: in_progress
- Source: [확정 결정](../decisions/2026-10-28-stair-descent-local-test.md)
- Planning history: 계획 작성 단계에서는 `.memory/` 문서만 작성했다. 후속 실행의 구현·검증 결과는 아래 Progress에 기록한다.
- Previous completed plan: [Stage Unlocks and Per-Stage Scores](./2026-10-27-stage-unlocks-and-per-stage-scores.md), T01 `f5ef960`, T02 `f35254f`, T03 `20f8425`, 완료 동기화 `8d9b31d`.

## Goal

기존 `/`의 오르기 게임과 기록을 보존하면서 `/descent-test.html`에서 로컬 데모 전용 내려오기 게임을 실행한다. D 한 칸/J 회전하며 한 칸/Space 장애물 두 칸 점프, 위쪽에서 추격, 1단계150점·90초, 기존 장애물/이벤트/넘어짐 규칙을 유지한다. 결과만 표시하며 저장소 접근과2단계 진행은 없다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | in_progress | 순수 규칙·좌표 → 독립 로컬 화면 → 실제 브라우저 검증 | [P01](../phases/2026-10-28-stair-descent-local-test/P01-local-descent/phase.md) |

## Task Roadmap

| Task | Result | Files |
| :--- | :--- | :--- |
| T01 | 기존 엔진의1단계 체크포인트를 최종 종료로 연결하고 하강 좌표를 생성 | 신규 `src/descent/descentEngine.ts`, `descentSceneModel.ts` 및 두 테스트 |
| T02 | 독립 HTML 진입점/개발모드 gate/저장 없는 화면·오디오·조작·하강 모션 | 신규 `descent-test.html`, `src/descent/main.tsx`, `descentGate.ts`, `DescentTestApp.tsx`, `descentViewState.ts`, `DescentGameScreen.tsx`, `DescentScene.tsx`, `descent.css` 및 gate/app/view/screen/scene 테스트 |
| T03 | 원본 보존·실제 하강 플레이·저장소 무접근·모바일·시간/모션 증거 | 신규 테스트 검증, 관련 신규 파일의 입증된 결함 수정만, Task/phase/plan/current 완료 기록 |

## Final Contract

- 기존 `index.html`, `src/main.tsx`, `App.tsx`, `src/game/**`, `src/leaderboard/**`, `src/auth/**`, `src/audio/**`, `src/test/**`, 기존 CSS·설정·패키지·자산은 읽기 전용이다. 새 구현은 `src/descent/`와 별도 HTML에만 추가한다.
- 별도 HTML의 entry만 `DEV && VITE_LOCAL_DEMO_MODE?.trim()==='true'`에서 테스트 화면을 장착한다. 기존 앱을 import하지 않고 실제 인증 우회나 기존 `/`의 메뉴 변경을 하지 않는다. Vite 기본 build input은 유지하므로 추가 HTML은 기본 `dist/`에 포함하지 않는다. 비활성 entry에서는 정적 이용 불가 안내만 표시한다.
- 논리 index/`stepsClimbed`는 이동량으로 계속 증가한다. 새 투영은 `x=260+columnDelta*34`, `y=216+indexDelta*28`, viewBox520×400이다. 원래 투영점의 `y`를 `432-y`로 바꿀 수 있으나 SVG/캐릭터/텍스트 전체를 뒤집지 않는다. 다음 계단은 아래쪽, NPC는 위쪽이다. 기존11계단은 index−4..index+6이며 가장 아래 앞면은y400, 초기 NPC 머리는y16으로 들어온다.
- stage는 항상1, 초기 score0/time90/NPCgap4/base800ms.150점 이상은 최종 cleared 결과(150~153점), 체크포인트/다음 단계/랭킹 없음. 재시작은 ready0점/시계 미시작/새 경로다. 원본 엔진의 체크포인트·5단계 규칙은 수정하지 않는다.
- 긴5~9/짧은1~3 혼합 경로와 기존 장애물 생성기를 그대로 사용한다. 상자는 긴 구간당10%·안전한 내부·최대1개/짧은 구간0개. 점프 정상2점/보너스4점, 실제30칸→30초2배, 잘못 입력500ms넘어짐/250ms추격, 한 번 잡히면 종료, 설정은 게임 시계 일시정지다.
- 랭킹·진행도·오디오 설정·인증 키를 읽거나 쓰거나 이관/삭제하지 않는다. 기존 `GameScreen`/`GameAppShell`, leaderboard/stageProgress, load/saveAudioPreferences는 import하지 않는다. 기본 오디오 값 복사와 메모리 상태만 사용하며 컨트롤러는 실제 시작 클릭 때 재생한다.

## Why Three Tasks

- T01은 DOM/오디오/저장소 없는 함수와 숫자 좌표여서 독립 테스트·lint/build가 가능하다. 실행할 UI가 없어도 검증 가능한 단위다.
- T02는 진입점·gate·화면·스타일·오디오 생애를 함께 연결해야 별도 주소로 플레이할 수 있다. 화면만 먼저 원본 `GameScreen`에 연결하면 기록 이관이 실행되므로 이 경계를 한 Task로 묶는다. 타이머/모션을 위한 순수 view reducer도 이 Task에서 실제 소비한다.
- T03은 실제 브라우저에서 내려오는 방향과 가림/점프·네 화면·원본 게임 보존을 판정한다. 단위 테스트 통과만으로 화면 비교가 끝났다고 표시하지 않는다.

## Regression Traps

- 원본 `applyInput`은1단계 클리어 순간 다음 구간을2단계 확률로 reveal한다. adapter에서 최종 장애물 결정을 이전 obstacles와 새 route로 stage1 재계산해야 한다. 이를 놓치고 stage 필드만1로 두어도 결정 metadata에2가 들어간다.
- 하강 투영 후 NPC visible을 원본 모델 값 그대로 쓰면 위쪽 화면 밖 판정이 틀린다. 새 좌표로 다시 계산한다. 이동·점프·잡힘 프레임도 함께 변환한다.
- 계단 y가 index와 함께 증가하므로 그리는 순서는 index 오름차순이다. 현재 오르기 scene의 역순이나 y반전 CSS를 복사하지 않는다. 점프는 위로 뜨는 궤적을 유지해야 하므로 fromY−56/midY−84/toY0과 기존 상승 궤적을 구분한다.
- 기존 픽셀 동작 CSS는 `.stair-game`에 묶여 있다. 자산만 import하면 여러 포즈 프레임이 모두 보일 수 있어 새 `.descent-game` 아래 포즈 표시·고유 keyframe을 정의한다. 원본의 선택자/키프레임을 수정하지 않는다.
- StrictMode 재실행/함수형 updater 안에서 사운드를 재생하면 발소리가 중복된다. view reducer는 순수하게 두고 단계 수/실수 식별자 변화로 효과를 한 번 호출한다. 재시작의 RNG도 이벤트에서 만든 readyState를 reducer에 전달한다.
- 새 화면은 storage getter가 차단되어도 실행 가능해야 한다. 원본 화면 import, 오디오 설정 helper 호출, 편의를 위한 localStorage.clear는 금지한다.

## Validation Strategy

- 각 Task의 명시 파일 테스트 + lint/build/diff check. T02/T03은 신규7테스트와 기존 지정17테스트(기존509개 기준)를 함께 실행하고 실제 개수를 기록한다. 전체 App suite의 별도 이슈는 확장하지 않는다.
- 브라우저는 개발 서버 프로세스 env의 로컬 데모와 별도 소유 context로만 검사한다. 기존 프로필을 읽거나 지우지 않는다. 증거는 `%TEMP%\stair-descent-local-test-2026-10-28\`의 script/JSON/PNG/log로 남긴다.
- 전체 하강 플레이는 실제 생성기·표시된 상자/코너에 맞는 실제 앱 입력으로 진행한다. 제어시간/엔진 경계 fixture와 실제800/250/500/3200ms 시간 검사를 분리한다. 320×667/390×667/768×1024/1440×900 및320px root24/32, reduced-motion을 확인한다.
- 저장소 접근 카운터/throwing getter를 앱 로드 전에 설치해0회임을 확인한다. sentinel은 도구가 소유 context에 먼저 만들고 검사 종료 시 도구 원본 메서드로 읽어 byte equality를 확인한다. 도구 읽기를 앱 접근으로 세지 않는다. 원본 `/` 검증은 별도 context라 원래 migration 동작과 섞지 않는다.
- 실제 결과와 링크를 기록한 뒤에만 Task done/phase3/3/plan completed/current none으로 전환한다. 실행 불가 검사는 미체크로 남긴다.

## Adjacent Findings — Separate Work

- 이번 계획에 추가할 새 범위 밖 결함은 발견되지 않았다. 기존 번들 크기, 독립 App 전체 suite, 공용 서버 랭킹, Entra 설정/배포, 내려오기5단계 확장, 원본 게임 리팩터링은 제외한다.
- 원본 게임의 저장 부수 효과/1단계 클리어 후2단계 reveal/상승 CSS는 결함으로 수정할 대상이 아니라 새 실험의 재사용 경계를 정하는 근거다.

## Progress

- done: 1/3 (active: T02)
- 2026-10-28 T01 `0225893` 완료: 순수1단계 adapter/하강 좌표 모델과 두 테스트. 지정8파일356/356tests(9.07s), lint/build/diff check 통과. 마지막 장애물의stage1 결정과 전체 모션점/가시성 변환을 확인했으며 원본 구현/저장소/설정/의존성은 변경하지 않았다. JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB), 기존500kB chunk 경고 유지.
- 로그 `%TEMP%\stair-descent-t01-2026-10-28\`, 상세 결과는 T01 Validation Results. 다음 T02에서 별도 로컬 HTML/화면을 연결하고, 실제 브라우저 완료는 T03에서 판정한다. 계획은 아직 in_progress다.
