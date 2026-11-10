# Task: T01 Add R Restart Hint

## Status: done

## Goal
Add an R-key restart explanation beside the existing D/J desktop controls in stage and infinite modes, and verify the existing R confirmation flow stays unchanged.

## Decision Summary
- Show `R 재시작` in the desktop control hint in both modes.
- Do not alter R key handling, confirmation dialogs, mobile touch controls, gameplay, or ranking behavior.

## Implementation

### I01. Add the hint to both game modes
- Related Files:
  - `src/game/GameScreen.tsx` :: `.desktop-control-hint` - append an `R` key badge and `재시작` label after the current D/J/Space instructions.
  - `src/infinite/InfiniteModeScreen.tsx` :: `.desktop-control-hint` - append the same `R 재시작` label after the current D/J instructions.
- Requirements:
  - Follow the existing markup convention: `<kbd>R</kbd>` plus Korean action text, separated from other controls by the existing dot separator.
  - Keep `.mobile-control-hint` unchanged.
  - Do not modify existing restart keyboard event logic.

### I02. Verify the visible labels and existing behavior
- Related Files:
  - `src/game/GameScreen.test.tsx` :: stage-mode controls/restart coverage - assert the desktop hint includes `R` and `재시작`; preserve tests for restart confirmation.
  - `src/infinite/InfiniteModeScreen.test.tsx` :: infinite-mode controls/restart coverage - assert the desktop hint includes `R` and `재시작`; preserve tests for restart confirmation.
- Requirements:
  - Cover both mode labels in rendered component tests.
  - Keep existing keyboard behavior tests intact.

## Acceptance Criteria
- [x] Stage mode displays `R 재시작` beside its keyboard control hints.
- [x] Infinite mode displays `R 재시작` beside its keyboard control hints.
- [x] R still opens the existing confirmation dialog; mobile controls are unchanged.
- [x] Focused tests, lint, build, and diff check pass.

## Validation
- `npm run test -- --run src/game/GameScreen.test.tsx src/infinite/InfiniteModeScreen.test.tsx` — 2 files, 123 tests passed.
- `npm run lint` — passed.
- `npm run build` — passed; existing >500 kB chunk-size warning remains.
- `git diff --check` — passed.

## Commit Message
```text
feat(controls): explain the R restart shortcut

Plan: 2026-11-10-r-keyboard-hint
Phase: P01-control-hints
Task: T01-add-r-hint

- Show R restart guidance in stage and infinite modes
- Preserve restart confirmation behavior
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending
