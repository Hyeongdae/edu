# Task: T01 Pursuer Gap Rules and Distance UI

## Status: done

## Goal

메인 게임과 단독 하강 실험에서 실제 간격15칸 이상일 때만100ms 가속을 켜고6칸 이하에서 끄며, 사용자에게 추격 거리 숫자를 표시하지 않는다.

## Decision Summary

- 실제 간격은 `stepsClimbed - pursuerIndex`이고 상태 전이는 진입15/해제6의 hysteresis를 따른다. 가속이 해제된 뒤7~14에서는 기본 속도, 가속 중7~14에서는 계속100ms다.
- 단계별 기본 속도600/500/400/300/250ms, 단독600ms, 낙상 회복500ms, 일반 낙상 추격250ms, 모션 처리·절대기한·50ms polling은 유지한다. 가속 중 낙상은100ms 우선이다.
- 화면의 추격 거리 문구와 SVG accessible name의 거리 숫자만 제거한다. 내부 `pursuerDistance`, `pursuerIndex`, data 속성 및 방향/다음 코너/보너스30칸 정보는 유지한다.

## Implementation

### I01. 공유 가속 규칙과 엔진 경계

- Related Files:
  - `src/game/pursuitRules.ts` :: `PURSUER_CATCH_UP_START_DISTANCE`, `PURSUER_CATCH_UP_END_DISTANCE`, `PURSUER_CATCH_UP_INTERVAL_MS`, `getPursuerCatchUpState`, `getPursuerMotionDurationMs` — 가속 경계와 시각 동기화; modify
  - `src/game/gameEngine.ts` :: `tickGame`, `applyInput`, `getNextPursuerStepAt` — 절대 기한 기반 추격 이동; read-only unless tests expose a mismatch
  - `src/descent/descentEngine.ts` :: `tickDescent` 및 공유 엔진 호출 — 단독 하강 규칙 연결; read-only unless tests expose a mismatch
  - `src/game/stageRules.ts` :: `getStageRule` — 단계별 기본 속도 계약; read-only
  - `src/game/pursuerCatchUp.test.ts` :: 추격 규칙 경계 테스트; modify
  - `src/game/timedPursuit.test.ts` :: 지연 tick/기한/낙상 우선순위; modify
  - `src/game/stageResult.test.ts` :: 추격 해제 후 실제 접촉 시점과 남은 시간 snapshot; modify
  - `src/descent/DescentGameScreen.test.tsx` :: 단독 화면 polling 및 모션 시간 통합; modify

#### Details

- **Signatures & Types**: 기존 API와 `GameState` 모델은 변경하지 않는다.
  ```typescript
  export const PURSUER_CATCH_UP_START_DISTANCE: number = 15;
  export const PURSUER_CATCH_UP_END_DISTANCE: number = 6;
  export const PURSUER_CATCH_UP_INTERVAL_MS: number = 100;
  export function getPursuerCatchUpState(wasCatchingUp: boolean, distance: number): boolean;
  export function getPursuerMotionDurationMs(
    state: Pick<GameState, "isPursuerCatchingUp">
  ): number;
  ```
- **Data & Schema Fields**: persistence/schema 변경 없음. `GameState.isPursuerCatchingUp:boolean`, `pursuerDistance:number`, `pursuerIndex:number`, `stepsClimbed:number`, `nextPursuerStepAt:number|null`, `lastMistake:boolean`, `recoveryEndsAt:number|null` 계약을 유지한다. 간격은 `stepsClimbed - pursuerIndex`다.
- **Execution Flow / Logic**:
  1. 현재 상태가 가속 중이면 `distance > 6`인 동안 가속을 유지하고6에서 해제한다. 가속 상태가 아니면 `distance >= 15`에서 진입한다.
  2. 공유 추격 판정이 메인과 단독 하강에 모두 적용되므로 엔진의 helper 연결 여부를 확인한다. 진입 시 `nextPursuerStepAt`을 `min(existingDeadline, now+100)`으로 당기며 더 이른 예정 시간을 늦추지 않는다.
  3. 예정 기한마다 실제 경로의 바로 다음 한 계단만 이동한다. 늦은 tick에서도 연속 인접 이동을 보존한다. 낙상 중 가속은100ms, 가속 해제 후 회복 전은250ms, 회복 후는 해당 단계 기본값이다.
  4. 모션 길이는 가속 중100ms, 일반 상태는 기존240ms다. 새 게임/Continue/종료 및 pause/resume의 기존 수명 규칙을 바꾸지 않는다.

### I02. 거리 표기와 사용자 도움말

- Related Files:
  - `src/game/StairScene.tsx` :: scene heading과 SVG accessible name — 메인 거리 텍스트 제거; modify
  - `src/descent/DescentScene.tsx` :: scene heading과 SVG accessible name — 단독 거리 텍스트 제거; modify
  - `src/game/GameScreen.tsx` :: 도움말 추격 안내 문장 — 변경된 기준 설명; modify
  - `src/descent/DescentGameScreen.tsx` :: 단독 도움말 추격 안내 문장 — 변경된 기준 설명; modify
  - `src/game/GameScreen.test.tsx` :: 도움말/scene 통합 기대값; modify
  - `src/game/StairScene.test.tsx` :: 접근성 설명 및 거리 표시 부재; modify
  - `src/descent/DescentScene.test.tsx` :: 접근성 설명 및 거리 표시 부재; modify

#### Details

- 시각 UI에서는 “추격자 N칸” 표기만 제거한다. SVG accessible name은 방향/위쪽 추격자/장애물 정보를 유지하고 숫자 거리를 포함하지 않는다.
- 도움말은 단계 기본 속도와 함께 “15칸 이상 멀어지면0.1초마다 추격하고,6칸까지 좁혀지면 원래 속도로 돌아온다”로 설명한다. 가속 중 낙상100ms 우선, 비가속 낙상250ms, 회복500ms 안내도 정확히 유지한다.
- `data-pursuer-distance`, `data-pursuer-index`, 테스트용 route-index와 내부 state 필드는 진단/규칙용이라 변경하지 않는다.
- 이벤트30칸, 다음 코너까지 거리, 진행 방향, 장애물/점프 도움말은 그대로 유지한다. 광범위한 `30` 또는 `칸` 문자열 치환을 금한다.

## Acceptance Criteria

- [ ] 14칸에서는 비가속,15칸에서 진입하고 가속 중7~14칸은 유지하며6칸에서 해제한다.
- [ ] 해제 후7→14 사이 재진입하지 않고15에서 다시 진입한다. 2칸 점프의 양쪽 경계 통과도 최종 실제 간격에 맞는다.
- [ ] 단계별 기본 속도, 일반 낙상250ms, 회복500ms, 가속 낙상100ms, deadline 보존·늦은 tick·pause/Continue 동작이 유지된다.
- [ ] 두 화면에서 시각/접근성 텍스트의 추격 거리 숫자는 사라지고 방향/이벤트 안내와 내부 거리 데이터는 남는다.

## Validation

- `npm.cmd test -- src/game/pursuerCatchUp.test.ts src/game/timedPursuit.test.ts src/game/stageResult.test.ts src/game/GameScreen.test.tsx src/game/StairScene.test.tsx src/descent/DescentGameScreen.test.tsx src/descent/DescentScene.test.tsx` — 지정된 추격 규칙/종료 시간/화면 회귀 검사 통과.
- `npm.cmd run lint` — lint 오류와 경고0.
- `npm.cmd run build` — TypeScript와 Vite build 통과.

## Commit Message

```text
fix(pursuit): adjust catch-up gap and remove distance labels

Plan: 2026-10-29-pursuer-gap-and-stair-preview
Phase: P01-pursuit-preview
Task: T01-pursuit-gap-rules

- Start 100ms catch-up at a 15-stair gap and release at six
- Remove visible pursuer distance while retaining guidance
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
