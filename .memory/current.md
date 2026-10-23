# Current Context

## Active Plan

[Five Stage Obstacle Jump](./plans/2026-10-23-five-stage-obstacle-jump.md)

## Active Phase

[P01 Five Stage Game](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/phase.md)

## Active Task

[T03 Timed Pursuer](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/T03-timed-pursuer.md)

## Last Completed Task

[T02 Route and Obstacle Generation](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/T02-route-and-obstacle-generation.md) — commit `7d1f426`.

## Status

- P01 done2/5, Active T03 구현 시작 준비. 이번 실행은 T02 한 개만 완료했고 T03 구현은 시작하지 않았다. T01 구현 커밋12a49d3/문서d63b0f4 이력을 유지한다.
- T01 기능 유지:5단계90/75/65/60/50초·누적300/600/900/1200/1500점, 승급3기회/거리4회복·누적점수/경로/보너스 유지,5단계 최종 클리어, HUD/결과/v3랭킹. 구형v1/v2만 정리하고v3/audio/auth/다른 키 보존.
- T02 구현: 긴5~9칸 뒤 짧은1~3칸 구간1개/2개 랜덤 혼합, 방향 반전·인접 짧은 길이 비반복. 전체 구간 경계 메타데이터, tailRunKind/tailShortRunsRemaining, 결정적LCG/초기Math.random한번, advanceStairRoute의 선택적 oldestRequiredIndex API를 추가했다. 실제 게임에 새 계단 패턴이 적용된다.
- T02 장애물 모듈은 별도 StairObstacleState로 준비했다. 긴 구간만10/20/30/40/50%로 최대1개/첫·마지막 제외/안전 착지, 짧은 구간은 항상null. 나타나지 않는 결정도 저장하고 이미 보인 구간 재추첨 없음. 미래6칸에 들어올 구간마다 독립LCG2회, 과거4칸 밖 장애물 결정은 정리하되 경로 보관량과 분리한다.
- 실제 GameState/입력/장면에는 아직 장애물·Space·독립 추격을 연결하지 않았다. 현재 D/J와 기존 거리기반 추격을 유지한다. NPC 위치에 필요한 과거 보관과1000/800/600/500/400ms 자율 전진 연결은 T03이다.
- T02 검증: 지정Vitest6파일202/202tests 통과, lint/TypeScript+Vite빌드 종료코드0. 최초 배열검사 후 TS7053 타입 추론 문제는 해결 후 재검증했다. 최종 JS533.75kB/gzip149.36kB,500kB초과 청크 경고는 남아 있다. 브라우저 육안/전체App.test.tsx/실제 음원 청취는 실행하지 않았다.
- 후속 추격: pursuerIndex와 nextPursuerStepAt으로 실제 위치·시계 분리, 성공 시 거리 증가/NPC즉시 동반 이동 없음, 오입력은500ms 정지/추가1칸 전진 제거. 실제 잡힘/시간순 만료·숨김 복귀·세 시계 설정pause를 처리하고, 거리4초과·화면 밖 NPC·필요 경로 보관·독립240ms모션을 연결한다.
- 후속 T04는 보이는 상자·충돌·Space2칸/일반2점·보너스4점/게이지+2·3개 모바일 버튼을 함께 연결한다. T05는 클립 밖 점프 아크·빠른 후속 입력·통합 브라우저 검증이다.
- 이전 timed-stage-progression 완료 이력과 별도 넘어짐 소리 청취 문제를 유지한다. 독립 App 기대값/옛 CSS/번들 분할 정리는 임의로 합치지 않는다.

## Next Step (IMPORTANT)

`/memory-execute` 또는 `current 보고 이어서 해줘` 요청 시 T03 청사진 한 개만 읽고 구현·검증·커밋한다. 단계별1000/800/600/500/400ms 시간 기반 추격의 상태/시간순 tick/잡힘·기회/오입력 정지/필요 경로 보관/화면 밖 실제 NPC/자체 전진 모션/설정 보정을 함께 연결한다. T02의 새 경로·장애물 모듈 계약을 사용하되 장애물·점프 게임 연결은 T04로 남긴다. 통과 후 Task/phase/current를 갱신하고 T04로 전진한다. T04~T05 또는 별도 소리 문제를 한 번에 실행하지 않는다.
