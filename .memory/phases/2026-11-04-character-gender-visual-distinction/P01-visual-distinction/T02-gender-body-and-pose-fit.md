# Task: T02 Gender Body and Pose Fit

## Status: in_progress

## Goal
선택한 옷과 소품을 유지하면서 두 나이대 모두 남녀 어깨/몸통 윤곽이 구분된다. 게임4프레임과 야근4포즈에서 팔·목·가방이 자연스럽게 연결되고 기존 손/발 기준점은 유지된다.

## Decision Summary
- T01 완료 후 실행한다. 얼굴/눈의 gender 표현은 공통 렌더러에 구현되어 있고 이 Task는 공통 옷과 포즈별 팔/가방의 맞춤을 한 커밋에서 수행한다.
- 기존 남성 기본 몸통/손/발을 기준으로 여성의 어깨와 몸통을 좁혀 구분한다. 전체 scale이나 발 clip을 변경하지 않고, 성별에 따른 옷/머리/소품 자동 교체 및 신규 저장 필드는 만들지 않는다.

## Implementation

### I01. 같은 의상의 어깨·몸통 윤곽 구분
- Related Files:
  - `src/game/pixel/OfficerAppearanceParts.tsx` :: `OfficerOutfitArt` — 몸통 외곽/피부·옷 접점/의상 디테일; modify
  - `shared/characterAppearance.ts`, `shared/expandedCharacterAppearance.ts` :: `CharacterLook`, `resolveCharacterLook` — 현재 계약; read-only
  - `src/game/pixel/officerPalette.ts` :: `OfficerAppearanceInput`, `getOfficerPalette` — 색상/legacy 입력; read-only

#### Details
- **Signatures & Types** (유지):
  ```typescript
  OfficerOutfitArt(props: {
    variant: "young" | "older";
    appearance: OfficerAppearanceInput;
    pose: "normal" | "dragged";
  }): ReactElement;
  ```
- **Data & Schema Fields**: 저장 객체는 `{ version: 2, runner: CharacterLook, pursuer: CharacterLook }` 그대로다. CharacterLook의 gender/hairStyle/hairColor/skinTone/outfit/outfitColor/hat/glasses/shoes/shoeColor/eyeStyle/bag/bagColor는 모두 필수 non-null 문자열이다. 이 Task는 gender(male/female), outfit(shirt/suit/cardigan/hoodie/vest), variant(young/older), pose(normal/dragged)로 그릴 도형을 고른다. 새 variant나 실루엣 저장 필드는 없다.
- **Execution Flow / Logic**:
  1. 기존 role별 resolveCharacterLook/palette와 older/dragged 계산을 유지하고 `appearance.gender === "female"`로 로컬 도형만 분기한다. 데이터 자체는 복사/저장/변경하지 않는다.
  2. 남성 normal 외곽 young `M9 22H27V34H9Z`, older `M10 22H26V34H10Z` 및 기존 cloth rect(young x10/y23/w16/h9, older x11/y23/w14/h9)는 유지한다. 남성 dragged 외곽 young `M7 22H23V25H27V34H10V30H7Z`, older `M8 22H22V25H25V34H11V30H8Z`도 유지한다. 기존 기본 남성/추격자 검사와 소품 크기 기준을 보존하기 위함이다.
  3. 여성은 어깨를 좌우1px씩 안쪽으로 넣고 몸통 아래쪽을 더 완만히 정리한다. 아래는 도형을 시작할 정확한 외곽안이며, 정수 좌표에서 팔/의상 디테일/가방 연결을 확인하며 미세 조정할 수 있다. 과장된 가슴/허리 강조 대신 회사원 옷의 옆선으로 표현한다.

     | variant/pose | Female outline starting path | Shoulder bounds |
     | :--- | :--- | :--- |
     | young/normal | `M10 22H26V25H25V29H24V32H25V34H11V32H12V29H11V25H10Z` | x10..26, y22..25 |
     | older/normal | `M11 22H25V25H24V29H23V32H24V34H12V32H13V29H12V25H11Z` | x11..25, y22..25 |
     | young/dragged | `M8 22H22V25H25V29H24V32H25V34H11V32H12V29H9V26H8Z` | x8..22, y22..25 |
     | older/dragged | `M9 22H21V25H24V29H23V32H24V34H12V32H13V29H10V26H9Z` | x9..21, y22..25 |

  4. 외곽 path에 `.officer-torso-outline`, 기존 `.officer-outfit`에 `data-appearance-gender`를 추가하여 실제 도형/선택 전달을 검증한다. 여성 cloth는 외곽 안쪽에1px 테두리를 남기는 path로 그리되 `.officer-cloth[fill]`는 유지한다. normal의 white inner panel은 여성 young x16/width6, older x16/width5 안에서 시작하고 옆 음영/벨트/사원증도 새 외곽에 맞춘다. 패널이 taper 바깥에 칠해져 체형을 다시 넓히지 않게 한다. dragged는 기울어진 기존 목/몸통 접점을 보존한다.
  5. shirt의 칼라/단추, suit의 라펠/넥타이, cardigan의 앞단, hoodie의 후드/끈/주머니, vest의 앞단/단추를 모두 유지한다. 필요한 부분만 새 여성 옷 범위 안으로 옮기거나1px 줄인다. `.officer-{outfit}-details`와 선택 색상을 유지한다. 옷의 종류/기본 팔레트를 변경하거나 성별에 따라 색을 강제하지 않는다.
  6. 새 clipPath, mask 또는 캐릭터/몸통 전체를 축소하는 transform을 추가하지 않는다. 정수 path/rect로 외곽과 디테일을 맞춘다. 원래 헤드/목/다리가 만나는 y21..24 및 y32..34 범위와 신발 기준은 유지한다.
  7. 오류/반환: 기존 fallback/normalization을 유지하는 순수 JSX 렌더링이다. 신규 상태/타이머/요청/예외/설정 API가 없다. 두 성별/나이대 모두 선택한 의상 도형을 반환한다.

### I02. 게임·야근의 포즈별 소매와 가방 연결
- Related Files:
  - `src/game/pixel/PixelOfficer.tsx` :: `OfficerFrameArt`, `PixelOfficer` — idle/run-a/run-b/stumble 소매; modify
  - `src/game/pixel/OvertimeOfficer.tsx` :: `OvertimeOfficer` — standing/grabbing/dragged/seated 소매; modify
  - `src/game/pixel/OfficerBagArt.tsx` :: `OfficerBagBackArt`, `OfficerBagFrontArt`, `placement` — 새 어깨에 맞는 끈; modify only where needed
  - `src/game/pixel/pixel-scene.css`, `src/game/StairScene.tsx`, `src/infinite/InfiniteStairScene.tsx` — 기존 모션/좌표/clip; read-only

#### Details
- **Signatures & Types** (공개 props 변경 없음):
  ```typescript
  type OfficerPose = "idle" | "climb" | "fall" | "jump";
  type OfficerFrame = "idle" | "run-a" | "run-b" | "stumble";
  type OvertimeOfficerPose = "standing" | "grabbing" | "dragged" | "seated";
  PixelOfficer(props: {
    variant: "young" | "older"; direction: "left" | "right";
    pose: OfficerPose; appearance?: OfficerAppearanceInput;
  }): ReactElement;
  OvertimeOfficer(props: {
    variant: "young" | "older"; pose: OvertimeOfficerPose;
    appearance?: OfficerAppearanceInput;
  }): ReactElement;
  type OfficerBagPose = "normal" | "dragged" | "seated";
  interface OfficerBagArtProps {
    variant: "young" | "older"; appearance: ExpandedLook; pose: OfficerBagPose;
  }
  OfficerBagBackArt(props: OfficerBagArtProps): ReactElement | null;
  OfficerBagFrontArt(props: OfficerBagArtProps): ReactElement | null;
  ```
- **Data & Schema Fields**: bag는 none/backpack/laptop/crossbody/briefcase, bagColor는 black/brown/navy/beige다. 기존 가방 placement는 older x=-1, young x=0을 기준으로 briefcase x에-24, dragged x에-1, seated y에+1을 더한다. 이 전체 placement와 케이스/손잡이 위치는 유지하고 필요한 끈의 로컬 path만 어깨/옷 옆선에 맞춘다.
- **Execution Flow / Logic**:
  1. PixelOfficer의4개 frame과 OvertimeOfficer의4개 pose에서 같은 gender를 읽는다. `.officer-body > g` 및 `.overtime-officer > g`의 `translate(-32 -80) scale(2)`, 방향 `scale(±1 1)`, frame/pose class/data, key/animation은 유지한다. 성별 표현을 `.officer-body` 전체 scale로 대신하지 않는다.
  2. normal idle/standing에서 여성 upper sleeve는 남성 기준으로 뒷어깨 x+1/폭-1, 앞어깨 x-1/폭-1로 시작한다. male young back x6/w4, front x26/w4이고 older back x7/w3, front x25/w3이다. female 시작안은 young back x7/w3, front x25/w3, older back x8/w2, front x24/w2다. 손은 원래 x/y/크기에 유지하고 줄어든 소매와 손 사이를 path/작은 연결 rect로 이어 빈 픽셀 구간이 생기지 않게 한다.
  3. run-a/run-b/stumble에서는 손을 들거나 뒤로 보내는 기존 포즈를 유지한다. 어깨 가까운 소매 뿌리만 안쪽으로 맞추고 기존 아래팔/손과 맞닿는 연결을 연장한다. normal 값의 x만 기계적으로 모든 rect에 적용하지 않는다. 특히 older run-b의 앞소매→x28 손 연결이 끊어지지 않아야 한다. 손 위치/놀람 표시/발 위치를 재배치하지 않는다.
  4. grabbing의 붙잡는 손(x young1, older2/y24), dragged의 잡힌 손(x young34, older32/y24), seated의 책상 쪽 손(x young32, older30/y27) 및 머리 transform(seated translate(3 4), dragged translate(-2 0))을 유지한다. 기존 `.overtime-officer-grip`, 보행/앉은 다리 그룹을 유지하면서 proximal sleeve와 torso 접점을 조정한다.
  5. 소매 도형에 `.officer-arm-back`/`.officer-arm-front` 및 `.officer-sleeve`처럼 뜻이 분명한 class를 부여할 수 있다. 값 검증을 위한 작은 식별자이며 별도 모션 CSS를 추가하지 않는다. 손에는 `.officer-hand`를 붙여 기존 좌표를 검증할 수 있다. 기존 클래스/필수 그룹을 제거하지 않는다.
  6. sleeve/shade는 vest일 때 `#e6f2ed`/`#b7cad1`, 그 외 기존 palette.cloth/clothShade를 사용한다. gender 때문에 흰 조끼 소매나 손 피부색이 바뀌지 않는다.
  7. 가방 순서 back→head→outfit→front→팔/다리/신발을 유지한다. none이면 여전히 null이다. female backpack은 끈의 윗부분을 새 어깨로, 아래쪽을 새 torso 안으로 연결하며 가방 케이스를 축소하지 않는다. laptop/crossbody의 어깨끈도 외곽이 좁아져 떠 보이는 부분만 맞춘다. briefcase는 기존 자유로운 손 옆 손잡이/케이스를 유지한다. 동일 gender의 선택 색상/종류는 다른 옷·나이대·표정에서도 보존한다.
  8. 신발/다리 원본 geometry, y=40, 게임 clip rect(-34,-88,68,84), scene/camera/계단 좌표와 판정·CSS 모션은 변경하지 않는다. 렌더러에서 gender 외의 값을 저장하거나 바꾸지 않는다.

### I03. 실제 체형·연결과 기준점 검증
- Related Files:
  - `src/game/pixel/genderAppearanceArt.test.tsx` :: T01 파일에 torso/pose/bag 회귀 추가; modify
  - `src/game/pixel/characterAppearanceArt.test.tsx` :: 여성 소매의 과거 x좌표 selector를 의미 기반으로 갱신; modify where necessary
  - `src/game/pixel/expandedCharacterArt.test.tsx` :: 기존 가방/표정/발 검증 유지·보완; modify if necessary
  - `src/game/pixel/pursuerAppearance.test.tsx` :: 남성 기본 body/의상 기준; read-only

#### Details
- 같은 옷/나이대/pose에서 gender만 바꾸어 `.officer-torso-outline`와 `.officer-cloth`의 실제 도형/bounds가 달라지는지 확인한다. young/older×normal/dragged×옷5종을 포함하며 각 옷의 디테일과 색상이 남아야 한다. 남성 기본 rect/outline을 검증하는 기존 테스트는 그대로 통과해야 한다.
- 두 gender×young/older×게임4프레임/야근4포즈에서 팔-몸통과 팔-손 접점의 실제 도형을 확인한다. 최소 고정 포즈의 연결을 SVG 도형 bounds/교차 또는 정적 픽셀 표본으로 검증한다. class 존재만으로 연결을 증명하지 않는다. 들린 손/붙잡는 손/앉은 손의 기존 좌표와 두 신발 바닥=40을 함께 확인한다.
- 가방5종(색상은 대표색과 기존4색 회귀)을 두 gender와 나이대에서 확인한다. 케이스 모양/색상과 앞뒤 순서는 유지하고 어깨끈 접점을 확인한다. 가방 없음으로 바꾸어도 입력 bagColor는 그대로다.
- female fixture의 `.officer-frame--idle rect[x="6"][y="31"]` 등 기존 손 좌표는 보존하므로 계속 검증한다. 바뀐 upper sleeve를 과거 x좌표로 찾는 검사만 `.officer-sleeve`의 실제 fill/geometry로 갱신한다. 테스트를 지우거나 새 여성 값에 맞춰 모든 좌표 검증을 없애지 않는다.
- DOMParser XML에서는 getAttribute/contains를 사용한다. 부모 transform/frame/pose/clip 검사는 유지한다. 테스트 전후 look을 deep compare하여 선택값 무변경을 확인한다.
- 가능하면 TEMP 정적 SVG 렌더러로 얼굴/몸통/손·가방의 실제 표본을 확인한다. 기존 도구 `%TEMP%/character-expansion-t02-renderer/node_modules/@resvg/resvg-js`, `%TEMP%/character-expansion-t04-static.cjs`를 재사용할 수 있으나 Task용 새 표본은 별도 TEMP 폴더에 둔다. 예전 geometry의 정적 결과를 이번 검증으로 재사용하지 않는다. 새 의존성을 repo에 추가하거나 차단된 Chrome 실행을 우회하지 않는다. 종합 시각 비교는 T03에서 마무리한다.

## Acceptance Criteria
- [ ] 같은 옷에서 두 나이대 모두 성별에 따른 어깨/몸통이 실제로 구분된다.
- [ ] 게임/야근의 모든 포즈에서 목·팔·손·몸통·가방이 연결된다.
- [ ] 옷5종 디테일과 색상, 조끼 소매, 가방 종류/색상/레이어가 유지된다.
- [ ] 손/신발 기준점, 전체 변환/clip/모션과 기존 남성 기본 도형이 보존된다.
- [ ] 신규 저장 필드/API/UI/게임 규칙 변경 없이 집중 검증을 통과한다.

## Validation
- `npm test -- --run src/game/pixel/genderAppearanceArt.test.tsx src/game/pixel/characterAppearanceArt.test.tsx src/game/pixel/expandedCharacterArt.test.tsx src/game/pixel/pursuerAppearance.test.tsx src/game/StairScene.test.tsx src/infinite/InfiniteStairScene.test.tsx src/game/OfficeExitEnding.test.tsx src/game/OvertimeCaptureEnding.test.tsx --maxWorkers=2` — 도형/포즈/가방/기존 장면 기준점 회귀 통과.
- `npm run lint` — 오류 없음.
- `npm run build` — 타입 검사와 빌드 통과. 기존 chunk 경고 때문에 성능 개선 범위를 추가하지 않는다.
- `git diff --check` — 오류 없음.
- 집중 검증→lint→build는 자원 경쟁으로 테스트가 시간 초과하지 않게 순서대로 실행한다. timeout/skip/config 변경으로 회귀를 숨기지 않는다.

## Commit Message
```text
feat(character): differentiate body silhouettes across all officer poses

Plan: 2026-11-04-character-gender-visual-distinction
Phase: P01-visual-distinction
Task: T02-gender-body-and-pose-fit

- Shape gender-specific shoulders and clothing without moving hands or feet
- Fit sleeves and bag straps across gameplay and overtime poses
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
- Next after successful commit: T03-editor-and-scene-validation. phase/plan/current를 done2/3 및 Active T03으로 동기화한다. 기존 pixel-theme.css와 무관한 파일은 커밋에서 제외한다.
