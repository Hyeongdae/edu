# Plan: Distance Based Pursuer Catch Up

## Goal

두 로컬 게임의 단계별 추격 속도를 600/500/400/300/250ms로 변경하고 거리 30칸 진입·7칸 해제의 50ms 추격을 적용한다.

## Source

[확정 결정](../decisions/2026-10-28-distance-based-pursuer-catch-up.md). 사용자의 즉시 적용 요청에 따라 계획 파일 생성 후 실행한다.

## Phases

| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | completed | 공용 엔진·양쪽 화면·경계 회귀 검증 완료 | [P01](../phases/2026-10-28-distance-based-pursuer-catch-up/P01-pursuit/phase.md) |

## Task boundary

타입과 엔진, 실제 50ms를 표시하는 양쪽 화면은 함께 검증해야 하므로 단일 Task로 묶는다. 기존 기록 초기화나 별도 게임 규칙을 추가하지 않는다.

## Completion

- done1/1, Active Task none. 구현 `43db38c`, 계획 `63a5773`.
- 지정28파일754tests/lint/build/diff 통과 및 격리 브라우저 두 진입점 검사 통과. 증거와 제한은 T01 Validation Results에 기록했다.
