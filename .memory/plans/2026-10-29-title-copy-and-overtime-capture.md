# Plan: Title Copy and Overtime Capture

## Goal
Change the title subtitle to `계단을 내려가 1층까지 도착해 퇴근하세요!` and add a two-second pixel office sequence after a pursuer capture. The older employee grabs the young employee's arm, pulls them to a desk, and the protagonist sits down and lowers their head. Show the existing results automatically afterward, preserving the result recorded at capture.

## Source Decisions
[Confirmed decisions](../decisions/2026-10-29-title-copy-and-overtime-capture.md)

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `completed` | Built and integrated the office scene, capture/result lifecycle and title subtitle; browser-check limitation recorded in T02. | [P01](../phases/2026-10-29-title-copy-and-overtime-capture/P01-overtime-capture/phase.md) |

## Task Order
1. T01 creates an independently renderable office scene, dedicated character poses, and a timestamp-based presentation hook with focused tests.
2. T02 connects the completed scene to GameScreen, changes the exact title subtitle, updates affected integration tests, and checks the visible animation in a browser.

## Progress
- done: 2/2; no active task. T01 completed at `4e41af6` with 33 tests, lint, build, and standalone visual inspection passing. T02 completed at `10e1ac4` (2026-10-30) with 182/182 targeted tests, lint, build, and HTTP/module verification passing. Main-game browser inspection was blocked by automatic approval review; no T02 visual acceptance is claimed.

## Scope and Invariants
- Normal timeline relative to caught result: 0–499 ms existing staircase catch; 500–2,499 ms office scene; at 2,500 ms existing result and leaderboard.
- A reduced-motion preference skips these presentation waits and shows the final office illustration with the result.
- No new GameStatus, GameState, storage schema, scoring rule, chase speed, stage unlock, auth configuration, or audio asset.
- Stage-five successful office-exit ending remains a separate four-second presentation.
- Save ranking immediately from the immutable caught StageResult; do not save again when the office scene completes.
- The existing standalone descent-test entry is outside this main-game feature.

## Out-of-scope Observation
`src/App.test.tsx` still queries audio settings, sliders, account text, and the old stage-start button directly on the initial authenticated screen. The current initial screen is the title with two actions, so those assertions appear to predate that UI. This observation is not a test execution result. Updating that existing test suite is not added to this plan; report it separately to the user.
