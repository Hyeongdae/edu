# Task: T01 Shared Stair Route

## Status: done

## Goal
실제 이동 방향의 연속 구간이 4~6칸이고 직전 구간과 다른 길이가 되도록 경로를 생성한다. 화면이 나중에 재사용할 수 있는 앞뒤 경로를 게임 엔진의 유일한 판정 근거로 만든다. 엔진과 기존 게임 화면이 이 작업만으로도 실행·검증 가능해야 한다.

## Decision Summary
- 한 방향 구간의 실제 계단 수는 4~6이며 코너 이후 새 길이는 직전 전체 구간 길이와 달라야 한다. J는 방향을 바꾸며 새 구간의 첫 계단 하나를 소비한다.
- 공유 경로와 난수 상태는 런타임 `GameState.route`에 둔다. 난수 호출은 초기 생성에 한정하며, 경로는 불변 값으로 갱신하고 메모리 사용량을 제한한다.

## Implementation

### I01. 경로 모델과 결정적 생성기
- Related Files:
  - `src/game/types.ts` :: `GameState`, `Direction`, `StairRunLength`, `StairRouteStep`, `StairRoute`; modify
  - `src/game/stairRoute.ts` :: 경로 생성·보충·조회 함수; new
  - `src/game/stairRoute.test.ts` :: 경로 불변식 검증; new

#### Details
- **Signatures & Types**:
  ```typescript
  // types.ts에 추가한다. 기존 GameState 필드는 그대로 두고 route만 추가한다.
  type StairRunLength = 4 | 5 | 6;
  interface StairRouteStep {
    index: number;
    column: number;
    direction: Direction;
  }
  interface StairRoute {
    steps: readonly StairRouteStep[];
    rngState: number;
    tailDirection: Direction;
    tailRunLength: StairRunLength;
    tailStepsRemaining: number;
  }
  // GameState.route: StairRoute (필수, non-null)

  // stairRoute.ts exports
  function chooseRunLength(unit: number, previousLength: StairRunLength | null): StairRunLength;
  function createStairRoute(random?: () => number): StairRoute;
  function advanceStairRoute(route: StairRoute, playerIndex: number): StairRoute;
  function getRouteStep(route: StairRoute, index: number): StairRouteStep;
  function countStraightSteps(route: StairRoute, playerIndex: number, direction: Direction): number;
  ```
- **Data & Schema Fields**:
  - `index`: 시작 발판 0, 실제 성공 이동마다 +1. 시작 이전 발판은 -4~-1이다. 화면의 높이도 이 번호에서 계산한다.
  - `column`: 계단의 수평 격자 좌표. 오른쪽 이동은 이전 노드 +1, 왼쪽 이동은 -1이다.
  - `direction`: 해당 노드로 들어온 이동 방향. 플레이어/추격자의 시각적 방향에도 사용한다.
  - `rngState`: 0~4294967295 정수. `tailDirection`은 마지막 생성 노드의 방향이다. `tailRunLength`는 마지막 생성 구간의 전체 길이 4·5·6 중 하나이며, 버퍼 정리 후에도 유지한다. `tailStepsRemaining`은 그 방향으로 아직 생성할 계단 수(정착 상태에서 0~5)다. 0이면 다음 노드 생성 전에 반대 방향과 직전과 다른 새 길이를 선택한다.
  - 경로는 정착 상태에서 정확히 `playerIndex - 4`부터 `playerIndex + 18`까지 연속 23개 노드를 가진다. 정적 시작 노드도 번호/좌표 규칙에 포함되지만 랜덤 구간 길이 통계에서는 제외한다.
- **Execution Flow / Logic**:
  1. `chooseRunLength(unit, previousLength)`는 유한한 `0 <= unit < 1`을 받는다. previousLength가 null이면 후보는 `[4,5,6]`, 그 외에는 이 배열에서 previousLength를 제외한 두 길이다. `floor(unit * candidates.length)` 인덱스의 길이를 반환한다. 첫 구간은 세 후보가 같은 확률, 이후에는 두 후보가 같은 확률이다. 같은 값이 나오면 다시 뽑는 반복문은 만들지 않는다.
  2. `createStairRoute`는 기본 `Math.random` 또는 주입된 함수에서 한 번 `u`를 읽는다. 첫 오른쪽 구간 길이는 `chooseRunLength(u, null)`이고 초기 난수 상태는 `floor(u * 4294967296) >>> 0`이다. -4~0 노드를 `column = index`, `direction = "right"`로 준비한다. tailRunLength와 남은 생성 수를 첫 길이로 둔 뒤 index 18까지 채운다.
  3. 새 구간 난수는 `next = (Math.imul(rngState, 1664525) + 1013904223) >>> 0`이다. 길이는 `chooseRunLength(next / 4294967296, tailRunLength)`로 고른다. 그 값을 새 rngState에 담고, 이전 방향을 반대로 바꾼 뒤 tailRunLength를 새 길이로 바꿔 해당 노드를 생성한다. 생성된 각 노드마다 tailStepsRemaining을 1 줄인다. 난수 상태 0도 허용한다. 직전 전체 구간 길이를 기준으로 비교하며 현재 화면의 남은 D 횟수와 비교하지 않는다.
  4. `advanceStairRoute(route, playerIndex)`는 더 필요한 미래 노드를 마지막 노드에서 이어 생성하고, `playerIndex - 4` 미만 노드를 버린다. 기존 객체와 배열을 변경하지 않는다. 생성기 메타데이터를 경로에 함께 반환한다.
  5. `countStraightSteps`는 playerIndex 다음 노드부터 현재 `direction`과 같은 방향의 노드를 첫 반대 방향 전까지 센다. 모퉁이라면 0이다. 18칸 버퍼가 최대 구간 6칸 뒤의 전환과 미리보기를 보장하므로 추측값을 쓰지 않는다.
  6. 조회는 인덱스 일치 노드를 반환한다. 범위 밖 또는 비정상 경로를 임의 직선으로 보정하지 않는다.
- **Error & Exception Handling**:
  - 잘못된 난수, 4·5·6·null 이외의 previousLength, 정수가 아닌 playerIndex/index, 요청 인덱스 누락, 불연속 노드 또는 미래 버퍼 부족은 `RangeError`로 명확히 실패한다. chooseRunLength의 previousLength null은 첫 구간 생성에서 유효하다. 기존 상태는 그대로 둔다.
  - 앱에서는 정상 엔진이 만든 경로만 사용한다. 외부 API/저장소에 경로를 읽거나 쓰지 않는다.
- **State Transition & Return**:
  - 한 성공 이동 뒤 동일한 과거·미래 경로를 공유하면서 플레이어 뒤 4칸만 보존한다. 같은 경로와 같은 playerIndex 입력은 깊은 동등 값의 결과를 반환한다.

### I02. 엔진과 React 입력 연결
- Related Files:
  - `src/game/gameEngine.ts` :: `createGameState`, `applyInput`, `resetGame`; modify
  - `src/game/GameScreen.tsx` :: `handleStart`; modify
  - `src/game/StairScene.tsx` :: 기존 화면 호환 여부; read-only in this task
  - `src/leaderboard/leaderboard.ts`, `src/audio/audioPreferences.ts` :: 저장 모델; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  function createGameState(random?: () => number): GameState;
  function startGame(state: GameState): GameState;
  function tickGame(state: GameState, nowMs: number): GameState;
  function applyInput(state: GameState, input: GameInput, nowMs: number): GameState;
  function resetGame(random?: () => number): GameState;
  ```
  - `applyInput`의 기존 네 번째 `random` 인자는 제거한다. 프로덕션 `GameScreen` 호출은 이미 세 인자이며, 네 인자 테스트 호출은 I03에서 바꾼다.
  - 삭제 대상: 이전 `MIN_STRAIGHT_STEPS`, `STRAIGHT_STEP_VARIANTS`, `nextStraightSteps`에 의한 별도 구간 생성.
- **Data & Schema Fields**:
  - `GameState`의 기존 필드: status, score, stepsClimbed, lives, direction, straightStepsRemaining, pursuerDistance, eventSteps, eventEndsAt, recoveryEndsAt, lastMistake. 여기에 I01의 `route`를 추가한다.
  - 초기값: status ready, score/stepsClimbed/eventSteps 0, lives 3, direction right, pursuerDistance 4, 두 종료 시간 null, lastMistake false. straightStepsRemaining은 초기 route에서 계산한다.
  - 저장하는 최고 점수/오디오 환경설정의 버전과 필드는 변경하지 않는다.
- **Execution Flow / Logic**:
  1. `createGameState`가 `createStairRoute(random)`를 한 번 호출한다. 초기 remaining은 route의 첫 같은 방향 실제 계단 수인 4~6이다.
  2. `applyInput`의 시간 검증, tickGame 호출, playing/recovery 차단은 유지한다. 다음 `getRouteStep(route, stepsClimbed + 1)`의 direction이 현재 direction과 같으면 D, 다르면 J가 정답이다. `straightStepsRemaining === 0`과 이 판정이 항상 일치하도록 유지한다.
  3. 오답은 기존처럼 거리 -1, 잡히면 목숨 -1/거리 4 초기화, 500ms recovery와 lastMistake를 설정한다. 경로 노드·난수 상태·플레이어 인덱스는 소비하지 않는다.
  4. 정답은 다음 노드로 stepsClimbed를 1 늘리고 direction을 그 노드의 direction으로 바꾼다. `advanceStairRoute`로 버퍼를 정리/보충한 뒤 그 경로에서 remaining을 다시 계산한다. J가 이미 새 구간의 첫 칸을 소비했으므로 길이 L의 새 구간에서는 remaining = L - 1이다.
  5. 점수 +1/+2, 30번째 성공 시 30초 이벤트, 500ms 회복, 3회 잡히면 종료 등의 기존 규칙은 연결한다. tickGame의 spread 갱신에서도 route를 보존한다.
  6. 재시작은 새 seed/route를 만들며 모든 게임 필드를 초기화한다. `GameScreen.handleStart`에서 재시작용 state를 이벤트 핸들러 안에서 먼저 만들고 `setGameState(nextState)`로 전달한다. `resetGame()`의 Math.random 호출을 React 함수형 updater 안에 두지 않는다. 기존 BGM 시작과 scoreSavedRef 초기화는 유지한다.
- **Error & Exception Handling**:
  - 잘못된 시간의 기존 RangeError를 유지한다. 경로 함수에서 실패하면 원본 상태를 변경하지 않는다.
  - 함수형 `handleInput` updater는 무작위 외부 호출을 하지 않으므로 StrictMode 재실행에 동일한 결과를 낸다.
- **State Transition & Return**:
  - 기존 화면은 direction/remaining을 계속 읽을 수 있다. 경로 기반 좌표와 미리보기 렌더링은 T02에서 적용한다.

### I03. 경로 및 조작 회귀 검증
- Related Files:
  - `src/game/stairRoute.test.ts` :: 경로 경계/불변식; new
  - `src/game/gameEngine.test.ts` :: 랜덤 주입과 모퉁이 테스트; modify
  - `src/game/GameScreen.test.tsx` :: 기존 고정 4칸 가정; modify

#### Details
- 난수 u=0이면 첫 구간 4칸, u=0.5이면 5칸, u=0.999이면 6칸이다. 기존 `randomFiveSteps = () => 0.5`를 그대로 사용할 수 있다.
- chooseRunLength는 previousLength 4/5/6과 unit 0/0.999의 조합으로 여섯 가능한 전환을 확인한다. 4→5·6, 5→4·6, 6→4·5만 반환하고 직전과 같은 값을 반환하지 않아야 한다. 첫 구간 null은 세 값 모두 가능하다.
- 모퉁이 테스트는 `straightStepsRemaining: 0`만 덮어써서 경로와 모순되는 상태를 만들지 않는다. 정답 입력으로 실제 모퉁이까지 진행한 상태를 사용한다. 새 구간 J 뒤 남은 횟수는 경로에서 계산한 L-1과 비교한다.
- 4/6 경계, 연속 구간 길이 불일치, 여러 길이의 교대 방향, 시작 이전 4칸, 인접 노드 column 변화 ±1, 1,000칸 진행 후에도 23개 노드, 새 상태/배열 반환 및 원본 불변, 같은 seed/입력의 같은 결과를 검증한다. 버퍼를 보충한 뒤에도 인접 구간 길이가 중복되지 않는지 확인한다. 렌더/조회가 난수를 호출하지 않는 것도 확인한다.
- 오답/회복 중 입력은 미래 노드나 seed를 소비하지 않는다. 정답 미리보기의 첫 노드와 실제 이동 노드가 일치하는지 검증한다.
- 기존 score/lives/recovery/event 테스트는 유지한다. 네 번째 applyInput 인자를 제거하고 route와 모순되는 fixture만 교체한다.
- 초기 상태 전체를 고정 객체로 비교하던 테스트는 기존 필드의 `toMatchObject`와 별도의 경로 불변식 검증으로 바꾼다. 생성된 23개 노드 전체를 그대로 복사한 예상값은 만들지 않는다.
- `GameScreen.test.tsx`의 이벤트 30계단/발소리 30회 테스트는 방향 힌트 `data-testid="route-direction"`가 "지금 방향을 바꾸세요"인지 보고 D/J를 선택하는 `climbOneStep()` 테스트 helper를 사용한다. 특정 구간 길이를 반복해 총 30을 맞추지 않는다.
- `Math.random=0`으로 고정한 climb 애니메이션 테스트는 D 4회 후 J 1회로 총 5칸을 검증한다. 다음 구간은 5 또는 6칸이며 전환 J가 그중 첫 칸이다. 잡힘 12회 오답 시나리오는 시작 구간 최소 4칸이므로 J 오답 반복으로 계속 재사용한다.
- T01에서는 기존 추격자 고정 좌표 테스트를 바꾸지 않는다. 그것은 T02의 경로 좌표 변경 때 다룬다.

## Acceptance Criteria
- [x] 실제 경로의 각 방향 구간이 4~6칸이며 J 계단을 중복 집계하지 않는다.
- [x] 첫 구간 뒤 모든 새 구간은 직전 전체 구간 길이와 다르며 버퍼 보충 후에도 이 규칙이 유지된다.
- [x] 다음 입력 판정은 route의 다음 노드 방향과 일치하고, 구간 내 seed/미래 경로가 다시 뽑히지 않는다.
- [x] 뒤 4/앞 18칸이 유지되고 오래 플레이해도 route 노드 수가 증가하지 않는다.
- [x] 같은 state/input은 같은 결과를 내며, 오답은 route를 소비하지 않는다.
- [x] 기존 점수/이벤트/오디오/기록 저장 및 조작 회귀 검증이 유지된다.

## Validation
- `npm test -- --run src/game/stairRoute.test.ts src/game/gameEngine.test.ts src/game/GameScreen.test.tsx` — 모든 대상 테스트 통과.
- `npm run lint` — 미사용 선언과 hooks 오류 없이 통과.
- `npm run build` — 타입 검사 및 Vite 빌드 통과.
- 이 작업은 경로/엔진 단위다. 기존 화면의 미래 구간 예측을 실제 route로 교체하는 것은 다음 T02의 완료 조건이다.

## Commit Message
```text
feat(game): share deterministic random stair routes

Plan: 2026-10-22-pixel-stair-game-redesign
Phase: P01-pixel-stair-game
Task: T01-shared-stair-route

- Generate four-to-six-step runs without consecutive repeated lengths
- Retain bounded route history and preview for the scene
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: complete (see task commit in git history)

## Validation Results
- 지정된 stairRoute/gameEngine/GameScreen 테스트 3개 파일, 61개 테스트 통과.
- `npm run lint` 통과.
- `npm run build` 통과. JavaScript 청크 510.96 kB에 대한 Vite 권고 경고는 남아 있으며 빌드 오류는 아니다.
- 3개 초기 seed에서 각각 1,000칸 동안 경로 연결, 길이 4~6, 직전 길이 비반복, 고정 23개 노드를 확인했다.
- 화면의 실제 route 미리보기 연결과 픽셀 디자인은 후속 T02~T04 작업이다.
