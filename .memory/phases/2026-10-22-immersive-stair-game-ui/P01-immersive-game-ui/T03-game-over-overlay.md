# Task: T03 게임 종료 오버레이와 뷰포트 확인

## Status: done

## Goal
게임 종료 시 계단 장면과 HUD를 게임 프레임 배경으로 유지하고, 최종 점수·TOP 10·다시 시작 버튼을 같은 프레임 안에 표시해 ready/playing/game-over 모두 독립 페이지 스크롤 없이 사용할 수 있게 한다.

## Decision Summary
- 기존 localStorage TOP 10 형식과 저장 로직을 유지한다. 이 작업은 순위 서비스나 픽셀 아트 변경을 하지 않고, 기존 결과 UI를 in-game overlay로 배치한다.
- 종료 UI와 leaderboard가 좁은 viewport에 맞지 않을 때만 leaderboard 내부에서 스크롤한다. 결과, 다시 시작, scene, HUD는 계속 표시한다.

## Implementation

### I01. 종료 화면을 프레임 내부로 이동
- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen` — status별 game-over overlay 구조; modify
  - `src/leaderboard/LeaderboardPanel.tsx` :: `LeaderboardPanel` — existing rank data presentation; reuse/read-only
  - `src/game/game.css` :: `.game-over-panel`, `.game-over-result`, `.leaderboard-card`, `.leaderboard-list`, `.game-layout`, `.scene-card`; modify
  - `src/game/GameScreen.test.tsx` :: game-over cases; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface LeaderboardEntry {
    accountId: string;
    displayName: string;
    bestScore: number;
    updatedAt: number;
  }
  ```
  `LeaderboardPanel`은 기존 `entries` 및 `currentAccountId` props를 그대로 받는다. `GameState.status`는 기존 `"ready" | "playing" | "game-over"` union을 유지한다.
- **Data & Schema Fields**:
  - local leaderboard schema, save-once ref, `saveBestScore` 호출, storage key는 변경하지 않는다.
  - 새로운 UI state/leaderboard fields를 추가하지 않는다.
- **Execution Flow / Logic**:
  1. `gameState.status === "game-over"`에서 기존 `StairScene`과 상단 `GameHud`를 유지하고 그 위에 result/leaderboard overlay를 그린다.
  2. result에 이번 점수, 계단 수, storage 오류 안내(있으면), `다시 시작` 버튼을 표시한다. 재시작은 기존 `handleStart`를 사용해 `resetGame()` 및 BGM start 동작을 유지한다.
  3. TOP 10은 기존 `LeaderboardPanel`로 표시한다. 목록이 사용 가능한 높이를 넘을 때 `.leaderboard-card` 내부만 `overflow:auto`로 스크롤한다.
  4. desktop은 scene을 크게 보이는 동안 결과/순위 카드를 읽을 수 있는 overlay grid로 배치한다. 720px 이하에서는 overlay를 세로/겹침형 compact 배치로 재구성하여 restart action이 보이게 한다.
  5. viewport 1440×900, 1280×720, 390×844, 390×667에서 ready, playing, game-over를 확인한다. document scroll은 viewport를 넘지 않아야 한다. game-over에서 결과, 재시작 버튼, TOP 10 카드 bounds가 프레임 내부이고 목록 scroll만 내부에 있어야 한다.
- **Error & Exception Handling**: storage save 실패 안내를 계속 보여주며 game-over UI 및 restart를 사용 가능하게 둔다. 낮은 높이에서도 결과 버튼이 잘리면 panel flex/grid track과 내부 padding을 줄이고, 필수 내용 자체를 숨기지 않는다.
- **State Transition & Return**: playing → game-over 이후 기존 점수 저장은 한 번만 실행된다. restart click은 ready를 거치지 않고 기존 동작대로 새 playing state를 시작하고 결과 오버레이를 닫는다.

### I02. 종료 UI와 모든 상태 테스트
- Related Files:
  - `src/game/GameScreen.test.tsx` :: `saves the final score once, shows the ranking, and restarts a fresh game`, `keeps the result and restart available when local storage fails`; modify

#### Details
- `game-over`에서 scene와 HUD가 여전히 존재하고 점수, TOP 10, restart가 게임 frame 내부 DOM에 포함되는지 검증한다.
- save-once와 실패 안내의 기존 assertion을 보존한다.
- 다시 시작 시 score 0, `playing` 상태, HUD 표시, 결과 overlay 제거를 검증한다.

## Acceptance Criteria
- [x] game-over에서 scene와 상단 HUD가 배경에 유지된다.
- [x] 결과, TOP 10, 다시 시작 UI가 하나의 게임 프레임 안에 표시된다.
- [x] 순위가 많을 때 leaderboard 내부만 스크롤되고 페이지 스크롤은 생기지 않는다.
- [x] 네 지정 viewport 및 세 게임 상태에서 주요 게임 영역이 보인다.
- [x] 저장 실패 및 재시작 기존 동작이 유지된다.

## Validation
- `npm test -- --run src/game/GameScreen.test.tsx src/leaderboard/LeaderboardPanel.test.tsx` — game-over, retry, leaderboard 테스트 통과
- `npm run lint` — ESLint 오류 없음
- `npm run build` — TypeScript 검사 및 Vite build 통과
- Browser check at 1440×900, 1280×720, 390×844, 390×667 — each ready/playing/game-over has no document-level overflow; game-over action visible; leaderboard scroll remains internal

## Commit Message
```text
feat(game): show results inside the stair scene

Plan: 2026-10-22-immersive-stair-game-ui
Phase: P01-immersive-game-ui
Task: T03-game-over-overlay

- Keep the stair scene and HUD behind the final result
- Fit ranking and retry controls inside the game frame
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in Git history
