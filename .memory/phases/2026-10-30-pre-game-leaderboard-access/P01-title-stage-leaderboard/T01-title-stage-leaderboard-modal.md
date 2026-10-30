# Task: T01 Title and Stage Leaderboard Modal

## Status: done

## Goal
타이틀 화면과 단계 선택 화면에서 같은 기존 TOP 10 랭킹을 모달로 열고, 닫은 뒤 같은 화면과 단계 선택 상태로 복귀하게 한다.

## Decision Summary
- 각 화면에 `랭킹 보기` 버튼을 두고, 기존 `LeaderboardPanel`을 재사용해 1~5단계 통합 TOP 10을 표시한다.
- 회사 앱은 `CompanyRecordsGate`가 제공한 회사 기록을 사용하고 로컬 데모는 브라우저 기록을 사용한다. 기록/API/정렬 규칙은 바꾸지 않는다.
- 모달은 픽셀 아트 게임 스타일, Escape/닫기/배경 클릭 닫기, 키보드 포커스 이동 제한 및 원래 버튼으로 포커스 복원을 지원한다.

## Implementation

### I01. 랭킹 모달 컴포넌트

- Related Files:
  - `src/leaderboard/LeaderboardDialog.tsx` :: `LeaderboardDialog` — 랭킹 카드의 모달 껍데기와 닫기 동작; new
  - `src/leaderboard/LeaderboardDialog.test.tsx` :: `LeaderboardDialog` tests — 역할, TOP 10 렌더링, 닫기/키보드 동작 검증; new
  - `src/leaderboard/LeaderboardPanel.tsx` :: `LeaderboardPanel` — 기존 랭킹 목록과 제목/정렬 렌더링; read-only
  - `src/leaderboard/leaderboard.ts` :: `LeaderboardEntry`, `getTopScores` — 로컬 TOP 10 정렬 규칙; read-only
  - `src/shared/companyRecords.ts` :: `SharedBest`, `getSharedTopScores` — 회사 TOP 10 정렬 규칙; read-only
  - `src/game/GameInstructionsDialog.tsx` :: `GameInstructionsDialog` — 기존 모달의 backdrop, dialog ref, 닫기 버튼 패턴; read-only

#### Details
- **Signatures & Types**:
  ```ts
  interface LeaderboardDialogProps {
    entries: LeaderboardEntry[];
    currentAccountId: string;
    scope: "browser" | "company";
    onClose: () => void;
    closeButtonRef: React.RefObject<HTMLButtonElement | null>;
    dialogRef: React.RefObject<HTMLElement | null>;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  }

  export function LeaderboardDialog(props: LeaderboardDialogProps): React.ReactElement;
  ```
- **Markup/Accessibility**:
  - Backdrop is a sibling wrapper with `className="leaderboard-dialog-backdrop"`; close only when `event.target === event.currentTarget`.
  - Dialog container uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby="leaderboard-title"`, supplied `dialogRef`, and supplied `onKeyDown`.
  - Header close button uses the supplied ref, `type="button"`, accessible name `랭킹 닫기`, visible `닫기` label, and `onClose`.
  - Render `<LeaderboardPanel entries={entries} currentAccountId={currentAccountId} scope={scope} />` exactly once inside the dialog. Do not sort or filter entries in the dialog.
- **Execution Flow / Logic**:
  1. Render existing `LeaderboardPanel` with the caller-selected record scope.
  2. Close on close-button click or backdrop-only mouse down.
  3. Let the caller's keyboard handler close on Escape and trap Tab within focusable modal controls, matching `GameScreen.onDialogKeyDown`.
  4. Do not create local ranking state, fetch another endpoint, write storage, or mutate game state.

### I02. Open the modal from both pre-game screens

- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen`, `activeDialog`, `openGameDialog`, `closeGameDialog`, `onDialogKeyDown` — modal state, origin ref, focus lifecycle and shared record selection; modify
  - `src/game/GameScreen.test.tsx` :: title/stage leaderboard integration tests — both entry points, data source, close return, and game-state preservation; modify
  - `src/game/StageSelectPanel.tsx` :: `StageSelectPanelProps`, `StageSelectPanel` — stage-screen ranking button; modify
  - `src/game/StageSelectPanel.test.tsx` :: `StageSelectPanel` tests — ranking trigger placement/availability and callback; modify

#### Details
- **Signatures & Types**:
  ```ts
  type ActiveGameDialog = "settings" | "instructions" | "leaderboard" | null;

  interface StageSelectPanelProps {
    // Existing fields remain unchanged.
    onOpenLeaderboard: (trigger: HTMLButtonElement) => void;
  }

  function openLeaderboard(trigger: HTMLButtonElement): void;
  function closeLeaderboard(): void;
  ```
- **Data**:
  - Existing `LeaderboardEntry` remains `{ accountId: string; displayName: string; bestStage: GameStage; bestScore: number; remainingTimeCs?: number; achievedAt: string }`.
  - `entries` passed to the dialog are `companyRecords?.entries ?? leaderboard`.
  - `scope` passed to the dialog is `usesCompanyRecords ? "company" : "browser"`.
  - No model, API route, persistent key, or ranking comparison changes.
- **Execution Flow / Logic**:
  1. Extend the existing active-dialog union and dialog-ref handling with `leaderboard` without changing settings/instructions behavior.
  2. Permit opening only while `gameState.status === "ready"` and the title/stage-selection controls are visible. The title screen starts in ready state; the stage selector is rendered in ready state.
  3. On each trigger, save its `HTMLButtonElement` in a dedicated return-focus ref, set active dialog to `leaderboard`, and do not call `handleEnterStageSelection`, `handleStart`, or reset game state.
  4. Render one `LeaderboardDialog` while `activeDialog === "leaderboard"`, passing the existing entries, current account ID, and scope above.
  5. On open, focus the modal close button. On close, clear the active dialog and return focus to the stored trigger. Existing Escape and Tab-loop behavior applies.
  6. Because title/stage selection is not a running game, do not add or subtract time and do not use the playing-only pause/recovery path.
  7. The title trigger is a third button in the existing `.game-title-actions` grid with accessible name `랭킹 보기`. The stage trigger uses the same label and is added after `시작하기` in `StageSelectPanel`.
  8. Keep the selected stage unchanged when the dialog is opened and closed. Keep the existing post-game `<LeaderboardPanel>` and `game-over` rendering unchanged.
- **Required Integration Cases**:
  - Title: clicking `랭킹 보기` opens a named modal, displays existing top entries, and close returns focus to the title ranking button without entering stage selection.
  - Stage selection: choose a different unlocked stage, open/close ranking, and verify selected stage and focus return are preserved; game remains ready.
  - Company scope passes the server-provided entries with `scope="company"`; local/demo scope passes browser entries with `scope="browser"`.
  - The modal is absent while playing, checkpointing, or on game-over; game-over continues to show its existing ranking.
  - Escape, close button, and backdrop click close; clicking dialog content does not close it. Tab and Shift+Tab stay within dialog controls.

### I03. Pixel theme and responsive layout

- Related Files:
  - `src/game/game.css` :: `.leaderboard-dialog-backdrop`, `.leaderboard-dialog`, header/close/content styles — base modal overlay and responsive layout; modify
  - `src/game/pixel-theme.css` :: `.stair-game.pixel-theme .leaderboard-dialog*` — pixel-art colors, hard edges, borders and mobile overrides; modify

#### Details
- Place the backdrop over the existing game scene using the same stacking context as instructions/settings dialogs; do not replace or hide the staircase background.
- Center the dialog, constrain width and viewport height, allow the ranking list to scroll inside it, and retain a reachable close button on small screens.
- Reuse existing pixel-theme variables and square-border/shadow conventions. Add reduced-motion-safe behavior; do not add animation that prevents immediate dismissal.
- Give the backdrop/dialog z-index above title/stage selection and below any global auth/error screen.

## Acceptance Criteria
- [x] Title screen and stage selection each expose a keyboard/touch-accessible `랭킹 보기` button.
- [x] Both open the same overall top 10 using existing ranking data, scope, and sort order.
- [x] Modal close, Escape, and backdrop behavior work, and focus returns to the exact opening button.
- [x] Closing from stage selection preserves the selected stage; opening/closing does not start, pause, or reset a run.
- [x] Existing game-over ranking, score/progress persistence, company API, auth behavior, and mobile controls remain unchanged.
- [x] Pixel theme and narrow viewport keep the list scrollable and close control visible.

## Validation
- `npm run test -- --run src/leaderboard/LeaderboardDialog.test.tsx src/leaderboard/LeaderboardPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/GameScreen.test.tsx --maxWorkers=2` — modal/component and full entry-point regression tests pass.
- `npm run lint` — no lint/type-related ESLint errors.
- `npm run build` — TypeScript and Vite production build pass.
- `git diff --check` — no whitespace errors.

## Commit Message
```text
feat(leaderboard): add pre-game ranking access

Plan: 2026-10-30-pre-game-leaderboard-access
Phase: P01-title-stage-leaderboard
Task: T01-title-stage-leaderboard-modal

- Add title and stage selection ranking buttons
- Reuse the existing top ten in an accessible modal
- Preserve the originating screen and selected stage
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 — targeted147/147, lint, build, diff check.
- commit: pending
