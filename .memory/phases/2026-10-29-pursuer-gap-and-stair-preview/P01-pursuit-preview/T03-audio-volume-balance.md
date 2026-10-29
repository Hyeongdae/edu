# Task: T03 Audio Volume Balance

## Status: done

## Goal

저장된 오디오 슬라이더/음소거 설정은 그대로 보존하면서, 메인 게임과 단독 하강 실험의 BGM 실제 재생 음량을 설정값의0.6배로 낮추고 계단 발소리만1.5배(최대1)로 키운다. 넘어짐 소리 크기와 음소거 동작은 유지한다.

## Decision Summary

- `bgmVolume` 설정은 재생 시점에0.6배로 계산한다. 슬라이더/저장값/기본값을 바꾸지 않으므로 기존 사용자 설정에도 반영된다.
- 발소리 설정은 재생 시점에1.5배 후1.0으로 제한하고, 넘어짐 소리는 기존 `effectsVolume`을 그대로 사용한다.
- `bgmMuted`, `effectsMuted`, 음소거 UI, 저장 key/schema, source 음원과 event playbackRate1.25는 보존한다. 실제 음소거 오류를 새로 수정하지 않는다.

## Implementation

### I01. HTMLAudioElement별 재생 이득 적용

- Related Files:
  - `src/audio/audioController.ts` :: `createAudioController`, 내부 `getBgm`, `playEffect`, `setPreferences`, `playFootstep`, `playFall` — 재생 음량 계수; modify
  - `src/audio/audioController.test.ts` :: `FakeAudio`, audio controller volume/mute/event tests — 계산값과 상한 테스트; modify
  - `src/audio/audioPreferences.ts` :: `AudioPreferences`, `loadAudioPreferences`, `saveAudioPreferences`, `STORAGE_KEY` — 스키마 불변 확인; read-only
  - `src/audio/audioPreferences.test.ts` :: 기존 저장/복원 키와 값 회귀; modify only if needed for regression expectation

#### Details

- **Signatures & Types**: 공개 `AudioController`와 preference 타입은 변경하지 않는다. controller 내부 helper를 아래 의미로 확장한다.
  ```typescript
  const BGM_PLAYBACK_GAIN = 0.6;
  const FOOTSTEP_PLAYBACK_GAIN = 1.5;
  function scaledVolume(volume: number, gain: number): number {
    return Math.min(1, Math.max(0, volume * gain));
  }
  const playEffect = (source: string, gain: number): void => { /* ... */ };
  ```
- **Data & Schema Fields**: `AudioPreferences`는 `{bgmVolume:number, bgmMuted:boolean, effectsVolume:number, effectsMuted:boolean}`이고 저장 key는 `stair-climb:audio:v1`이다. 타입/기본값/기존 저장 JSON 값은 바꾸지 않는다.
- **Execution Flow / Logic**:
  1. BGM element를 처음 만들 때 `scaledVolume(preferences.bgmVolume, 0.6)`을 `volume`에 적용한다. `setPreferences`에서 이미 존재하는 BGM에도 같은 식을 적용한다.
  2. `playFootstep`은 기존 `/audio/stone-step.ogg`를 재생하면서 `scaledVolume(effectsVolume,1.5)`를 적용한다. 새 HTMLAudioElement마다 현재 설정이 반영된다.
  3. `playFall`은 `/audio/fall-thud.mp3`를 기존 `effectsVolume` 그대로 재생한다. 발소리 계수를 공유하지 않는다.
  4. 볼륨 0은 계속0이고 해당 mute flag가 참이면 기존대로 효과음 element를 만들지 않거나 BGM의 `muted`를 참으로 둔다. 계수 후 volume은 유효한 HTMLAudioElement 범위 `[0,1]`에 둔다.
  5. `setEventActive`의 BGM playbackRate1.25, stop/dispose/오류 처리와 게임 입력/음향 호출 개수는 변경하지 않는다. 양쪽 화면은 공용 controller를 사용하므로 별도 UI/settings 변경은 없다.

### I02. 단위 및 앱 오디오 회귀 검사

- Related Files:
  - `src/audio/audioController.test.ts` :: 초기/변경 설정, 상한, mute/zero, fall volume, event speed — modify
  - `src/audio/AudioControls.test.tsx` :: 슬라이더와 음소거 상태 전달 — read-only unless assertion changes are required
  - `src/game/GameScreen.test.tsx` :: 발소리/넘어짐 별도 재생 및 저장 설정 연결 — modify only if required
  - `src/descent/DescentGameScreen.test.tsx` :: 단독 화면 공용 controller 연결 — modify only if required

#### Details

- `bgmVolume=0.5`일 때 HTMLAudioElement BGM `volume=0.3`; `setPreferences` 뒤 새 비율 반영, mute flag와 `playbackRate`는 독립 값임을 검사한다.
- 발소리는 `effectsVolume=0.5`일 때0.75, `0.2`일 때0.3, `1`일 때1로 제한된다. 넘어짐은 각각0.5/0.2/1로 원래 설정값이다.
- 양쪽 채널 volume0, 채널별 mute true, 해제 후 재생을 검사한다. muted BGM도 이벤트 playbackRate 변경을 계속 받고, mute된 효과음은 새 Audio instance를 만들지 않는다.
- 기본값, 기존 storage v1 JSON round-trip, AudioControls slider 값에는 계수를 반영하지 않는다. 재생 element의 실제 volume에만 적용한다.

## Acceptance Criteria

- [x] BGM 새 생성 및 저장 설정 변경 때마다 실제 volume이 `bgmVolume×0.6`이다.
- [x] 발소리 actual volume은 `min(effectsVolume×1.5,1)`이며 넘어짐 volume은 `effectsVolume`과 같다.
- [x] 두 mute flag, volume0, mute 해제 동작은 기존대로 유지된다.
- [x] 오디오 preference 기본값/저장 키/직렬화 데이터와 슬라이더 값은 변경되지 않는다.
- [x] 이벤트 playbackRate1.25, 성공/실수별 오디오 호출 1회, 메인/단독 동일 동작이 유지된다.
- [x] 기존 사용자 설정에 계수가 적용되고 새 설정 초기화/추가 저장 접근이 발생하지 않는다.

## Validation

- `npm.cmd test -- src/audio/audioController.test.ts src/audio/audioPreferences.test.ts src/audio/AudioControls.test.tsx src/game/GameScreen.test.tsx src/descent/DescentGameScreen.test.tsx` — volume/mute, preference 저장, 메인/단독 오디오 회귀 검사 통과.
- `npm.cmd run lint` — lint 오류와 경고0.
- `npm.cmd run build` — TypeScript와 Vite build 통과.
- 격리된 브라우저 확인: 로컬 demo에서 기존 오디오 preference를 바꾸지 않고 BGM `Audio.volume` 및 발소리/넘어짐 instance의 `volume`을 관찰해 기본50% 설정에서0.30/0.75/0.50을 확인한다. 0/최대/음소거도 확인하되 실제 스피커 청취는 사용자가 최종 밸런스를 결정할 수 있도록 별도 체감 확인으로 남긴다. 사용자 프로필/기록은 변경하지 않는다.

## Commit Message

```text
fix(audio): balance music and stair footsteps

Plan: 2026-10-29-pursuer-gap-and-stair-preview
Phase: P01-pursuit-preview
Task: T03-audio-volume-balance

- Reduce BGM playback gain without changing stored preferences
- Boost footsteps while preserving fall sound and mute behavior
```

## Progress

- [x] 구현 완료
- [x] 검증 통과 (5개 파일, 130 tests; lint/build 통과)
- 브라우저/스피커 확인: 브라우저 자동 제어 도구 부재로 미수행
- commit: pending
