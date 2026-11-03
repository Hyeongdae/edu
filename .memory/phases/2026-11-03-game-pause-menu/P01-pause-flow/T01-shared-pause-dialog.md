# Task: T01 Shared Pause Dialog

## Status: done

## Goal
Provide one accessible, pixel-themed pause dialog that both game modes can use for resume, restart confirmation, and title confirmation.

## Decision Summary
- The dialog is parent-controlled so both game modes own their timer and navigation state. A shared pause icon and the same CSS dialog styles keep the two modes visually consistent.
- `아니오` returns to the pause menu. `Escape` cancels a confirmation back to that menu; from the menu itself it requests resume so the mode can run its 3-second countdown.

## Implementation

### I01. Shared dialog and icon

- Related Files:
  - `src/game/PauseMenuDialog.tsx` :: `PauseMenuDialog`, `PauseMenuConfirmation`, `PauseMenuDialogProps` — shared menu and confirmation content; new
  - `src/game/PauseMenuDialog.test.tsx` :: `PauseMenuDialog` tests — verify dialog options and confirmation transitions; new
  - `src/game/pixel/PixelIcon.tsx` :: `PixelIconName`, `ICON_PATHS` — add pause glyph; modify
  - `src/game/pixel-theme.css` :: `.game-pause-button`, `.pause-menu-backdrop`, `.pause-menu-dialog`, action styles — position pause control beside settings and style modal; modify

#### Details
- **Signatures & Types**:
  ```typescript
  export type PauseMenuConfirmation = "restart" | "title" | null;

  export interface PauseMenuDialogProps {
    modeName: string;
    confirmation: PauseMenuConfirmation;
    onResume: () => void;
    onRequestRestart: () => void;
    onRequestTitle: () => void;
    onConfirm: () => void;
    onCancelConfirmation: () => void;
  }

  export function PauseMenuDialog(props: PauseMenuDialogProps): ReactElement;
  ```
- **Data & Schema Fields**:
  - `PauseMenuConfirmation`: `"restart" | "title" | null`; `null` shows the pause actions, `restart` and `title` show the corresponding confirmation prompt.
  - `PixelIconName`: add `"pause"`; SVG viewBox remains `0 0 16 16` and uses the existing crisp-edge icon convention.
- **Execution Flow / Logic**:
  1. With no confirmation selected, show `게임 재개`, `다시시작`, and `타이틀로 돌아가기` actions.
  2. Restart/title action changes the controlled confirmation type and shows a contextual question with `예` and `아니오` buttons.
  3. `예` calls `onConfirm`; `아니오` calls `onCancelConfirmation` and returns to the pause action list.
  4. Escape while confirming calls `onCancelConfirmation`; Escape on the action list calls `onResume`.
  5. Use a `role="dialog"`, `aria-modal="true"`, labelled heading, focus the first action on open, and trap Tab/Shift+Tab within the dialog. Clicking the backdrop does not dismiss the pause.
  6. The pause button remains a compact 44×44 control; callers decide visibility and place it adjacent to the existing settings button.
- **Error & Exception Handling**:
  - The component has no persistence or timers; it only calls the supplied callbacks. It must not silently close on backdrop click.
- **State Transition & Return**:
  - Confirmation changes are controlled by the parent; the dialog itself does not mutate mode or game state.

### I02. Component verification
- Related Files:
  - `src/game/PauseMenuDialog.test.tsx` :: menu, confirmation, keyboard/focus tests — new
#### Details
- Verify both confirmation variants render the matching question; `예`/`아니오` call the correct callbacks once.
- Verify Escape cancels confirmation and Escape in the menu requests resume.
- Verify Tab and Shift+Tab remain within the dialog and focus begins on the primary action.

## Acceptance Criteria
- [ ] Both modes can render the same pause menu and confirmation interface.
- [ ] Dialog keyboard behavior and focus remain accessible without relying on browser-native confirmation dialogs.
- [ ] Pause icon follows the existing pixel icon rendering convention.

## Validation
- `npm test -- src/game/PauseMenuDialog.test.tsx` — focused dialog tests pass.
- `npm run lint` — no ESLint errors.
- `npm run build` — TypeScript check and production build pass.

## Commit Message
```text
feat(game): add shared pause dialog

Plan: 2026-11-03-game-pause-menu
Phase: P01-pause-flow
Task: T01-shared-pause-dialog

- Add accessible pause and confirmation dialog
- Add pixel pause icon and shared modal styling
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
