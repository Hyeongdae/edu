# Task: T02 Expanded Pixel Parts

## Status: pending

## Goal
눈5종·가방5종과 새 머리·옷·소품·신발을 실제 픽셀 도형으로 그리고, 모든 이동/야근 포즈에서 착지 기준을 유지한다. 현재 UI/API의 version1 계약은 유지하며 직접 version2 look을 전달한 렌더링도 가능하게 한다.

## Decision Summary
- T01 완료 후 실행한다. 최신 타입/카탈로그는 shared/expandedCharacterAppearance.ts에 있고 public shared/characterAppearance.ts는 아직 과거 계약을 가리킨다. 이번 Task에서 public export를 전환하지 않는다.
- 평소에는 선택한 눈, 넘어짐에는 놀란 눈, 야근에는 지친 눈을 그린다. 가방은 뒤 레이어와 옷 위/팔다리 아래 레이어로 나누며 실제 판정·좌표 모델을 바꾸지 않는다.

## Implementation

### I01. 공통 입력과 확장 팔레트
- Related Files:
  - `src/game/pixel/officerPalette.ts` :: OfficerPalette, getOfficerPalette — 최신/과거 look 색상 처리; modify
  - `shared/expandedCharacterAppearance.ts` :: CharacterLook, APPEARANCE_OPTIONS, normalizeCharacterLook, resolveCharacterLook; read-only
  - `shared/legacyCharacterAppearance.ts` :: CharacterLook 과거 타입; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // 순수 .ts에 type alias를 두어 .tsx Fast Refresh 규칙을 지킨다.
  import type { CharacterLook as ExpandedLook } from "../../../shared/expandedCharacterAppearance";
  import type { CharacterLook as LegacyLook } from "../../../shared/legacyCharacterAppearance";
  export type OfficerAppearanceInput = ExpandedLook | LegacyLook;
  export interface OfficerPalette {
    skin: string; skinShade: string; skinHighlight: string;
    hair: string; hairHighlight: string;
    cloth: string; clothShade: string;
    shoe: string; shoeSole: string;
    bag: string; bagShade: string;
  }
  export function getOfficerPalette(appearance: OfficerAppearanceInput): OfficerPalette;
  ```
- **Data & Schema Fields**:
  - 최신 look은 기존10필드와 eyeStyle default/round/smile/sleepy/sharp, bag none/backpack/laptop/crossbody/briefcase, bagColor black/brown/navy/beige를 갖는다. 전체 기본 외형은 version2다.
  - 추가 스타일: hairStyle long/curly; hairColor blue/pink; outfit hoodie/vest; outfitColor black/sky/orange/beige; hat beanie/beret; glasses sunglasses; shoes boots; shoeColor navy/red/beige.
  - 기본색은 최신 APPEARANCE_OPTIONS의 swatch를 사용한다. 머리 강조색 추가: blue=#81b4df, pink=#e9a2cb. 옷 음영 추가: black=#161e2f, sky=#49849e, orange=#965c2b, beige=#95815f.
  - 가방 음영: black=#141d2f, brown=#4d3325, navy=#1e2e4e, beige=#95815f. 가방 기본색: black=#263247, brown=#785039, navy=#30466d, beige=#c8b38b.
  - 기존 피부 음영/머리 강조색/옷 음영/신발 바닥 색은 유지한다. 가방과 옷 색은 독립적이다.
- **Execution Flow / Logic**:
  1. getOfficerPalette는 normalizeCharacterLook으로 입력을 최신 look으로 복사한다. 잘못된 look은 RangeError로 거부하고 임의 팔레트로 저장/검증을 통과시키지 않는다.
  2. 모든 swatch 조회는 최신 카탈로그를 쓴다. 새 enum에 대응하는 강조색/음영을 모두 채워 undefined fill이 나오지 않게 한다.
  3. 컴포넌트에서 필요한 화면 기본값은 resolveCharacterLook(value, role)을 사용한다. unknown을 기본값으로 표시하는 것과 팔레트 입력 타입은 구분한다.

### I02. 눈·머리·옷·모자·안경·부츠 확장
- Related Files:
  - `src/game/pixel/OfficerAppearanceParts.tsx` :: OfficerHeadArt, OfficerEyeArt, OfficerOutfitArt, OfficerShoeArt; modify
  - `src/game/pixel/characterAppearanceArt.test.tsx` :: 현재 version1 부위 회귀; modify only if selectors must reflect the eye-layer correction
  - `src/game/pixel/expandedCharacterArt.test.tsx` :: version2 스타일·표정 회귀; new

#### Details
- **Signatures & Types**:
  ```typescript
  export type OfficerExpression = "normal" | "stumble" | "weary";
  export function OfficerHeadArt(props: {
    variant: OfficerVariant; appearance: OfficerAppearanceInput; expression: OfficerExpression;
  }): ReactElement;
  export function OfficerEyeArt(props: {
    variant: OfficerVariant; appearance: ExpandedLook; expression: OfficerExpression;
  }): ReactElement;
  export function OfficerOutfitArt(props: {
    variant: OfficerVariant; appearance: OfficerAppearanceInput; pose: "normal" | "dragged";
  }): ReactElement;
  export function OfficerShoeArt(props: {
    appearance: OfficerAppearanceInput; x: number; y: number; width: number;
  }): ReactElement;
  ```
- **Execution Flow / Logic**:
  1. 머리/옷 부위는 variant young→runner, older→pursuer로 입력을 정규화한다. 기존 direct component 테스트에서 과거10필드 look을 전달할 수 있어야 한다. 기존 이름·역할·표정·포즈 시그니처는 유지한다.
  2. normal의 default 눈은 현재 남녀 눈/눈썹을 유지한다. round는 밝은 내부 픽셀+큰 동그란 윤곽, smile은 위로 휜 눈 선, sleepy는 수평의 반쯤 감긴 눈, sharp는 기울어진 눈썹/좁은 눈으로 구분한다. 픽셀 격자로 그리며 기존 눈 영역 x12..28/y9..15 안에서 표현한다.
  3. stumble과 weary가 선택 눈보다 우선한다. 기존의 커진 눈/지친 눈을 사용하며 입력 appearance를 수정하지 않는다. normal 재렌더 시 선택 눈을 다시 표시한다.
  4. 일반 안경의 기본 눈을 따로 그리는 현재 path를 없애고 공통 눈을 한 번 사용한다. default+일반안경 조합의 기존 렌즈 속 눈 위치/크기도 기본 표현의 기준으로 보존한다. 렌즈/테두리는 선택한 눈을 읽을 수 있는 순서로 그린다. 선글라스만 눈 위에 불투명한 어두운 렌즈와 작은 반사 픽셀을 그린다.
  5. 장발은 머리 뒤에서 몸 양 옆으로 내려오는 레이어와 앞머리, 곱슬머리는 계단형 작은 곱슬 윤곽으로 기존4종과 구분한다. 장발 뒤 레이어는 얼굴/몸을 덮지 않는다. 기존 bob/ponytail 뒤 레이어는 유지한다.
  6. 후드티는 후드 테두리/끈/앞 주머니, 조끼는 셔츠 위 민소매 윤곽과 V넥/단추로 구분한다. .officer-hoodie-details/.officer-vest-details에 실제 도형을 둔다. 일반/끌려가는 torso 모두 처리한다. 현재 셔츠·정장·카디건의 기본 표현과 사원증을 보존한다.
  7. 비니는 머리를 감싸는 둥근 픽셀 윤곽+접힌 띠, 베레모는 한쪽으로 넓은 윤곽+작은 꼭지로 구분한다. 색은 옷 팔레트를 재사용한다. 새 모자도 머리/얼굴을 가리지 않게 한다.
  8. 부츠는 입력 y보다 위로 올라가는 shaft/cuff를 추가한다. 기존 .officer-shoe-base의 x/y/width와 높이2, 아래끝 y+2는 유지한다. 밑창과 상단을 추가해도 바닥을 아래로 늘리지 않는다.
  9. 새 클래스 예: .officer-eyes[data-eye-style][data-expression], .officer-hair--long/curly, .officer-beanie-hat, .officer-beret-hat, .officer-glasses--sunglasses, .officer-shoe--boots, .officer-boot-upper. 기존 class와 data-officer-*는 제거하지 않는다.
- **Tests**:
  - 신규 test는 최신 모듈을 직접 import한다. 아직 과거 public 카탈로그의 개수 가정을 새 카탈로그 개수로 바꾸지 않는다.
  - normal 눈5종의 실제 path/rect 조합이 구별되고 일반 안경 아래에서도 같은 선택이 남는지 검증한다. 선글라스 렌즈는 눈 뒤가 아닌 앞에 있는지 확인한다.
  - 선택 눈 A/B의 stumble/weary 도형이 같은 상황별 표현을 쓰고 다시 normal로 돌아오면 원래 A/B가 나오는지 검사한다. 선택 객체는 불변이다.
  - 장발·곱슬/후드·조끼/비니·베레모/부츠의 실제 도형과 색상을 확인한다. 새 색상에 undefined fill이나 잘못된 swatch가 없어야 한다.

### I03. 가방 앞뒤 레이어와 모든 포즈 연결
- Related Files:
  - `src/game/pixel/OfficerBagArt.tsx` :: OfficerBagBackArt, OfficerBagFrontArt; new
  - `src/game/pixel/PixelOfficer.tsx` :: PixelOfficerProps, OfficerFrameArt —4프레임; modify
  - `src/game/pixel/OvertimeOfficer.tsx` :: OvertimeOfficerProps —4야근 포즈; modify
  - `src/game/pixel/expandedCharacterArt.test.tsx` :: 가방/방향/포즈 검증; new
  - `src/game/pixel/pixel-scene.css` :: 기존 frame/pose 모션; read-only
  - `src/game/StairScene.tsx`, `src/infinite/InfiniteStairScene.tsx` :: 좌표/clip/draw order; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export type OfficerBagPose = "normal" | "dragged" | "seated";
  export interface OfficerBagArtProps {
    variant: OfficerVariant; appearance: ExpandedLook; pose: OfficerBagPose;
  }
  export function OfficerBagBackArt(props: OfficerBagArtProps): ReactElement | null;
  export function OfficerBagFrontArt(props: OfficerBagArtProps): ReactElement | null;
  // PixelOfficerProps.appearance 및 OvertimeOfficerProps.appearance:
  appearance?: OfficerAppearanceInput;
  ```
- **Execution Flow / Logic**:
  1. PixelOfficer와 OvertimeOfficer 진입점에서 look을 resolveCharacterLook으로 최신화하여 공통 부위에 전달한다. appearance props 생략 시 기존 역할별 기본 외형을 표시한다.
  2. bag=none은 두 레이어 모두 null이다. backpack은 몸 뒤의 모서리가 접힌 픽셀 상자와 앞의 두 줄 어깨끈, laptop은 얇은 직사각형과 어깨끈, crossbody는 작은 주머니와 사선 끈, briefcase는 손 옆 가로로 긴 상자와 짧은 손잡이·잠금 장치로 구분한다.
  3. 그리기 순서는 bag back→head/hair→outfit→bag front→기존 arms/legs/shoes다. 손·발·얼굴·사원증을 가방으로 가리지 않는다. 뒤/앞 레이어를 같은 큰 사각형으로 대체하지 않는다.
  4. 전체4개 게임 frame idle/run-a/run-b/stumble에 같은 선택을 전달한다. 야근 standing/grabbing은 normal, dragged/seated는 해당 pose를 전달하여 등/어깨/손 위치에 맞춘다. 앉은 포즈에서도 가방으로 책상이나 얼굴을 덮지 않는다.
  5. 원본 좌표에서 가방 대부분을 x1..33/y22..37 안에 둔다. 캐릭터는 기존 translate(-32 -80) scale(2)로 표시되며 main scene clip은 x=-34..34/y=-88..-4다. 가방/장발은 이 영역 안에서 설계하고 clip이나 actor anchor를 넓히지 않는다. 신발 y=38/height2/아래끝40을 유지한다.
  6. `.officer-bag-back/.officer-bag-front`, `data-bag-kind`, `data-bag-pose`, 채색 부위 `.officer-bag-fill`을 둔다. bagColor는 옷과 별개인 palette.bag/bagShade를 쓴다. 방향 반전은 기존 부모 scale을 따르며 추가로 좌우를 반전하지 않는다.
  7. 새 .tsx는 React 컴포넌트만 runtime export한다. 순수 색상 helper를 .tsx에 혼합하지 않는다.
- **Tests**:
  - 두 역할×좌우×idle/climb/fall/jump, 두 역할×standing/grabbing/dragged/seated에서 모든 가방을 전달하여 실제 상자·끈·손잡이·색상과 레이어 순서를 확인한다.
  - 색상 변경은 가방에만 반영되고, bag none이면 모든 가방 요소가 없으며, 옷/성별 변경이 가방 종류·색상을 초기화하지 않는지 확인한다.
  - 기존4frame, data-motion, 좌우 scale과 모든 신발의 아래끝 y40이 유지되는지 검증한다.

## Acceptance Criteria
- [ ] 신/구 look을 모두 그리며 기존 기본 외형을 유지한다.
- [ ] 추가 스타일과 눈5종·가방5종이 실제 도형과 색상으로 구분된다.
- [ ] 일반 안경과 상황별 표정에 눈 선택을 올바르게 반영한다.
- [ ] 모든 pose·방향에서 가방이 표시되고 발 위치·모션·clip을 변경하지 않는다.
- [ ] public 계약은 version1을 유지하며 API/UI의 새 계약 활성화는 T03에서 한다.

## Validation
- `npm test -- --run src/game/pixel/expandedCharacterArt.test.tsx src/game/pixel/characterAppearanceArt.test.tsx src/game/pixel/pursuerAppearance.test.tsx src/game/StairScene.test.tsx src/infinite/InfiniteStairScene.test.tsx src/game/OfficeExitEnding.test.tsx src/game/OvertimeCaptureEnding.test.tsx --maxWorkers=2` — 새 부위와 기존 장면 회귀 통과.
- `npm run lint` — Fast Refresh를 포함하여 오류 없음.
- `npm run build` — 타입/번들 성공.
- `git diff --check` — 공백 오류 없음.
- headless/browser에서 기존/신규 대표 조합을 정적으로 나열해 확인할 때는 TEMP artifact를 쓴다. 아직 UI에서 새 항목을 선택할 수 있다고 보고하지 않는다.

## Commit Message
```text
feat(character): render expanded styles eyes and layered bags

Plan: 2026-11-04-character-customization-expansion
Phase: P01-appearance-expansion
Task: T02-expanded-pixel-parts

- Draw selectable eyes and new clothing hair and accessories
- Share layered bags across gameplay and overtime poses without moving feet
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
