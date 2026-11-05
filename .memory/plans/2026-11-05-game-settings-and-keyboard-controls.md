# Plan: Game Settings and Keyboard Controls

- Date: 2026-11-05
- Status: in_progress
- Decision: [Game Settings and Keyboard Controls](../decisions/2026-11-05-game-settings-and-keyboard-controls.md)

## Goal
Make the existing audio settings reachable on title/ready/checkpoint/gameplay screens in both game modes, and provide `Escape` pause and confirmation-based `R` restart shortcuts (`Enter` confirms) that reuse existing countdown and pause behavior.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | Settings entry points and shared keyboard behavior in both modes | [P01](../phases/2026-11-05-game-settings-and-keyboard-controls/P01-settings-and-hotkeys/phase.md) |

## Tasks and Order
| Task | Observable outcome | Principal files |
| :--- | :--- | :--- |
| T01 | Audio settings open from title/ready/checkpoint/playing, and `Escape`/`R` route through existing pause and restart confirmation flows in both modes | `src/game/GameScreen.tsx`, `src/infinite/InfiniteModeScreen.tsx` |

T01 is the only task. R opens the existing restart confirmation and Enter activates the focused affirmative button. Preserve the existing 3-second countdown, pause timing, stage-checkpoint restart target, sound preference persistence, and text-entry/dialog keyboard handling.

## Validation
- Run focused settings and keyboard tests for `GameScreen` and `InfiniteModeScreen` if requested, then lint/build if requested.
- Inspect the diff to ensure keyboard shortcuts do not fire behind dialogs or while typing, and settings are locked during countdowns.
- Do not alter audio storage, game scoring/rules, ranking, stage timers, or pause confirmation wording.

## Progress
- done: 0/1
- Active: P01-T01
- T01 implementation is complete and `git diff --check` passes. Tests/build were not run; keep the task active until validation is requested/completed.
