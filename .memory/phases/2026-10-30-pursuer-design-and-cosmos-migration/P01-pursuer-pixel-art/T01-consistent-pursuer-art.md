# Task: T01 Consistent Pursuer Pixel Art

## Status: done

## Goal
Make the older pursuer recognizable as the same slightly slimmer straw-hat office worker in every stair-chase pose and the overtime-capture animation, without changing the character's age cues, office clothing, movement, or scene layout.

## Decision Summary
- Preserve the older face, gray hair details, glasses, and office suit colors. Add a readable yellow straw hat with a darker band; narrow the torso and limbs slightly while keeping the current head scale, shoe baseline, and pixel-art rendering.
- The chase and overtime-capture characters are separately drawn components, so update both. The same `PixelOfficer` is also used by the main and descent scenes.

## Implementation

### I01. Shared chase-character frames

- Related Files:
  - `src/game/pixel/PixelOfficer.tsx` :: `OfficerFrameArt`, `PixelOfficer`, `FRAMES` — add older-only hat and slimmer silhouette to the four shared frames; modify.
  - `src/game/StairScene.tsx` :: older pursuer `PixelOfficer` call — read-only; verify shared art is used by the main scene.
  - `src/descent/DescentScene.tsx` :: older pursuer `PixelOfficer` call — read-only; verify shared art is used by the descent scene.

#### Details
- **Signatures & Types**: Keep `OfficerVariant = "young" | "older"`, `OfficerPose = "idle" | "climb" | "fall" | "jump"`, `OfficerFrame = "idle" | "run-a" | "run-b" | "stumble"`, and the existing component signatures unchanged.
- **Artwork**:
  - In `OfficerFrameArt`, render one `older`-only hat group in each of `idle`, `run-a`, `run-b`, and `stumble`. Give it a yellow/gold straw crown, a visibly wider pixel brim, and a darker brown band. Keep the older glasses and visible gray temple details below/at the sides of the brim.
  - Narrow only the older torso, sleeves/arms, and pant-leg shapes by approximately one to two source pixels, keeping the same purple office jacket, teal tie, shoe colors, overall head scale, and shoe baseline at source `y=40`. Do not apply the slim transform to `young`.
  - Keep the full hat inside the existing actor viewport: the actor uses `translate(-32 -80) scale(2)` and scene clip rect `x=-34, y=-88, width=68, height=84`. Keep the hat crown at or below source `y=0` so it does not clip.
  - Preserve each existing pose's arms/legs and the four-frame visibility/stride CSS. The hat must stay attached to the head and must not move independently in any pose.
- **Execution Flow / Logic**:
  1. Add a clearly named SVG group (for example `.officer-straw-hat`) under the older-only branch of every frame, using crisp rectangle/path primitives.
  2. Adjust older-only torso/limb geometry without changing young geometry or `data-officer-variant`, `data-officer-pose`, or frame names.
  3. Confirm the existing scene components continue to supply `variant="older"` for pursuers; do not change movement or scene ordering.

### I02. Overtime-capture art and appearance regression coverage

- Related Files:
  - `src/game/pixel/OvertimeOfficer.tsx` :: `OfficerHead`, `OvertimeOfficer` — duplicate the older hat treatment and slim body proportion in the distinct capture artwork; modify.
  - `src/game/OvertimeCaptureEnding.tsx` :: `OvertimeOfficer` older call sites — read-only; verify both `grabbing` and `standing` layers receive the updated older artwork.
  - `src/game/pixel/pursuerAppearance.test.tsx` :: new component-level appearance tests.

#### Details
- **Signatures & Types**: Preserve `OvertimeOfficerPose = "standing" | "grabbing" | "dragged" | "seated"` and `OvertimeOfficer({ variant, pose }: OvertimeOfficerProps): ReactElement`.
- **Appearance contract**:
  - Apply the hat/body changes only when `variant === "older"`; young dragged/seated characters remain unchanged.
  - Preserve the existing `older` glasses/gray hair and purple jacket/teal tie. Keep the capture animation's head translations, arm grip, legs, and timed layer visibility intact.
- **Tests**: Render both components inside an SVG root. Verify older `PixelOfficer` includes the hat group in every frame present in the SVG, older `OvertimeOfficer` includes it for all four poses, and young variants do not include the older hat group. Verify existing data attributes and baseline markers/geometry remain stable where exposed; do not turn the tests into a game-rule or timing test.
- **Acceptance Criteria**:
  - [x] Main and descent chase actors show the same yellow straw hat and slightly slimmer older office-worker silhouette in idle/moving states.
  - [x] Both older overtime-ending layers show the same hat and slim build throughout capture, while the young protagonist is unchanged.
  - [x] Existing motion states, clipping, and gameplay state are untouched.

## Validation
- `npm test -- --run src/game/pixel/pursuerAppearance.test.tsx` — appearance variants/poses pass.
- `npm run lint` — no SVG JSX/style errors.
- `npm run build` — production Vite/TypeScript build succeeds.

## Commit Message
```text
feat(game): add straw hat to the pursuer

Plan: 2026-10-30-pursuer-design-and-cosmos-migration
Phase: P01-pursuer-pixel-art
Task: T01-consistent-pursuer-art

- Slim the older pixel officer while preserving the business outfit
- Match the chase and overtime-capture pursuer artwork
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
