# Task: T03 Pixel Office Scene

## Status: in_progress

## Goal
기존 야외 하늘·풀밭·주황 계단·보라색 몬스터 장면을, 젊은 회사원과 조금 나이 든 회사원이 회사 건물 안에서 쫓고 쫓기는 픽셀아트 장면으로 바꾼다. 창문 너머 네온 도시 야경과 사무실 소품, 로비의 개방감을 함께 보여주며 T02의 경로와 가림 동작을 보존한다.

## Decision Summary
- 두 인물은 귀엽고 코믹한 사람 회사원이다. 추격자는 조금 나이 든 회사원이며 몬스터/로봇이 아니다.
- 배경은 큰 창문이 있는 계단실을 중심으로 사무실 소품과 유리 로비의 넓은 공간감을 섞는다. 네온 도시는 창밖 풍경이다.

## Implementation

### I01. 픽셀 회사원 캐릭터
- Related Files:
  - `src/game/pixel/PixelOfficer.tsx` :: 회사원 스프라이트와 자세 프레임; new
  - `src/game/pixel/pixel-scene.css` :: 인물 프레임/선명한 렌더링; new
  - `src/game/StairScene.tsx` :: 기존 runner/pursuer 도형 교체; modify
  - `src/game/GameScreen.test.tsx` :: 이전 SVG 팔다리 구조에 묶인 단언 갱신; modify

#### Details
- **Signatures & Types**:
  ```typescript
  type OfficerVariant = "young" | "older";
  type OfficerPose = "idle" | "climb" | "fall";
  interface PixelOfficerProps {
    variant: OfficerVariant;
    direction: Direction;
    pose: OfficerPose;
  }
  function PixelOfficer(props: PixelOfficerProps): ReactElement;
  ```
- **Data & Schema Fields**:
  - 저장소 네이티브 SVG 픽셀 도형으로 구현한다. 기본 그리드 32 × 40, 정수 rect 좌표, 표시 배율 2이다. 전체 인물은 64 × 80 장면 단위다.
  - 발 중심 원점 계약: `translate(-32 -80) scale(2)` 안의 32×40 도형으로 발 중심이 (0,0)이 되게 한다. 왼쪽 방향은 바깥 group의 `scale(-1 1)`로 뒤집는다.
  - 루트에는 `data-officer-variant`와 `data-officer-pose`를 둔다. 장식 도형은 aria-hidden이다. variant/pose는 런타임 GameState 필드를 추가하지 않고 props에서 전달한다.
  - 프레임은 idle/run-a/run-b/stumble 네 종류다. 각 프레임의 발 기준과 머리 높이를 맞춰 자세 변경 시 전체 위치가 흔들리지 않게 한다.
- **Execution Flow / Logic**:
  1. young은 짧은 어두운 머리, 밝은 셔츠, 넥타이와 사원증, 어두운 바지로 표현한다. older는 관자놀이의 회색 머리와 다른 재킷 색으로 구분하되 같은 회사원 세계관의 귀여운 비율을 사용한다. 직급/상하관계 텍스트는 새로 만들지 않는다.
  2. 큰 표정과 짧은 팔다리의 코믹한 달리기 자세를 만든다. 형태는 직사각형 픽셀과 계단 모양 윤곽으로 그린다. 기존 둥근 머리 circle과 부드러운 곡선 몬스터 도형은 제거한다.
  3. idle은 정지 프레임, climb은 run-a/run-b 교대, fall은 팔과 다리를 벌린 stumble 프레임이다. CSS `steps(1,end)`와 정수 이동으로 표현하고 연속 회전으로 픽셀 외곽을 흐리지 않는다. 기존 runner-pose의 smooth 회전 애니메이션은 이 픽셀 자식에 중복 적용하지 않는다.
  4. 플레이어 pose는 lastMistake면 fall, 아니면 isClimbing일 때 climb, 나머지 idle이다. 추격자는 isClimbing 또는 lastMistake/잡힘 연출 중에 climb이고 나머지 idle이다. 기존 motion key에 맞춰 자세 프레임이 재시작되게 한다.
  5. T02의 위치 wrapper와 발 마스크를 유지한다. 캐릭터 내부에 경로 이동, 점수 처리, 오디오, 타이머를 넣지 않는다. 기존 runner/pursuer test ID와 placement data-route-index는 바깥 wrapper에 유지한다.
  6. reduced-motion에서는 프레임 교대/몸체 hop을 끄고 현재 의미에 맞는 정지 자세를 사용한다. 숨겨진 프레임만 남아 인물이 사라지지 않게 idle 또는 stumble 하나를 확실히 보인다.
- **Error & Exception Handling**:
  - variant/direction/pose는 TypeScript union으로 제한한다. 외부 이미지 로딩이나 폰트 다운로드 실패에 의존하지 않는다.
- **State Transition & Return**:
  - 화면의 두 인물만 바꾸며 T02의 추격·접촉·복귀 위치 계산은 유지한다.

### I02. 회사 내부와 창밖 네온 야경
- Related Files:
  - `src/game/pixel/PixelOfficeBackdrop.tsx` :: 회사 내부 배경; new
  - `src/game/pixel/PixelStair.tsx` :: 계단 윗면/앞면 픽셀 도형; new
  - `src/game/pixel/pixel-scene.css` :: 배경/장면 레이어; new
  - `src/game/StairScene.tsx` :: 배경과 계단 renderer 연결; modify

#### Details
- **Input Contract from T02**:
  - 메인 게임 SVG viewBox는 `0 0 520 400`이다. `buildStairSceneModel(state)`가 중앙 `(260,216)`, 간격 34 × 28로 뒤 4/앞 6칸을 만든다.
  - `SceneStep`은 index, direction, x, y를 가진다. 좌표는 발판/인물 발 중심 기준이다. 인물은 자신의 계단 앞면으로 아래쪽이 가려지고, 잡힘 overlay는 발 마스크를 사용한다.
- **Signatures & Types**:
  ```typescript
  function PixelOfficeBackdrop(): ReactElement;
  interface PixelStairProps {
    face: "top" | "front";
    direction: Direction;
  }
  function PixelStair(props: PixelStairProps): ReactElement;
  ```
  - backdrop은 자체 `<svg className="office-backdrop" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">`를 반환한다.
  - stair는 로컬 발 중심 (0,0) 기준의 group을 반환한다. 바깥 renderer가 SceneStep 좌표로 이동시키고 top/front를 나눠 그린다.
- **Data & Schema Fields**:
  - 공통 팔레트: 바탕 `#0b1026`, 실내 벽 `#171e3b`, 패널 `#242b4a`, 밝은 글자 `#eef7ff`, cyan `#61e8e1`, pink `#f07cbd`, gold `#ffd27a`.
  - 계단은 회청색 윗면/짙은 앞면과 얇은 cyan 모서리로 배경과 구분한다. 너비 68/윗면 깊이 24/앞면 높이 16과 기존 발 기준을 유지한다.
  - SVG는 `shapeRendering="crispEdges"`와 정수 좌표를 사용한다. 장면 크기가 바뀌어도 윤곽을 흐리는 filter blur/feDropShadow를 적용하지 않는다.
- **Execution Flow / Logic**:
  1. 하늘·태양·풀밭을 제거하고 어두운 회사 벽과 실내 바닥을 만든다. 큰 창문 영역은 대략 x32~488, y32~276에 놓고 세로 창틀로 유리 로비의 넓은 공간감을 표현한다.
  2. 창문 안에는 픽셀 건물 실루엣, 작은 켜진 창, cyan/pink 네온 간판을 둔다. 창틀과 실내 벽이 그 앞에 오도록 그려 야경이 건물 외부임을 명확하게 한다. 간판에 특정 서비스의 로고를 복제하지 않는다.
  3. 벽 쪽 난간과 `02F` 층수 표지로 계단실을 표현한다. 02F는 장식이며 새로운 층수 점수나 난이도 규칙을 추가하지 않는다.
  4. 좌우 가장자리와 아래쪽 배경에 책상/모니터/복사기 소품을 소량 배치한다. 실제 플레이 계단이 아니라 배경 소품임을 알 수 있게 대비를 낮춘다. 소품이나 난간이 인물 얼굴, 모퉁이, HUD 앞에 그려지지 않게 한다.
  5. 실내 배경 SVG는 장면의 절대 배경 레이어로 확장하고, 기존 게임플레이 SVG는 투명 배경의 별도 레이어에 둔다. 배경은 slice로 공간을 채우고 경로 SVG는 meet로 전체 앞뒤 경로를 유지한다. 두 SVG는 같은 장면 컨테이너에 있으며 계단과 배우는 배경보다 앞이다.
  6. PixelStair는 T02의 동일한 상/앞면 경계를 계단형 픽셀 윤곽으로 표현한다. top → actor → front의 렌더 순서와 발 마스크를 유지하고 random/입력 판정은 호출하지 않는다.
  7. `pixel-scene.css`를 StairScene에서 import한다. 기존 game.css보다 구체적인 `.stair-game .pixel-officer...`/`.office-backdrop` 선택자로 아트 프레임과 레이어를 적용한다. T04의 UI theme 파일과 역할을 섞지 않는다.
- **Error & Exception Handling**:
  - 배경 도형은 정적인 상수/배열로 정의하고 render에서 Math.random을 호출하지 않는다. 재렌더할 때 창밖 건물이 바뀌지 않는다.
  - 새 패키지나 외부 리소스 로드를 추가하지 않는다. 픽셀 아트를 CSS 테두리만 바꾼 기존 곡선 그림으로 대신하지 않는다.
- **State Transition & Return**:
  - 기존 props/route/점수/오디오/잡힘 상태 계약을 그대로 소비한다. 새 디자인 자산은 렌더 전용이다.

### I03. 디자인과 동작 연결 검증
- Related Files:
  - `src/game/GameScreen.test.tsx` :: 캐릭터 pose와 기존 애니메이션 계약; modify
  - `src/game/stairSceneModel.test.ts` :: 기존 경로/잡힘 모델; read-only regression

#### Details
- 이전 runner 팔다리 class 개수 4개에 묶인 단언은 제거한다. young/older 변형이 각각 표시되고, 정답/오답 때 플레이어 pose가 climb/fall로 바뀌며 route-index와 motion key가 유지되는지로 검증한다.
- 픽셀 rect 하나하나를 스냅샷으로 고정하는 테스트는 추가하지 않는다. 경로/오디오/회복에 대한 의미 있는 기존 테스트를 유지하고 디자인 품질은 브라우저로 확인한다.
- 양방향, 모퉁이, 거리 4/3/2/1, 잡힘의 정지/접촉 프레임에서 인물이 발판 위에 놓이고 몸 아래쪽만 가려지는지 확인한다.
- 네온 야경은 창밖에, 책상과 복사기는 실내에, 난간/층수 표지는 계단실에 보이는지 확인한다. 계단 길이 4·5·6과 코너마다 바뀌는 구간 모두 읽기 쉬워야 한다.

## Acceptance Criteria
- [ ] 두 인물이 코믹한 young/older 회사원 픽셀 캐릭터로 보이며 몬스터 도형이 사라진다.
- [ ] 계단실·사무실 소품·로비 창문을 섞은 회사 내부이며, 네온 도시는 창밖에 보인다.
- [ ] 계단/배경/인물의 픽셀 모서리가 선명하고 캐릭터와 계단 크기가 유지된다.
- [ ] T02의 동일 경로 이동, 아래쪽 가림, 모퉁이, 잡힘/복귀가 유지된다.
- [ ] reduced-motion에서도 인물이 사라지지 않고 정적인 현재 상태를 읽을 수 있다.

## Validation
- `npm test -- --run src/game/stairSceneModel.test.ts src/game/gameEngine.test.ts src/game/GameScreen.test.tsx` — 대상 회귀 검증 통과.
- `npm run lint` — 통과.
- `npm run build` — 통과.
- 로컬 데모 390×667, 1440×900에서 초기/정답/실수/좌우 모퉁이/잡힘과 reduced-motion을 육안 확인한다. 장면 캡처로 전체 구도와 접촉 순간의 가림을 확인한다. HUD 디자인의 최종 통일은 T04에서 완료한다.

## Commit Message
```text
feat(game): draw pixel office workers and neon office scenery

Plan: 2026-10-22-pixel-stair-game-redesign
Phase: P01-pixel-stair-game
Task: T03-pixel-office-scene

- Replace the runner and monster with comic office workers
- Draw an indoor stairwell with office props and neon windows
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
