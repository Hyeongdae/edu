# Plan: Pursuer Follow Animation

## Goal
Make the existing pursuer visibly move one stair closer after each wrong input, and show a brief catch followed by a quick return to its starting position when it reaches the player. Keep the choreography inside the existing 500 ms recovery period, preserve game rules and stored data, and make the final catch visible before the game-over result panel appears.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `complete` | Add transient pursuer movement, catch and return choreography to the game scene. | [P01](../phases/2026-10-22-pursuer-follow-animation/P01-pursuer-follow-animation/phase.md) |

## Scope Notes
- The final score save and `game-over` game state remain immediate. Only the result panel is hidden while the catch animation runs.
- `GameState`, game rules, and localStorage format remain unchanged.
- Pixel art, new audio effects, and changes to the pursuer's game rules are out of scope.
