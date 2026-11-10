# Decisions: R Keyboard Hint

- Date: 2026-11-10
- Status: Confirmed

## D01. Show the R restart shortcut in game controls
- **Chosen**: Add `R Restart` to the desktop keyboard hints at the bottom of both stage mode and infinite mode.
- **Rationale**: The user asked to explain the existing R restart shortcut alongside the current D/J instructions.

## D02. Preserve existing restart behavior and mobile layout
- **Chosen**: Keep R's existing restart confirmation behavior unchanged. Add the hint to desktop keyboard instructions; do not change gameplay or mobile touch-control labels.
- **Rationale**: The request is to add an explanation, and R already opens the restart confirmation in both modes.

## Codebase findings
- `src/game/GameScreen.tsx` and `src/infinite/InfiniteModeScreen.tsx` render separate `.desktop-control-hint` elements for their respective modes.
- Both screens already handle R as a restart request that opens the existing confirmation dialog.
