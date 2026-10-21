# Task: T05 라이선스 확인 오디오와 설정

## Status: pending

## Goal
로그인 후 메뉴와 플레이 중 BGM을 재생하고 게임 이벤트·성공 이동·실수에 맞춰 음악 속도와 효과음을 제어하며, 사용자가 조절한 BGM·효과음 설정을 브라우저에 기억한다.

## Decision Summary
- 사용 권한이 확인된 짧은 경쾌한 아케이드 루프 BGM, 돌계단 발소리, 묵직한 넘어짐 효과음을 포함한다.
- 더블 점수 이벤트 동안 BGM 재생 속도를 1.25배로 올린다. BGM과 효과음은 각각 볼륨·음소거를 독립 조절한다.
- 선택 음원은 OpenGameArt의 `Happy Loop`(wipics, CC0), Wikimedia Commons `Concrete Steps 2`(Pwaivers, CC BY-SA 3.0), OpenGameArt `Jump Landing Sound`(MentalSanityOff, CC0)이며 출처·사용 조건은 `public/audio/LICENSES.md`에 기록한다.

## Implementation

### I01. 권리 확인 오디오 자산
- Related Files:
  - `public/audio/stair-climb-bgm.mp3` :: BGM 루프 — 신규 바이너리
  - `public/audio/stone-step.ogg` :: 성공 이동 효과음 — 신규 바이너리 (원본 라이선스 배포 형식)
  - `public/audio/fall-thud.mp3` :: 실수 효과음 — 신규 바이너리
  - `public/audio/LICENSES.md` :: 출처와 사용 조건 — 신규
  - `README.md` :: 오디오 자산 출처 안내 — 수정

#### Details
- **Data & Schema Fields**: 각 자산에 대해 `파일명`, `원본 URL`, `저작자`, `라이선스 이름 및 버전`, `상업적 이용 허용 여부`, `사내 이용 허용 여부`, `요구되는 표기`를 기록한다. 재인코딩으로 원본 오디오를 변형하지 않고 발소리는 Commons의 Ogg 파일 그대로 포함한다.
- **Execution Flow / Logic**:
  1. 가사 없는 경쾌한 아케이드 BGM을 20~60초 길이의 짧은 루프 형식으로 선택한다.
  2. 상업적·사내 이용을 허용하는 라이선스 또는 명시된 사용 허가를 확인한다. 출처가 불분명하거나 사용 조건이 확인되지 않은 파일은 사용하지 않는다.
  3. 돌계단을 가볍게 밟는 짧은 발소리와 묵직한 넘어짐 소리를 같은 권리 확인 기준으로 선택한다.
  4. 모든 원본 링크, 저작자, 라이선스 및 필요한 attribution을 `public/audio/LICENSES.md`에 기록하고 README에서 해당 문서를 연결한다.
  5. 파일을 지정 경로로 복사하고 `Audio()`가 경로를 찾을 수 있도록 정적 자산 URL을 `/audio/...`로 사용한다.
- **Error & Exception Handling**: 라이선스를 검증할 수 없는 자산은 대체한다. BGM 루프 시작점과 끝점의 들리는 공백을 확인하고, 눈에 띄는 공백이 있으면 다른 자산을 선택한다.
- **State Transition & Return**: 이 단위는 세 오디오 파일과 함께 검토 가능한 라이선스 기록을 남긴다. 불명확한 라이선스는 구현을 진행할 조건으로 간주하지 않는다.

### I02. 오디오 설정 저장 모델
- Related Files:
  - `src/audio/audioPreferences.ts` :: 설정 스키마·저장소 — 신규
  - `src/audio/audioPreferences.test.ts` :: 기본값·유효성·저장 테스트 — 신규
- **Signatures & Types**:
  ```ts
  export interface AudioPreferences {
    bgmVolume: number;
    bgmMuted: boolean;
    effectsVolume: number;
    effectsMuted: boolean;
  }
  export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences;
  export function loadAudioPreferences(storage?: Storage): AudioPreferences;
  export function saveAudioPreferences(preferences: AudioPreferences, storage?: Storage): boolean;
  ```
- **Data & Schema Fields**: 키 `stair-climb:audio:v1`; 각 볼륨은 0과 1 사이 숫자, 음소거 값은 boolean. 기본 볼륨은 BGM 0.5, 효과음 0.5, 두 채널 음소거 기본값은 false.
- **Execution Flow / Logic**:
  1. 저장 값이 없거나 손상되었으면 기본 설정을 반환한다.
  2. 볼륨이 유효한 범위 밖이거나 타입이 잘못된 항목은 해당 항목만 기본값으로 대체한다.
  3. 설정 변경 때 JSON을 `localStorage`에 저장한다.
  4. 저장소 접근이 실패하면 현재 런타임 값은 적용할 수 있도록 유지하고 저장 실패를 boolean 결과로 알린다.
- **Error & Exception Handling**: JSON 파싱 및 `Storage` 보안/용량 예외를 외부로 던지지 않는다. 잘못된 스키마는 사용하지 않는다.
- **State Transition & Return**: load는 완전한 유효 `AudioPreferences`를 반환한다. save는 저장 성공 여부를 반환한다.

### I03. AudioController 및 이벤트 재생
- Related Files:
  - `src/audio/audioController.ts` :: 오디오 엘리먼트 및 재생 API — 신규
  - `src/audio/audioController.test.ts` :: 오디오 동작 mock 테스트 — 신규
- **Signatures & Types**:
  ```ts
  export interface AudioController {
    startBgm(): Promise<boolean>;
    stopBgm(): void;
    setEventActive(active: boolean): void;
    setPreferences(preferences: AudioPreferences): void;
    playFootstep(): void;
    playFall(): void;
    dispose(): void;
  }
  export function createAudioController(): AudioController;
  ```
- **Data & Schema Fields**: BGM source `/audio/stair-climb-bgm.mp3`, 발소리 `/audio/stone-step.ogg`, 넘어짐 `/audio/fall-thud.mp3`. BGM base `playbackRate = 1`, 이벤트 중 `1.25`; 종료 시 `1`로 복귀한다.
- **Execution Flow / Logic**:
  1. `startBgm`은 BGM 요소에 `loop = true`를 설정해 재생을 시도한다. 재생 성공이면 `true`, 브라우저 autoplay 거부를 포함해 재생 실패면 `false`를 반환한다.
  2. `stopBgm`은 BGM을 pause하고 `currentTime = 0`으로 초기화한다. `dispose`는 재생을 중지하고 요소를 해제한다.
  3. `setEventActive(true/false)`는 BGM `playbackRate`를 1.25/1로 바꾼다. BGM이 음소거여도 이벤트 속도 상태는 최신 상태로 유지한다.
  4. `setPreferences`는 BGM 볼륨·음소거를 BGM 요소에 적용한다. 효과음 볼륨·음소거는 새 효과음 요소에 적용한다.
  5. `playFootstep`과 `playFall`은 각각 성공 이동과 잘못된 입력 때 호출되며, 여러 빠른 입력에서도 겹쳐 재생할 수 있도록 새 효과음 요소를 만들어 `play()`한다. 음소거 채널은 재생하지 않는다.
  6. 모든 `HTMLMediaElement.play()` Promise rejection은 처리하고 화면 전체 오류로 전파하지 않는다.
- **Error & Exception Handling**: autoplay 차단은 `startBgm() === false`로 전달한다. 재생 실패한 효과음은 조용히 무시하고 다음 호출이 동작하도록 한다. 오디오 파일 decode/네트워크 오류가 게임 입력과 점수 상태를 막지 않는다.
- **State Transition & Return**: 오디오 재생은 게임 엔진 상태를 바꾸지 않으며, React에서 발생한 상태 변화에 반응한다.

### I04. 오디오 UI 및 게임 연동
- Related Files:
  - `src/audio/AudioControls.tsx` :: BGM·효과음 설정 — 신규
  - `src/audio/audio.css` :: 음량 조절 UI — 신규
  - `src/game/GameScreen.tsx` :: 게임 전이 오디오 호출 — 수정
  - `src/game/GameScreen.test.tsx` :: 오디오 전이 연결 테스트 — 수정
  - `src/App.tsx` :: 로그인된 메뉴에서 오디오 시작 — 수정
  - `src/App.test.tsx` :: 로그인 후 재생 시작·차단 대체 버튼·설정 복원 — 신규
- **Signatures & Types**:
  ```ts
  export function AudioControls(props: {
    preferences: AudioPreferences;
    onChange: (next: AudioPreferences) => void;
    autoplayBlocked: boolean;
    onEnableAudio: () => void;
  }): JSX.Element;
  ```
- **Execution Flow / Logic**:
  1. 인증된 앱 셸이 mount되면 BGM을 시도한다. 이 앱 셸은 로그인 완료 뒤에만 렌더링되어 메뉴에서 음악을 들을 수 있다.
  2. BGM 자동 재생이 거부되면 메뉴에 `음악 켜기` 버튼을 표시한다. 버튼 클릭에서 다시 `startBgm()`을 실행하고, 성공 후 fallback 안내를 숨긴다.
  3. BGM과 효과음 각각 `음소거` 버튼과 0~100% range slider를 제공한다. range는 0~1 실수로 바꿔 설정 저장소에 기록한다. 스크린 리더용 레이블을 제공한다.
  4. `GameScreen`에서 `stepsClimbed`가 1 증가하면 `playFootstep()`을 한 번 호출한다. `lastMistake`가 false에서 true로 바뀌면 `playFall()`을 한 번 호출한다. rerender만으로 효과음이 반복되지 않도록 이전 값과 비교한다.
  5. `eventEndsAt`의 활성 여부가 바뀔 때 `setEventActive`를 호출한다. 30초 이벤트 종료 시 1배속 복귀가 즉시 반영된다.
  6. 게임이 `game-over`가 되면 `stopBgm()`을 호출한다. 사용자가 다시 시작하면 BGM을 재시작한다. 로그인된 앱 셸이 unmount될 때 `dispose()`한다.
- **Error & Exception Handling**: 자동 재생 거부 상태에서는 분명한 켜기 버튼을 표시한다. 로컬 저장 실패는 음량 조절 사용을 막지 않고 일시적 설정을 유지한다. 볼륨 0과 음소거의 의미를 분리한다(0은 음량 0, 음소거는 이전 볼륨값을 보존).
- **State Transition & Return**: BGM과 효과음 설정은 서로 독립적으로 적용되며 브라우저 재방문 시 불러온다.

### I05. 오디오 검증
- Related Files:
  - `src/audio/AudioControls.test.tsx` :: UI 조작 테스트 — 신규
  - `src/game/GameScreen.test.tsx` :: 이동·실수·이벤트·종료 오디오 테스트 — 수정
  - `src/App.test.tsx` :: 인증된 셸 BGM 시작 및 설정 복원 테스트 — 신규
- **Data & Schema Fields**: 실제 미디어 재생은 mock audio element로 대체한다. 오디오 파일 존재·길이·라이선스는 수동 확인한다.
- **Execution Flow / Logic**: 로그인 완료 후 BGM 시도, autoplay 거부 fallback, 이벤트의 1.25/1 재생 속도, BGM 종료/재시작, 성공 D/J당 한 번의 발소리, 오입력당 한 번의 넘어짐 소리, 설정별 독립 음소거·볼륨, 새 mount 후 저장값 복원을 확인한다.
- **Error & Exception Handling**: `play()` rejection 및 `localStorage` 접근 거부를 테스트하며 게임 UI가 정상 작동해야 한다.

## Acceptance Criteria
- [x] 라이선스가 확인된 BGM 및 두 효과음 파일이 출처 문서와 함께 제공된다.
- [x] 로그인 후 메뉴와 게임 중 BGM이 반복되고, autoplay가 막히면 켜기 버튼이 나타난다.
- [x] 더블 점수 이벤트 중 BGM은 1.25배, 이벤트 종료 시 1배속이다.
- [x] 성공적인 D/J 이동마다 발소리, 오입력마다 넘어짐 효과음이 한 번씩 재생된다.
- [x] BGM과 효과음의 음소거·볼륨은 분리되고 다음 방문에도 설정이 남는다.
- [x] 넘어짐 연출 500ms 동안 입력 잠금이 유지되며 오디오 실패가 게임을 중단시키지 않는다.

## Validation
- `npm run test -- --run src/audio src/game/GameScreen.test.tsx src/App.test.tsx` — 오디오 설정·controller·로그인 셸 및 게임 연동 테스트 통과.
- `npm run test -- --run` — 전체 57개 테스트 통과.
- `npm run lint` — ESLint 오류 없음.
- `npm run build` — TypeScript 및 프로덕션 빌드 성공 (기존 번들 크기 경고는 표시됨).
- 수동 파일 확인: BGM 20.87초, 발소리 Ogg 0.79초, 세 파일의 로컬 존재 및 라이선스 문서 대조 완료.
- 브라우저에서 소리를 직접 듣는 수동 검증은 Entra 설정이 없어 아직 실행하지 않음. `.env.local`을 설정하면 autoplay·음량·이벤트 속도·게임 오버·모바일 효과음을 확인할 수 있음.

## Commit Message
```text
feat(audio): add licensed game music and sound effects

Plan: 2026-10-21-stair-climb-game
Phase: P01-local-game
Task: T05-audio

- Add licensed loop music, footsteps, and fall audio
- Persist separate audio settings and sync music to game events
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (`npm run test -- --run`, `npm run lint`, `npm run build`)
- commit: `feat(audio): add licensed game music and sound effects`
