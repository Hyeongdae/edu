# Current Context

## Active Plan

[Five Stage Obstacle Jump](./plans/2026-10-23-five-stage-obstacle-jump.md)

## Active Phase

[P01 Five Stage Game](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/phase.md)

## Active Task

[T05 Jump Motion and Validation](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/T05-jump-motion-and-validation.md)

## Last Completed Task

[T04 Obstacle Jump Gameplay](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/T04-obstacle-jump-gameplay.md) — commit `7a61ed2`.

## Status

- P01 done4/5, Active T05 구현 시작 준비. 이번 실행은 T04 한 개만 완료했다. T01:12a49d3, T02:7d1f426, T03:42dab25, T04:7a61ed2 이력을 유지한다.
- 현재 실제 앱:5단계90/75/65/60/50초·누적300/600/900/1200/1500점/최종 클리어, 긴5~9 뒤 짧은1~3구간1개 또는2개 랜덤, D/J/Space와 모바일3버튼 조작·보이는 상자/충돌/2칸 점프, 시간 기반 독립 추격, 단계→점수 v3랭킹이다. 승급3기회/거리4회복·점수/보너스 유지, 구형v1/v2만 정리/audio/auth/다른 키 보존을 유지한다.
- T03 상태: pursuerIndex 실제 위치, pursuerDistance=stepsClimbed-pursuerIndex 캐시, nextPursuerStepAt 절대 예정시각, lastPursuerMove={fromIndex,toIndex,atMs}, captureCount/captureEndsAt. 모든 단계1000/800/600/500/400ms마다 한 실제 계단을 전진하며 성공 입력은 NPC를 즉시 이동시키지 않고 거리를 늘린다.
- 오입력은500ms 제자리 정지만 벌점이며 즉시NPC전진 없음. 시간 추격은 정상 진행한다. 실제 잡힘에만 기회1회를 차감하고 NPC를플레이어-4로 재배치·온전한 새 간격을 센다. 잡힘500ms 회복 중에도 추격하며5단계는400ms후 한 칸 전진한다. 기회0이면 caught종료/최종 기록1회 저장이다.
- tick은 절대 예정시각순으로 모든 실제 경과를 재현하고 정확히 같은 시각에는 단계 만료가 NPC/입력보다 우선한다. 이전 시각의 fatal catch는 나중 stage deadline으로 바꾸지 않는다. 설정은 단계/보너스/추격 시계를 함께 보정하고 회복·잡힘 공개는 경과한다. 일반 숨김 탭은 시간 흐름/복귀 잡힘을 반영한다.
- 경로는 최소 player-4/NPC/최근NPC이동출발점까지 보관한다. 장면 기본11칸과 논리 경로 보관량은 다르다. 실제 화면 밖 NPC는 가짜로 표시하지 않고 실제 인덱스/거리만 유지한다. 보이는 과거NPC에는 실제 계단을 추가하고 자체 코너 방향/clip밖240ms전진과 captureCount 기반500ms잡힘을 표시한다.
- GameScreen의 NPC key/활성은 lastPursuerMove.atMs와 시각에서 계산한다. 타이머 callback만 시각 상태를 갱신해 lint를 통과하며 플레이어300ms 모션과 간섭하지 않는다. 발소리는 성공입력당1회, 넘어짐 소리는 실제 오입력만이며 시간 잡힘에는 새 넘어짐 소리를 호출하지 않는다. 스피커 청취 문제 해결은 별도다.
- GameState.obstacles/lastMove를 연결했다. 긴 구간만10/20/30/40/50%·최대1개·안전한 내부, 짧은 구간null, 없는 결정까지 보관·재추첨 금지. PixelObstacle 상자와 실제 판정은 같은 상태를 읽는다. 다음 상자에서 Space는같은방향두칸/일반2점·보너스4점/게이지+2/거리+2이며 NPC는 즉시이동하지 않는다. 빈 점프·상자 충돌·코너 점프는 기존500ms 실수다.
- T03 검증: 지정Vitest10파일298/298tests, lint와TypeScript/Vite빌드 종료코드0. 최종JS537.79kB/gzip150.41kB,500kB초과 청크 경고가 남아 있다. 실제 브라우저/reduced-motion 육안/전체App.test.tsx/스피커 청취는 실행하지 않았다.
- T04 검증: 지정12파일335/335tests, lint와TypeScript/Vite빌드 종료코드0. 실제 생성기 seeded500입력/다중승급·결정 객체 보존, 예정잡힘/만료 우선·게이지28/29·목표초과·단일포인터/Space보호·빠른후속입력·피드백/저장1회/오디오호출을 검증했다. timedPursuit 회귀도 test-only 장애물 fixture로 격리했다. JS542.45kB/gzip151.79kB·500kB경고는 별도. 현재 점프는 기존300ms 일반 오르기 모션을 사용한다. T05는 전용 공중 아크·빠른 후속 입력·모바일/확대·실제 추격 포함 전체 브라우저 검증이다.
- 이전 계획 완료 이력과 별도 넘어짐 소리 청취 문제를 유지한다. 독립 App 기대값·옛 CSS·번들 분할 정리를 임의로 합치지 않는다.

## Next Step (IMPORTANT)

`/memory-execute` 또는 `current 보고 이어서 해줘` 요청 시 T05 청사진 한 개만 읽고 구현·검증·커밋한다. T04의 안정된 상자/점프2칸·2/4점/키보드·모바일3버튼 계약과 T03의 시간순 독립 추격을 유지하며 전용 점프 아크/포즈/겹침을 완성한다. 현재 빠른 입력에 잠금이 없고 점프 상자는300ms 일반 오르기 동안 보존된다. 이 상태에서 전체5단계/랭킹/실제 경과 추격·숨김 복귀/반응형·확대·reduced-motion을 격리 브라우저로 검증한다. T05 전에는 전용 공중 모션·실제 브라우저 완료를 주장하지 않는다. 별도 넘어짐 소리 청취 문제와 독립 App 기대값/옛 CSS/번들 분할을 합치지 않는다. 최종 통과 후 Task/phase/current/plan을 완료한다.
