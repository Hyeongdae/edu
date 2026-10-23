# Current Context

## Active Plan

[Five Stage Obstacle Jump](./plans/2026-10-23-five-stage-obstacle-jump.md)

## Active Phase

[P01 Five Stage Game](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/phase.md)

## Active Task

[T02 Route and Obstacle Generation](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/T02-route-and-obstacle-generation.md)

## Last Completed Task

[T01 Five Stages and Ranking](./phases/2026-10-23-five-stage-obstacle-jump/P01-five-stage-game/T01-five-stages-and-ranking.md) — commit `12a49d3`.

## Status

- P01 done1/5, Active T02 구현 시작 준비. 이번 실행은 T01 한 개만 완료했으며 T02 이후 구현은 시작하지 않았다.
- T01 구현: 공통 stageRules의5단계90/75/65/60/50초·누적300/600/900/1200/1500점, 모든 단계의 시간 만료, 승급3기회/거리4회복·점수/경로/보너스 유지,5단계 목표 최종 클리어, HUD 목표/시계·결과 이유, 단계1~5 v3랭킹과 승인된 구형v1/v2만 정리.
- 공통 규칙표에 장애물10/20/30/40/50%와 추격 간격1000/800/600/500/400ms를 준비했으나 아직 동작에 연결하지 않았다. 실제 앱은5단계 제한시간/v3랭킹을 사용하고 계단4~6칸/기존 추격/D·J는 유지한다. 장애물/점프/시간 기반 NPC는 후속 구현이다.
- T01 검증: 지정된 Vitest7파일192/192통과, lint와TypeScript+Vite빌드 종료코드0. 브라우저 육안/전체App.test.tsx/실제 청취는 수행하지 않았다. 실제 사용자 브라우저 저장소를 도구로 삭제하지 않았으며 새 앱의 읽기/저장 경로에서 구형 랭킹만 정리한다.
- 후속 확정 경로: 긴5~9 뒤 짧은1~3구간1개/2개 랜덤, 구간마다 방향 전환·인접 짧은 길이 비반복, 장애물은 긴 구간만 최대1개/안전한 내부. 보이는 없음/위치 재추첨 금지.
- 후속 추격: 별도 실제 인덱스·예정시각, 성공 시 NPC즉시 이동 없음/거리 증가, 오입력500ms 정지/즉시 추가전진 없음, 그동안 정상 추격. 실제 NPC와 최근 이동 출발점까지 경로 보관, 시간순 잡힘·숨김 복귀, 설정은 단계/이벤트/추격 시계 정지.
- 후속 점프: Space2칸/일반2점·보너스4점/게이지+2, 빈 점프·충돌500ms실수. 모바일 앞으로 / 가까운 방향 바꾸기·점프, 중복 입력·성공 애니메이션 잠금 없음. 랭킹 단계→점수 순과v3/audio/auth/다른키 보존은 유지한다.
- 남은 작업: T02 경로·보관 API·독립 장애물 기반 → T03 시간 기반 추격·실제 모션 → T04 장애물 표시·충돌·점프 조작 → T05 점프 아크·통합 브라우저 검증.
- 이전 timed-stage-progression3/3 완료 이력(1027b1f,7349c38,f5ade70,문서c2fe6ca)은 유지한다. 넘어짐 소리 청취 문제/독립 App 기대값·옛 CSS 정리는 별도이고 새로 해결되었다고 보고하지 않는다.

## Next Step (IMPORTANT)

`/memory-execute` 또는 `current 보고 이어서 해줘` 요청 시 T02 청사진 한 개만 읽고 구현·검증·커밋한다. 긴5~9/짧은1~3 패턴과 구간 메타데이터, 선택적 과거 보관 API, 긴 구간만 안정적으로 결정하는 장애물 모듈을 만든다. 이 단계는 장애물을 GameState/충돌/그림에 연결하거나 독립 추격을 먼저 구현하지 않는다. 통과 후 Task/phase/current를 동기화하고 T03으로 전진한다. T03~T05 또는 별도 소리 문제를 한 번에 실행하지 않는다.
