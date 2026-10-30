# Plan: Score Cap, Stage Countdown, and BGM Volume

## Goal
Ensure newly played stages end at their exact target score, add a fair three-second pause before each continued stage, and lower the default background music preference without overwriting saved player settings.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | Cap scoring, implement the checkpoint countdown, and lower the default BGM preference. | [P01](../phases/2026-10-30-score-cap-stage-countdown-bgm/P01-gameplay-polish/phase.md) |

## Confirmed Decisions
- New scores are capped at the target for every stage: 150, 200, 250, 300, and 350.
- Previously saved over-target records are left untouched; the user will correct them manually.
- After Continue, show a large 3–2–1 over the stair scene; start the next stage after the countdown.
- The next-stage timer and pursuer begin only after the countdown.
- Default BGM preference becomes 30%; saved browser preferences remain unchanged.

## Implementation Order
1. T01 caps in-game and server-accepted scores at each stage target.
2. T02 adds the checkpoint countdown and delays the next stage clocks.
3. T03 sets the default BGM preference to 30% while preserving stored preferences.

## Deployment Note
Before deploying T01's stricter stored-record validation, manually correct any Cosmos player documents whose `bestScore` exceeds the target for `bestStage`. This plan must not edit existing ranking documents.
