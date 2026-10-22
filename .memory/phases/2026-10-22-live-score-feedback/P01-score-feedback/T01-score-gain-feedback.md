# Task: T01 점수 획득 피드백 표시

## Status: done

## Goal
성공적인 계단 이동 때 HUD 총점을 즉시 갱신하고 획득량 `+1` 또는 `+2`를 약 700ms 동안 보여주며 총점 숫자를 짧게 강조한다. 실패 입력은 점수를 올리지 않으므로 피드백을 표시하지 않는다.

## Decision Summary
- 현재 엔진 규칙(일반 이동 +1, 이벤트 중 이동 +2)을 그대로 사용한다. HUD 상태의 점수 차이를 감지해 획득 팝업과 재생 키를 갱신하고 CSS 애니메이션으로 시각화한다.
- 기존 `prefers-reduced-motion` 미디어 쿼리에 새 점수 애니메이션을 포함한다. 새 모델이나 저장 스키마는 추가하지 않는다.

## Implementation

### I01. 점수 변화 감지와 일시적 표시 상태

- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen` — 직전 점수와 현재 점수 차이를 감지하고 팝업 생명주기를 관리; modify
  - `src/game/GameHud.tsx` :: `GameHudProps`, `GameHud` — 획득량과 재생 키를 점수 카드에 전달하고 표시; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface GameHudProps {
    state: GameState;
    eventSecondsLeft: number;
    scoreGain: number | null;
    scoreAnimationKey: number;
  }
  ```
  `GameHud`는 기존 함수 시그니처 `GameHud({ state, eventSecondsLeft }: GameHudProps): ReactElement`를 확장하여 두 새 필드를 받는다.
- **Data & Schema Fields**:
  - `GameState`: 기존 `score: number`를 사용하며 모델 필드 추가 없음.
  - `GameScreen` 로컬 상태: `scoreGain: number | null` (마지막 증가량, 없으면 `null`), `scoreAnimationKey: number` (성공한 증가마다 1 증가).
  - `GameScreen` refs: `previousScoreRef: { current: number }`, `scoreGainTimeoutRef: { current: number | undefined }`.
- **Execution Flow / Logic**:
  1. `GameScreen`이 `gameState.score`를 직전 점수 ref와 비교한다.
  2. 점수가 증가하면 차이 `gameState.score - previousScoreRef.current`를 `scoreGain`에 넣고 `scoreAnimationKey`를 1 올린다. 엔진 규칙상 차이는 일반 이동 `1`, 이벤트 이동 `2`다.
  3. 이전 팝업 타이머가 있으면 취소하고, 700ms 뒤 `scoreGain`을 `null`로 만드는 새 타이머를 시작한다. 연속 입력에서도 가장 최근 증가량이 새 애니메이션으로 재생되어야 한다.
  4. 점수가 감소하는 리셋 상태에서는 팝업 타이머를 취소하고 `scoreGain`을 `null`로 만든다. 점수가 같으면 팝업을 시작하지 않는다.
  5. Effect cleanup에서 타이머를 취소해 컴포넌트가 사라진 뒤 상태 업데이트가 발생하지 않도록 한다.
  6. 기존 `GameHud` 호출부에 두 새 prop을 전달한다. 점수 텍스트는 상태 변경 직후 이미 갱신되며, 획득 표시에는 `+{scoreGain}`을 렌더한다.
- **Error & Exception Handling**: 새 외부 호출이나 예외 경로가 없다. `window.setTimeout` 반환값을 `window.clearTimeout`으로 정리한다.
- **State Transition & Return**: 점수 증가 전 `scoreGain=null`; 증가 직후 점수 차이와 애니메이션 키 갱신; 700ms 뒤 `scoreGain=null`. 점수 증가에는 기존 엔진 결과를 그대로 렌더링한다.

### I02. 점수 카드 애니메이션 및 모션 감소 지원

- Related Files:
  - `src/game/GameHud.tsx` :: 점수 카드의 `.score-value` 및 획득 점수 표시 — 애니메이션 클래스/키와 접근 가능한 팝업 텍스트 추가; modify
  - `src/game/game.css` :: `.score-card`, `.score-value`, 점수 애니메이션 keyframes, `@media (prefers-reduced-motion: reduce)` — 팝업 배치와 애니메이션 스타일 정의; modify

#### Details
- 점수 증가량은 총점 옆에 `+1` 또는 `+2`로 표시하고, 보조기기가 의미를 알 수 있도록 `aria-live="polite"`가 있는 짧은 상태 문구로 렌더한다.
- 팝업 요소에 `key={scoreAnimationKey}`를 지정해 같은 증가량이 연속되어도 새 이동마다 CSS 애니메이션이 다시 시작되게 한다.
- 총점 숫자도 `scoreAnimationKey` 변경 때 재생되는 짧은 강조 애니메이션을 가진다. 총점 숫자는 애니메이션 중에도 새 값을 즉시 표시해야 한다.
- 기본 모션은 약 700ms 동안 팝업을 위로 이동시키며 투명하게 사라지게 한다. 점수 강조 효과는 짧은 scale/밝기 변화로 표현한다.
- `prefers-reduced-motion: reduce`에서는 두 애니메이션을 끈다. 획득량 텍스트는 동일한 약 700ms 동안 정적으로 표시해 점수 변화 정보 자체는 유지한다.
- 팝업 표시 여부는 `scoreGain !== null`로 결정한다. 실패 입력에 대한 별도 시각 효과는 추가하지 않는다.

### I03. 회귀 테스트

- Related Files:
  - `src/game/GameScreen.test.tsx` :: `describe("GameScreen controls")` — 정상 증가, 이벤트 증가, 실패 입력 및 연속 애니메이션 키 회귀 검증; modify

#### Details
- 가짜 타이머와 `Math.random`의 고정값을 이용해 테스트를 결정적으로 만든다.
- 시작 후 정상 이동 한 번에서 점수 `1` 및 획득 표시 `+1`을 확인한다.
- 정확히 30칸 이동해 이벤트를 활성화한 뒤 다음 성공 이동에서 총점 증가량 `2`와 표시 `+2`를 확인한다. 기존 엔진 규칙대로 30번째 이동 자체는 이벤트 시작 전이므로 `+1`이며, 그 다음 이동이 `+2`임을 검증한다.
- 연속 성공 입력에서 `scoreAnimationKey`가 증가해 같은 점수 증가 애니메이션을 다시 시작할 수 있음을 확인한다.
- 잘못된 입력은 총점을 바꾸지 않고 획득 점수 표시를 만들지 않음을 확인한다.
- 타이머를 700ms 진행한 뒤 획득 표시가 사라지고, 테스트 cleanup 이후 잔여 타이머가 없는지 확인한다.

## Acceptance Criteria
- [ ] 성공 이동 직후 점수 텍스트에 총점이 즉시 반영된다.
- [ ] 일반 이동은 `+1`, 이벤트 중 이동은 `+2` 획득량을 약 700ms 표시한다.
- [ ] 매 점수 증가마다 총점 강조와 획득량 애니메이션이 다시 재생된다.
- [ ] 실패 입력은 점수 획득 표시를 만들지 않는다.
- [ ] 모션 감소 환경에서도 획득량은 표시되며 이동 애니메이션은 비활성화된다.

## Validation
- `npm test -- --run src/game/GameScreen.test.tsx` — 점수 피드백 회귀 테스트를 포함해 GameScreen 테스트 전체 통과.
- `npm run lint` — ESLint 오류 없음.
- `npm run build` — TypeScript 검사 및 Vite 빌드 통과.

## Commit Message
```text
feat(game): show live score gains

Plan: 2026-10-22-live-score-feedback
Phase: P01-score-feedback
Task: T01-score-gain-feedback

- Show +1 and +2 score gain feedback for successful climbs
- Animate the score and cover event, repeated input, and reduced motion behavior
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: created
