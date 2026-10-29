# Task: T02 Title Copy and Capture Integration

## Status: done

## Goal
Show the new office animation only after a pursuer capture, automatically reveal the unchanged recorded result afterward, and replace the title subtitle with the exact confirmed wording. Verify both screen behavior and the visible character action.

## Decision Summary
- Depends on completed T01, which provides the standalone scene, dedicated poses, and lifecycle hook.
- Normal caught timeline: existing staircase catch for 500 ms, office scene for 2,000 ms, then result/leaderboard. Reduced motion provides the result plus static office illustration immediately.
- The ranking is determined/saved when capture occurs, independent of animation completion. Five-stage success retains its existing separate four-second exit ending.

## Implementation

### I01. Integrate the caught presentation and title subtitle

- Related Files:
  - `src/game/GameScreen.tsx` :: subtitle JSX, hook call, foreground/result branches, restart focus, frame attributes, background semantics — modify.
  - `src/game/overtime-capture-ending.css` :: active-frame background/interaction selectors — modify.
  - `src/game/useOvertimeCaptureEnding.ts` :: T01 hook contract — read-only.
  - `src/game/OvertimeCaptureEnding.tsx` :: T01 animated/complete component — read-only.
  - `src/game/game.css`, `src/game/pixel-theme.css` :: existing caught-result visibility and mobile layout rules — read-only.
  - `src/game/gameEngine.ts`, `src/game/types.ts`, `src/game/useOfficeExitEnding.ts`, `src/game/OfficeExitEnding.tsx`, `src/leaderboard/leaderboard.ts` — read-only.

#### Details
- **Signatures & Types**:
  ```typescript
  // T01 contract; do not change it during integration.
  useOvertimeCaptureEnding(result: StageResult | null, nowMs: number): {
    phase: "none" | "capture" | "overtime" | "complete";
    sceneStartedAtMs: number | null;
    prefersReducedMotion: boolean;
  };
  OvertimeCaptureEnding(props: {
    variant: "animated" | "complete";
    startedAtMs?: number;
  }): ReactElement;
  ```
- **Data & Schema Fields**:
  - Existing GameScreen state `nowMs` is updated by inputs, the 50 ms game interval, and visibilitychange. Pass this to the new hook beside the existing `useOfficeExitEnding(stageResult)` call.
  - Add derived booleans `isOvertimeEnding = overtime.phase === "overtime"`, `isCaughtPresentationPending = overtime.phase === "capture" || isOvertimeEnding`, and `isForegroundEnding = isEnding || isOvertimeEnding`.
  - Preserve the existing `pursuerCatchVisible` calculation for scene motion suppression. Set frame `data-pursuer-catching` to `pursuerCatchVisible && overtime.phase !== "complete"`, so a reduced-motion completed result is not blocked by the engine's still-pending captureEndsAt.
  - Add `data-overtime-ending={isOvertimeEnding}`; retain `data-office-ending={isEnding}` for successful exit behavior.
  - No new GameState/status fields, persisted fields, snapshots, stage thresholds, or storage migrations.
- **Execution Flow / Logic**:
  1. Change only the visible title subtitle to exactly `계단을 내려가 1층까지 도착해 퇴근하세요!`. Preserve the title text, two actions, shared stair scene, and its 200 ms transition.
  2. Keep ready/playing/checkpoint branches as they are. In game-over rendering: existing isEnding success branch first; caught capture phase renders no result/office overlay so the staircase catch remains visible; caught overtime phase renders the animated OvertimeCaptureEnding; otherwise render the existing game-over result and leaderboard.
  3. Key the animated office component by the caught result identity/endedAtMs so another run creates a fresh animation. Pass the non-null hook sceneStartedAtMs as startedAtMs; do not pass result.endedAtMs directly because the office starts 500 ms later.
  4. In the result column, when the result is caught and reduced motion is currently enabled, render OvertimeCaptureEnding variant complete as a static illustration. Normal completed animations reveal the ordinary existing result panel. Keep existing result reason/score/stage/time wording and success illustration.
  5. During overtime, mark the retained game-stage and footer aria-hidden/inert, using isForegroundEnding alongside the existing title check. Disable the settings trigger during either caught presentation phase as well as its existing ready/checkpoint/success-ending conditions. The office modal becomes the accessible foreground.
  6. Add CSS under the new data-overtime-ending marker to hide the game-stage/footer/settings visually and disable pointer interaction behind the opaque scene. Scope to this new state; do not modify the success-ending selectors, ordinary game-over layout, or standalone descent-test styles.
  7. Result/restart controls are not mounted during normal capture/overtime. Adapt the existing restart focus effect to require game-over, no success ending, and no caught presentation pending. For a reduced-motion complete result, focus restart immediately even if engine captureEndsAt has not yet elapsed.
  8. Guard handleShowStageSelection against a pending caught presentation, so a stale/programmatic invocation cannot reset the game behind the scene. Once results appear, preserve its existing resetGame/readKnownHighest/stage selection behavior and allow another run to play a fresh office scene.
  9. Do not move or duplicate the existing saveBestScore effect. It depends on the frozen stageResult and saves immediately at capture; finishing the office scene must not perform a second write. Existing storage errors are displayed with results after the presentation.
  10. Keep game-over stopBgm behavior and all existing sound ownership. No new BGM/playFall/playFootstep request from office mount or completion.
  11. Core status is game-over throughout capture and overtime. D/J/Space cannot call the engine or change the record, score, stage time, or chase during the sequence.
  12. Existing private engine capture duration is 500 ms. Do not extend captureEndsAt to 2,500 ms, change RECOVERY_DURATION_MS, keep the engine playing during the scene, or delay the endedAtMs/remainingTimeCs snapshot.
  13. On a delayed visibility update after the full 2,500 ms deadline, show results directly. On a live motion-reduction change, end the presentation immediately; turning motion back on must not replay the same caught result.

### I02. Meaningful screen regression coverage

- Related Files:
  - `src/game/GameScreen.test.tsx` :: title assertion, capture timeline, result persistence, focus, success-ending coexistence, reduced motion and retry — modify.
  - `src/game/OvertimeCaptureEnding.test.tsx` :: completed T01 contracts — read-only unless an integration-discovered defect requires a targeted correction.
  - `src/game/OfficeExitEnding.test.tsx`, `src/game/StageSelectPanel.test.tsx` — regression validation, read-only.

#### Details
- Existing test render helper bypasses the title by temporarily returning matchMedia matches true only around the title click. It does not express the intended preference for the ending hook. New animated ending tests must install a full media-query mock before mounting, including addEventListener/removeEventListener; use renderBase and explicitly complete the title transition where useful.
- Test the caught sequence with a controlled clock and an actually generated/valid pursuit state (seedReadyStage/withPursuitAt fixtures already exist):
  1. Capture at t: engine status and frozen ranking result are already game-over/caught, storage has one write, staircase pursuer is caught, and no office/result overlay appears yet.
  2. At t+499 ms the staircase catch remains. At t+500 ms the office dialog appears, the background is inert/hidden, settings is disabled, and result/restart is absent.
  3. At t+2,499 ms office remains. At t+2,500 ms it is removed and ordinary results/ranking appear with restart focus.
  4. Stored result bytes and remainingTimeCs never change across the scene; no extra ranking write or new sound request occurs. Input dispatch does not call applyInput during the game-over scene.
- Cover stages 1–5 caught, with exact boundaries in one representative case; do not duplicate the entire expensive clock test for each stage.
- Initial reduced motion shows the static final office/result and restart focus without waiting for engine captureEndsAt. Live reduction during capture or office finishes immediately, and turning it off does not replay.
- Retry after completion clears the old presentation and returns to stage selection with existing unlock defaults and zero-score preview. The next actual capture can play again.
- Late visibility update beyond the end goes straight to results; mid-window late entry aligns the office component's startedAtMs and negative animation delay.
- Unmount/remount under StrictMode cleans up timeouts and media listeners; a cancelled old scene cannot complete a later result.
- Preserve the title's exact two actions, shared scene identity, guide behavior, and newly specified exact subtitle.
- Update affected old caught-result assertions that assumed result visibility or restart after only 500 ms: await the full presentation if testing the normal flow, or explicitly mock reduced motion if testing immediate reduced-mode restart. Preserve immediate save assertions at t; do not postpone those to match the visual delay.
- The existing office-exit integration case that includes caught must now allow the additional caught-only presentation before asserting restart, while still proving the successful office-exit component never appears for caught.
- Keep timeout, quit, checkpoint, stage-five success (four seconds), storage-error fallback, and keyboard/touch mappings covered. Do not hide failures by globally enabling reduction, increasing test timeouts, skipping tests, or deleting old assertions without equivalent coverage.

### I03. Browser visual acceptance

- Related Files:
  - `src/game/OvertimeCaptureEnding.tsx`, `src/game/pixel/OvertimeOfficer.tsx`, `src/game/overtime-capture-ending.css` — inspect T01 output; make only feature-local corrections justified by the visual check.
  - This Task blueprint :: validation evidence note — update after checking.

#### Details
1. Use the existing authorized local development/demo access or signed-in development session. Use the actual development-server URL. Do not change Entra/env/auth configuration or publish the app as part of this feature.
2. Check at 1440×900 and 390×667 (and a narrow 320 px viewport if text/layout clips): exact title subtitle is readable, title-to-stage flow still works, and idle play leads to a real pursuit capture.
3. Observe or capture the office sequence at its grab, drag, seated drop, and final slumped moments. A browser animation inspector or temporary external fixture may freeze/scrub the animation; keep diagnostics out of committed app code.
4. Confirm the pursuer visibly holds the protagonist's arm; both travel toward the desk; the chair and bent seated legs align; the lowered head is clear. Confirm desk, monitor glow, papers, and neon windows are recognizable, not hidden behind the actors or overlay.
5. Check that the office fills the frame during its two seconds and results become usable afterward without root overflow. Mobile text/buttons remain readable and tappable.
6. Emulate reduced motion: no moving sequence or two-second delay; static final illustration and result/restart are immediately usable. Check keyboard focus in the office and then the restart button; background settings cannot receive focus during the office scene.
7. Record the actual browser/viewport/evidence path and whether the real animation was observed. DOM-only tests do not establish visual quality. If browser inspection is genuinely unavailable, report that limitation explicitly rather than claiming visual acceptance.

## Acceptance Criteria
- [x] Title subtitle exactly matches the requested sentence.
- [x] Only a caught result shows the existing 500 ms catch followed by the two-second office sequence and then results automatically.
- [x] Arm grab, dragging, chair drop, and slumped seated final pose use the unchanged T01 artwork; standalone visual evidence exists from T01. Main-game visual inspection is limited as recorded below.
- [x] Reduced motion skips moving presentation and waits, shows the final illustration with results, and never replays an already consumed capture.
- [x] Recorded stage/score/remaining time and storage writes remain fixed at capture; scene completion adds no sound or save.
- [x] Dialog/background semantics and restart focus match the currently visible screen in integration coverage.
- [x] Retry/new runs, title/guide, timeout/quit/checkpoint, successful exit, and touch input remain covered. Main-game mobile layout has not been visually revalidated in T02.
- [x] Required targeted tests, lint, build, and the browser-check limitation have recorded outcomes.

## Validation
- `npm.cmd test -- --run src/game/OvertimeCaptureEnding.test.tsx src/game/GameScreen.test.tsx src/game/OfficeExitEnding.test.tsx src/game/StageSelectPanel.test.tsx --maxWorkers=2` — feature and existing screen/exit/selection regressions pass.
- `npm.cmd run lint` — no lint errors.
- `npm.cmd run build` — TypeScript and production build pass.
- Browser checks in I03 — record desktop/mobile, normal/reduced motion, and visible action evidence. No new test dependency or config change is required.

## Commit Message
```text
feat(game): show overtime ending after capture

Plan: 2026-10-29-title-copy-and-overtime-capture
Phase: P01-overtime-capture
Task: T02-title-copy-and-capture-integration

- Change the title subtitle and connect the caught-only office scene
- Preserve captured rankings, reduced-motion results and retry focus
```

## Progress
- [x] Implementation complete
- [x] Required automated validation passed; browser limitation documented
- commit: pending

## Validation Results (2026-10-30)
- Final exact four-file validation command: **182/182 tests passed, 4/4 files, no skips**, 60.32 s. The earlier filtered diagnostic run is not the final acceptance run.
- Added GameScreen integration coverage for exact 499/500/2,499/2,500 ms boundaries, all five caught stages, immediate captured-result storage, unchanged saved bytes/time, no extra input/audio, initial/live reduced motion, retry/fresh scenes, late visibility entry/expiry, and pending-scene unmount/remount cleanup.
- Updated old result-at-500-ms tests to wait for the office scene or explicitly request reduced motion. Kept immediate storage assertions at capture, before animation completion. Test cleanup flushes React's zero-delay work before asserting there are no remaining timers; it does not advance future animation deadlines to conceal leaks. Lifecycle hook and artwork remain unchanged from T01.
- `npm.cmd run lint`: exit 0. `npm.cmd run build`: exit 0; 223 modules, JS 583.75 kB (gzip 163.01 kB), CSS 75.93 kB (gzip 13.42 kB). This includes the newly connected office modules. The existing bundle-size concern remains outside scope.
- Local demo: `http://127.0.0.1:5176/` returned HTTP 200; served auth module has the development-only demo flag enabled, and the served GameScreen module imports the office scene and connects its active-frame marker. Existing protected development server at port 5175 was retained. Demo mode was enabled only in the new server process environment; no auth/env/config file changed.
- **Browser-check limitation:** automatic approval review rejected the compound browser-check/owned-headless-Chrome launch command with `blocked by policy`. No separate browser tool is available. The denied browser action was not retried through another launcher; no browser was created by that rejected command. Therefore T02 does not claim actual desktop/mobile gameplay screenshots or real-browser visual acceptance. T01's existing standalone Chrome evidence still documents the unchanged artwork.
- Evidence: `%TEMP%\overtime-t02-2026-10-30\` contains the final test log and diagnostic logs plus `validation-summary.json`. The user can exercise the integrated main game at the demo link: title → 게임 시작 → 시작하기 → wait for the pursuer to catch the player. Reduced-motion users receive the static final office with results immediately.
- Out-of-scope findings: no new adjacent production defect found. The already recorded stale App.test.tsx initial-screen assumptions were not changed or included in this targeted validation.
