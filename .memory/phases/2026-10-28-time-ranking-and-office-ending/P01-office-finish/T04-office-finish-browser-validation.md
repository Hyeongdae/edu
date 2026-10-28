# Task: T04 Office Finish Browser Validation

## Status: pending

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

- [ ] 시간 tuple·구 랭킹 초기화/해금 보호·각 클리어 즉시 저장을 브라우저에서 확인.
- [ ] 전체5단계·약4초 엔딩·모션 감소·저장 순서·focus·cleanup 확인.
- [ ] 두 진입점 계단 아트와 단독 무저장/1단계 경계 확인.
- [ ] 지정31파일/lint/build/diff 통과, 실제 count·증거·제한 기록, 데모 링크 제공.

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

- [ ] 구현/브라우저 검증 완료
- [ ] 지정 검증 통과
- commit: pending
