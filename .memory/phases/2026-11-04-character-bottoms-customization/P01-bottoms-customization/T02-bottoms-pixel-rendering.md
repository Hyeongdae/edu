# Task: T02 Bottoms Pixel Rendering

## Status: done

## Goal
하의4종/색6종을 두 역할의 모든 게임·야근 포즈에 그린다. 남색 긴바지는 기존 다리/신발 위치를 유지하고 새 하의만 실제 모양으로 구분하며, public v2/UI/저장 계약은 유지한다.

## Decision Summary
- T01의 `shared/bottomsCharacterAppearance.ts`가 strict v3와 v1/v2 표시 정규화를 제공한다. 기본 bottoms=trousers, bottomsColor=navy다.
- 단순 재색칠로 반바지/치마를 표현하지 않는다. 신발 바닥 y=40과 야근 CSS가 사용하는 앞뒤 다리 그룹을 보존한다. 계획2026-11-04-character-bottoms-customization/P01-bottoms-customization.

## Implementation

### I01. 새 계약을 표시 계층에 연결하고 하의 팔레트 추가
- Related Files:
  - `src/game/pixel/officerPalette.ts` :: OfficerAppearanceInput, OfficerPalette, getOfficerPalette — modify.
  - `src/game/pixel/OfficerAppearanceParts.tsx` :: resolveCharacterLook import, OfficerHeadArt/OfficerOutfitArt/OfficerShoeArt — modify only for v3 input support.
  - `src/game/pixel/PixelOfficer.tsx` :: resolveCharacterLook, OfficerFrameArt type/import — modify.
  - `src/game/pixel/OvertimeOfficer.tsx` :: resolveCharacterLook import — modify.
  - `src/game/pixel/OfficerBagArt.tsx` :: OfficerBagArtProps/배치/레이어 — read-only unless a narrow type adaptation is required.
  - `shared/bottomsCharacterAppearance.ts` :: v3 normalizer/catalog — read-only.
  - `shared/characterAppearance.ts`, `shared/expandedCharacterAppearance.ts`, `shared/legacyCharacterAppearance.ts` :: 아직 public v2/고정 계약 — read-only.

#### Details
- **Signatures & Types**:
  ```typescript
  // 세 타입은 각각 bottomsCharacterAppearance/expandedCharacterAppearance/legacyCharacterAppearance에서 import.
  export type OfficerAppearanceInput = BottomsLook | ExpandedLook | LegacyLook;
  export interface OfficerPalette {
    skin: string; skinShade: string; skinHighlight: string;
    hair: string; hairHighlight: string; cloth: string; clothShade: string;
    shoe: string; shoeSole: string; bag: string; bagShade: string;
    bottoms: string; bottomsShade: string; bottomsDeepShade: string;
  }
  export function getOfficerPalette(input: OfficerAppearanceInput): OfficerPalette;
  ```
- **Data & Schema Fields**: 기존 피부/머리/상의/신발/가방 팔레트는 변경하지 않는다. 하의 front/back/deep은 black #283247/#161e2f/#10182c, navy #354766/#2c3b59/#22304c, gray #788394/#525f71/#394657, beige #c8b38b/#95815f/#6f6048, brown #785039/#4d3325/#34251d, white #e6edf2/#b1bfcc/#8092a4다.
- **Execution Flow / Logic**:
  1. getOfficerPalette는 v3 normalizeCharacterLook를 사용해 정상 v1/v2/v3를 공통 v3로 바꾼다. 잘못된 input은 기존처럼 RangeError다. 기존 swatch helper를 재사용한다.
  2. PixelOfficer/OvertimeOfficer/공통 머리·상의의 resolve import를 새 v3 모듈로 바꾼다. OfficerFrameArt의 resolved appearance 타입도 v3로 바꾼다. public export는 변경하지 않는다.
  3. OfficerEyeArt와 OfficerBagArt가 v2의 공통13필드 타입을 받는 것은 v3도 구조적으로 만족하므로 불필요하게 갈아엎지 않는다. 다만 이 부품이 내부에서 v2 strict normalize를 호출해 v3를 기본값으로 되돌리지 않게 한다. 현재 bag는 getOfficerPalette만 호출하므로 위 팔레트 변경으로 지원된다.
  4. 기존 하의 없는 v2 미리보기/fixture도 새 표시 경로에서 기본 긴바지로 동일하게 렌더링되어야 한다.

### I02. 공통 하의/다리/신발 부품
- Related Files:
  - `src/game/pixel/OfficerBottomsArt.tsx` :: OfficerBottomsArt, 포즈별 다리/신발 표 — new.
  - `src/game/pixel/PixelOfficer.tsx` :: OfficerFrameArt의 각 frame별 하의/신발 블록 — modify.
  - `src/game/pixel/OvertimeOfficer.tsx` :: seated/walking legs 블록 — modify.
  - `src/game/overtime-capture-ending.css` :: 앞뒤 다리 애니메이션 선택자 — read-only.
  - `src/game/pixel/OfficerAppearanceParts.tsx` :: OfficerShoeArt — reuse; 발 기준 변경 금지.

#### Details
- **Signatures & Types**:
  ```typescript
  export type OfficerBottomsPose = "idle" | "run-a" | "run-b" | "stumble"
    | "standing" | "grabbing" | "dragged" | "seated";
  export interface OfficerBottomsArtProps {
    variant: OfficerVariant;
    appearance: OfficerAppearanceInput;
    pose: OfficerBottomsPose;
  }
  export function OfficerBottomsArt(props: OfficerBottomsArtProps): ReactElement;
  ```
- **Data & Schema Fields**: 새 게임 상태나 저장 필드는 추가하지 않는다. 렌더링만 v3의 bottoms/bottomsColor/skinTone/shoes/shoeColor를 소비한다. 나이대는 variant의 young/older이며 gender와 혼동하지 않는다.
- **Execution Flow / Logic**:
  1. 현재 PixelOfficer의 다리 rect와 OvertimeOfficer의 다리 path/신발을 한 부품으로 옮긴다. 각 다리의 기존 도형을 두 가지 명암으로 재사용하여 기본 남색 긴바지의 실루엣이 그대로 남게 한다. 아래 표의 `Y/O`는 young/older 값이다. rect는 x,y,w,h 형식이며 쉼표는 같은 다리의 추가 rect다.

  | Pose | Back leg | Front leg | Shoes: back x/w; front x/w (모두 y=38) |
  | :--- | :--- | :--- | :--- |
  | idle | rect(Y12/O13,34,Y5/O4,5) | rect(21,34,Y5/O4,5) | Y10/O11,Y8/O7; 20,Y9/O8 |
  | run-a | rect(11,33,Y6/O5,4), rect(7,35,Y6/O5,4) | rect(21,33,Y5/O4,4), rect(24,36,Y5/O4,3) | 5,9; 24,8 |
  | run-b | rect(12,33,Y5/O4,4), rect(10,36,Y5/O4,3) | rect(20,33,Y6/O5,4), rect(24,35,Y6/O5,4) | 8,8; 24,8 |
  | stumble | rect(Y8/O9,33,Y9/O8,4), rect(Y6/O7,36,Y6/O5,3) | rect(21,33,Y7/O6,4), rect(25,36,Y5/O4,3) | Y3/O4,Y10/O9; 24,Y8/O7 |
  | standing/grabbing | Y:M12 33H17V39H12Z / O:M13 33H17V39H13Z | Y:M21 33H26V39H21Z / O:M21 33H25V39H21Z | Y10/O11,Y8/O7; 20,Y9/O8 |
  | dragged | Y:M11 33H17V36H13V39H8V37H11Z / O:M12 33H17V36H14V39H9V37H12Z | Y:M21 33H26V36H29V39H24V37H21Z / O:M21 33H25V36H28V39H24V37H21Z | Y6/O7,Y8/O7; 24,Y9/O8 |
  | seated | Y:M12 33H29V36H24V35H12Z / O:M13 33H28V36H24V35H13Z | Y:M19 32H31V34H33V39H28V35H19Z / O:M19 32H30V34H32V39H28V35H19Z | 21,8; 28,7 |

  2. seated의 추가 깊은 그림자 `M23 35H27V39H23Z`도 유지하고 bottomsDeepShade를 사용한다. 기본 긴바지는 다리 외에 기존 torso의 허리/벨트와 모든 신발을 유지한다.
  3. trousers는 표의 전체 다리 도형을 back/front 색상으로 채운다. jeans는 같은 바탕에 1px 주머니/솔기와 y=37의1px 밑단을 더한다. 디테일이 다리 도형 밖으로 나오지 않게 각 다리 도형으로 clip한다. 솔기 색은 bottomsDeepShade, 밝은 밑단은 front 색을 사용한다. clipPath는 React useId와 부위 접미사를 사용해 동일 SVG의 여러 캐릭터/프레임에 중복 ID가 없게 한다.
  4. shorts는 기존 다리 전체를 skin/skinShade로 먼저 그리고 y<35의 옷 부분만 기존 다리 도형으로 clip해서 덮는다. 상의/허리에서 무릎 부근까지 옷이 있고 y35~38에는 선택 피부색이 보여야 한다. 신발/부츠를 마지막에 그려 피부가 부츠를 덮지 않게 한다.
  5. skirt는 기존 다리를 피부색으로 그리되 치마 아래 노출(y>=36)만 남기고, y33~36의 연결된 밑단을 추가한다. 포즈별 허리/다리의 범위에 맞춘 픽셀 다각형을 사용한다. 기본 idle/standing/grabbing young 예시는 `M11 33H27V34H28V36H10V34H11Z`, older는 양쪽을1px 좁힌다. run-a는 `M11 33H26V34H28V36H9V35H11Z`, run-b는 `M12 33H26V34H29V36H9V35H12Z`, stumble은 `M8 33H28V34H29V36H6V35H8Z`, dragged는 `M11 33H26V34H29V36H8V35H11Z`, seated는 `M12 33H29V34H31V36H23V35H12Z`를 young 기준으로 삼는다. older/좁은 몸통은 연결된 허리 안에서1px 내측 조정하고 신발 위치는 바꾸지 않는다. y35의1px 밑단과 뒤쪽 명암으로 옷 모양을 구분한다. 기존 다리 좌표를 움직여 치마로 대체하지 않는다.
  6. 공통 부품 root에 `.officer-bottoms`, `.officer-bottoms--{kind}`, `data-bottoms-kind`, `data-bottoms-color`, `data-bottoms-pose`를 둔다. 다리/옷/노출 피부/jeans 디테일/치마 밑단에 의미 있는 selector를 두되 실제 도형 검증을 함께 작성한다.
  7. 게임에서는 각 frame의 팔/손 다음 기존 다리 자리에 부품을 넣는다. run-a/run-b/stumble의 팔/손/놀람 장식/머리/가방과 `.officer-frame` 그룹은 유지한다.
  8. 야근의 seated는 `.overtime-officer-seated-legs`, 나머지는 `.overtime-officer-walking-legs` 및 `.overtime-officer-leg-back/front`를 유지한다. 해당 다리와 신발을 같은 앞/뒤 그룹 안에 둬 기존 CSS의 transform/reduced-motion을 그대로 받게 한다. 치마 연결부는 허리 아래 공통 그룹에 두고 다리 움직임에 따라 찢어지지 않게 한다. 신발을 그룹 밖으로 빼지 않는다.
  9. 외부 translate(-32 -80)/scale(2), 방향 scale, 캐릭터 전체 크기, 계단 발 clip, 장면/카메라/모션 규칙은 그대로다. 새 SVG가 입력 appearance를 수정하지 않게 한다.

### I03. 도형/조합/포즈 회귀
- Related Files:
  - `src/game/pixel/bottomsAppearanceArt.test.tsx` :: 하의 실루엣/색/레이어/발/호환 — new.
  - `src/game/pixel/characterAppearanceArt.test.tsx`, `expandedCharacterArt.test.tsx`, `genderAppearanceArt.test.tsx`, `pursuerAppearance.test.tsx` :: 기존 불변조건 — modify only selectors that depended on moved leg wrappers.

#### Details
- 두 나이대/성별×8포즈에서 trousers/jeans/shorts/skirt를 같은 기존13필드로 비교한다. 남색 긴바지 기본 도형/색/신발 좌표가 표와 일치하고 v1/v2 입력은 같은 기본 하의가 되는지 검사한다.
- 여섯 색상이 앞/뒤/깊은 명암으로 실제 SVG에 반영되는지, jeans 디테일이 clip 안에 있는지, 반바지/치마는 노출된 다리에 선택한 피부색을 쓰는지 확인한다. labels/classes만 검증하지 않는다.
- trousers와 jeans, shorts와 skirt의 실제 픽셀 점유/명암 차이를 검사한다. 치마는 허리 밑단이 끊어지지 않고 좌우 다리가 그대로 연결되어야 한다.
- 부츠3px 윗부분/밑창, 백팩/노트북/크로스/서류가방의 기존 위치, 상의5종·여성 몸통/나이대와 하의 연결을 확인한다. 조합은 가림/좌표 경계에 영향을 주는 사례를 중심으로 구성한다.
- 동일 SVG의 두 역할·네 프레임을 렌더링하여 useId clip 참조가 실제 올바른 로컬 도형을 가리키고 중복되지 않는지 확인한다. 야근 CSS 다리 그룹 안에 신발/옷이 남는지 검사한다.
- 기존 머리/눈/손/상의/가방 검사를 삭제하지 않는다. DOM 계층이 달라진 검사만 새 하의 부품의 의미 있는 selector로 좁힌다.

## Acceptance Criteria
- [x] 4종이 실제 도형으로 구분되고 모든 색/피부/신발/포즈에 연결된다.
- [x] 기본 남색 긴바지와 발 y=40, 기존 모션/야근 다리 그룹 및 기타 선택이 유지된다.
- [x] 정상 v1/v2/v3를 표시하고 public/API/UI는 여전히 v2다.
- [x] 정적 비교와 자동 검증의 범위를 기록한다. 실제 브라우저 실행 차단을 우회하지 않는다.

## Validation
- `npm run test -- --run src/game/pixel/bottomsAppearanceArt.test.tsx src/game/pixel/characterAppearanceArt.test.tsx src/game/pixel/expandedCharacterArt.test.tsx src/game/pixel/genderAppearanceArt.test.tsx src/game/pixel/pursuerAppearance.test.tsx src/game/OfficeExitEnding.test.tsx src/game/OvertimeCaptureEnding.test.tsx src/game/StairScene.test.tsx src/infinite/InfiniteStairScene.test.tsx --maxWorkers=2` — 기존 불변조건과 새 하의 검증 통과.
- `npm run lint`, `npm run build`, `git diff --check` — 통과.
- 현재 부품의 SSR SVG 표본을 TEMP 아래 원래 크기와2배 크기로 저장해 긴바지/청바지/반바지/치마·노출 피부·부츠·seated를 비교한다. 실제 브라우저 애니메이션 확인이라고 기록하지 않는다.

## Commit Message
```text
feat(character): render customizable bottoms across officer poses

Plan: 2026-11-04-character-bottoms-customization
Phase: P01-bottoms-customization
Task: T02-bottoms-pixel-rendering

- Share bottoms geometry and colors across game and office poses
- Preserve legacy trousers, shoe anchors and animated leg groups
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `e30fea8`

## Execution Result — 2026-11-04
- OfficerBottomsArt를 추가해 원래 다리/신발 좌표를 공통 표로 옮겼다. PixelOfficer의4프레임과 OvertimeOfficer의4포즈가 이 부품을 사용한다. 상의/머리/팔/손/가방/외부 transform/신발 바닥 y=40과 야근의 앞뒤 다리 CSS 그룹을 보존했다.
- officerPalette에6색의 앞/뒤/깊은 명암을 더하고 표시 계층의 resolve를v3로 연결했다. 고정 v1/v2와 public v2, API/DB/편집 화면/게임 규칙은 바꾸지 않았다. OfficerBagArt는 기존 공통13필드 타입과 배치를 그대로 사용한다.
- 청바지는 clip 내부의1px 솔기/주머니/대비되는 밑단, 반바지는y35부터 피부색 다리, 치마는 연결된y33~36 밑단과y36부터 피부색 다리다. 부츠는 다리 위에 마지막으로 그린다. 필요한 하의에만 useId 기반 clipPath를 만들고 기본 긴바지는 추가 clip 정의가 없다.
- 기존4개 픽셀 테스트278/278 통과. 첫 지정9파일 실행은460통과/3실패: 기본 긴바지에도 만든 불필요한 clip 정의가 기존 장면의 clip 개수 검사에 걸렸다. 테스트를 느슨하게 바꾸지 않고 불필요한 정의 생성을 제거해463/463을 통과했다.
- 테스트 helper를 강화한 뒤 옷/가방 조합을 한 테스트에서50번씩 검사하던2건이5초를 넘었다. timeout/skip/config를 늘리지 않고 같은 전체 조합을 나이대·성별·상의별 사례로 분리했다. 최종 지정9파일481/481(30.80초), 고정 v2 fixture import를 명확히 한 뒤 새 하의 검사115/115(10.75초) 통과. 기존 테스트 파일은 수정하지 않았다.
- lint/프런트엔드 타입·빌드/diff check 통과. JS667.92kB(gzip184.06kB)/CSS92.97kB(gzip15.88kB), 기존500kB chunk 경고 유지. 마지막 테스트 fixture import 조정 후 해당 파일 ESLint도 통과했다.
- TEMP/character-bottoms-customization-2026-11-04/t02/에 실제 SSR SVG와 PNG 표본을 생성·육안 확인했다. styles16/movement16/office16/colors24/boots8의80조건을 원래 표시 크기/2배로 비교했다. 별도로 기준커밋097c26c의 기존 부품과 현재 부품을 나이대2×성별2×포즈8, 백팩/부츠 포함32조건에서 렌더링하여 PNG 바이트32/32 일치를 확인했다. baseline-summary.json, baseline-results.json과 각 before/after 파일에 보존했다.
- 초기 TEMP 표본 생성기는 프리뷰 메타데이터를 appearance에 섞어 잘못된 입력으로 만든 실수가 있었다. 생성기를 수정한 뒤 정상15필드/과거13필드로 다시 생성해 위 결과를 확인했다. 제품 코드의 입력 검증을 완화하지 않았다.
- 실제 브라우저/모바일 레이아웃/애니메이션 재생 및 회사 계정/Cosmos 확인은 실행하지 않았다. 이전 Chrome 실행 차단을 우회하지 않았다. 정적/DOM 검사와 실제 브라우저 확인을 구분한다. push/배포 없음. 별도 범위 결함은 특이사항 없음.
