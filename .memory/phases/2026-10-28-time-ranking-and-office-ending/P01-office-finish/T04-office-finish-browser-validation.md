# Task: T04 Office Finish Browser Validation

## Status: done

## Goal

시간 랭킹, 클리어 즉시 저장, 약4초 퇴근 엔딩, 콘크리트 계단을 실제 브라우저에서 검증한다. 기존5단계 진행과 단독1단계 무저장 조건을 확인하고 계획을 완료한다.

## Decision Summary

- Depends on T01~T03. 이번 기능의 브라우저 검증과 직접 관련 결함 보완을 담당한다.
- 메인 /는5단계, 로컬 계정별 랭킹v2, 진행도v1이다. /descent-test.html는 DEV 로컬 데모에서만 실행하는1단계 무저장 실험이다.
- 랭킹 비교는 단계→점수→remainingTimeCs→먼저 달성한 시각. StageResult는 실제 종료 순간을 보관한다. 5단계 성적 저장이4초 엔딩보다 먼저다.

## Implementation

### I01. Evidence harness and scope

- Related Files:
  - 이 T04 청사진/phase.md/current.md/계획: 검증 결과와 정상 workflow 상태 동기화.
  - 제품 source는 기본 read-only. 직접 관련 결함을 발견하면 아래 경로에서만 수정/검증/보고:
    - `src/game/{types.ts,stageResult.ts,gameEngine.ts,recordStorage.ts,GameScreen.tsx,CheckpointPanel.tsx,useOfficeExitEnding.ts,OfficeExitEnding.tsx,office-exit-ending.css,pixel-theme.css}`
    - `src/game/pixel/PixelStair.tsx`, `src/leaderboard/{leaderboard.ts,LeaderboardPanel.tsx}`
    - T01~T03에 지정한 검사/fixture. 단독 adapter/view는 새 snapshot 호환에 직접 필요할 때만 수정.
  - 임시 driver/증거: `%TEMP%/time-ranking-and-office-ending-2026-10-28/T04/`.
  - 참고용 이전 helper:
    - `%TEMP%/main-game-descent-conversion-2026-10-28/cdp.mjs`
    - `%TEMP%/stair-descent-local-test-2026-10-28/cdp.mjs`
    - `%TEMP%/distance-based-pursuer-catch-up-2026-10-28/browser-smoke.mjs`
  - helper는 새 폴더로 복사해 현재 키/규칙에 맞춘다. 기존 driver의 오래된 시간/키 기대값을 그대로 쓰지 않는다.

#### Harness contracts

```typescript
interface ObservedResult {
  stage: 1 | 2 | 3 | 4 | 5;
  score: number;
  remainingTimeCs: number;
  endedAtMs: number;
  outcome: "cleared" | "caught" | "time-limit";
}
interface BrowserEvidence {
  scenario: string;
  viewport: { width: number; height: number };
  clock: "controlled" | "real";
  before: unknown;
  after: unknown;
  assertions: string[];
  screenshots: string[];
  runtimeErrors: unknown[];
}
```

- Node 내장 WebSocket/CDP 또는 기존 브라우저 도구를 사용한다. 패키지를 추가하지 않는다. 새 숨김/headless Chrome은 전용 임시 프로필/포트를 사용하고, 시작 시 PID/명령을 기록해 종료 전 소유권을 확인한다.
- 기존5175 데모 서버를 보존한다. 미실행이면 프로세스 환경의 VITE_LOCAL_DEMO_MODE=true로 Vite를 숨김 실행하고 URL을 기록한다. env 파일/tenant 설정은 바꾸지 않는다.
- 기록 fixture는 격리 context의 localStorage에만 넣는다. React 상태는 읽기 전용 관찰만 허용한다. fiber dispatch/내부 상태 대입으로 게임을 진행하지 않는다. native D/J/Space, 실제 터치, 선택/Continue/Quit/Restart로 진행한다.
- 날짜를 제어한 시나리오와 실제 시간/타이머 검사를 증거에 구분한다. 애니메이션 위치를 수동 이동한 사진을 실제 시간 검사로 보고하지 않는다.

### I02. Storage and ranking scenarios

1. 구 descent v1 랭킹, 여러 계정의 progress v1, auth/audio/session/기타 sentinel을 준비한다. 접속 시 구 랭킹만 정리되고 새v2는 비어 있으며 진행도/기본 해금 선택/기타 byte가 보존되는지 검사한다.
2. 유효v2와v1 공존, 구키 get/remove 실패, 재접속/StrictMode/재시도를 검사한다. 새v2와 해금이 지워지지 않아야 한다. 저장소 차단/공간 부족에도 플레이·Continue·Quit과 오류 안내가 동작해야 한다.
3. 같은 단계/같은 점수의 시간1234/1235를 두 계정 이상으로 구성한다.12.35초가 위에 표시되고1cs 개선은 개인 최고 갱신, 악화/완전 동점은 기존 achievedAt 보존·추가 쓰기0인지 확인한다. 높은 단계/점수는 시간보다 먼저 비교한다.
4. 실제 UI로1단계 클리어 후 CP가 표시되는 즉시v2의 단계/점수/시간을 읽는다. 제어 시계로95초 기다린 후 Quit해도 원래 시간/쓰기 횟수가 같아야 한다. 재접속 시2단계 해금과 기본 선택을 확인한다.
5. Continue 후2단계0점에서 진행해80점 등의 실제 성적을 만들고 잡히게 한다.2단계 점수/시간이 저장되고1단계 시간이 섞이지 않아야 한다. 개인 최고 tuple/여러 계정 TOP10/현재 사용자 표시/긴 이름도 확인한다.
6. 시간 초과는0.00초다. 늦은 visibility 복귀의 잡힘은 실제 접촉 기한으로 계산해0으로 뭉개지지 않아야 한다. 설정95초 대기는 남은 시간을 줄이지 않는다. 표시한 두 자리 소수와 저장 정수가 일치해야 한다.

### I03. Complete route and ending scenarios

1. 화면 크기320×667/390×844/768×1024/1440×900 각각에서 합법 생성 경로를 사용한다.1→Continue→2→Continue→3→Continue→4→Continue→5 전체 클리어를 확인한다. 각 단계0점 시작과 목표150/200/250/300/350, 즉시 저장된 같은 단계 snapshot, 기존 경로/보너스 보존을 검사한다. 제어 시계를 사용했음을 명시한다.
2. 마지막 성공 순간에5단계 clear 결과·v2 랭킹·해금이 먼저 저장되는지 확인한다. 일반 입력과 보너스 jump 초과 점수도 시나리오 중 각각 포함한다.4초 전에는 엔딩,4초 후에는 같은 score/time의 결과·랭킹이며 추가 쓰기0이다.
3. 별도 실제 시간 검사도 한다. 격리 progress로5단계를 해금하고 선택한 뒤 native 키로 실제 클리어한다.4초 자동 타이머와 결과 focus를 관측하고, 관측 허용 오차와 방법을 기록한다. 제어 시계의 전체 진행 검사와 구분한다.
4. 엔딩0/약1/약2.5/약3.8초 및 결과 PNG를 저장한다.1F/열리는 문/정립한 젊은 회사원/야경/퇴근 완료가 보여야 한다. 배경 HUD·설정 중복 노출, 캐릭터 네 포즈 동시 노출, 닫힌 문을 관통하는 오류가 없어야 한다.
5. 모션 감소는 정적인 최종 장면+결과가 즉시 표시된다. 재생 중 감소로 바꿔도 기다리지 않으며 다시 일반 모션으로 바꿔도 같은 결과를 재생하지 않는다. 재시작 후 새 클리어에서는 다시 재생한다. unmount 후 남은 타이머/listener가0인지 검사한다.
6. caught/time-limit/quit/CP에는 엔딩이 없다. D/J/Space/터치 연타나 늦은 visibility로 종료 후 점수/NPC/저장이 진행되지 않아야 한다. 결과 focus/Tab/native Space 재시작을 확인한다.
7. 긴 이름/소수 시간/320px/글자24px·32px에서 root 가로 overflow가 없어야 한다. 결과를 스크롤해 재시작/TOP10에 접근 가능해야 한다. 기존 safe area/조작 버튼 크기도 확인한다.

### I04. Stair art and standalone boundaries

- 메인과 단독 화면에서 회색 콘크리트 윗면/진한 앞면/노란 안전선이 읽히는 PNG를 저장한다. 좌우 회전/짧은 구간/보통 한 칸/두 칸 점프 착지, 상자 외곽, 발 clip, 앞면 가림, NPC50ms/기본 간격을 확인한다.
- 고정 seed에서 렌더마다 무늬가 바뀌지 않아야 한다. 아트는 실제 계단 index/방향/장애물 판정과 일치해야 한다.
- 단독 화면을 합법 입력으로1단계 클리어한다. 메인5단계 엔딩을 재생하지 않아야 한다. storage getter/메서드 호출0, 차단된 저장소에서도 플레이, auth/audio/main 랭킹·진행도 sentinel byte 보존을 확인한다.
- DEV gate와 메인 인증 경계는 기존 단위 검사로도 확인한다. 실제 tenant 로그인은 수행하지 않았다면 미검증으로 명시한다.

### I05. Final audit and evidence index

- driver의 before/after JSON·PNG·Runtime 오류0을 기록한다. 실패 로그도 보관하고 최종 성공 로그를 식별한다.
- evidence-index.json에 driver/시계 종류/화면 크기/결과/artifact 상대경로와 hash를 정리한다. 두 진입점 HTTP200과 서버 PID/명령을 기록한다.
- 소유권을 확인한 Chrome/context만 닫고 사용자 데모5175는 남긴다. 검증을 위해 사용자 실제 프로필/기록을 수정하지 않는다.
- 범위 밖 발견은 보고만 한다. 직접 관련 결함 수정은 파일/원인/재현/수정 전후를 기록하고 지정 검증을 다시 실행한다.
- Task done 후 지정 커밋, phase done4/4, plan completed, current ActiveTask/Phase 없음으로 동기화한다. 기존 완료 이력을 보존한다.

## Acceptance Criteria

- [x] 시간 tuple·구 랭킹 초기화/해금 보호·각 클리어 즉시 저장을 브라우저에서 확인.
- [x] 전체5단계·약4초 엔딩·모션 감소·저장 순서·focus·cleanup 확인.
- [x] 두 진입점 계단 아트와 단독 무저장/1단계 경계 확인.
- [x] 지정31파일/lint/build/diff 통과, 실제 count·증거·제한 기록, 데모 링크 제공.

## Validation

```powershell
npm.cmd test -- --run src/game/stageResult.test.ts src/game/pursuerCatchUp.test.ts src/game/recordStorage.test.ts src/game/StairScene.test.tsx src/descent/descentEngine.test.ts src/descent/descentSceneModel.test.ts src/descent/descentGate.test.ts src/descent/DescentTestApp.test.tsx src/descent/descentViewState.test.ts src/descent/DescentGameScreen.test.tsx src/descent/DescentScene.test.tsx src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts src/auth/authConfig.test.ts src/game/OfficeExitEnding.test.tsx src/game/pixel/PixelStair.test.tsx --maxWorkers=2
npm.cmd run lint
npm.cmd run build
& 'C:/Program Files/Git/cmd/git.exe' diff --check
```

모든 명령 통과, skip0. 로그는 `%TEMP%/time-ranking-and-office-ending-2026-10-28/`의 Task별 폴더. 실행 당시 실제 test 수/시간/빌드 크기·경고를 기록한다. 테스트 timeout/skip/config/package 변경 금지.


위 명령에 더해 저장한 driver를 정확한 경로의 `node <driver.mjs>`로 실행하고 exit0/Runtime 오류0을 기록한다. 기존 App 전체 suite/500kB chunk 경고는 별도 알려진 항목이며 검사 설정을 약하게 만들지 않는다.

## Commit Message

```text
test(game): verify time rankings and office-exit flow in browsers

Plan: 2026-10-28-time-ranking-and-office-ending
Phase: P01-office-finish
Task: T04-office-finish-browser-validation

- Verify ranking reset, frozen times and immediate checkpoint saves
- Check the fifth-stage exit, reduced motion and responsive stair art
- Record regression results and isolated browser evidence
```

## Progress

- [x] 구현/브라우저 검증 완료
- [x] 지정 검증 통과
- commit: 지정 구현 커밋에 포함 (hash는 phase/current의 완료 동기화에서 기록)

## Validation Results — 2026-10-29

- T04 브라우저 검증만 완료했다. 제품 source/test/config/package는 T03 `1fa30e6`과 동일하며 추가 수정이 필요하지 않았다. 진행은 native D/J/Space와 실제 CDP touch/클릭/Continue/Quit/Restart를 사용했다. React 상태는 읽기 전용으로만 관찰했고 fiber dispatch/내부 상태 대입은 사용하지 않았다. public 저장 API/LeaderboardPanel fixture는 실제 게임 진행과 구분해 기록했다.
- 환경: Windows/Node24.21.0/Chrome156.0.8078.49, DEV local demo true. 기존5175가 미실행이어서 프로세스 환경 VITE_LOCAL_DEMO_MODE=true로 숨김 Vite PID14620을 시작했다. .env/tenant 설정 변경 없음. 전용9228/Task 임시 프로필 Chrome PID15988과 격리 context만 사용했다.
- 성공 driver6개: full-flow.mjs, storage-ranking.mjs, ending-real-layout.mjs, mechanics-boundaries.mjs, standalone-boundaries.mjs, ending-interaction.mjs. 각각 `node "C:/Users/DEX/AppData/Local/Temp/time-ranking-and-office-ending-2026-10-29/T04/<driver>.mjs"`로 실행해 exit0/PASS/Runtime 예외0. 상세 시계·전후값·PNG는 동명 JSON/log에 있다. audit.mjs는 경로 길이/패턴·cleanup·단독 저장 경계와 검증 결과를 추가 확인했다.
- 네 화면320×667/390×844/768×1024/1440×900에서1→5 전체 진행: 각615행동/641물리계단,26보너스점프, 단계별150/200/250/300/352점. 각 단계0점 시작, 목표/예산90·75·65·60·50초, NPC600·500·400·300·250ms, 긴5~9/짧은1~3·긴짧긴/긴짧짧긴을 확인했다. 전체 진행은 Date.now 제어 시나리오다. 단계별 clear snapshot과 동일한 랭킹이 그 순간 한 번씩 저장되고, 마지막 보너스 jump 초과 점수352도 보존됐다.
- 시간/저장: 구 descent v1만 삭제, 여러 계정 progress v1/새v2/auth/audio/session/기타 sentinel byte 보존. StrictMode 실제 진입/재접속에서도 새 기록 유지. public API의 구키 get/remove 실패·재시도도 비파괴다. 같은 단계·점수1235cs가1234cs보다 우선하며1cs 개선만 갱신, 악화/동점은 achievedAt/byte/쓰기 수 보존. 단계·점수가 시간보다 우선하고 완전 동점은 먼저 달성 순서다. TOP10/현재 사용자/긴 이름과12.35·12.34 표시를 확인했다.
- 실제1단계 UI clear CP 즉시 저장→제어95초 대기→Quit에서 추가 쓰기0/90.00초 유지, 재접속2단계 기본 해금 확인. Continue/새 선택 후2단계80점 caught는 자체 snapshot/시간으로 저장된다. quota 실패에도 해금 저장/오류 안내/Quit, getter 차단에도 메모리 플레이/Continue/caught가 가능했다.
- 시간 경계: 설정95초 pause는 예산/추격 deadline을 그대로 늦춘다. 늦은 visibility caught는 실제 접촉 기한으로87.60초를 보존한다. 합법5단계 생성 경로를250ms/물리계단 속도로 진행해190행동·340점에서50초 timeout, 결과0.00초/엔딩 없음. caught/quit/CP도 엔딩이 없다.30칸부터50ms 인접추격, 넘어져도50ms 유지,7칸에서 해제를 확인했다.
- 실제 시간 엔딩은 Date.now/타이머를 제어하지 않았다. 해금 fixture 뒤 native 키로5단계350점 clear, 즉시4301cs 저장→4085ms에 결과/재시작 focus 관측. 허용 범위3990~4499ms,25ms polling/스크린샷 관측 오차를 포함한다.0/1000/2500/3800ms와 결과 PNG/CSS를 확인했고1F→문 열림→젊은 회사원 걷기→야경 문밖 퇴장→퇴근 완료 순서와 단일 pose/정립 상태/배경 HUD·설정 숨김이 정상이다. 이 사진은 모션을 수동 이동하지 않았다.
- 초기 모션 감소는 정적 final/결과/focus 즉시 제공, 재생 중 감소도 즉시 완료, 일반 모션 복귀는 같은 결과를 다시 재생하지 않으며 새 도전은 재생한다. 엔딩 중 D/J/Space/실제 touch/visibility가 점수·NPC·저장을 바꾸지 않는다. Tab은 엔딩 heading에 머무르고 결과의 native Space 재시작은 단계 선택으로 이동한다.
- 종료 후 App timer0/media listener0을 확인했다. 문서에 Vite HMR ping interval1은 남지만 callback source와 /@vite/client stack으로 식별한 개발 서버 인프라다. 게임 타이머로 오인하지 않도록 원본 before/after를 보존했다.
- 네 화면 글자24px·32px 결과/긴 이름 TOP10에서 root 가로 overflow0, 내부 스크롤로 재시작과 마지막 행 접근 가능.32px active 엔딩도 네 화면에서 확인했다. 메인/단독의 회색 윗면·진한 앞면·노란선, top→runner→front 순서와 원래 발 clip(-34,-88,68,84), 좌우 코너/일반 이동/상자·두 칸 점프가 정상이다. 별도 seed0.19의 일반 점프는3→5/2점, seed0.5 전체 경로는 보너스 점프4점을 검증했다.
- 단독 DEV 화면은 정상/차단 저장소 양쪽에서 각87행동으로1단계150점 종료, 메인 엔딩 없음. getter/local/session/Storage 메서드 호출 모두0, main ranking/progress/auth/audio sentinel byte 불변. DEV gate/메인 인증 경계는 지정 단위 검사와 production build로도 확인했다. 실제 Entra tenant 로그인과 스피커 청취 품질은 수행하지 않았다.
- 중간 driver 실패도 보존: storage-ranking-initial은 CP 버튼 focus 상태의 native Space가 Continue를 활성화한 검사 구성 오류였다. 비게임 입력 검사는 heading에 focus하고 버튼 Space 활성화 검사는 별도로 유지했다. ending-real-layout-initial은 스크롤 내부 정적 그림까지 viewport 안에 있어야 한다는 잘못된 기대였으며 실제 root/패널 경계·스크롤 접근을 검사했다. cleanup-initial은 Vite HMR interval을 App timer로 센 경우다. mechanics 초기에는50ms 애니메이션을65ms 뒤 읽은 시점/seed0.5의 첫60행동에 장애물이 없는 경우/seed0.19의 점프가 첫 코너보다 먼저 나오는 순서에 맞게 harness만 보완했다. 제품 source/규칙/timeout/skip/config 수정 없음. 실패 JSON/log도 index에 보존했다.
- 지정31파일945/945tests/skip0/workers2/71.22초, lint 오류0/경고0, tsc/Vite build/diff 통과. JS564.20kB(gzip157.79)/CSS63.80kB(gzip11.77),218modules/393ms. 기존500kB 초과 크기는 유지되며 이번 build.log에 chunk경고 재출력 없음. 알려진 App 전체suite 부채 정리는 범위 밖이다.
- 증거: %TEMP%/time-ranking-and-office-ending-2026-10-29/T04/evidence-index.json — artifact114개/PNG62개/주요 driver6개와 전체 파일 SHA256, 중간 실패 로그 포함. 브라우저 임시 profile은 index 대상에서 제외했다. full-flow.log의 PowerShell UTF16 BOM은 읽을 때 판별하며 원본은 유지했다. environment.json/process-identity.json/cleanup.json/scope-audit.log에 경계/소유권/서버/소스 불변을 기록했다.
- Win32_Process CommandLine에서 exact Task profile/9228 소유권을 확인한 뒤 Browser.close로 Chrome15988을 종료했다.9228 listener 없음.5175 PID14620은 유지하며 `/`와 `/descent-test.html` HTTP200/타이틀 확인. 사용자 실제 브라우저/프로필/기록과 기존 untracked 파일을 직접 변경하지 않았다. 새 범위 밖 결함: 특이사항 없음.
- 완료 테스트 링크: http://127.0.0.1:5175/ (메인), http://127.0.0.1:5175/descent-test.html (단독 로컬 실험).
