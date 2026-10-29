# Current Context

## Active Plan
None. [Title Copy and Overtime Capture](./plans/2026-10-29-title-copy-and-overtime-capture.md) is complete.

## Active Phase
None. [P01 Overtime Capture](./phases/2026-10-29-title-copy-and-overtime-capture/P01-overtime-capture/phase.md) is complete.

## Active Task
None.

## Last Completed Task
[T02 Title Copy and Capture Integration](./phases/2026-10-29-title-copy-and-overtime-capture/P01-overtime-capture/T02-title-copy-and-capture-integration.md) — `10e1ac4` (2026-10-30). T01: `4e41af6`, memory sync `2d73945`.

## Status
- title-copy-and-overtime-capture: completed 2/2; Active Task none.
- T02 connected the 500 ms staircase catch → 2,000 ms office scene → recorded result flow in GameScreen, with reduced-motion static results and restart focus, and changed the exact title subtitle. Captured-result storage, engine rules, auth/config files, and audio ownership are unchanged.
- Final T02 validation: 182/182 tests across four targeted files, lint, and build passed. HTTP 200 and connected module/development-demo flag verified at `http://127.0.0.1:5176/`; process-only demo server retained for the user. Existing protected port 5175 retained.
- T02 real-browser inspection was blocked by automatic approval review (`blocked by policy`); no main-game visual acceptance claimed. Evidence and logs: `%TEMP%\overtime-t02-2026-10-30\`. T01 standalone artwork inspection remains at `%TEMP%\overtime-t01-2026-10-29\preview-evidence.json` with six PNGs.
- Previous title-scene-and-guide-copy plan completed 1/1 with 119/119 targeted tests, lint, and build passing.

## Source Decisions
[Title Copy and Overtime Capture](./decisions/2026-10-29-title-copy-and-overtime-capture.md)

## Next Step (IMPORTANT)
No active task. The user can test the integrated game at `http://127.0.0.1:5176/`: 게임 시작 → 시작하기 → let the pursuer catch the player. Reduced motion shows a static office illustration with results. Future changes need a new selected task; do not rerun T01/T02 or expand the already recorded App.test.tsx cleanup without a new request.
---

### Previous Context: Main Game Descent Conversion

### Active Plan

[Main Game Descent Conversion](./plans/2026-10-28-main-game-descent-conversion.md)

### Active Phase

없음 — [P01 Main Descent](./phases/2026-10-28-main-game-descent-conversion/P01-main-descent/phase.md) 완료.

### Active Task

없음 — main-game-descent-conversion 완료 (3/3).

### Last Completed Task

[T03 Main Descent Browser Validation](./phases/2026-10-28-main-game-descent-conversion/P01-main-descent/T03-main-descent-browser-validation.md) — `8da80d6` (2026-10-28). 이번 계획 T02 `5217dfa`/동기화 `c537dfb`, T01 `9b6ba54`/동기화 `4d7669e`. 이전 local-descent 계획 T03 `04fdeea`/동기화 `bdf18d5`, T01 `0225893`/동기화 `4b49dc8`, T02 `f9aa712`/동기화 `8f92171`. 이전 stage-score 계획: T01 `f5ef960`/동기화 `0ca7bf2`, T02 `f35254f`/동기화 `6dfa99a`, T03 `20f8425`/완료 동기화 `8d9b31d`. 이전 checkpoint 계획 완료: T04 `9fda567`, 동기화 `cec0d37`.

### Status

- main-game-descent-conversion: **completed, done3/3, Active Task none**. 2026-10-28 T03 `8da80d6` 완료: 소유 브라우저9 driver/네 화면5단계·새 저장·모션/실제 시간·모바일/큰 글자·오디오 재시도 focus·인증/독립 실험 경계를 검증했다. 지정27파일727/727tests(56.60초/workers2/skip0), lint/build/diff check 통과. 제품 source/test 추가 수정 없음. 사용자 profile/실제 기록에는 직접 접근하지 않았다.
- T03 증거: `%TEMP%\main-game-descent-conversion-2026-10-28\evidence-index.json`의145artifact/PNG82·필수14사진/9driver와 로그·SHA256. seed0.5의320×667/390×667/768×1024/1440×900 각각615행동·641물리계단·26보너스점프/점수150·200·250·300·352. 실제 재접속/초기화 실패 재시도·public 계정분리, 양방향 animation0/150/300·catch500/reduced·실제250/500/1300과4초same-document lifecycle, native retry Promise·focus/range·늦은 결과·unmount timer0/listener0/dispose1 통과. 일반2점은 seed0.19 generated native Space로 별도 확인했다. 전체 진행의 제어 시계와 실제 시간/함수 경계 fixture/공개 GameScreen 계정 fixture를 구분했다.
- T03 build JS553.68kB(gzip154.76kB)/CSS57.30kB(gzip10.95kB), 기존500kB chunk 경고 출력. source는 `5217dfa` 그대로이며 원본 core/규칙/실험/authConfig/audio/config/package baseline diff 없음. 실제 Entra tenant 로그인/회사 계정 전환·스피커 청취 품질은 미검증이다. 완료 링크 `http://127.0.0.1:5175/` HTTP200/title 내려오기/DEVtrue/demo flagtrue 확인; 기존 demo PID21048 유지, identity 확인한 소유 Chrome/보조5176·5177 종료. 신규 범위 밖 결함: 특이사항 없음.
- T02 증거: `%TEMP%\main-descent-t02-2026-10-28\`의 tests-27-final.log/lint.log/build.log/audit.log; 최초717통과/10실패와 focused105/105 로그도 보존한다. 하강 표시·marker 쓰기·실제 PixelOfficer 속성·jsdom microtask에 맞게 테스트를 보완했고 timeout/skip/config/엔진·규칙은 변경하지 않았다. scene23tests, GameScreen기존77+focus5=82tests 포함. JS553.68kB(gzip154.76kB)/CSS57.30kB(gzip10.95kB); 기존500kB 초과 번들 크기는 유지되며 이번 최종 로그에 경고 재출력은 없다. 기본 dist는 index.html만 존재한다.
- T01 증거: `%TEMP%\main-descent-records-t01-2026-10-28\`의 tests.log/lint.log/build.log. marker read/write·6개 구키 get/remove 실패 12조합과 재시도·새 기록 보존, account별 max/랭킹 pair·동점·schema·getter 오류를 검증했다. 기존 main/scene/실험/App/auth/audio/entry/config/package 경로는 baseline `bdf18d5` 대비 diff 없음. JS552.85kB/CSS55.50kB, 기존 500kB chunk 경고 유지. 신규 범위 밖 결함: 특이사항 없음.
- 사용자 확정: 기존 `/`를5단계 내려오기로 변경/추격자는 위쪽; 기존 규칙·로그인·오디오·랭킹·checkpoint·단계 선택 유지; 구 랭킹·단계 해금 모두 초기화 후1부터 재시작.
- 새 저장 키: stair-descent:leaderboard:v1 / stair-descent:stage-progress:v1, reset marker stair-descent:records-reset:v1=`1`. 구 랭킹v1..v5와 ascentprogressv1만 정리하고 auth/audio/session/새 기록은 보존한다. 구 랭킹에서 해금을 복원하지 않는다. 재방문/StrictMode/삭제 실패 재시도에도 새 기록을 지우지 않는다.
- T01에서 recordStorage 신규 helper/optional scope를 stageProgress·leaderboard에 추가하고 fake Storage로 검증했다. 기존 defaultascent는 유지했다. T02에서 모든 main read/save에 descent를 명시하고 renderer/CSS/문구를 함께 전환했다. T03에서 실제5단계·저장 전환/재접속·모바일/시간을 확인했다. core/규칙/기본 상승 모델/game.css/독립 실험/App/authConfig/audio/public/config/package는 baseline `bdf18d5` 대비 diff 없음.
- 하강 투영만 기존 src/descent/descentSceneModel.ts에서 읽기 전용 재사용한다. 기본 상승 stairSceneModel을 바꾸면 실험이 이중 반전되므로 그대로 둔다. main은 실제5단계 core엔진을 사용하며 실험의1단계 adapter/view reducer/App를 import하지 않는다.
- 규칙 고정: 목표150/200/250/300/350; 시간90/75/65/60/50초; 긴 구간 상자10/20/30/40/50%; NPC800/650/500/400/300ms; fall500/NPC250;30물리계단→30초2배;긴5..9/짧은1..3. 각 단계0점/클리어CP/Continue·Quit/5최종/실제단계+점수랭킹 유지.
- 검증 명령은 기존 느린 화면 테스트 자원 경쟁을 고려해 maxWorkers2를 명시한다. T01은6파일, T02/T03은 기존24+recordStorage/StairScene/authConfig의27파일/실제 count기록. timeout/skip/config 변경은 하지 않는다. 기존 App 전체suite/번들/렌더 성능/공용 서버랭킹/Entra·배포/새 모드는 이번 계획 밖이다.
- 사용자 추가 확정(D11): T02에서 GameScreen dialog/previous-open refs와 post-commit focus 복구를 구현했다. 집중된 재시도 버튼 제거 후 close 복구, 내부 slider/button focus 유지, Tab/Escape/trigger 복귀·늦은 결과 후 외부 focus 보존과 StrictMode를 검사했다. T03에서 실제 native 재시도·Tab/ShiftTab/Escape/닫기 복귀·range ArrowRight/media Promise/늦은 완료까지 검증했다. 오디오 owner/설정 저장/게임 pause는 유지한다. 신규 범위 밖 결함 발견: 특이사항 없음.

### Previous Completed Plan: Stair Descent Local Test

- stair-descent-local-test: **completed, done3/3, Active Task none**. 이번 실행에서는 T03 한 개만 검증·관련 결함 수정·커밋했다. `04fdeea`: 실제 브라우저9 driver/지정24파일642/642tests(47.17s, `--maxWorkers=2`)/lint 오류0·경고0/build/diff check 통과.
- 확정 범위: 기존 오르기 게임 유지, 별도 `/descent-test.html` 개발용 로컬 데모, D내려가기/J회전하며내려가기/Space2칸점프, 위쪽 NPC추격,1단계150점·90초, 기존10% 긴 구간 장애물·30칸 보너스·500ms넘어짐/250ms추격 유지, 기록 미저장.
- 새 제품 코드는 `src/descent/`와 별도HTML에만 추가한다. 기존 index/main/App/game/audio/auth/leaderboard/test/config는 읽기 전용. 원본 GameScreen의 저장/이관 부수 효과를 가져오지 않는다. 오디오 설정도 기본값 복사/메모리 전용이다.
- T01 완료: 순수 stage1 adapter와 하강 좌표 모델/두 테스트를 추가했다. 원본 체크포인트→최종cleared, 입력 전 obstacles로 마지막stage1 reveal, index계속증가/좌표y432−oldY, NPC visible재계산/모든 모션점 변환을 구현했다. terminal lastMove는 성공 데이터로 보존하므로 T02는 status!==playing에서 이동 연출을 억제해야 한다. adapter는 stage2/클리어>1/외부 raw checkpoint 입력을 거절한다.
- T01 증거: C:\Users\DEX\AppData\Local\Temp\stair-descent-t01-2026-10-28\의 tests.log/lint.log/build.log와 초기 실패 로그. JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB). 당시 기존500kB chunk 경고가 출력됐으며 번들 설정은 바꾸지 않았다. 실제 생성기7seed/합법 입력·기존 시간/확률/보너스/범위 오류·좌표/불변성을 확인했다. UI 저장 무접근과 브라우저 모션은 후속 T03에서 완료했다.
- T02 완료: 별도HTML/gate/저장없는 앱·view reducer·화면·scene·CSS와5테스트를 연결했다. sound counter로 React 배치/StrictMode 중복을 막고 restart RNG는 이벤트에서 생성한다. 설정 닫기 후 gear 재활성화 이후 focus 복귀/빠른 열기·닫기의 NPC 과거 cosmetic 모션 재생 방지/오디오 전용 scoped grid도 반영했다. 원본 CSS/기능/오디오/저장 helper는 변경하지 않았다.
- T02 검증: 기본 동시 실행24파일은 기존 GameScreen.test.tsx:198의30회 렌더링 검사에서5000ms 시간 초과 후 연쇄 실패했다. 원본 단독77/77(28.25s), 동일24경로에 `--maxWorkers=2`만 추가한 최종 검사는642/642(72.08s) 통과다. timeout/skip/config 변경은 없다. 중간 `tests-24-final.log`는 확장자 오타로23파일만 실행된 로그이므로 최종 근거는 `regression-24-final.log`다.
- T02 증거: `C:\Users\DEX\AppData\Local\Temp\stair-descent-t02-2026-10-28\`의 최종 regression-24-final.log/lint-final.log/build-final.log. JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB), 기본 dist는 기존 index.html만/기존500kB chunk 경고 유지. 테스트에서는 storage throwing getter/메서드0접근,1단계 실제 합법 입력 전체 클리어·마지막 점프·pause95초/음향 counter/StrictMode/터치·Space/300·600ms정리/잡힘 gate를 확인했다.
- T03 완료: 실제0.19 seed/10% 생성기·표시 cue·native키/터치로 네 viewport(320×667/390×667/768×1024/1440×900) 모두87행동/90물리계단/150점/생성 jump3회/1단계 최종 종료·ready 재시작을 확인했다. 저장 getter/메서드0/유효v4-only·v5·progress/audio/auth/session/unrelated sentinel byte equality, blocked getter 정상 실행, 원본 y188/NPC328 및clear→Quit→retry2/0점/목표200/랭킹 쓰기를 별도 context에서 확인했다.
- T03 모션/시간/접근성: actual Date.now800·1600·2400·3200 NPC/250·500 fall/1300 정상 successor/4초 frozen→active same-document 단일 잡힘, WebAnimation step300/jump양쪽300/NPC240/catch500의 실제 좌표, 설정95제어초 동결/Tab·nativeSpace·터치중복·range·root24/32 scroll hit-test/음악1↔1.25/종료·unmount timer0/listener0/dispose1을 확인했다. 전체 flow는 제어시간 UI이며 함수 fixture로 검사한90초expiry·250/500tie·pending150·149→153 경계와 실제 시간 검사를 구분했다. 실제 스피커 청취 품질은 판정하지 않았다.
- T03 관련 결함1개 수정: 오디오 허용 후 enable 버튼이 사라지면서 modal focus/Escape가 끊겼다. DescentGameScreen의 settingsDialog ref/유효 내부focus 보존·외부focus 복구와 DescentTestApp 기존 재시도 테스트를 보완했다. 수정 전6개 중1실패→수정 후6/6 및 최종 전체 회귀/브라우저 모두 통과다. 기존 게임/공용 오디오/설정/원본 테스트는 그대로다.
- T03 검증/증거: `%TEMP%\stair-descent-local-test-2026-10-28\`의 evidence-index.json(97artifact/PNG40·필수11)/final-driver9개/regression-24-final.log/lint-final.log/build-final.log. Node24.21.0/npm11.19.0/Chrome156.0.8078.48, 소유 숨김 headless/CDP context만 사용했다. 기본24파일 명령은 기존 GameScreen30회 렌더링5000ms 시간 초과 후73연쇄실패/569통과(21.03s), 동일24파일 workers2는642/642(47.17s)다. timeout/skip/config 변경 없음. default build는 기존index.html만/JS551.91kB/CSS55.50kB이며 이번 최종 로그에는 chunk 경고가 재출력되지 않았다.
- 로컬 링크 `http://127.0.0.1:5175/descent-test.html`: 기존 소유 데모 PID21048 유지/최종HTTP200/새 module/DEVtrue/demo flagtrue 확인. devfalse5176은 이용 불가, production preview5177의 동일경로200은 원본index SPA fallback·Entra 설정 안내이며 descent 미배포다. 소유 Chrome17080/보조5176·5177 서버는 identity 확인 후 종료했고 사용자 프로필/다른 서버는 건드리지 않았다. env 파일은 변경하지 않았다.
- 새 범위 밖 결함 발견 없음. 기존 번들 크기/독립 App 전체 suite/공용 랭킹/Entra·배포/원본 리팩터링/내려오기5단계는 추가하지 않는다.

### Source Decisions

[Main Game Descent Conversion](./decisions/2026-10-28-main-game-descent-conversion.md)

### Previous Stair Descent Source Decisions

[Stair Descent Local Test](./decisions/2026-10-28-stair-descent-local-test.md)

### Completed Stair Descent Plan History

| Task | Implementation commit | Validation |
| :--- | :--- | :--- |
| T01 Descent Engine and Scene Model | `0225893` | 지정8파일356tests/lint/build |
| T02 Isolated Local Descent Screen | `f9aa712` | 지정24파일642tests/workers2/lint/build/entry HTTP |
| T03 Descent Browser Validation | `04fdeea` | 지정24파일642tests/workers2/lint/build + 소유 브라우저9 driver |

### Previous Completed Plan: Stage Unlocks and Per-Stage Scores

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

### Previous Stage Score Source Decisions

[Stage Unlocks and Per-Stage Scores](./decisions/2026-10-27-stage-unlocks-and-per-stage-scores.md)

### Previous Completed Plan: Stage Checkpoints and Fall Chase

| Task | Implementation commit | Validation |
| :--- | :--- | :--- |
| T01 Checkpoint Session and Records | `afafa68` | 지정16파일388tests/lint/build |
| T02 Stage Selection and Progress | `fa1a5ec` | 지정17파일402tests/lint/build |
| T03 Fall Pursuit Acceleration | `9a9e6b5` | 지정17파일432tests/lint/build |
| T04 Checkpoint Browser Validation | `9fda567` | 지정17파일433tests/lint/build + 격리 브라우저 |

### Previous Source Decisions

[Stage Checkpoints and Fall Chase](./decisions/2026-10-23-stage-checkpoints-and-fall-chase.md)

### Previous Completed Plan History

[Five Stage Obstacle Jump](./plans/2026-10-23-five-stage-obstacle-jump.md) — completed5/5. 아래 구현/검증 이력은 이전 계획에 속한다.
| Task | Implementation commit | Validation |
| :--- | :--- | :--- |
| T01 Five Stages and Ranking | `12a49d3` | 지정7파일192tests/lint/build |
| T02 Route and Obstacle Generation | `7d1f426` | 지정6파일202tests/lint/build |
| T03 Timed Pursuer | `42dab25` | 지정10파일298tests/lint/build |
| T04 Obstacle Jump Gameplay | `7a61ed2` | 지정12파일335tests/lint/build |
| T05 Jump Motion and Validation | `e369a28` | 지정14파일352tests/lint/build + 격리브라우저 |

위 표는 이전 계획의 완료 이력이다. stage-checkpoints-and-fall-chase T01~T04 구현/검증 이력은 위 Previous Completed Plan 표에 기록했다.

### Next Step (IMPORTANT)

현재 계획은 완료됐고 Active Task는 없다. T01/T02/T03와 이전 완료 계획을 재실행하지 않는다. 사용자는 `http://127.0.0.1:5175/`에서 main 내려오기 게임을 테스트할 수 있다. 새 변경 요청이 오면 그 요구에 맞춰 인터뷰/결정→계획→Active Task 실행을 시작한다. 검증 증거는 위 임시 폴더와 T03 청사진에 보존돼 있다. 공용 서버 랭킹/실제 Entra 설정·배포/번들 성능·오래된 App 전체suite 정리는 자동으로 시작하지 않는다.
