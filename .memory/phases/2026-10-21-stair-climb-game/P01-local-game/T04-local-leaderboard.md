# Task: T04 로컬 랭킹 및 게임 종료 연결

## Status: pending

## Goal
게임 종료 시 Entra 계정별 최고 점수를 브라우저에 저장하고, 현재 브라우저에 저장된 기록 중 상위 10명을 표시하며 새 게임을 시작할 수 있게 한다.

## Decision Summary
- 저장소는 `localStorage`만 사용한다. 기록은 브라우저별이며 서버나 Azure 공유 저장소를 호출하지 않는다.
- 계정은 MSAL `homeAccountId`로 식별하고 Entra 표시 이름을 랭킹에 보인다.

## Implementation

### I01. 로컬 랭킹 모델과 저장소
- Related Files:
  - `src/leaderboard/leaderboard.ts` :: 모델, 읽기, 최고점수 upsert, 상위 10개 정렬 — 신규
  - `src/leaderboard/leaderboard.test.ts` :: 저장 규칙 테스트 — 신규
- **Signatures & Types**:
  ```ts
  export interface LeaderboardEntry {
    accountId: string;
    displayName: string;
    bestScore: number;
    achievedAt: string;
  }
  export interface SaveBestScoreResult {
    entries: LeaderboardEntry[];
    saved: boolean;
    error?: "storage-unavailable";
  }
  export function readLeaderboard(storage?: Storage): LeaderboardEntry[];
  export function saveBestScore(
    entry: Omit<LeaderboardEntry, "achievedAt">,
    storage?: Storage,
    now?: Date
  ): SaveBestScoreResult;
  export function getTopScores(entries: LeaderboardEntry[], limit?: number): LeaderboardEntry[];
  ```
- **Data & Schema Fields**: 단일 키 `stair-climb:leaderboard:v1`에 `LeaderboardEntry[]` JSON 저장. `accountId`는 Entra `homeAccountId`, `displayName`은 계정 `name` 또는 `이름 없음`, `bestScore`는 0 이상의 정수, `achievedAt`은 ISO-8601 문자열. 같은 계정에는 한 항목만 허용한다.
- **Execution Flow / Logic**:
  1. `readLeaderboard`는 키가 없으면 빈 배열을 반환한다.
  2. JSON 파싱 후 각 항목의 필드와 숫자 점수를 확인한다. 잘못된 JSON/스키마는 전체를 빈 배열로 처리하고 키를 제거해 다음 플레이가 복구될 수 있게 한다.
  3. `saveBestScore`는 같은 계정의 기존 점수보다 새 점수가 높을 때만 `bestScore`, 표시 이름, `achievedAt`을 갱신한다. 같거나 낮으면 기존 최고 점수를 유지한다. 새 계정이면 새 항목을 추가한다.
  4. `getTopScores`는 점수 내림차순, 동점은 `achievedAt` 오름차순으로 안정 정렬한 뒤 기본 limit 10개를 반환한다.
  5. `localStorage` 접근이 `SecurityError` 또는 `QuotaExceededError`로 실패하면 예외를 바깥에 던지지 말고 호출 화면이 저장 실패 안내를 보여줄 수 있도록 결과 타입을 반환한다.
- **Error & Exception Handling**: 잘못된 점수(정수 0 미만, NaN)는 `saveBestScore` 입력 오류로 `RangeError`를 던진다. 저장 접근 실패는 `{ saved: false, error: "storage-unavailable" }`와 가능한 목록을 반환하며 UI에 “기록을 저장하지 못했습니다” 안내를 노출한다. 저장 실패가 게임 종료 표시를 막지 않는다.
- **State Transition & Return**: 성공 시 `{ entries, saved: true }`, 저장 실패 시 `{ entries, saved: false, error: "storage-unavailable" }`를 반환한다. 모듈은 브라우저 전역에 직접 접근하지 않고 주입 `Storage`를 우선 사용해 테스트 가능하게 한다.

### I02. 게임 종료와 랭킹 표시
- Related Files:
  - `src/game/GameScreen.tsx` :: 게임 종료 시 점수 저장 및 결과 화면 — 수정
  - `src/leaderboard/LeaderboardPanel.tsx` :: 상위 10개 표 — 신규
  - `src/game/GameScreen.test.tsx` :: 종료·저장·재시작 연결 검증 — 수정
  - `src/leaderboard/LeaderboardPanel.test.tsx` :: 정렬과 빈 상태 화면 검증 — 신규
- **Signatures & Types**:
  ```ts
  export function LeaderboardPanel(props: { entries: LeaderboardEntry[]; currentAccountId: string }): JSX.Element;
  ```
- **Data & Schema Fields**: `GameScreen`은 로그인 계정에서 `homeAccountId`와 `name`을 읽어 저장 함수에 전달한다. 계정 ID가 없으면 점수 저장을 시도하지 않고 오류 안내를 보여준다.
- **Execution Flow / Logic**:
  1. 상태가 `playing`에서 `game-over`로 처음 바뀐 시점에 최종 점수를 한 번 저장한다. React effect 재실행이나 렌더로 중복 저장하지 않도록 처리 완료 플래그를 둔다.
  2. 저장 성공 후 목록을 갱신하고 상위 10개를 보여준다. 현재 계정 행은 시각적으로 구분하고 점수, 표시 이름, 순위를 표시한다.
  3. 기록이 없으면 빈 랭킹 메시지를 보여준다. Entra 표시 이름을 그대로 사용하며 이메일은 표시하지 않는다.
  4. `다시 시작`은 `resetGame`으로 점수, 기회, 경로, 추격자, 이벤트를 초기화하고 같은 로그인 계정으로 새 판을 시작한다. 이미 저장한 최고 점수는 보존한다.
- **Error & Exception Handling**: 저장 실패 시 게임 종료 화면과 다시 시작은 계속 이용 가능하고 저장 실패 메시지를 노출한다. 저장된 기록 목록은 실패 전 상태 또는 빈 상태로 안전하게 렌더링한다.
- **State Transition & Return**: `game-over` 화면에서 결과·랭킹·재시작을 제공하며, 재시작 후 다시 `playing` 상태가 된다.

### I03. 저장소 테스트
- Related Files:
  - `src/leaderboard/leaderboard.test.ts` :: 중복 계정·동점·손상 데이터·저장 실패 — 수정
- **Data & Schema Fields**: 가짜 `Storage` 객체를 주입해 브라우저 환경에 의존하지 않는다.
- **Execution Flow / Logic**: 최고 점수만 남기기, 동점 시 먼저 얻은 기록 우선, 상위 10개 제한, 빈 저장소, 손상 JSON 초기화, storage 쓰기 예외 결과, 게임 오버에서 한 번만 기록하는지 검증한다.
- **Error & Exception Handling**: `getItem`, `setItem`, `removeItem` 각각의 예외를 테스트한다.

## Acceptance Criteria
- [ ] 로그인 사용자의 기록은 브라우저 로컬 저장소에서 계정별 최고 점수 하나로 유지된다.
- [ ] 상위 10개가 점수 내림차순으로 표시되고 동점은 먼저 달성한 점수가 앞선다.
- [ ] 세 번째 포획 뒤 게임 결과, 랭킹, 다시 시작 동작이 연결된다.
- [ ] 손상되거나 쓸 수 없는 저장소가 게임 플레이를 중단시키지 않는다.

## Validation
- `npm run test -- --run src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/game/GameScreen.test.tsx` — 저장 및 게임 종료 통합 테스트 통과.
- `npm run lint` — ESLint 오류 없음.
- `npm run build` — TypeScript 및 프로덕션 빌드 성공.
- 수동 확인: 서로 다른 MSAL 계정으로 플레이 후 현재 브라우저의 사용자별 최고 기록 목록과 재시작 동작 확인.

## Commit Message
```text
feat(leaderboard): save local best scores per Entra account

Plan: 2026-10-21-stair-climb-game
Phase: P01-local-game
Task: T04-local-leaderboard

- Persist one best score per signed-in account in localStorage
- Show the top ten and connect game-over and restart flows
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
