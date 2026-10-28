# Plan: Main Game Descent Conversion

- Date: 2026-10-28
- Status: completed
- Source: [Confirmed decisions](../decisions/2026-10-28-main-game-descent-conversion.md)
- Execution: T01 기록 저장 준비/T02 메인 하강 통합/T03 실제 브라우저 검증 완료. main 최초 접속의 구 기록 한 번 초기화와 이후 새 기록 보존을 검증했다.
- Baseline: `bdf18d5` (local descent plan completion); main ascent is still live. Previous local experiment T01 `0225893`, T02 `f9aa712`, T03 `04fdeea`.

## Goal

기존 `/`의 픽셀 게임을5단계 내려오기로 전환한다. 위쪽 추격자/D·J·Space/모바일 버튼/체크포인트/각 단계0점/단계 선택/랭킹/Entra와 오디오 설정을 유지한다. 최초 전환에서 구 랭킹과 해금을 모두 초기화하고 이후 내려오기 기록은 재접속해도 유지한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | completed | 기록 전환 준비 → 메인 하강 통합 → 실제 브라우저 검증 | [P01](../phases/2026-10-28-main-game-descent-conversion/P01-main-descent/phase.md) |

## Task Roadmap

| Task | Observable result | Primary files |
| :--- | :--- | :--- |
| T01 | 명시적 descent 저장 scope를 준비하고 기존 메인은 계속 기존 저장·상승 동작 | 신규 `game/recordStorage.ts`/test, `stageProgress.ts`/test, `leaderboard.ts`/test |
| T02 | `/`에서5단계 하강·새 저장 scope 활성화 및 오디오 재시도 후 설정 focus 복구 | `GameScreen`, `StairScene`, `pixel-scene.css`, `ControlButtons`, `GameHud`, `AuthGate`, `index.html`, 관련 테스트/README |
| T03 | 전체5단계/새 기록 보존/모션·모바일·설정 focus·로그인 경계 확인 | 임시 CDP drivers/JSON/PNG/log, 관련 결함이 입증된 T01/T02 파일만 수정 |

## Fixed Contracts

- 규칙은 현재 그대로: 목표150/200/250/300/350, 제한90/75/65/60/50초, 긴 구간 장애물10/20/30/40/50%, NPC800/650/500/400/300ms, fall500ms/NPC250ms, 한 번 잡히면 종료. 긴5~9/짧은1~3,30물리계단→30초2배, 일반 jump2/bonus4점. 클리어마다 checkpoint/continue 다음 단계0점,5최종 종료.
- 새 저장은 `stair-descent:leaderboard:v1`/`stair-descent:stage-progress:v1`; reset marker `stair-descent:records-reset:v1` 값`1`. 구 랭킹 `stair-climb:leaderboard:v1`~`v5`와 `stair-climb:stage-progress:v1`만 정리한다. legacy→descent 이관은 없다. 인증/세션/audio:v1/무관한 키 보존. 새 키를 비우는 reset 코드를 만들지 않는다.
- 기존 storage API에는 최종 optional scope `'ascent'|'descent'`를 추가하고 default는ascent로 둔다. T01은 지원만 추가하고 main에는 연결하지 않는다. T02의 모든 main read/save가descent를 명시한다. 이 순서로 상승 화면이 운영 중일 때 미리 기록을 초기화하는 중간 단계를 피한다.
- core `GameState`/엔진/route/obstacle/stageRules/기본 상승 좌표 모델은 유지한다. 기존 `src/descent/descentSceneModel.ts`의 순수 하강 투영만 main `StairScene`에서 재사용한다. 이 함수에는 stage1 제한이 없다.1단계 전용 adapter/view reducer/App는 main에 import하지 않는다. 실험 소스/별도 HTML은 변경하지 않는다.
- main renderer의 계단 순서·step/jump/NPC/catch 모션·발 가림을 함께 바꾼다. 기존 HUD/단계/결과/설정 레이아웃과 main class/testid를 유지하며 SVG 전체 반전은 하지 않는다. title/AuthGate/control/scene/HUD/결과/도움말 문구를 하강으로 일치시킨다.
- main `App`의 인증/오디오 owner와 MSAL/env/config/package/자산은 유지한다. 제목 변경을 위해 AuthGate의 텍스트는 바꿀 수 있지만 로그인 분기/redirect/토큰 설정을 바꾸지 않는다.
- 사용자 추가 확정(D11): main `음악 켜기` 재시도 버튼이 제거될 때 dialog 밖으로 빠진 focus를 close로 복구한다. 유효한 내부 range/button focus는 유지하며 close 후 gear로 복귀한다. T02의 GameScreen/기존 테스트와 T03 실제 native 키 검사에 포함하고 새 Task나 오디오 owner 리팩터링은 추가하지 않는다.

## Why These Task Boundaries

- T01은 optional storage scope를 fake Storage에서 독립 검증한다. 기존 default API를 보존하므로 UI가 반쯤 전환되거나 실제 기록이 먼저 초기화되지 않는다.
- T02는 투영만 먼저 연결하면 상승 keyframe/역순 레이어가 남는다. 화면·CSS·문구와 main storage scope를 한 번에 활성화해야 실제5단계 하강/새 기록이라는 검증 가능한 결과가 된다.
- T03은 unit test만으로 SVG 가림/모바일 scroll/실제 추격 시간·문서 lifecycle/재접속 저장 보존을 판정하지 않는다. 실제 브라우저 증거가 통과해야 completed로 바꾼다.

## Validation Strategy

- T01의6파일 focused 검증 후 T02/T03은 기존24파일(642개 기준)+신규 recordStorage/StairScene+기존 authConfig의27파일을 명시 실행한다. 실제 count를 기록한다. 알려진 원본 GameScreen 검사 자원 경쟁 때문에 명령에 `--maxWorkers=2`를 처음부터 명시한다. skip/timeout/config 완화는 금지한다.
- 매 Task lint/build/diff check. default dist HTML은 index.html 하나; 별도 descent-test.html은 제외한다. T01에서 main/실험 변경 없음, T02부터 main의 허용 파일만 수정하고 baseline 대비 엔진/규칙/실험/인증 설정/오디오/패키지 변경이 없는지 확인한다.
- 브라우저는 연결 도구 우선, 없으면 Node 내장 fetch/WebSocket/CDP의 소유 숨김 headless profile/context만 사용한다. `%TEMP%\main-game-descent-conversion-2026-10-28\`에 drivers/JSON/PNG/log를 남긴다. 기존 사용자 profile/브라우저 기록을 지우지 않는다.
- full flow는 실제 generator/표시 cue에 맞는 D/J/Space와 native 키·터치로5단계를 진행한다. document clock을 제어한 full flow와 실제 Date.now의800/250/500ms·4초 lifecycle, 명시적 함수 경계 fixtures를 구분한다. 임의 GameState hook dispatch로 승급하지 않는다.
- 구 키가 있는 소유 context에서 최초 초기화와 인증·오디오 sentinel 보존을 검증한다. 그 context의 앱 조작으로 저장한 새 score/progress를 reload/재시작/다른 계정 전환 후 다시 읽어 유지하는지 확인한다. 매 navigation마다 새 키를 fixture로 덮어쓰면 이 검증이 무효다.

## Adjacent Findings — Excluded

- 기본 병렬 pool의 기존 GameScreen30회 렌더링 test timeout과 기존 JS551.91kB 크기는 별도 성능 개선이다. 전체 App.test.tsx에는 설정 UI가 항상 보인다고 가정한 예전 expectation이 있어 이 계획의 무관한 suite 수리 대상으로 확장하지 않는다.
- 공용 서버 랭킹/Entra 설정 변경/배포/새 dependency/난이도 조정/새 모드 선택/독립 실험 리팩터링은 제외한다.

## Progress

- done: 3/3 (active: none)
- T01 `9b6ba54`: recordStorage와 두 API의 optional scope/회귀 테스트 구현. 지정 6파일 242/242tests(32.11초/workers2), lint/build/diff check 통과. 읽기 전용 main/실험/auth/audio/config 경로 diff 없음. 실제 브라우저 기록은 미접근이며 main은 기존 상승 화면이다.
- 증거: `%TEMP%\main-descent-records-t01-2026-10-28\tests.log`, `lint.log`, `build.log`. JS552.85kB(gzip154.43kB)/CSS55.50kB(gzip10.77kB), 기존 500kB chunk 경고 유지. 신규 범위 밖 결함: 특이사항 없음.
- T02 `5217dfa`: main5단계 하강 scene/step·jump·NPC·catch/레이어·문구, 모든 main 저장 descent scope, D11 오디오 재시도 focus 복구 완료. 지정27파일727/727tests(54.39초/workers2/skip0), lint/build/diff check 통과. 새 scene23tests와 GameScreen82tests를 포함하며 원본 엔진/실험/auth설정/audio/config는 보존했다.
- T02 증거: `%TEMP%\main-descent-t02-2026-10-28\`의 tests-27-final.log/lint.log/build.log/audit.log, 초기 실패와 focused 보완 로그도 보존. JS553.68kB(gzip154.76kB)/CSS57.30kB(gzip10.95kB), 기본 dist는 index.html만 존재. 실제 브라우저는 사용하지 않았으며 T03 검증 전 전체 완료로 표시하지 않는다. 신규 범위 밖 결함: 특이사항 없음.
- T03 `8da80d6`: 소유 Chrome156.0.8078.49의9개 driver/네 화면5단계·체크포인트·새 저장 재접속·하강 모션·실제 추격/lifecycle·native audio retry focus·모바일/font24·32·인증/실험 경계 통과. 실제 전체 진행은 seed0.5/제어 시계, 각615행동·641물리계단·26보너스 점프/최종352점이며 일반2점 점프는 seed0.19 native Space로 별도 확인했다.
- T03 지정27파일727/727tests(56.60초/workers2/skip0), lint/build/diff check 통과. 제품 source/test 추가 수정 없음. JS553.68kB(gzip154.76kB)/CSS57.30kB(gzip10.95kB), 기존500kB chunk 경고 출력. 증거 `%TEMP%\main-game-descent-conversion-2026-10-28\evidence-index.json`:145artifact/PNG82·필수14사진과9 driver/logs/hash. 실제 tenant 로그인/회사 계정 전환·스피커 청취 품질은 미검증이며 공개 계정/함수 fixture와 실제 UI 검증을 구분했다.
- 완료 링크 `http://127.0.0.1:5175/` HTTP200/title 내려오기/DEVtrue/demo flagtrue/main descent model 확인. 기존 PID21048은 유지하고 identity 확인한 소유 Chrome/보조5176·5177만 종료했다. 사용자 profile/실제 기록은 접근하지 않았다. 신규 범위 밖 결함: 특이사항 없음. 다음 Active Task는 없다.
- 2026-10-28 사용자 요청으로 main 오디오 재시도 focus 복구/회귀 테스트/브라우저 검증을 T02/T03에 포함했다. 실행 순서와 T01 포인터는 유지한다.
