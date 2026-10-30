# Decisions: Score Cap, Stage Countdown, and BGM Volume

- Date: 2026-10-30
- Status: Confirmed

## D01. Cap new stage scores at the target
- **Chosen**: Clamp each stage's score to its target: stages 1–5 end at 150, 200, 250, 300, and 350 points respectively.
- **Rationale**: Bonus scoring must not produce a score above the stage's advertised clear target.

## D02. Leave previously saved scores for the user to edit
- **Chosen**: Apply the score cap to new gameplay and new submissions; do not rewrite existing ranking records as part of this change. The user will edit existing over-target records.
- **Rationale**: Preserve the user's control over previously stored ranking data.

## D03. Add a three-second countdown after continuing
- **Chosen**: After the player presses Continue at a cleared-stage checkpoint, keep the stair scene visible and show a large 3–2–1 countdown. Start the next stage only after the countdown finishes.
- **Rationale**: The player explicitly requested an intentional pause before starting the next stage.

## D04. Freeze gameplay clocks during the countdown
- **Chosen**: The next-stage timer and pursuer begin only after the countdown ends.
- **Rationale**: The countdown is a transition pause and should not consume the stage's limited time or create an unfair pursuer lead.

## D05. Lower the default BGM preference to 30%
- **Chosen**: Set the default BGM slider preference to 30%; preserve any volume preference already saved in the browser.
- **Rationale**: Lower the out-of-box music level while retaining players' explicit audio choices.
