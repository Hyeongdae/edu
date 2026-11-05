# Decisions: Infinite Mode Pursuer Difficulty

- Date: 2026-11-05
- Status: Confirmed

## D01. Distance-based catch-up
- **Chosen**: Keep the distance catch-up rule. When the runner is at least 10 stairs ahead of the pursuer, the pursuer moves every 0.10 seconds regardless of score. Keep that speed until the gap closes to 6 stairs, then return to the score-based base speed.
- **Rationale**: The pursuer should pressure players who build a large lead while allowing the chase speed to normalize after it catches up.

## D02. Score-based base speed
- **Chosen**: Start at a 0.25-second pursuer movement interval. For each 50 points scored, reduce the base interval by 0.01 seconds, with a minimum of 0.10 seconds. Derive the interval from the current score so the 2x event counts toward thresholds.
- **Rationale**: Progressively increase difficulty as a run's score grows, with a fixed maximum speed.

## D03. Remove survival timer
- **Chosen**: Do not add a remaining-time countdown, per-step time recovery, or timeout death.
- **Rationale**: Difficulty will come from increasing pursuer speed instead of a separate survival timer.

## D04. Speed HUD
- **Chosen**: Show the effective pursuer speed in the infinite-mode HUD as seconds per stair, using two decimal places (for example, `0.25초/칸`). During distance catch-up, show the effective 0.10-second interval.
- **Rationale**: Make the score-based difficulty increase and temporary catch-up boost visible to players.

## D05. Pursuer animation timing
- **Chosen**: Match pursuer step animation duration to the effective movement interval so the animation stays in sync as the interval gets shorter.
- **Rationale**: Keep the visible chase pace aligned with the speed shown in the HUD.

## Scope
- Infinite mode only.
- Keep scoring, the 50-step 2x event, fall/caught endings, ranking, and the existing start/restart countdown behavior unchanged.
