# Current Context

## Active Plan
None

## Active Phase
None

## Active Task
None

## Last Completed Task
[T01 Infinite Mode Base Speed Update](./phases/2026-11-06-infinite-mode-pursuer-speed/P01-base-speed/T01-base-speed-update.md) - `22192d7` (2026-11-06).

## Previous Completed Task
[T03 Versioned Bottoms Persistence](./phases/2026-11-04-character-bottoms-customization/P01-bottoms-customization/T03-versioned-bottoms-persistence.md) — `d7b6e24` (2026-11-04).

## Status
- Plan infinite-mode-pursuer-speed completed: T01 (`22192d7`), 1/1 task. Pursuer base interval is 200 ms; score acceleration, catch-up, score, event, ranking, and saving rules remain unchanged.

## Next Step (IMPORTANT)
There is no active task. Start a new plan when the user requests another feature.

## Completed Plan History
- character-bottoms-customization T01 (`2d6b996`), T02 (`e30fea8`), T03 (`d7b6e24`), T04 (`d480239`) 완료, done4/4. Active Task 없음. 이번 실행은 마지막 T04만 구현/검증/커밋했다.
- 하의4종(긴바지/청바지/반바지/치마)과 색6종을 추가한다. 고정 v1/v2를 유지하고 독립 v3 계약→모든 포즈 렌더링→public/API 저장 전환→15개 편집 그룹/장면 검증 순서다.
- T01: shared/bottomsCharacterAppearance.ts 및 테스트를 추가했다. 정상 v1/v2를 기존 선택 그대로 읽고 기본 긴바지/남색만 보완한다. strict v3 저장 검증과 표시 기본값을 분리한다. 정확한13필드 standalone look는 과거형으로 허용하지만 누락된 version3 envelope/14필드/여분·Symbol 키는 거부한다.
- 지정4파일328/328(3.65초), lint/프런트엔드·API 타입 검사와 빌드/diff check 통과. JS663.62kB(gzip182.84kB)/CSS92.97kB(gzip15.88kB), 기존500kB chunk 경고 유지. API36.4kB.
- T02: OfficerBottomsArt/팔레트와 두 렌더러를 연결했다. 하의4종/6색과 피부 노출/청바지 솔기·밑단/치마 연결부를 게임4프레임·야근4포즈에 적용한다. 기본 긴바지의 추가 clip 정의는 생성하지 않으며 발 y=40·외부 transform·야근 앞뒤 다리 CSS 그룹·기존 외형을 유지한다.
- T02 최종 지정9파일481/481(30.80초), 새 하의115/115(10.75초), lint/build/diff check 통과. JS667.92kB(gzip184.06kB)/CSS92.97kB(gzip15.88kB), 기존500kB chunk 경고 유지. 최초 clip 개수3실패는 불필요한 정의 제거로, 조합 검사2건의 timeout은 같은 전체 조합을 작은 사례로 나누어 해결했다. 기존 테스트/config/timeout/skip을 완화하지 않았다.
- TEMP/character-bottoms-customization-2026-11-04/t02/에80조건 원래 크기/2배 SVG·PNG를 육안 확인했다. 기본 긴바지32조건은 이전097c26c와 PNG 바이트가 동일하다. 초기 TEMP 생성기의 외형/메타데이터 혼입을 고친 뒤 정상 입력으로 다시 확인했다. 실제 브라우저4크기/터치/native keyboard/애니메이션 및 실제 계정/Cosmos 확인은 실행하지 않았다.
- T03: public characterAppearance.ts는 이제 bottomsCharacterAppearance의 v3를 노출한다. repository의 원본 v1/v2 판정으로 최초 명시 저장을 실제 v3 쓰기로 연결했다. 고정 v1/v2 모듈/기존 선택·점수·해금/DB·컨테이너·인덱스/Auth/점수 대기열 version2는 유지한다. 클라이언트/계정 store는 기존 public 정규화·clone·동등 비교/400ms 자동 저장 경로를 그대로 사용한다.
- T03 검증: 지정7파일450/450(10.92초), 최종 픽셀 관련2파일 포함9파일662/662(21.12초), API4파일211/211(최종2.81초), lint/프런트엔드·API 타입·build/diff check 통과. JS668.23kB(gzip184.06kB)/CSS92.97kB(gzip15.88kB), API39.3kB. 기존500kB chunk 경고 유지. 초기 수동13필드/버전2 fixture의 타입 오류2곳은 최신 계약에 맞게 수정했다.
- T03은 v1/v2 GET·두 점수 no-op의 문서 무변경, 명시 저장/실제 점수 개선·409/412 보존, 실제 fetch mock 응답 정규화/strict v3 저장 확인, 지연 응답/401/실패 재시도·점수 큐/계정 전환과 새 HTTP-backed store 세션 복원을 검증했다. 구버전 저장 echo나 누락/다른 하의는 성공으로 인정하지 않는다.
- 로컬 Cosmos http://127.0.0.1:8080/ready 미준비로 실제 통합 검사는 실행하지 않았다. v2 원본의 GET/ETag 보존·첫 명시 저장·두 점수 no-op/개선3사례를 추가하고 API tsc(test 포함)를 통과했다. 전체16사례는 배포 전 기존 CI에서 실제 실행이 필수다. 운영 연결/테스트 쓰기로 대체하지 않았다.
- T04: 편집 UI는15그룹이며 상의/상의 색상과 하의/하의 색상을 구분한다. 하의4종/색6종을 양쪽 역할에서 독립 선택하고 기존 미리보기/자동 저장 경로를 재사용한다. 실제 편집→단계/무한→타이틀 왕복과 계정 하의만 다른 응답의 점수/시간/카운트다운 보존, 퇴근/야근 실제 도형 전달을 검증했다.
- T04 최종 검증: frontend/shared59파일1981/1981(141.40초), API211/211, 배포 검사26/26, lint/프런트엔드·API 타입 검사와 build/diff check 통과. 범용 radio 검색을 그룹 내부로 좁히고 기존 종료 테스트의 fake clock을3.999초/4초 경계로 나눴다. 게임 타이머/timeout/skip 설정은 변경하지 않았다. 중단된 실행 환경과 초기 timeout 및 수정 근거는 T04에 기록했다.
- 정적 editor HTML/두 모드·퇴근/야근 SVG·PNG4장면은 TEMP/character-bottoms-customization-2026-11-04/t04/에 확인·보존했다. 실제 브라우저/모바일/애니메이션/회사 계정 복원은 미검증이다. 로컬 emulator readiness도 미준비로 전체16통합사례는 배포 전 기존 CI에서 통과해야 한다. JS668.29kB(gzip184.08kB)/CSS92.97kB(gzip15.88kB), API39.3kB. 기존 번들 경고 유지.
- 로컬 데모 http://127.0.0.1:5173/ HTTP200 및 최신 하의 편집 모듈 제공을 확인했다. 타이틀→캐릭터 꾸미기→하의/하의 색상에서 테스트한다. 기존 CSS/모바일 버튼 간격/게임 규칙과 무관한 untracked 파일/이전 출시 기록을 보존했다. push/배포 없음. 별도 범위 결함은 특이사항 없음.

## Previous Feature Status — Gender Visual Distinction
- character-gender-visual-distinction T01 (`8e2f3a8`), T02 (`34f0944`), T03 (`05356a7`) 완료, done3/3, Active Task 없음. 이번 실행은 T03만 검증·커밋했다. push/배포는 수행하지 않았다.
- T01에서 공통 얼굴/피부/턱/목과 눈썹·속눈썹을 개선했다. 눈 본체를 .officer-eye-shape로 분리하고 안경/표정/눈5종을 유지한다. T02에서 어깨/몸통과 옷5종, 게임/야근 소매 및 가방끈을 연결했고 T03에서 실제 편집·두 모드·모든 엔딩 전달/종합 비교/최종 자동 검증을 완료했다.
- T01 지정4파일246/246(14.41초, 새32사례), lint/build/diff check 통과. 턱/피부/목의 실제 도형 단면, 눈5종·안경·임시 표정 복원·선택/나이대/legacy fallback을 확인했다. 당시 JS659.15kB(gzip181.74kB)/CSS92.97kB(gzip15.88kB), 기존 chunk 경고 유지.
- 실제 현재 OfficerHeadArt의 정적28표본을 TEMP/character-gender-visual-distinction-2026-11-04/t01/에 생성·확인했다. 로그 TEMP/gender-face-t01-{tests,lint,build}.log 보존.
- T02 지정8파일362/362(19.50초), 추가 손/백팩 검사 후 genderAppearanceArt64/64(6.33초), lint/build/diff check 통과. 원래 손 좌표/발 y40·남성 기본 몸통을 유지하면서 픽셀4방향 연결과 여성 옷의 외곽 이탈0을 확인했다. 기존 여성 rect/소매 좌표 가정의 검사26개는 실제 새 어깨 폭/의미 있는 selector로 갱신했다. 기존 색/손/발 검사는 유지했다.
- T02 정적64표본(옷20/포즈24/가방20)을 TEMP/character-gender-visual-distinction-2026-11-04/t02/에 생성·확인했다. 로그 TEMP/gender-body-t02-{baseline,focused,anchors,lint,lint-final,build}.log 보존. JS663.62kB(gzip182.84kB)/CSS92.97kB(gzip15.88kB), 기존 chunk 경고 유지.
- T03 지정11파일498/498(64.50초), 전체 frontend/shared57파일1784/1784(139.43초), lint/build/diff check 통과. 실제 radio의 남성→여성→남성, 다른12필드/반대 역할·저장상태/초점 보존, 단계/무한 플레이 왕복, 계정 gender-only 응답의 진행/카운트다운 보존, 두 모드/모든 엔딩 실제 도형 변화를 확인했다. 본체 누락이 없어 테스트7파일만 보강했다.
- T03에서 원래 크기에 가까운 표시/2배 확대76조건과 실제 계단·두 엔딩 SVG4개를 새 정적 표본으로 확인했다. TEMP/character-gender-visual-distinction-2026-11-04/t03/ 및 TEMP/gender-scenes-t03-{focused,all,lint,build}.log에 보존했다. 실제 모바일/브라우저/native keyboard/애니메이션 검증은 아니며 수동 확인은 출시 전 남아 있다.
- 같은 머리·눈·옷·소품에서 gender만 바꾸어 차이를 강화한다. 나머지12필드와 반대 역할/나이대는 유지한다. 기존 CharacterAppearance version2/13필드, API/DB/저장 동작을 변경하지 않는다.
- OfficerHeadArt/OfficerEyeArt는 공통이다. OfficerOutfitArt와 별도로 PixelOfficer/OvertimeOfficer의 소매를 함께 맞췄다. 기존 older 남성 run-b의1px 손-소매 틈도 동일 포즈 연결 범위에서 보완했다. 새 clipPath/전체 scale 없이 손·신발 y=40, 외부 변환·장면 좌표·게임 규칙을 보존한다.
- framed default 눈의 첫 path 검사는 T01에서 .officer-eye-shape로, 여성 소매의 과거좌표 검사는 T02에서 실제 도형/소매 selector로 갱신했다. 기존 남성 기본 몸통/손/발 단언과 눈/표정/가방 검증은 유지한다.
- 이전 Chrome 실행 차단을 우회하지 않는다. 허용된 브라우저 도구가 없으면 기존 TEMP 정적 SVG 도구/DOM으로 확인하고 실제 모바일·native keyboard·애니메이션 미검증을 명시한다. 이전 Cosmos/실제 계정 검증은 별도 출시 전 확인으로 인계한다.
- 기존 미커밋 src/game/pixel-theme.css 모바일 조작 버튼 간격2줄과 무관한 untracked 파일을 보존하고 커밋에서 제외했다. 기존 로컬5173 데모 HTTP200/PID11840 및 최신 렌더러 제공을 확인했다. 새 별도 범위가 필요한 발견은 없다.

## Source Decision
- [Character Bottoms Customization](./decisions/2026-11-04-character-bottoms-customization.md)
- Previous: [Character Gender Visual Distinction](./decisions/2026-11-04-character-gender-visual-distinction.md)

## Next Step (IMPORTANT)
현재 계획4/4의 구현/자동 검증과 커밋을 완료했으며 Active Task는 없다. 완료 Task를 재실행하지 않는다. 사용자는 http://127.0.0.1:5173/ 타이틀→캐릭터 꾸미기에서 하의 선택을 테스트할 수 있다. 실제 모바일/브라우저·회사 계정 복원과 로컬 emulator 미준비에 따른16사례 CI 통합 검증은 출시 전 확인으로 남긴다. public v3 클라이언트/API는 함께 출시해야 한다. 새 요청이 있으면 해당 범위의 결정→계획→Active Task 순서로 진행하고 별도 요청 없이 push/배포하지 않는다.

## Latest Release — 2026-11-04
- 사용자 요청: GitHub 업데이트 및 배포. 기존 캐릭터 꾸미기/옵션 확장/성별 차이 강화와 보존 중이던 모바일 버튼 간격2줄을 함께 출시했다. 모바일 간격 커밋은 `ae9d9b1`이다.
- 코드 커밋 `ae9d9b175a97f73cacc50d3f1d0180bafb3b7be8`을 `origin/main` 및 `origin/codex/cosmos-emulator-ci`에 atomic fast-forward push 완료.
- [GitHub Actions 41782715701](https://github.com/Hyeongdae/edu/actions/runs/41782715701): verify/deploy 모두 success. frontend/shared1784/1784, API198/198, 실제 Cosmos emulator 통합13/13, 배포 검사26/26 및 lint/클라이언트·API build 통과.
- 운영 https://ashy-cliff-0e5e4b600.1.azurestaticapps.net/ 배포 완료. Azure 운영 환경 Ready, lastUpdatedOn `2026-11-04T06:04:59.747872+00:00` 확인. 배포 job 완료는 15:05 KST.
- 익명 요청의 `/`, `/api/profile`, `/api/leaderboard`는 Entra 로그인으로302, `/.auth/me`는200으로 로그인 보호 확인. 실제 로그인 플레이/기기 간 외형 복원은 이번 확인 범위에 포함하지 않았다.
- 기존 메모의 “push/배포 미수행”, “로컬 emulator 미실행”, “모바일 간격 미커밋”은 각 개발 Task 당시의 기록이다. 이번 CI의 emulator 검증/동시 배포로 해당 출시 대기 항목을 완료했다. 이전 untracked 사용자 파일은 보존했다.

## Previous Completed Feature: Character Customization Expansion
- T01 (`20fbcb6`), T02 (`ab16a10`), T03 (`445e014`), T04 (`b5b989e`) 완료. done 4/4, Active Task 없음.
- shared/characterAppearance.ts는 이제 expandedCharacterAppearance.ts의version2 계약을 재노출한다. 고정 legacy 모듈은 그대로 유지한다.
- repository는 정상version1 문서의 기존10선택을 보존해 새3필드를 보완하여 읽는다. 읽기/점수무변경no-op는 DB를 쓰지 않고, 명시적최초외형저장/실제점수쓰기는version2를 쓴다. schemaVersion1과점수대기열version2는 유지한다.
- recordApi.normalizeSharedProfile은 실제 HTTP프로필/점수응답을 canonical version2로 반환한다. 외형 저장확인은 raw version2만 인정하며 store의 기존400ms debounce/직렬쓰기/revision 로직은 유지한다.
- T03 지정9파일584/584(36.06초), API4파일198/198, lint/frontend·API build/diff check 통과. 기존외형보존·첫명시저장·no-op·두모드점수·지연응답/실패재시도·계정분리를 검증했다.
- 로컬 http://127.0.0.1:8080/ready 미준비로 실제emulator통합은 미실행이다. 통합3건을 추가하고API tsc(test 포함)를 통과했다. 기존 CI 통합 검증은 배포 전 필수다. 운영계정/Cosmos/push/배포는 변경하지 않았다.
- T02에서는 픽셀/눈/가방모든pose의289테스트 및 정적25표본/90clip 비교를 통과했다. 당시 Chrome 실행은 자동승인검토에서 blocked by policy로 차단되어 TEMP 정적SVG 렌더러로 대체했다. 실제브라우저 애니메이션/모바일 새선택 UI 확인은 남아 있다.
- T04에서 FIELDS를13개 그룹으로 연결했다. 눈5종/가방5종/가방색4종 및 기존 추가 머리/옷/소품/색상을 두 역할에 독립 적용한다. 가방 none에서도 색상 유지, 상황별 임시 눈 표정, 두 모드/모든 엔딩 전달을 검증했다. 계정 자동 저장과 로컬 세션 메모리를 그대로 사용한다.
- 최종 frontend/shared56파일1714/1714(154.75초), 지정214/214, GameScreen112/112, API198/198, lint/frontend·API build/diff check 통과. 최초 전체 실행의5000ms 초과/후속 실패를 기록하고 dialog 쿼리를 좁힌 뒤 전체 재검증을 통과했다. timeout/skip/worker 설정 및 게임 규칙은 변경하지 않았다.
- 실제 두 모드/퇴근/야근의 SSR SVG 정적 표본을 확인했다.4개크기 실제 레이아웃/터치/네이티브 키보드/애니메이션 및 실제 Cosmos 검증은 미실행이다. 배포 전 수동 브라우저 확인과 기존 CI 통합 통과가 필요하다. TEMP/character-expansion-t04-evidence/ 및 character-expansion-t04-*.log에 근거를 보존했다.
- 기존 src/game/pixel-theme.css의 미커밋 모바일 버튼 간격 변경은 보존하고 커밋에서 제외했다. 기존 로컬 데모 http://127.0.0.1:5173/ HTTP200/PID11840 유지. 추가 범위 발견: 특이사항 없음. push/배포는 수행하지 않았다.

### Source Decision (Previous Feature)
- [Character Customization Expansion](./decisions/2026-11-04-character-customization-expansion.md)

### Release Notes (Previous Feature)
계획 구현은4/4 완료하여 다음 Active Task는 없다. 로컬 데모의 타이틀→캐릭터 꾸미기에서 새 옵션을 테스트한다. 배포 전 실제 브라우저4개크기의 스크롤/터치/초점/애니메이션, emulator CI 및 실제 계정 저장 복원을 확인한다. 배포가 필요하면 클라이언트/API를 함께 출시하고 구버전 탭을 새로고침한다. push/배포는 별도 사용자 요청 범위다.

## Previous Completed Feature
- [Character Customization](./plans/2026-11-03-character-customization.md): complete5/5. T01 8898b74, T02 5f98abb, T03 9e06d5a, T04 d5489e8, T05 936e26b, 완료 문서 bc5b044.
- 이전 최종 검증: frontend/shared54파일1474/1474, API186/186, lint/frontend·API build 통과. 브라우저4개크기 확인. 당시 push/배포는 수행하지 않았다.

## Previous Completed Plan
- [Game Pause Menu](./plans/2026-11-03-game-pause-menu.md) complete 3/3. T02: `b9b95f4`; T03: `ec1c52a`.
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
- P01 Gameplay Polish is complete (3/3): score cap, the three-second stage transition countdown, and the 30% default BGM preference are implemented and validated.

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
