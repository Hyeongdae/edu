# Task: T03 Infinite Mode UI and Integration

## Status: done

## Goal
Expose both modes from the title, make infinite gameplay playable on desktop/mobile, and connect its separate instructions and company ranking to T01/T02.

## Decision Summary
- Keep the current stage mode visually downward and behaviorally unchanged. Infinite mode uses its independent upward engine/scene, D/J only, a three-second start countdown, no stage timer, and no jump/obstacle UI.
- Title instructions and rankings are modal dialogs with separate Stage Mode/Infinite Mode tabs. Infinite rankings show score only and use dense shared ranks 1, 1, 2.
- Submit the infinite score exactly once at terminal game state through CompanyRecordBinding; do not save local leaderboard records.

## Implementation

### I01. Add infinite screen, HUD, and scene

- Related Files:
  - src/infinite/InfiniteModeScreen.tsx :: countdown, input, game/pursuer loop, audio, settings, terminal result; new.
  - src/infinite/InfiniteModeScreen.test.tsx :: screen start/input/fail/save/retry tests; new.
  - src/infinite/InfiniteHud.tsx :: score, stairs, pursuer distance, event gauge/time; new.
  - src/infinite/InfiniteHud.test.tsx :: score/event labels and progress boundaries; new.
  - src/infinite/InfiniteStairScene.tsx :: SVG and pixel rendering from InfiniteSceneModel; new.
  - src/infinite/InfiniteStairScene.test.tsx :: ascending art, no obstacles, player/pursuer animation; new.
  - src/infinite/infinite-mode.css :: mode layout and responsive scene/result styles; new.
  - src/game/StageTransitionCountdown.tsx :: optional mode label for stage-free countdown; modify.
  - src/game/StageTransitionCountdown.test.tsx :: preserve stage label and verify infinite label; modify.
  - src/audio/audioController.ts :: existing startBgm, stopBgm, playFootstep, playFall, setEventActive methods; read-only.
  - src/audio/AudioControls.tsx :: reuse current audio controls in settings; read-only.
  - src/company/CompanyRecordsNotice.tsx :: pending/error/retry status; read-only.

#### Details
- Props and countdown contract:
  ~~~typescript
  interface InfiniteModeScreenProps {
    account: GameAccount;
    companyRecords?: CompanyRecordBinding;
    audioController?: AudioController;
    audioPreferences?: AudioPreferences;
    autoplayBlocked?: boolean;
    onAudioPreferencesChange?: (next: AudioPreferences) => void;
    onEnableAudio?: () => void;
    onReturnToTitle: () => void;
  }
  export function InfiniteModeScreen(props: InfiniteModeScreenProps): ReactElement;
  type StageTransitionCountdownProps =
    | { stage: GameStage; label?: never; secondsRemaining: 1 | 2 | 3 }
    | { stage?: never; label: string; secondsRemaining: 1 | 2 | 3 };
  ~~~
- Props for InfiniteModeScreen:
  - account: GameAccount
  - companyRecords?: CompanyRecordBinding
  - audioController?: AudioController
  - audioPreferences?: AudioPreferences
  - onAudioPreferencesChange?: (next: AudioPreferences) => void
  - autoplayBlocked?: boolean
  - onEnableAudio?: () => void
  - onReturnToTitle: () => void
- Countdown component props become a compile-time union: either { stage: GameStage; secondsRemaining: 1 | 2 | 3 } or { label: string; secondsRemaining: 1 | 2 | 3 }. Existing stage rendering keeps the same label; infinite passes label="무한 모드 시작".
- Create one ready infinite state on entry. Show the shared numeric 3-2-1 overlay above the upward scene. Start engine and pursuer deadline only at countdown expiry. Ignore inputs and duplicate start/retry during countdown. Retry creates a new route and zero-score state, then repeats the countdown.
- Poll tickInfiniteGame every 50 ms while playing and reconcile on visibilitychange using Date.now and absolute deadlines. No stage countdown/time display or stage clear logic is used. Pause both pursuer and event deadlines while settings are open, then resume by shifting deadlines by the paused duration.
- Map keyboard D to forward and J to turn. Space is ignored and never calls jump. On mobile render only forward and turn actions with upward labels. Do not render the existing jump button in this mode.
- InfiniteHud shows current uncapped score, stairs climbed upward, pursuer distance, and 0–50 stair gauge. While active it shows remaining event seconds and 2x status. Use progressbar aria-valuemax 50.
- InfiniteStairScene uses buildInfiniteSceneModel and increasing route index/upward y coordinates, existing PixelOfficeBackdrop, PixelOfficer and PixelStair components. Render no obstacle node. Show the current turn/straight-run hint for D/J.
- Reuse the existing audio controller: start BGM from the click handler before countdown, play one footstep per successful physical stair, toggle event audio only on event state transitions, play fall/catch effects once, and stop BGM on terminal state. Keep audio preferences editable in infinite mode settings; settings pauses the endless clocks.
- On a wrong turn, game state becomes terminal immediately but retain fallEndsAt and display the fall for 500 ms before result overlay. On catch, retain the current 500 ms catch presentation then show result. Submit { score } exactly once on the terminal transition, even for zero. Result shows score, fall/catch reason, and stairs survived with Retry and Main Title actions.
- When cloud records are present, render CompanyRecordsNotice and allow its existing retry/status behavior without blocking result display. Local demo has no record binding and must not write a local ranking.

### I02. Add title mode routing without changing stage mode

- Related Files:
  - src/game/GameScreen.tsx :: title actions, active mode selection, shared instruction/ranking dialog props, infinite screen handoff; modify.
  - src/game/GameScreen.test.tsx :: title selection, stage flow preservation, return flow; modify.
  - src/game/game.css :: title mode button layout; modify.
  - src/game/pixel-theme.css :: responsive/pixel title actions and infinite mode layout; modify.

#### Details
- Add an active mode state for title/stage/infinite routing. The existing stage action is labeled Stage Mode and still calls the existing title-to-stage-selection transition. Keep highest-unlocked stage, stage preview, initial countdown and settings exactly as before.
- Add Infinite Mode action on the same title. Open InfiniteModeScreen over the existing office title art; do not route through StageSelectPanel and do not alter selected stage or stage progress.
- On infinite result Main Title, return to the existing title. Starting/retrying infinite must not mutate stage GameState, cloud highestClearedStage, stage best score, or stage route.
- Preserve title name, tagline, background, music startup rules, rank/guide button access, focus restoration, and existing stage result return/retry behavior.
- Keep hooks unconditional and mode-aware so leaving/re-entering the screen clears all timers/listeners and never causes a stale stage effect to advance infinite state.

### I03. Add mode tabs to instructions and ranking

- Related Files:
  - src/game/GameInstructionsDialog.tsx :: separate instruction tabs; modify.
  - src/game/GameInstructionsDialog.test.tsx :: content and keyboard tab coverage; modify.
  - src/leaderboard/LeaderboardDialog.tsx :: separate ranking tabs and props; modify.
  - src/leaderboard/LeaderboardDialog.test.tsx :: both category lists and tab behavior; modify.
  - src/leaderboard/LeaderboardPanel.tsx :: stage list preservation and infinite score-only list; modify.
  - src/leaderboard/LeaderboardPanel.test.tsx :: dense rank, score order, empty/current account cases; modify.
  - src/game/game.css and src/game/pixel-theme.css :: accessible pixel tabs and mode rank columns; modify.
  - src/company/types.ts :: read the T02 infiniteEntries binding; modify.

#### Details
- LeaderboardDialog takes stage entries and infinite entries separately and defaults to the stage tab. Selecting a tab changes only the displayed category.
- Preserve the stage list comparator, rank rows, fields and remaining-time display unchanged. Infinite list sorts score descending, displays name and score only, highlights the current account, and shows a top-10 badge/empty state.
- Assign dense visible rank by score: first entry is 1; if score differs from previous entry, rank is previous rank + 1; if equal, retain previous rank. Example [100, 100, 90] => [1, 1, 2]. Backend order among equal scores does not affect rank.
- Instructions dialog has Stage Mode and Infinite Mode tabs, defaulting to Stage Mode. Preserve the existing stage table and encouragement as-is. Infinite instructions state: D forward, J turn while advancing, Space unused, no obstacles/time/stage goal, 1 point per stair, every 50 stairs starts 30 seconds at 2x, base chase 0.3 seconds, 0.1 seconds while gap is at least 15 until gap is 6 or less, and a wrong turn/catch ends the run.
- Tabs use semantic tablist/tab/tabpanel roles, aria-selected, keyboard focus/activation, and preserve existing Escape, focus trap, close-button and trigger-return behavior for both dialogs.
- The title ranking popup reads stage entries and infiniteEntries from the same company binding but renders them independently. Local demo remains non-persistent and shows the existing local-play explanation for both lists.

## Acceptance Criteria
- [ ] Title exposes Stage Mode and Infinite Mode; existing stage selection/start/checkpoint/final ending remain unchanged.
- [ ] Infinite mode ascends, omits obstacle/jump/stage timer UI, starts on 3-2-1, and ends on a fall or catch after the visual animation.
- [ ] Score/event/chase HUD follows the T01 rules and mobile has forward/turn controls only.
- [ ] Title ranking and instructions each have separate mode tabs; stage ranking stays unchanged and infinite ties display 1, 1, 2.
- [ ] Hosted mode saves to T02 cloud API, while local demo does not persist leaderboard history.

## Validation
- npm run test -- --run src/infinite/InfiniteModeScreen.test.tsx src/infinite/InfiniteHud.test.tsx src/infinite/InfiniteStairScene.test.tsx src/game/StageTransitionCountdown.test.tsx src/game/GameScreen.test.tsx src/game/GameInstructionsDialog.test.tsx src/leaderboard/LeaderboardDialog.test.tsx src/leaderboard/LeaderboardPanel.test.tsx --maxWorkers=2 — infinite UI and preserved stage UI tests pass.
- npm run lint — lint/static checks pass.
- npm run build — production TypeScript/Vite build passes.
- npm --prefix api test -- src/playerRepository.test.ts src/handlers.test.ts && npm --prefix api run build — production record integration remains green.

## Commit Message
feat(game): add title-selectable infinite mode

Plan: 2026-11-03-infinite-score-mode
Phase: P01-infinite-mode
Task: T03-infinite-mode-ui

- Add ascending endless gameplay with mode-specific controls
- Add separate instruction and ranking tabs

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: pending
