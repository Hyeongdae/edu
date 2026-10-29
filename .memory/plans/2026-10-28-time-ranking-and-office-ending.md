# Plan: Time Ranking and Office Ending

## Status: completed

## Goal

메인 내려오기 게임의 성적을 단계 → 점수 → 남은 시간(0.01초)으로 비교하고 각 단계 클리어 즉시 저장한다. 기존 랭킹을 새 버전으로 전환하며 해금을 보존한다. 5단계 클리어 후 약4초의 1층 퇴근 엔딩을 보여주고 공용 계단을 회색 콘크리트·노란 안전선 픽셀 디자인으로 바꾼다.

## Source Decisions

[Confirmed decisions](../decisions/2026-10-28-time-ranking-and-office-ending.md), D01~D07. 계획 단계에서는 .memory 문서만 작성한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | completed | 시간 성적·랭킹·퇴근 시각 연출과 회귀 검증 완료 | [P01](../phases/2026-10-28-time-ranking-and-office-ending/P01-office-finish/phase.md) |

## Tasks and Dependencies

| Task | Depends on | Outcome |
| :--- | :--- | :--- |
| T01 Stage Result Snapshot | none | 순수 엔진이 종료 순간의 단계·점수·남은 시간을 보존 |
| T02 Time Ranking and Checkpoint Saves | T01 | 새 시간 랭킹·제한된 초기화·클리어 즉시 저장·표시 |
| T03 Office Exit and Concrete Stairs | T02 | 4초 자동 퇴근 엔딩·접근성·양쪽 화면 계단 디자인 |
| T04 Office Finish Browser Validation | T01~T03 | 실제 진입점·저장·5단계·시간 경계·모바일·모션 확인 |

## Why one Phase / four Tasks

한 웹앱 기능이므로 P01 하나로 둔다. T01은 시간이 사라지는 엔진 경계를 먼저 고정한다. T02는 기록 형식·저장·표시를 함께 바꿔 중간에 실행 불가능한 스키마를 만들지 않는다. T03은 기존 결과를 바탕으로 시각 연출을 얹는다. T04는 순수 함수/DOM 검사로 확인하기 어려운 SVG 모션·좁은 화면·실제 브라우저 저장을 검증한다.

## Interface Contracts

- T01: `GameState.stageResult: StageResult | null`; `StageResult={stage,score,remainingTimeCs,endedAtMs,outcome}`. outcome은 cleared/caught/time-limit, ready/playing은 null. checkpoint와 game-over는 결과 보유, quit는 checkpoint 결과를 그대로 보유.
- T02: 메인 descent 랭킹 v2의 `remainingTimeCs:number` 필수. 공개 공용 LeaderboardEntry에는 기존 ascent v5 호환을 위한 optional 필드를 두되, descent 읽기/저장에서는 반드시 검증한다.
- T02: `stair-descent:leaderboard:v2` 신규 키와 v1 랭킹만 정리하는 별도 helper. 해금 키와 기존 reset marker는 그대로.
- T03: 엔진 상태는 종료 상태로 확정하고 4초 연출은 UI 상태로만 관리한다. 성적 저장은 연출 전에 실행한다.
- PixelStair 공용 변경은 메인과 단독 DEV 실험에 함께 반영된다. 단독 실험은 기존1단계·무저장 경계를 유지한다.

## Fixed Gameplay Baseline

목표150/200/250/300/350, 제한90/75/65/60/50초, 장애물10/20/30/40/50%, 기본 추격600/500/400/300/250ms, 거리30부터50ms·7이하해제, 회복500ms/가속외추격250ms, 긴5~9/짧은1~3, D/J/Space와 모바일 세 버튼, 보너스30물리계단·30초2배.

## Validation Strategy

- T01/T02 지정29파일, T03/T04 지정31파일. 정확한 실행 명령은 각 Task에 복사해 둔다. workers2로 기존 느린 화면 검사 자원 경쟁을 제한한다.
- npm lint/build 및 git diff --check. timeout/skip/config/package 변경으로 통과시키지 않는다.
- 기존 App.test.tsx의 항상 보이는 오디오 UI 가정에 따른 전체-suite 부채와 기존500kB 번들 경고는 따로 보고한다. 이번 기능의 회귀 경로는 명시한 파일들이다.
- 로그/브라우저 driver/PNG/JSON은 %TEMP%/time-ranking-and-office-ending-2026-10-28/Task별 하위 폴더에 보관한다.
- 이미 실행 중인 로컬 demo5175를 보존한다. 소유한 격리 브라우저 context만 사용한다. 사용자 실제 브라우저 프로필/기록 삭제를 검증 수단으로 사용하지 않는다.

## Known Traps

1. 종료 후 stageEndsAt은 null이므로 HUD의0을 저장하면 모든 동점자가0초가 된다.
2. 늦은 tick은 NPC 접촉의 실제 deadline에서 시간을 계산해야 한다.
3. 체크포인트 그만두기/StrictMode/엔딩 완료가 같은 성적을 다시 저장하면 achievedAt과 개인 최고가 오염된다.
4. 기존 ascent→descent reset을 다시 시작하면 옛 진행 이관과 섞인다. 새 초기화는 구 descent 랭킹v1에만 한정한다.
5. motion-reduce CSS만으로 타이머가 없어지지 않는다. JS에서도 엔딩 대기를 해제한다.
6. SVG 앞면/발 클립을 바꾸면 회사원이 계단 속에 묻히거나 장애물이 가려질 수 있다.

## Progress

- done: 4/4 (active: none, completed)
- T04 `da47a38` (2026-10-29): 주요 driver6/Chrome156 격리context, 네 화면 전체5단계·즉시 저장·시간tuple/보호된 초기화·4초엔딩/모션감소/focus/cleanup·큰 글자/단독 무저장 검증 완료. 실제 엔딩4085ms, 제어 경로각615행동/641계단/마지막352점. 지정31파일945/945tests/skip0/workers2/71.22초, lint/build/diff 통과. artifact114/PNG62 및 SHA256 index는2026-10-29/T04에 보존했다. 제품 source 추가 수정 없음. demo5175 PID14620 유지/소유Chrome 종료. 실제tenant·스피커 청취·기존 App전체suite/번들 개선은 범위 밖이다.
- T03 `1fa30e6` (2026-10-29): clear 전용4초퇴근엔딩·모션감소/입력차단/focus/cleanup·공용 콘크리트/노란선 계단 완료. 지정31파일945/945tests/workers2/60.92초, lint/build/diff 통과. 실제 브라우저 SVG·모바일 검증은 T04에서 완료했다. 증거와 중간 로그/제한은 T03 Validation Results에 기록했다.
- T02 `9082bcc` (2026-10-29): 시간 랭킹v2·구v1만 정리·해금 보존·클리어 즉시 저장·CP/결과/랭킹 시간 표시 완료. 지정29파일912/912tests/workers2/54.62초, lint/build/diff 통과.
- T01 `cbc6c26`: 종료 성적 스냅샷·단위/표시/helper·엔진 전환·단독 fresh guard 완료. 지정29파일864/864tests/workers2/124.79초, lint/build/diff 통과. 증거/중간 실패와 제한은 T01 Validation Results에 기록했다.
- Last completed plan: distance-based-pursuer-catch-up, implementation43db38c / memory15704d3.
