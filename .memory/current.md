# Current Context

## Active Plan

[Five Stage Obstacle Jump](./plans/2026-10-23-five-stage-obstacle-jump.md)

## Active Phase

[P01 Five Stage Game](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/phase.md)

## Active Task

[T04 Obstacle Jump Gameplay](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/T04-obstacle-jump-gameplay.md)

## Last Completed Task

[T03 Timed Pursuer](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/T03-timed-pursuer.md) — commit `42dab25`.

## Status

- P01 done3/5, Active T04 구현 시작 준비. 이번 실행은 T03 한 개만 완료했고 장애물·점프 연결은 시작하지 않았다. T01:12a49d3, T02:7d1f426 이력을 유지한다.
- 현재 실제 앱:5단계90/75/65/60/50초·누적300/600/900/1200/1500점/최종 클리어, 긴5~9 뒤 짧은1~3구간1개 또는2개 랜덤, D/J 조작, 시간 기반 독립 추격, 단계→점수 v3랭킹이다. 승급3기회/거리4회복·점수/보너스 유지, 구형v1/v2만 정리/audio/auth/다른 키 보존을 유지한다.
- T03 상태: pursuerIndex 실제 위치, pursuerDistance=stepsClimbed-pursuerIndex 캐시, nextPursuerStepAt 절대 예정시각, lastPursuerMove={fromIndex,toIndex,atMs}, captureCount/captureEndsAt. 모든 단계1000/800/600/500/400ms마다 한 실제 계단을 전진하며 성공 입력은 NPC를 즉시 이동시키지 않고 거리를 늘린다.
- 오입력은500ms 제자리 정지만 벌점이며 즉시NPC전진 없음. 시간 추격은 정상 진행한다. 실제 잡힘에만 기회1회를 차감하고 NPC를플레이어-4로 재배치·온전한 새 간격을 센다. 잡힘500ms 회복 중에도 추격하며5단계는400ms후 한 칸 전진한다. 기회0이면 caught종료/최종 기록1회 저장이다.
- tick은 절대 예정시각순으로 모든 실제 경과를 재현하고 정확히 같은 시각에는 단계 만료가 NPC/입력보다 우선한다. 이전 시각의 fatal catch는 나중 stage deadline으로 바꾸지 않는다. 설정은 단계/보너스/추격 시계를 함께 보정하고 회복·잡힘 공개는 경과한다. 일반 숨김 탭은 시간 흐름/복귀 잡힘을 반영한다.
- 경로는 최소 player-4/NPC/최근NPC이동출발점까지 보관한다. 장면 기본11칸과 논리 경로 보관량은 다르다. 실제 화면 밖 NPC는 가짜로 표시하지 않고 실제 인덱스/거리만 유지한다. 보이는 과거NPC에는 실제 계단을 추가하고 자체 코너 방향/clip밖240ms전진과 captureCount 기반500ms잡힘을 표시한다.
- GameScreen의 NPC key/활성은 lastPursuerMove.atMs와 시각에서 계산한다. 타이머 callback만 시각 상태를 갱신해 lint를 통과하며 플레이어300ms 모션과 간섭하지 않는다. 발소리는 성공입력당1회, 넘어짐 소리는 실제 오입력만이며 시간 잡힘에는 새 넘어짐 소리를 호출하지 않는다. 스피커 청취 문제 해결은 별도다.
- 장애물 모듈은 아직 독립 상태다. 긴 구간만10/20/30/40/50%·최대1개·안전한 내부, 짧은 구간null, 없는 결정까지 보관·재추첨 금지. GameState에 obstacles/lastMove나 Space 입력은 아직 없다.
- T03 검증: 지정Vitest10파일298/298tests, lint와TypeScript/Vite빌드 종료코드0. 최종JS537.79kB/gzip150.41kB,500kB초과 청크 경고가 남아 있다. 실제 브라우저/reduced-motion 육안/전체App.test.tsx/스피커 청취는 실행하지 않았다.
- T04는 안정된 장애물 상태/그림/충돌/Space2칸 점프/일반2점·보너스4점/게이지+2/모바일3개버튼을 함께 연결한다. T05는 전용 점프 아크·빠른 후속 입력·모바일/확대·실제 추격 포함 전체 브라우저 검증이다.
- 이전 계획 완료 이력과 별도 넘어짐 소리 청취 문제를 유지한다. 독립 App 기대값·옛 CSS·번들 분할 정리를 임의로 합치지 않는다.

## Next Step (IMPORTANT)

`/memory-execute` 또는 `current 보고 이어서 해줘` 요청 시 T04 청사진 한 개만 읽고 구현·검증·커밋한다. T02의 장애물 모듈과 T03의 실제 NPC·시간순 tick/경로 보존 계약을 유지하며 GameState obstacles/lastMove를 추가하고, 보이는 상자/실제 판정/Space·모바일점프/2·4점 피드백을 함께 연결한다. 성공 점프는 실제2칸 이동과 거리 증가이며 NPC를 동반 전진시키지 않는다. 실패는500ms정지·정상 시간 추격이고, 시각에 도달한 잡힘/만료가 입력보다 먼저다. 전용 점프 아크와 전체 브라우저 검증은 T05로 남긴다. 통과 후 Task/phase/current를 갱신하고 T05로 전진하며 별도 소리 문제를 합치지 않는다.
