# Task: T02 게임 내 설정 창

## Status: done

## Goal
게임 프레임 오른쪽 위 설정 버튼 하나로 오디오·게임 제목·계정·조작·추격 안내를 여는 접근 가능한 설정 창을 제공하고, 설정 창이 열린 동안 게임 입력과 30초 이벤트 시간을 보존한다.

## Decision Summary
- 설정 창은 게임 영역 중앙에 표시하고 뒤 장면을 어둡게 한다. 기존 `AudioControls`를 재사용하고 오디오 선호값은 기존 localStorage 흐름에 맡긴다.
- 설정 중 D/J 입력을 무시하고 eventEndsAt을 설정 창이 열린 시간만큼 이동해 보너스 남은 시간을 보존한다. 새로운 `GameStatus`나 게임 저장 필드를 추가하지 않는다.

## Implementation

### I01. 설정 창 UI와 콘텐츠
- Related Files:
  - `src/game/GameScreen.tsx` :: `GameScreen`, `isTextEntryTarget` — 설정 열기/닫기 상태, account/audio props, settings trigger와 dialog; modify
  - `src/audio/AudioControls.tsx` :: `AudioControls` — 기존 volume, mute, autoplay-blocked controls; reuse without changing the public prop contract
  - `src/game/game.css` :: `.game-settings-button`, `.settings-backdrop`, `.settings-dialog`, `.settings-content`; new styles
  - `src/audio/audio.css` :: `.audio-controls` — modal 내부의 좁은/넓은 panel 배치; modify if needed
  - `src/game/GameScreen.test.tsx` :: `GameScreen controls`; modify

#### Details
- **Signatures & Types**:
  ```typescript
  interface GameScreenProps {
    account: AccountInfo;
    audioController?: AudioController;
    audioPreferences?: AudioPreferences;
    autoplayBlocked?: boolean;
    onAudioPreferencesChange?: (next: AudioPreferences) => void;
    onEnableAudio?: () => void;
  }
  ```
  기존 `AudioPreferences` 형태를 변경하지 않는다: `bgmVolume: number`, `bgmMuted: boolean`, `effectsVolume: number`, `effectsMuted: boolean`.
- **Data & Schema Fields**:
  - component state `isSettingsOpen: boolean`, 초기값 `false`.
  - `settingsOpenedAtRef: number | null`, 기본값 `null`; 모달이 열린 시간대를 계산한다. 저장소/게임 모델 필드는 추가하지 않는다.
- **Execution Flow / Logic**:
  1. 기존 별도 상시 header/account 및 안내 카드를 설정 dialog 콘텐츠로 옮긴다. 오른쪽 위 trigger는 `aria-label="게임 설정"`, `aria-expanded`, `aria-controls`를 가진다.
  2. dialog는 `role="dialog"`, `aria-modal="true"`, `aria-labelledby`를 제공한다. 헤더에 닫기 버튼을 둔다. 열 때 닫기 버튼으로 focus하고 닫을 때 trigger에 focus를 복귀한다. Escape와 backdrop 클릭으로 닫을 수 있다. dialog 내부 클릭은 backdrop 닫기를 실행하지 않는다.
  3. 오디오 props 세 가지가 모두 제공될 때 기존 `AudioControls`를 dialog 안에 렌더한다. prop이 없으면 오디오 영역을 렌더하지 않는다. 계정 이름은 `account.name ?? account.username` 규칙으로 표시한다.
  4. dialog open 시 `settingsOpenedAtRef.current = Date.now()`로 기록한다. 전역 D/J listener는 dialog가 열려 있거나 `isTextEntryTarget(event.target)`인 경우 입력을 처리하지 않는다. control buttons는 disabled 상태로 둔다.
  5. settings open 동안 event/recovery `setInterval` tick과 `visibilitychange` 복귀 tick은 game state에 적용하지 않는다. `nowMs`도 설정을 닫을 때 현재 시간으로 갱신한다.
  6. dialog close 시 `pausedMs = Date.now() - settingsOpenedAtRef.current`를 구한다. 현재 `eventEndsAt !== null`인 경우에만 `eventEndsAt: eventEndsAt + pausedMs`로 state를 갱신한다. `eventEndsAt`이 null이면 game state를 바꾸지 않는다. ref를 null로 되돌려 중복 close에서 시간을 두 번 더하지 않는다.
  7. AudioControls의 change와 enable callback은 App에서 전달한 기존 callback을 그대로 사용하여 `stair-climb:audio:v1` 선호값 저장 및 autoplay 제스처를 보존한다.
- **Error & Exception Handling**: trigger 조건은 정상적으로 optional audio props가 빠진 테스트 fixture에서도 dialog가 동작해야 한다. document listener, focus, timer effect는 unmount에서 cleanup한다. 이미 열린 동안 중복 close가 발생해도 pausedMs가 중복 반영되지 않는다.
- **State Transition & Return**: settings open/close는 게임 `status`, score, lives, steps를 바꾸지 않는다. 이벤트가 활성화된 경우 설정 중 절대 만료되지 않고, 닫을 때 원래 남은 이벤트 시간이 복원된다.

### I02. 설정 상호작용 테스트
- Related Files:
  - `src/game/GameScreen.test.tsx` :: new settings dialog cases in `GameScreen controls`; modify

#### Details
- top-right trigger opens one dialog containing existing audio controls, user/account identity, D/J guidance and chase explanation.
- close button, Escape, and backdrop close it; clicking dialog content does not close it; focus returns to trigger.
- D/J key input and mobile control clicks do not change score while dialog is open; after close they work.
- with fake timers, open the dialog during an active event, advance time beyond 30 seconds, close it, and assert `2배 점수` remains with the previously displayed remaining time (within ceil-to-seconds behavior). Advance the preserved remaining time and assert the event expires.
- no-event state remains unchanged when opening/closing the dialog; settings work when audio props are absent.

## Acceptance Criteria
- [x] 오른쪽 위 설정 버튼에서 오디오·계정·게임 제목·조작·추격 안내를 한 dialog에서 확인한다.
- [x] backdrop, Escape, 닫기 버튼과 focus 복귀가 정상 동작한다.
- [x] 열려 있는 동안 D/J와 게임 조작 버튼 입력이 막힌다.
- [x] dialog 열린 기간만큼 이벤트 종료 시각이 이동하고 남은 bonus 시간이 보존된다.
- [x] 기존 오디오 선호값 저장 및 브라우저 autoplay 처리 동작을 유지한다.

## Validation
- `npm test -- --run src/game/GameScreen.test.tsx src/audio/AudioControls.test.tsx src/audio/audioPreferences.test.ts` — settings, audio UI, 저장 로직 테스트 통과
- `npm run lint` — ESLint 오류 없음
- `npm run build` — TypeScript 검사 및 Vite build 통과
- Browser check at 390×667 and 1440×900 — settings dialog fits inside the game frame; D/J ignored; event seconds remain unchanged until close

## Commit Message
```text
feat(game): add an in-game settings dialog

Plan: 2026-10-22-immersive-stair-game-ui
Phase: P01-immersive-game-ui
Task: T02-in-game-settings

- Move audio and help content into one game settings dialog
- Block game inputs and preserve bonus time while it is open
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: recorded in Git history
