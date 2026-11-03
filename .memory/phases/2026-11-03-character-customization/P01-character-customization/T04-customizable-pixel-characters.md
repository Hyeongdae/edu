# Task: T04 Customizable Pixel Characters

## Status: done

## Goal
공통 외형 설정으로 일반 이동4개 프레임과 야근4개 포즈를 그린다. 성별·머리·옷·모자·안경·신발·피부색 선택이 모든 포즈에서 보이고 캐릭터 발 위치와 기존 모션을 유지한다.

## Decision Summary
- T01~T03 완료 후 실행한다. 이 Task는 렌더링 부품과 optional props를 제공한다. 실제 계정 외형을 장면에 전달하는 작업은 T05다.
- SVG 부위와 팔레트를 공유한다. 현재의 young/older는 역할별 나이/체형이고 gender 선택과 별개다.

## Implementation

### I01. 재사용하는 외형 부품
- Related Files:
  - `src/game/pixel/OfficerAppearanceParts.tsx` :: `OfficerHeadArt`, `OfficerOutfitArt`, `OfficerShoeArt`; new
  - `src/game/pixel/officerPalette.ts` :: `OfficerPalette`, `getOfficerPalette` — 순수 팔레트 계산을 React 컴포넌트와 분리해 Fast Refresh 규칙을 준수; new
  - `shared/characterAppearance.ts` :: `CharacterLook`, `APPEARANCE_OPTIONS`, `getDefaultCharacterLook`; read-only
  - `src/game/pixel/characterAppearanceArt.test.tsx` :: 옵션별 실제 부위 표시와 팔레트; new

#### Details
- **Signatures & Types**:
  ```typescript
  export type OfficerExpression = "normal" | "stumble" | "weary";
  export interface OfficerPalette {
    skin: string; skinShade: string; skinHighlight: string;
    hair: string; hairHighlight: string;
    cloth: string; clothShade: string;
    shoe: string; shoeSole: string;
  }
  export function getOfficerPalette(appearance: CharacterLook): OfficerPalette;
  export function OfficerHeadArt(props: {
    variant: OfficerVariant;
    appearance: CharacterLook;
    expression: OfficerExpression;
  }): ReactElement;
  export function OfficerOutfitArt(props: {
    variant: OfficerVariant;
    appearance: CharacterLook;
    pose: "normal" | "dragged";
  }): ReactElement;
  export function OfficerShoeArt(props: {
    appearance: CharacterLook;
    x: number; y: number; width: number;
  }): ReactElement;
  ```
- **Data & Schema Fields**:
  - CharacterLook 필드: gender `male/female`; hairStyle `short/side-part/bob/ponytail`; hairColor `black/brown/gray/blond`; skinTone `light/peach/tan/deep`; outfit `shirt/suit/cardigan`; outfitColor `ivory/navy/purple/teal/rose`; hat `none/straw/cap`; glasses `none/square/round`; shoes `dress/sneakers`; shoeColor `black/brown/white`.
  - base 색은 T01 옵션 swatch를 사용한다. palette의 명암은 로컬 상수로 정의한다. skin shade/highlight: light `#d89579/#f3c7a5`, peach `#d89579/#ffe0bd`, tan `#9c653f/#dfaa7b`, deep `#623923/#ad7654`; hair highlight: black `#41516c`, brown `#976346`, gray `#89909e`, blond `#efd07b`; cloth shade: ivory `#91b6c6`, navy `#1e2e4e`, purple `#4b425f`, teal `#255357`, rose `#82475f`; shoeSole는 black/brown `#748398`, white `#52617b`.
  - 기본 runner: male,short,black,peach,shirt,ivory,none,none,dress,black. 기본 pursuer: male,side-part,gray,light,suit,purple,straw,square,dress,black.
- **Execution Flow / Logic**:
  1. 모든 부품은 기존 원본36×40 픽셀 좌표계 안에서 그린다. 바깥 변환 `translate(-32 -80) scale(2)`와 발바닥 y=40을 바꾸지 않는다.
  2. HeadArt는 뒤쪽 머리 → 얼굴/귀/목 → 앞머리/나이 표현 → 눈/표정 → 안경 → 모자 순서로 합성한다. 단발/묶은 머리 뒤쪽 부분이 얼굴과 옷 위를 가로막지 않게 한다.
  3. gender는 얼굴 윤곽과 디테일로 표현하며 머리/옷/소품 목록이나 저장값을 자동 교체하지 않는다. older의 나이 든 얼굴과 날씬한 체형은 양쪽 gender에서도 역할 특성으로 유지한다.
  4. hat none은 모자 부품을 만들지 않는다. straw는 현재 `.officer-straw-hat` 이름과 도형을 재사용하고, cap은 앞 챙이 있는 독립 도형을 그린다. 모자 착용 시에도 선택 머리의 옆/뒤 부분이 보이게 한다.
  5. glasses none/square/round를 독립 적용한다. 기존 older 사각 안경을 기본으로 재사용하되 선택값이 none이면 자동 안경을 남기지 않는다.
  6. OutfitArt는 torso y22~33의 원래 young/older 및 dragged 윤곽을 사용한다. 셔츠는 단추/카라, 정장은 재킷 라펠/넥타이, 카디건은 앞 여밈/테두리로 실제 형태 차이를 보인다. 이름이나 색만 바꾸는 구현으로 끝내지 않는다.
  7. 팔/손/귀 등 노출 부위는 모두 skin palette를 사용한다. 팔 소매도 선택 cloth/clothShade를 사용하여 몸통과 다른 기본 옷 색이 남지 않게 한다.
  8. ShoeArt는 주어진 x/y/width와 기존2픽셀 높이를 유지한다. 구두는 닫힌 앞코, 운동화는 대비되는 밑창/옆 줄로 구분한다. 신발 종류로 발 기준선을 이동하지 않는다.
  9. 각 부품은 정적인 SVG 도형만 반환한다. timer, global CSS 변경, 이미지 업로드나 외부 네트워크 요청을 추가하지 않는다.

### I02. 일반·야근 렌더러 확장
- Related Files:
  - `src/game/pixel/PixelOfficer.tsx` :: `PixelOfficerProps`, `OfficerFrameArt`, `PixelOfficer`; modify
  - `src/game/pixel/OvertimeOfficer.tsx` :: `OvertimeOfficerProps`, `OfficerHead`, `OvertimeOfficer`; modify
  - `src/game/pixel/pursuerAppearance.test.tsx` :: 기존 밀짚모자/체형 기본값 회귀; modify if necessary
  - `src/game/pixel/pixel-scene.css`, `src/game/overtime-capture-ending.css` :: 프레임/모션 계약; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // 두 기존 props interface에 같은 optional 필드 추가
  appearance?: CharacterLook;
  // 기존 props는 유지한다.
  // PixelOfficer: variant:"young"|"older", direction:"left"|"right",
  //               pose:"idle"|"climb"|"fall"|"jump"
  // OvertimeOfficer: variant:"young"|"older",
  //                  pose:"standing"|"grabbing"|"dragged"|"seated"
  ```
- **Execution Flow / Logic**:
  1. appearance가 없으면 variant young→runner/older→pursuer 기본 look을 사용한다. 현재 scene 호출부를 이 Task에서 바꾸지 않아도 렌더링이 가능해야 한다.
  2. `PixelOfficer`는 기존 FRAMES `idle/run-a/run-b/stumble`의4개 group을 유지한다. 프레임별 머리/몸통/신발을 shared 부위로 교체하고 다리·팔 움직임 좌표는 기존대로 둔다.
  3. `OvertimeOfficer`의 별도 OfficerHead 도형을 shared HeadArt로 대체한다. seated/dragged는 weary, 그 외 normal 표정을 사용한다. 현재 머리 위치 미세 이동을 유지한다.
  4. 야근 standing/grabbing/dragged/seated 모두 같은 OutfitArt와 ShoeArt를 사용하되 앉은 다리·뻗은 팔·손 위치를 유지한다. 피부·소매에 palette를 전달한다.
  5. `.pixel-officer`, `.officer-frame`, `data-officer-frame`, `.officer-body`, 야근 다리 class, 방향 flip과 timer selector를 보존한다. metadata가 필요하면 `data-appearance-*`만 추가한다.
  6. 기본 외형에서 pursuer의4프레임 밀짚모자와 젊은 도망자의 모자 없음, 기존 foot baseline이 유지되어야 한다. 실험용 descent scene은 optional props 덕분에 현재 기본 모습으로 계속 동작한다.

### I03. 렌더링 검증
#### Details
- 양쪽 역할·양쪽 방향과 일반4포즈/야근4포즈를 render하여 선택 부위가 실제 SVG에 존재하는지 확인한다.
- none 선택이 기본 모자/안경을 제거하고, cap/round/ponytail 등의 실제 도형이 나타나는지 검증한다. metadata 값만 비교하는 테스트로 대체하지 않는다.
- 서로 다른 피부색의 얼굴/손, 의상 색의 몸통/소매, 신발 색이 같은 palette를 쓰는지 검증한다.
- 외형 적용 전후 바깥 transform,4프레임 수, 신발 y+height=40을 확인하여 계단에 몸이 끼거나 발이 뜨던 문제를 재발시키지 않는다.
- 작은 동작 차이는 구조 테스트로, 스타일별 알아보기와 소품 겹침은 T05 로컬 브라우저 미리보기로 확인한다.

## Acceptance Criteria
- [x] 모든 카탈로그 항목이 도형 또는 팔레트에 실제 반영된다.
- [x] 남녀/나이 역할과 옷·머리·소품을 독립 조합할 수 있다.
- [x] 모든 일반 프레임과 야근 포즈에서 외형이 일관된다.
- [x] 기본 외형과 프레임/방향/발 기준선 계약이 유지된다.

## Validation
- `npm test -- --run src/game/pixel/characterAppearanceArt.test.tsx src/game/pixel/pursuerAppearance.test.tsx src/game/StairScene.test.tsx src/infinite/InfiniteStairScene.test.tsx src/game/OfficeExitEnding.test.tsx src/game/OvertimeCaptureEnding.test.tsx --maxWorkers=2` — 기본 외형과 공유 부위 회귀 통과.
- `npm run lint` — 오류 없음.
- `npm run build` — 타입/빌드 성공.

## Commit Message
```text
feat(character): render customizable pixel parts across officer poses

Plan: 2026-11-03-character-customization
Phase: P01-character-customization
Task: T04-customizable-pixel-characters

- Share appearance parts between gameplay and overtime officers
- Preserve motion frames and foot placement while adding selectable styles
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Validation Results — 2026-11-03
- 지정한6개 파일126/126 통과(17.79초). 모든 일반 프레임·야근 포즈, 역할/방향, 선택 부위 도형/색상, 발 기준선과 기존 엔딩 회귀를 확인했다.
- `npm run lint`: 통과. 테스트 행렬의 TypeScript tuple 추론 수정 후 해당 테스트 파일 ESLint도 통과했다.
- `npm run build`: 테스트 tuple 타입을 명시한 후 타입/빌드 통과. JS641.68kB(gzip176.94kB), CSS88.41kB(gzip15.27kB). 기존500kB bundle 경고 유지.
- 격리된 headless Chrome에서 실제 컴포넌트10가지 조합을1200×720 정적 격자로 확인했다. 머리·옷·모자·안경·피부/신발 색과 발 착지 기준이 구분됨을 확인했다. 증거: `C:/Users/DEX/AppData/Local/Temp/character-art-preview-20261103.png`.
- 검토용 임시 HTML은 제거했고 게임의 모션 CSS와 장면 좌표를 수정하지 않았다. 실제 계정 선택 UI와 장면 외형 전달은 T05에서 연결한다.
- 순수 팔레트 함수만 별도 `.ts` 파일로 분리한 것은 컴포넌트 파일의 Fast Refresh lint 규칙을 지키기 위한 같은 Task 내 파일 구성 조정이다.
- 기존 미커밋 모바일 CSS는 보존했다. 추가 범위가 필요한 발견: 특이사항 없음.
