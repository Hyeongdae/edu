# Task: T03 Default BGM Volume

## Status: done

## Goal
Set the default background music slider preference to 30% for players without a saved preference, while preserving existing saved audio settings.

## Decision Summary
- Change only the default BGM preference from 50% to 30%.
- Keep the current playback gain multiplier and preserve any stored `bgmVolume`, mute, and effects preferences.

## Implementation

### I01. Update the single source of default audio preferences

- Related Files:
  - `src/audio/audioPreferences.ts` :: `DEFAULT_AUDIO_PREFERENCES`, `loadAudioPreferences` — set default `bgmVolume` to `0.3` and preserve stored valid values; modify.
  - `src/audio/audioController.ts` :: initial `preferences` fallback — use `DEFAULT_AUDIO_PREFERENCES` instead of a duplicated `bgmVolume: 0.5` object; modify.
  - `src/audio/audioPreferences.test.ts` :: missing/invalid setting and stored-setting cases — modify.
  - `src/audio/audioController.test.ts` :: initial BGM effective volume and explicit stored setting cases — modify.
  - `src/App.test.tsx` :: startup BGM volume with default and saved preferences — modify.

#### Details
- **Data & Schema Fields**:
  - `AudioPreferences.bgmVolume`: number from 0 through 1; new default `0.3`.
  - Other defaults remain unchanged: `bgmMuted: false`, `effectsVolume: 0.5`, `effectsMuted: false`.
- **Execution Flow / Logic**:
  1. For absent or invalid saved settings, `loadAudioPreferences` returns BGM volume `0.3`.
  2. For a valid saved BGM volume, return that exact value; do not reset or cap it.
  3. Leave `BGM_PLAYBACK_GAIN = 0.6` and effect volume handling unchanged. With the new default, initial effective audio output is `0.18` before mute state, versus the previous `0.3`.
  4. Keep the slider range and persistence format unchanged.

## Acceptance Criteria
- [ ] A player with no saved audio settings sees a 30% BGM slider and starts at effective output volume `0.18`.
- [ ] Existing saved BGM volume, mute, and effects settings are preserved exactly.
- [ ] BGM mute, event playback speed, and sound-effect volume behavior are unchanged.

## Validation
- `npm test -- --run src/audio/audioPreferences.test.ts src/audio/audioController.test.ts src/App.test.tsx --maxWorkers=2` — default and stored preference cases pass.
- `npm run lint` — no lint errors.
- `npm run build` — type check and production bundle pass.

## Commit Message
```text
fix(audio): lower the default background music volume

Plan: 2026-10-30-score-cap-stage-countdown-bgm
Phase: P01-gameplay-polish
Task: T03-default-bgm-volume

- Set the default BGM preference to 30 percent
- Preserve saved player audio preferences
```

## Progress
- [x] Implementation complete
- [x] Validation passed
- commit: `7d54586`
