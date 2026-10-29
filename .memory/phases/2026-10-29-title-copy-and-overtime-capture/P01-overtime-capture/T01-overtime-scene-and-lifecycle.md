# Task: T01 Overtime Scene and Lifecycle

## Status: done

## Goal
Provide a standalone, accessible two-second pixel office scene and a presentation hook that distinguishes the existing staircase catch, office animation, and completed result. The scene must visibly depict the older employee grabbing the young employee's arm, pulling them to a desk, and the protagonist sitting with a lowered head.

## Decision Summary
- D02–D04: Keep the existing approximately 500 ms staircase catch, then play a 2,000 ms nighttime office sequence before results.
- D05–D07: This is presentation only. Use immutable StageResult timing, clean up timers, honor reduced motion, and reuse the existing pixel character designs.
- This task creates standalone modules; GameScreen integration and the title subtitle belong to T02.

## Implementation

### I01. Caught-result presentation lifecycle

- Related Files:
  - `src/game/useOvertimeCaptureEnding.ts` :: exported constants, types, `useOvertimeCaptureEnding` — new.
  - `src/game/types.ts` :: `StageResult` — read-only.
  - `src/game/gameEngine.ts` :: `tickGame`, private `RECOVERY_DURATION_MS = 500` — read-only reference.
  - `src/game/useOfficeExitEnding.ts` :: existing reduced-motion and result-timestamp convention — read-only.

#### Details
- **Signatures & Types**:
  ```typescript
  export const OVERTIME_STAIR_CAPTURE_MS = 500;
  export const OVERTIME_CAPTURE_DURATION_MS = 2_000;
  export type OvertimeCapturePhase = "none" | "capture" | "overtime" | "complete";
  export interface OvertimeCaptureEndingState {
    phase: OvertimeCapturePhase;
    sceneStartedAtMs: number | null;
    prefersReducedMotion: boolean;
  }
  export function useOvertimeCaptureEnding(
    result: StageResult | null,
    nowMs: number,
  ): OvertimeCaptureEndingState;
  ```
- **Data & Schema Fields**:
  - Existing `StageResult` has readonly `stage: 1|2|3|4|5`, `score: number`, `remainingTimeCs: number`, `endedAtMs: number`, and `outcome: "cleared"|"caught"|"time-limit"`.
  - Eligible only when `result?.outcome === "caught"`; all five stages are eligible.
  - Return `phase: "none"` and `sceneStartedAtMs: null` for null, cleared, or time-limit results.
  - For a caught result, office start is `result.endedAtMs + OVERTIME_STAIR_CAPTURE_MS`; office completion is that start plus `OVERTIME_CAPTURE_DURATION_MS`.
  - The private engine recovery constant currently equals 500 ms for both falls and catches. The new exported presentation constant records this existing capture contract. Do not change/export the core recovery constant or change fall timing in this task.
  - All lifecycle state stays in the hook. No GameState fields, persistent keys, ranking fields, or global mutable playback state.
- **Execution Flow / Logic**:
  1. Safely create one media-query object for `(prefers-reduced-motion: reduce)` per hook instance, following useOfficeExitEnding. Missing or throwing matchMedia means reduced motion is false. Register/remove a change listener when supported.
  2. Keep a boundary clock state initialized from Date.now, plus the current reduced-motion state and a completed/consumed result reference. The caller supplies current wall time as `nowMs`; derive presentation time using the later of caller time and the boundary clock. This lets a visibility/input update settle a delayed scene immediately.
  3. For an eligible result that is reduced or consumed, return complete immediately. Otherwise return capture before office start, overtime from office start (inclusive) until completion (exclusive), and complete at/after completion.
  4. When capture or overtime is active, schedule at most one timeout for the next absolute boundary using `Math.max(0, boundaryAtMs - Date.now())`. Its callback updates the boundary clock from Date.now, allowing a late callback to skip already elapsed phases. Schedule no animation-frame loop or polling interval.
  5. Effect cleanup cancels the boundary timeout on result replacement, phase change, reset, and unmount. Parent rerenders must never restart the 500/2,000 ms windows. A late mount or a nowMs jump beyond the deadline must not replay the scene.
  6. Enabling reduced motion while capture/overtime is pending completes that result immediately. A result arriving while reduced motion is on is also consumed; turning reduction off must not replay that same result. A later new caught result may play normally after reduction is off. Use the result reference, as the existing success-ending hook does; do not clone the result per render.
  7. Do not start/stop audio, save rankings, mutate result times, or call any engine transition from this hook.

### I02. Dedicated pixel character artwork

- Related Files:
  - `src/game/pixel/OvertimeOfficer.tsx` :: scene-specific posed character artwork — new.
  - `src/game/pixel/PixelOfficer.tsx` :: `OfficerVariant`, current head/clothing palette and proportions — read-only.
  - `src/game/pixel/pixel-scene.css` :: global officer-frame selectors to avoid — read-only.

#### Details
- **Signatures & Types**:
  ```typescript
  export type OvertimeOfficerPose = "standing" | "grabbing" | "dragged" | "seated";
  export interface OvertimeOfficerProps {
    variant: OfficerVariant; // type-only import from ./PixelOfficer
    pose: OvertimeOfficerPose;
  }
  export function OvertimeOfficer(props: OvertimeOfficerProps): ReactElement;
  ```
- **Data & Schema Fields**:
  - Pure SVG artwork with `className="overtime-officer"`, `data-officer-variant`, `data-overtime-pose`, `shapeRendering="crispEdges"`, and `aria-hidden="true"`.
  - Match the existing approx. 64-by-80 rendered character proportions and foot baseline at local y=0; use the existing young/older head silhouettes, hair, older character's glasses/gray hair, shirt/tie colors, and ID badges.
  - Do not add poses to the shared OfficerPose union, add shared sprite frames, or modify gameplay PixelOfficer/pixel-scene.css. Shared frame selectors can otherwise hide new art or alter stair animation.
- **Execution Flow / Logic**:
  1. Draw the older worker's grabbing pose with an arm extended back toward the young worker, visibly contacting the young worker's wrist/forearm.
  2. Draw the young worker's dragged pose with an extended arm, resistant backward lean, and feet that can be bobbed during group travel.
  3. Draw an actual seated pose with bent legs and a lowered/slumped head. Repositioning an unchanged standing sprite does not satisfy the seated action.
  4. Provide a standing older-worker pose for the completed office scene. Reuse established design details in this dedicated art without changing the common gameplay component.

### I03. Office scene composition, motion, and accessibility

- Related Files:
  - `src/game/OvertimeCaptureEnding.tsx` :: `OvertimeCaptureEnding` — new.
  - `src/game/overtime-capture-ending.css` :: scoped scene/layout/keyframes — new.
  - `src/game/OfficeExitEnding.tsx`, `src/game/office-exit-ending.css` :: existing scene conventions — read-only.
  - `src/game/pixel/OvertimeOfficer.tsx` :: posed actors from I02 — use.

#### Details
- **Signatures & Types**:
  ```typescript
  export interface OvertimeCaptureEndingProps {
    variant: "animated" | "complete";
    startedAtMs?: number;
  }
  export function OvertimeCaptureEnding(props: OvertimeCaptureEndingProps): ReactElement;
  ```
- **Data & Schema Fields**:
  - Root `.overtime-capture-ending` has `data-testid="overtime-capture-ending"` and `data-variant`.
  - Animated root is an accessible modal dialog labelled by a focusable h2 `야근 사무실`. Static complete variant is not a modal, has no autofocus, and must not steal result-button focus.
  - SVG uses `viewBox="0 0 520 400"`, `preserveAspectRatio="xMidYMid meet"`, and crisp edges. Give it an accessible description of the arm grab, return to the desk, and seated/slumped ending; avoid duplicating the existing result reason text.
  - Use unique useId-derived clip IDs if the window/skyline uses clipping. Never hardcode shared SVG IDs.
  - Store initial elapsed animation time once, `Math.max(0, Date.now() - startedAtMs)` (zero if omitted), clamped to the two-second duration. Apply negative `--overtime-capture-offset` to every scene animation so a late mount enters at the correct point. Do not recompute the animation offset on ordinary rerenders.
- **Execution Flow / Logic**:
  1. Import the new CSS from this component. Draw a dark blue/slate office, tiled floor, a right-side desk and computer with monitor glow, document piles, chair, and windows with cyan/pink neon-city silhouettes. Use the game's existing palette; no new raster assets, fonts, dependencies, or audio files.
  2. Arrange the young worker on the left and the older worker ahead to their right, both traveling right toward the desk. Their arm contact must be visible during the drag. Finish the protagonist seated at the chair next to the desk; finish the pursuer standing nearby. Keep both actors upright and in front of the relevant background layers; desk foreground may occlude lower legs but must not hide the arm grab or final face.
  3. Animate a finite 2,000 ms storyboard: 0–300 ms arm grab/recoil; 300–1,300 ms pull/travel toward the desk; 1,300–1,700 ms drop into the chair using the seated artwork; 1,700–2,000 ms settle with the head lowered. Stepped foot/body motion should read as pixel animation. Keep timing offsets aligned across pose swaps, actor travel, and chair contact.
  4. Complete variant renders the final seated protagonist and standing pursuer immediately with no movement, flashing, or repeat loop.
  5. Use selectors under `.stair-game.pixel-theme .overtime-capture-ending` and scene-specific actor classes. Do not rely on shared `.pixel-officer` or `.officer-frame` selectors. Default art state should be the complete scene; animated selectors opt into the timeline.
  6. Animated root fills its game-frame parent with an opaque overlay at z-index 20, safe-area-aware padding, and a minmax(0, 1fr) SVG region. Allow container scrolling on short viewports. Static variant fits the result column with a bounded image height (about 128 px).
  7. On animated mount, focus the dialog heading; trap Tab/Shift+Tab on it for this automatic sequence. Do not add an unchosen skip/continue button or Escape-to-skip behavior. Complete variant adds no interactive element.
  8. Add reduced-motion CSS that disables all scene keyframes and displays the final seated/standing poses and transforms. The lifecycle hook performs the corresponding zero-delay behavior.
  9. Do not connect this scene to GameScreen yet; T02 owns the integration.

### I04. Standalone behavior tests

- Related Files:
  - `src/game/OvertimeCaptureEnding.test.tsx` :: hook probe and scene tests — new.
  - `src/game/OfficeExitEnding.test.tsx` :: existing fake-clock/media-query fixture pattern — read-only.

#### Details
- Test the hook with an explicit nowMs prop and controlled Date.now/fake timers. Clean up rendering, timers, media stubs, and listeners after each case.
- Assert capture at 0 and 499 ms; overtime at 500 and 2,499 ms; complete at 2,500 ms relative to endedAtMs. At most one active boundary timer under StrictMode.
- All stages 1–5 caught are eligible. Null, stage clear, and time-limit results schedule no office sequence.
- Parent rerender, late mount in either phase, delayed callbacks, and a caller nowMs jump beyond the end do not replay or extend the timeline.
- Replacing/clearing a result cancels its timer; stale callbacks cannot complete a new run. Unmount leaves no boundary timer or media listener.
- Initial reduction, result arriving while reduction is on, and reduction enabled during either phase complete immediately. Turning reduction off does not replay; a fresh result can play afterward. Missing/throwing matchMedia falls back safely.
- Animated scene has a correctly labelled modal, focuses its heading, and traps Tab both ways. Complete variant has no modal or focus theft.
- Assert the SVG scene contains office furniture/window context and older/young actor groups with the required scene-specific poses, and late-mount negative offsets remain stable on rerender. Test behavioral/semantic contracts; do not snapshot every rectangle or mirror every CSS declaration.
- Actual readability of arm contact, sitting, and layering requires the browser checks in T02; jsdom is not visual proof.

## Acceptance Criteria
- [x] Standalone hook produces the exact capture → overtime → complete timeline without changing game data.
- [x] Reduced motion, late updates, new runs, StrictMode, and cleanup behave as specified.
- [x] The two-second pixel office animation visibly includes arm contact, travel, an actual seated pose, and a lowered head.
- [x] The office contains desk/computer/documents/chair and neon-night windows consistent with the game.
- [x] Animated and static variants expose appropriate accessibility and focus behavior.
- [x] GameScreen, shared gameplay sprites, engine, storage, auth, and audio are unchanged.

## Validation
- `npm.cmd test -- --run src/game/OvertimeCaptureEnding.test.tsx --maxWorkers=2` — standalone timing, motion preference, cleanup, and scene semantics pass.
- `npm.cmd run lint` — no lint errors.
- `npm.cmd run build` — TypeScript and production build pass, including the standalone exported modules.

## Commit Message
```text
feat(game): add overtime capture scene and lifecycle

Plan: 2026-10-29-title-copy-and-overtime-capture
Phase: P01-overtime-capture
Task: T01-overtime-scene-and-lifecycle

- Draw the office grab, drag and seated character sequence
- Add bounded capture presentation timing and reduced-motion handling
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: `4e41af6`

## Validation Results (2026-10-29)
- Required standalone command: 33/33 tests passed (final run 3.57 s). Exact 500/2,500 ms boundaries, batched callbacks, delayed updates, all five caught stages, reset/new result, reduced motion, StrictMode cleanup, and accessible scene behavior are covered.
- `npm.cmd run lint`: exit 0; `npm.cmd run build`: exit 0. Main bundle remains 569.22 kB (gzip 159.32 kB), with the existing >500 kB chunk warning. These new standalone modules are not connected to the main entry until T02.
- Additional standalone visual inspection: Chrome 156.0.8078.49, 1440×900 and 390×667. Scrubbed the real CSS animations at 150/850/1,550/1,950 ms; inspected grab contact, travel, seated legs/chair placement, and lowered head. Mobile reduced-motion inspection showed zero animations and the final seated/standing artwork; body dimensions matched 390×667 with no root overflow. No runtime exceptions.
- Browser inspection exposed a reduced-motion CSS specificity conflict in head/leg selectors; corrected in this task and repeated the required checks afterward.
- Evidence: `%TEMP%\overtime-t01-2026-10-29\preview-evidence.json` and six PNGs. Preview server, browser profile, scripts, and evidence are temporary external artifacts; owned preview server/browser were closed. This is standalone scene evidence, not main-game integration acceptance.
- Scope: only the five new production/test files specified here plus task/memory documents. No additional existing defect discovered; the separately recorded stale App.test.tsx screen assumptions and bundle warning were not expanded into this task.
