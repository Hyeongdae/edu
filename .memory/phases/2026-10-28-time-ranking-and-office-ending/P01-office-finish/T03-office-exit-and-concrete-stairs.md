# Task: T03 Office Exit and Concrete Stairs

## Status: in_progress

## Goal

5단계 클리어를 약4초의 자동 1층 퇴근 장면으로 마무리하고, 공용 계단을 회색 콘크리트·노란 안전선 픽셀 디자인으로 교체한다. 결과 성적과 저장은 엔딩 시작 전에 확정된다.

## Decision Summary

- D05/D06. Depends on T02. 시간 랭킹 저장은 이미 StageResult로 연결되어 있다.
- 1층 도착 → 문 열림 → 젊은 회사원이 문 밖으로 걸어감 → 퇴근 완료 → 결과·랭킹. 메인5단계 cleared에서만 재생한다.
- 엔딩은 UI 수명으로 관리하며 core GameStatus는 game-over다. 공용 PixelStair는 두 로컬 화면에 반영한다.

## Implementation

### I01. Office-exit lifecycle hook

- Related Files:
  - `src/game/useOfficeExitEnding.ts` :: `useOfficeExitEnding`, duration constant — new.
  - `src/game/GameScreen.tsx` :: hook 연결, ending/result 분기, focus — modify.
  - `src/game/types.ts` :: T01 StageResult — read-only.
  - `src/game/gameEngine.ts`, `src/leaderboard/leaderboard.ts` — read-only.

#### Signatures & Types

```typescript
export const OFFICE_EXIT_DURATION_MS = 4_000;
export interface OfficeExitEndingState {
  isEnding: boolean;
  prefersReducedMotion: boolean;
}
export function useOfficeExitEnding(result: StageResult | null): OfficeExitEndingState;
```

#### Data & Logic

1. 재생 자격은 result?.stage===5 && result.outcome===cleared. CP/잡힘/시간 초과/quit/단독1단계는 false. 사용한 성적 객체를 다른 객체로 매 렌더 복제하지 않는다.
2. hook은 completedResult:StageResult|null와 prefersReducedMotion:boolean을 관리한다. 진행표시 isEnding은 자격이 있고 완료 참조와 다르며 motion-reduce가 아닐 때 true.
3. 대기 기한은 result.endedAtMs+4000. effect는 max(0,기한-Date.now())만 기다린 뒤 해당 결과를 completedResult로 기록한다. StrictMode 재설정/부모 렌더로4초를 재시작하지 않는다. callback은 캡처한 결과만 완료하고 새 도전의 결과를 완료하지 않는다.
4. result가null/다른결과로 바뀌거나 unmount하면 timeout 취소. 다음 새5단계 결과는 새 object이므로 다시 재생 가능. 늦게 렌더되면 남은 연출 시간만 기다린다.
5. window.matchMedia('(prefers-reduced-motion: reduce)')를 안전하게 읽고 change listener를 등록/해제한다. API가 없으면false. reduce면4초타이머 없이 정적인 완료 장면과 결과를 즉시 제공한다. 재생 중 reduce로 바뀌면 즉시 완료하며 다시 일반 모션으로 바꿔도 같은 엔딩을 재생하지 않는다. 이미 reduce인 상태에서 일반으로 바꿀 때도 당시 결과는 완료로 간주한다.
6. GameScreen은 hook 결과로 game-over 분기를 ending 또는 result로 선택한다. 엔딩은 frame 전체의 불투명 overlay로 보여준다. 배경 game-stage/게임 footer는 연출 중 aria-hidden/inert 및 시각적으로 가리고, 설정 버튼도 비활성화한다. 키보드 D/J/Space는 core status로 이미 종료되어 이동/점수/효과음을 만들지 않는다.
7. 재생 중 결과/재시작 버튼을 중복 노출하지 않는다. 종료 후 기존 결과·랭킹과 버튼을 표시하며 restartButtonRef로 focus를 이동한다. 기존 caught500ms gate에서도 focus는 gate 해제 후 처리한다. reduced-motion은 즉시 완료 결과와 focus를 제공한다.
8. 랭킹/해금 저장은 기존 T02 effect가 clear 즉시 수행한다. 엔딩완료 callback에서 저장하지 않는다. 기존 stopBgm/최종 성공 footstep을 유지하고 새로운 오디오 자산/서비스를 추가하지 않는다.

### I02. Pixel lobby, door and walking scene

- Related Files:
  - `src/game/OfficeExitEnding.tsx` :: 순수 장면 — new.
  - `src/game/office-exit-ending.css` :: scope된 SVG/모션/레이아웃 — new.
  - `src/game/pixel/PixelOfficer.tsx` :: young sprite/포즈 재사용 — read-only.
  - `src/game/pixel-theme.css` :: ending-active frame 보조 selector만 필요 시 modify.

#### Signatures & Types

```typescript
export interface OfficeExitEndingProps {
  variant: "animated" | "complete";
}
export function OfficeExitEnding(props: OfficeExitEndingProps): ReactElement;
```

#### Details

- animated는 role=dialog, aria-modal=true, useId로 heading 연결, heading tabIndex=-1과 mount focus. 연출 동안 Tab이 배경으로 이동하지 않게 한다. complete는 결과 내부의 정적 장식/완료 안내이며 modal을 만들지 않는다.
- SVG viewBox=0 0 520 400, shapeRendering=crispEdges, 픽셀 로비·바닥·유리 출입문·바깥 네온 야경을 그린다. 1F/EXIT 표식과 퇴근 완료 안내를 사용한다. 기존 배경의02F 간판을 그대로 가져오지 않는다.
- 기하 예시를 구현 기준으로 사용: 바닥y320, 출입문x334/y100/width140/height220, 양문은 각각70너비. PixelOfficer의 발 기준점은0, 외부 group translate(145 320)에서시작해 문밖 translate(405 320)까지 오른쪽으로 이동한다.
- 타임라인:0~800ms 1층도착/잠깐정지,800~1400ms 문열림,1400~3400ms 캐릭터걸어나감,3400~4000ms 퇴근완료/바깥으로퇴장. 기본 CSS translate/opacity 또는 SVG group의 CSS transform을 사용하며 원본 캐릭터를 수직으로 뒤집지 않는다.
- 문 유리 너머 밤도시는 문 frame/clipPath에 맞게 보인다. 필요한 clip ID는 useId. 지나간 캐릭터가 닫힌 문 위로 겹치지 않도록 문열림과 이동 시점을 맞춘다.
- 새 CSS는 .stair-game .office-exit-ending 범위. PixelOfficer의 모든 pose frame이 동시에 보이지 않도록 기존 idle/run-a/run-b 노출 규칙을 더 구체적인 selector로 재사용/정의한다. 걷기 frame은300ms 두 포즈 교대, 정적 complete는idle 한 포즈만 표시한다.
- complete는 최종위치/문열림/퇴근완료의 정지 그림과 결과를 즉시 보여준다. prefers-reduced-motion CSS에서도 모든 새 모션을 끄고 최종 상태로 고정한다.
- frame 전체를 채우되 그림은비율유지, 안내 글자는HTML로 읽을 수 있게 한다. 320×667/390×844/768×1024/1440×900에서 overflow 없이, 큰 글자에서도 결과와 재시작을 사용할 수 있다.

### I03. Concrete emergency stairs

- Related Files:
  - `src/game/pixel/PixelStair.tsx` :: top/front SVG 아트 — modify.
  - `src/game/StairScene.tsx`, `src/descent/DescentScene.tsx`, `src/game/pixel/PixelObstacle.tsx`, 좌표 모델 — read-only.
- 기존 props face:top|front, direction:left|right API를 유지한다. 외곽 영역 x-34..34/y-24..16, 발 착지점0과 기본 pixel outline을 보존한다.
- 윗면 콘크리트 #aeb7bf, 테두리하이라이트 #d9dee2, 고정 얼룩 #8c98a3, 앞면왼쪽 #64717d/오른쪽 #46535f, 외곽 #172333. 앞쪽 가장자리 안전선 #f3ca58/그림자 #b98e30. 기존 청록 모서리를 노란선으로 바꾼다.
- 미끄럼방지선은 앞 가장자리를 따라2px 정도로 그려 발판면과 앞면을 읽기 쉽게 한다. 기존 방향 표시는 어두운색 #223043으로 콘크리트와 대비시킨다.
- 기존 top→캐릭터→front 가림 순서와 발부분clip은 renderer가 관리한다. 아트만 바꾸며 히트/경로/점프 위치는 같은계단을 가리킨다.
- 노이즈는 고정된 작은 rect/path로 표현하고 Math.random/새상태/필터/외부asset은 사용하지 않는다. 갈색상자는 기존 형태/검은외곽으로 식별한다.

### I04. Tests

- New `src/game/OfficeExitEnding.test.tsx`: 순수 장면과 hook용 작은 test wrapper로 타이머/환경을 검사.
- New `src/game/pixel/PixelStair.test.tsx`: top/front/direction/경계/색/결정성.
- Modify `src/game/GameScreen.test.tsx`:5단계clear 즉시 저장과4초후결과,다른종료억제,focus/restart/StrictMode; 기존최종클리어즉시결과 기대만 새 타이밍으로 조정.
- Existing `src/game/StairScene.test.tsx`, `src/descent/DescentScene.test.tsx`는 새아트로 깨지는 실제색 기대값만 수정 가능. 엔진/규칙/오디오/저장 단위검사 보존.

#### Required cases

- 3999ms에는엔딩,4000ms에는결과; timer1개/StrictMode/부모리렌더동일기한; unmount/새result/null취소; 두번째run재생.
- CP1..4/caught/time-limit/quit/단독stage1은엔딩없음. clear 저장은0ms,4초후storage 추가쓰기0.
- reduced-motion 초기true/중간change/true→false 재생방지, matchMedia없는환경, listener해제, 정적final state.
- native Space로재시작버튼활성화후중복globaljump없음,결과focus/Tab/큰글자에서안내읽힘.
- 픽셀top/front각각한개와색/방향/aria-hidden, originalSVG 발점/clip의회귀, RNG소모0.

## Acceptance Criteria

- [ ] 5단계clear만 자동4초퇴근장면,마지막에결과·랭킹·focus.
- [ ] 기록은clear순간값이고연출이저장/점수/추격을변경하지않음.
- [ ] 회색콘크리트/노란선과기존발점·가림순서를두화면에서확인.
- [ ] 모션감소즉시결과/타이머·listener정리,지정31파일과lint/build/diff통과.

## Validation

```powershell
npm.cmd test -- --run src/game/stageResult.test.ts src/game/pursuerCatchUp.test.ts src/game/recordStorage.test.ts src/game/StairScene.test.tsx src/descent/descentEngine.test.ts src/descent/descentSceneModel.test.ts src/descent/descentGate.test.ts src/descent/DescentTestApp.test.tsx src/descent/descentViewState.test.ts src/descent/DescentGameScreen.test.tsx src/descent/DescentScene.test.tsx src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts src/auth/authConfig.test.ts src/game/OfficeExitEnding.test.tsx src/game/pixel/PixelStair.test.tsx --maxWorkers=2
npm.cmd run lint
npm.cmd run build
& 'C:/Program Files/Git/cmd/git.exe' diff --check
```

모든 명령 통과, skip0. 로그는 `%TEMP%/time-ranking-and-office-ending-2026-10-28/`의 Task별 폴더. 실행 당시 실제 test 수/시간/빌드 크기·경고를 기록한다. 테스트 timeout/skip/config/package 변경 금지.


## Commit Message

```text
feat(game): add office-exit ending and concrete pixel stairs

Plan: 2026-10-28-time-ranking-and-office-ending
Phase: P01-office-finish
Task: T03-office-exit-and-concrete-stairs

- Show a four-second first-floor exit after the fifth stage clear
- Respect reduced motion and restore result focus without delaying saves
- Render concrete stair treads with yellow safety edges in both scenes
```

## Progress

- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
