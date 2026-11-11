# Task: T03 Add v1 and v2 Ranking Views

## Status: done

## Goal
Let players inspect stage mode, historical infinite-mode v1, and new infinite-mode v2 rankings in the existing ranking dialog. Select v2 by default and label versions with lowercase `v`.

## Decision Summary
- Show three accessible ranking tabs: `단계 모드`, `무한모드 v1`, `무한모드 v2`.
- Select `무한모드 v2` every time the dialog opens.
- v1 and v2 use independent arrays and labels; both show TOP 10, account name, score, current-player marker, and joint rank for tied scores.
- Keep infinite gameplay title/button names as `무한모드`; version suffixes distinguish ranking history only.

## Implementation

### I01. Extend leaderboard panel to render a selected ranking version
- Related files:
  - `src/leaderboard/LeaderboardPanel.tsx` :: `LeaderboardPanelProps`, `LeaderboardPanel`, ranked infinite entries - modify.
  - `src/leaderboard/LeaderboardPanel.test.tsx` :: infinite leaderboard tests - modify.
  - `src/leaderboard/leaderboard.css` and/or `src/infinite/infinite-mode.css` :: leaderboard tab/list responsive styles - modify only if three tabs need layout adjustment.
- Signatures and data:
  - Panel selector: `mode: "stage" | "infinite-v1" | "infinite-v2"`.
  - Entries: stage `LeaderboardEntry[]`; `infiniteV1Entries: SharedInfiniteBest[]`; `infiniteV2Entries: SharedInfiniteBest[]`.
- Details:
  - Render stage records via existing stage branch; render `infiniteV1Entries` only for v1 and `infiniteV2Entries` only for v2.
  - Keep score-descending order and dense shared rank numbers already implemented for infinite mode (`1, 1, 2`). Reuse `getSharedTopInfiniteScores` for both versions; do not combine arrays.
  - Render visible labels `무한모드 v1` / `무한모드 v2` in the panel and use version-specific empty-state copy. Do not change the title screen's game mode name.
  - Keep `현재 플레이어` highlighting and TOP 10 rendering for each version.
  - If the existing two-button tab CSS is not responsive with three labels, update only the affected tab layout; preserve dialog bounds, row sizing, and mobile scrolling.
- Tests:
  - v1 tab renders only v1 data and v2 tab renders only v2 data even when entries differ for the same account.
  - Empty v2 shows a v2-specific empty message while V1 history remains visible on the v1 tab.
  - Equal v2 scores render joint ranks `1, 1, 2`; top-10 behavior and current-player marker remain intact.

### I02. Add accessible three-way tabs and default to v2
- Related files:
  - `src/leaderboard/LeaderboardDialog.tsx` :: props, selected-tab state, `selectTab`, `onTabKeyDown`, and tabpanel - modify.
  - `src/leaderboard/LeaderboardDialog.test.tsx` :: default selection, switching, keyboard navigation, and accessible names - modify.
  - `src/App.tsx` :: ranking dialog props/data binding - modify only if the app shell passes ranking data directly.
  - `src/game/GameScreen.tsx` :: result/title/checkpoint ranking dialog instance - modify to pass independent v1/v2 lists.
  - `src/infinite/InfiniteModeScreen.tsx` :: infinite ranking dialog instance - modify to pass independent v1/v2 lists.
- Details:
  - Selected state type is `"stage" | "infinite-v1" | "infinite-v2"` and initializes to `"infinite-v2"`.
  - Add `infiniteV1Entries` and `infiniteV2Entries` props, each defaulting to `[]`; preserve existing `entries`, close behavior, dialog focus refs, and modal keyboard handler.
  - Give each tab a unique stable ID and `aria-controls="leaderboard-tabpanel"`; set `aria-selected`, `tabIndex`, and panel `aria-labelledby` from the selected mode.
  - ArrowRight/ArrowLeft cycles stage → v1 → v2 → stage and reverse, with wraparound. Home selects stage; End selects v2. Preserve Enter/Space activation and outer menu navigation behavior.
  - Pass the v1 and v2 lists independently from the company binding in all dialog instances. Browser/local mode must keep its existing non-persistent behavior and must not fabricate company rankings.
  - Keep the version labels exactly lowercase: `무한모드 v1`, `무한모드 v2`.
- Tests:
  1. On dialog open, v2 tab is selected and v2 panel content is visible.
  2. Stage/v1/v2 tabs switch content and never cross-contaminate entries.
  3. Arrow navigation wraps all three tabs; Home and End select first/last; tabpanel accessible label tracks selection.
  4. Existing close, backdrop, Escape, focus handling, and external directional menu navigation tests continue to pass.

## Acceptance Criteria
- [x] Ranking dialog exposes stage, `무한모드 v1`, and `무한모드 v2` rankings as separate accessible tabs.
- [x] The dialog opens on v2 and shows the v2 empty state until newly played v2 results are recorded.
- [x] V1 historical rows remain viewable and no v1 record appears in v2.
- [x] Infinite mode's game title/button remains `무한모드`; only ranking version labels include v1/v2.
- [x] Keyboard and responsive ranking tests pass.

## Validation
- `npm run test -- --run src/leaderboard/LeaderboardPanel.test.tsx src/leaderboard/LeaderboardDialog.test.tsx src/game/GameScreen.test.tsx src/infinite/InfiniteModeScreen.test.tsx`
- `npm run lint`
- `npm run build`
- `git diff --check`

## Commit Message
```text
feat(leaderboard): show separate infinite v1 and v2 rankings

Plan: 2026-11-11-infinite-mode-v1-v2-leaderboards
Phase: P01-versioned-infinite-rankings
Task: T03-versioned-ranking-ui

- Add separate historical v1 and current v2 ranking tabs
- Default the ranking dialog to infinite v2
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending

## Validation Notes (2026-11-11)
- Passed focused leaderboard/game regression tests: 139 tests across 4 files.
- Passed `npm run lint`, `npm run build`, and `git diff --check`.
- Existing Vite warning about the 673 kB JavaScript chunk remains; build succeeds.
- T01 Cosmos emulator integration remains unverified as recorded in T01.
