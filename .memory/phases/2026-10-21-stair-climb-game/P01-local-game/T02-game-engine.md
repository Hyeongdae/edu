# Task: T02 게임 규칙 엔진

## Status: done

## Goal
계단 이동, 올바르지 않은 입력, 점수 이벤트, 추격자, 기회 소진 규칙을 React와 독립적인 순수 TypeScript 함수로 구현해 게임 화면이 일관된 상태 전이를 사용할 수 있게 한다.

## Decision Summary
- 경로는 좌우 번갈아 진행하고 직선은 4~6회의 D 이동으로 구성한다. 모퉁이에서 J는 회전과 한 칸 이동을 동시에 한다.
- 입력 제한 시간은 없다. 성공 이동만 점수와 30계단 이벤트 게이지에 반영한다.

## Implementation

### I01. 타입과 초기 상태
- Related Files:
  - `src/game/types.ts` :: 게임 모델 — 신규
  - `src/game/gameEngine.ts` :: 초기 상태 및 전이 함수 — 신규

#### Details
- **Signatures & Types**:
  ```ts
  export type Direction = "left" | "right";
  export type GameInput = "forward" | "turn";
  export type GameStatus = "ready" | "playing" | "game-over";
  export interface GameState {
    status: GameStatus;
    score: number;
    stepsClimbed: number;
    lives: number;
    direction: Direction;
    straightStepsRemaining: number;
    pursuerDistance: number;
    eventSteps: number;
    eventEndsAt: number | null;
    recoveryEndsAt: number | null;
    lastMistake: boolean;
  }
  export function createGameState(random?: () => number): GameState;
  export function startGame(state: GameState): GameState;
  ```
- **Data & Schema Fields**: `lives` 초기값 3, `pursuerDistance` 초기값 4, `direction` 초기값 `right`, `score`, `stepsClimbed`, `eventSteps` 초기값 0. `straightStepsRemaining`는 초기 및 새 구간마다 무작위 정수 4~6. `eventEndsAt`와 `recoveryEndsAt`는 epoch milliseconds이며 각각 이벤트 비활성 및 넘어짐 연출 비활성일 때 `null`이다.
- **Execution Flow / Logic**:
  1. `createGameState`는 주입된 `random`으로 `Math.floor(random() * 3) + 4`를 계산해 4~6 범위를 포함한다.
  2. `startGame`은 `ready`를 `playing`으로 바꾸며 나머지 값은 초기값 그대로 둔다.
  3. 잘못된 random 반환값(0 이상 1 미만이 아님)은 4로 fallback하지 않고 `RangeError`를 던진다.
- **Error & Exception Handling**: 비정상 난수 공급은 `RangeError`; 외부 저장/네트워크 오류는 이 모듈의 책임이 아니다.
- **State Transition & Return**: 모든 함수는 기존 상태를 변경하지 않고 새 `GameState`를 반환한다.

### I02. 입력·점수·이벤트·추격 전이
- Related Files:
  - `src/game/gameEngine.ts` :: `applyInput`, `tickGame`, `resetGame` — 수정

#### Details
- **Signatures & Types**:
  ```ts
  export function applyInput(state: GameState, input: GameInput, nowMs: number, random?: () => number): GameState;
  export function tickGame(state: GameState, nowMs: number): GameState;
  export function resetGame(random?: () => number): GameState;
  ```
- **Execution Flow / Logic**:
  1. `applyInput`은 `playing`이 아닐 경우 입력을 무시하고 같은 상태를 반환한다.
  2. 직선 구간(`straightStepsRemaining > 0`)에서는 `forward`만 성공한다. 성공 시 남은 직선 계단을 하나 줄인다. `turn` 입력은 실수다.
  3. 모퉁이(`straightStepsRemaining === 0`)에서는 `turn`만 성공한다. 성공하면 방향을 반전하고, 새 구간 길이 4~6을 뽑는다. 이 회전 입력도 계단 한 칸 이동이다. `forward` 입력은 실수다.
  4. 성공 이동은 `stepsClimbed`를 1 늘리고 점수를 얻는다. 이벤트가 활성 중이면 2점, 아니면 1점이다. 활성 이벤트 중에는 게이지를 쌓지 않는다.
  5. 이벤트가 꺼져 있을 때 성공 이동마다 `eventSteps`를 늘린다. 30에 도달하면 `eventEndsAt = nowMs + 30_000`으로 설정하고 `eventSteps = 0`으로 초기화한다.
  6. `tickGame`은 `eventEndsAt !== null && nowMs >= eventEndsAt`일 때 이벤트를 끝내고 `eventEndsAt = null`, `eventSteps = 0`으로 설정한다. UI는 매초 이 함수를 호출할 수 있다.
  7. 실수 입력은 플레이어·점수·이벤트 진행을 유지하고 `pursuerDistance`를 1 줄인다. 거리가 0 이하가 되면 `lives`를 1 줄이고 `pursuerDistance`를 4로 재설정한다. `lives`가 0이면 `status = "game-over"`로 바꾼다.
  8. 실수 입력은 `lastMistake = true`, `recoveryEndsAt = nowMs + 500`으로 설정해 넘어짐 연출을 시작한다. 연출 중 입력은 무시한다. 실수 자체로는 생명을 줄이지 않으며, 추격자가 닿을 때만 생명을 줄인다.
  9. `tickGame`은 `nowMs >= recoveryEndsAt`이면 `recoveryEndsAt = null`, `lastMistake = false`로 회복시킨다. 성공 이동은 즉시 `lastMistake = false`로 둔다.
- **Error & Exception Handling**: 음수 또는 비정상 `nowMs`는 `RangeError`. 잘못된 `GameInput`은 TypeScript 타입에서 제한한다. 게임 종료 후 입력으로 점수/생명이 변하지 않는다.
- **State Transition & Return**: 입력 함수는 순수 전이를 반환하며 원본 상태 객체와 그 하위 필드를 mutate하지 않는다.

### I03. 엔진 검증
- Related Files:
  - `src/game/gameEngine.test.ts` :: 규칙 단위 테스트 — 신규
- **Data & Schema Fields**: 난수 공급을 주입해 테스트에서 구간 길이를 고정한다.
- **Execution Flow / Logic**: 초기 생명과 거리, 4와 6 경계 구간, D 직진, J 모퉁이 회전, 오입력에 따른 거리 단축·500ms 입력 잠금·회복, 연출 중 추가 입력 무시, 포획 후 생명/거리 복구, 세 번째 포획 종료, 30번째 이동 이벤트 시작, 이벤트 중 2점, 만료 및 다음 게이지 진행, 종료 상태 입력 무시를 확인한다.
- **Error & Exception Handling**: 경계값 0, 0.999, 잘못된 난수 -1 및 1, 이벤트 만료 시각과 동일한 tick을 검증한다.

## Acceptance Criteria
- [x] 모든 규칙이 React import 없이 순수 함수로 실행된다.
- [x] 올바른 입력만 이동·점수·이벤트 진행을 갱신한다.
- [x] 잘못된 입력은 추격자를 움직이고 포획 시 기회를 잃게 한다.
- [x] 잘못된 입력은 500ms 넘어짐 상태를 만들고 그동안 중복 입력을 무시한다.
- [x] 이벤트와 생명 경계 조건을 포함한 단위 테스트가 통과한다.

## Validation
- `npm run test -- --run src/game/gameEngine.test.ts` — 엔진 테스트 통과.
- `npm run lint` — ESLint 오류 없음.
- `npm run build` — TypeScript 및 프로덕션 빌드 성공.

## Commit Message
```text
feat(game): implement stair climbing rules engine

Plan: 2026-10-21-stair-climb-game
Phase: P01-local-game
Task: T02-game-engine

- Model route, score events, lives, and pursuer state
- Cover movement and edge cases with unit tests
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (`npm run test -- --run src/game/gameEngine.test.ts`, `npm run lint`, `npm run build`)
- commit: `feat(game): implement stair climbing rules engine`
