# Task: T01 Distinct Face and Eyes

## Status: done

## Goal
같은 머리·옷·눈 모양에서 gender만 바꾸어도 young/older 모두 얼굴형과 눈 주변 특징이 달라진다. 눈5종, 일반 안경 및 넘어짐/야근 표정을 보존한다.

## Decision Summary
- 얼굴·체형을 함께 구분하는 확정안 중 이 Task는 공통 얼굴/눈을 담당한다. 선택한 모든 부위/색상과 나이대는 유지한다.
- 렌더링만 변경하며 CharacterAppearance version2/13필드, 팔·몸통·가방, 외부 좌표/clip/모션은 이 Task에서 변경하지 않는다. 체형은 후속 T02다.

## Implementation

### I01. 공통 얼굴과 눈의 특징 강화
- Related Files:
  - `src/game/pixel/OfficerAppearanceParts.tsx` :: `OfficerEyeArt`, `OfficerHeadArt`, `OfficerExpression` — 실제 공통 얼굴/눈 도형; modify
  - `src/game/pixel/officerPalette.ts` :: `getOfficerPalette`, `OfficerAppearanceInput` — 기존 색상/입력 타입; read-only
  - `shared/characterAppearance.ts`, `shared/expandedCharacterAppearance.ts` :: `CharacterLook`, `resolveCharacterLook` — 기존 계약/정규화; read-only
  - `src/game/pixel/PixelOfficer.tsx`, `src/game/pixel/OvertimeOfficer.tsx` :: 공통 얼굴 호출 및 표정 선택; read-only

#### Details
- **Signatures & Types** (기존 유지):
  ```typescript
  type OfficerVariant = "young" | "older";
  type OfficerExpression = "normal" | "stumble" | "weary";
  type OfficerAppearanceInput = ExpandedLook | LegacyLook;
  OfficerEyeArt(props: {
    variant: OfficerVariant; appearance: ExpandedLook; expression: OfficerExpression;
  }): ReactElement;
  OfficerHeadArt(props: {
    variant: OfficerVariant; appearance: OfficerAppearanceInput; expression: OfficerExpression;
  }): ReactElement;
  ```
- **Data & Schema Fields**: public `CharacterAppearance.version`은2, runner/pursuer는 필수 CharacterLook이다. CharacterLook의13개 필수 non-null 필드는 gender/hairStyle/hairColor/skinTone/outfit/outfitColor/hat/glasses/shoes/shoeColor/eyeStyle/bag/bagColor다. 이 Task는 gender(male/female), eyeStyle(default/round/smile/sleepy/sharp), glasses(none/square/round/sunglasses)를 읽으며 저장 값을 수정하지 않는다. variant의 young/older는 gender와 독립이다. 입력이 없거나 과거 look이면 기존 resolveCharacterLook의 역할별 fallback/보완을 그대로 사용한다.
- **Execution Flow / Logic**:
  1. OfficerHeadArt의 `resolveCharacterLook(input, variant === "older" ? "pursuer" : "runner")`, 기존 palette, female/older 계산을 재사용한다. 외형 객체를 변경하거나 별도 gender 상태를 만들지 않는다.
  2. 현재 얼굴 외곽 `.officer-face-outline`와 피부 `.officer-face-skin`, y19의 피부 보충 사각형, y21의 목을 한 단위로 다듬는다. 남성의 각진 턱/눈썹을 기준으로 여성은 아래쪽 볼→턱의 정수 계단을 더 분명히 좁힌다. 시작 범위: 눈·안경의 x12..28/y10..16 앵커는 유지하고 턱 중심을 x18..20/y20..22에 둔다. 여성 아래 턱 폭은 기존 x13..22보다 좌우1px씩 좁히는 안에서 시작한다. 남성의 넓은 아래 턱은 유지한다. 목은 기존 x16..22/y21..24에 연결한다.
  3. 여성 얼굴을 좁혀도 기존 귀/볼 보충 도형이 외곽 밖을 다시 채우지 않게 함께 조정한다. 눈·안경/모자/머리를 옮기거나 얼굴 전체 scale로 차이를 내지 않는다. 피부4색과 young/older에 같은 얼굴형 원칙을 사용하며 older의 `.officer-age-lines`는 남긴다. 특정 머리나 분홍색을 강제로 부여하지 않는다.
  4. `.officer-eyes` 안에서 선택 눈 본체와 주변 특징을 구분한다. `.officer-eye-shape`에 pupil/눈꺼풀 도형, `.officer-eyebrows`에 눈썹, 여성의 `.officer-eyelashes`에 짧은 바깥 속눈썹 도형을 둔다. 각 wrapper는 실제 path/rect를 포함한다. 기존 `.officer-eyes[data-eye-style][data-expression][data-eye-variant]`는 유지하고 필요하면 그리기 검증용 `data-appearance-gender`만 덧붙인다. 새 저장 필드는 아니다.
  5. 눈5종은 기존 형태를 유지한다. 남성 눈썹은 짧고 두껍게, 여성은 가는 눈썹/짧은 바깥 속눈썹으로 구분한다. 눈 위치는 기존 unframed x13..27/y10..15, framed pupils x16..18와 x25..27/y12..14를 기준으로 한다. 눈썹은 안경 위쪽 y8..10, 속눈썹은 해당 눈의 바깥 끝에1px 단위로 연결한다. smile/sleepy/sharp에도 특징이 적용되되 같은 눈으로 덮어쓰지 않는다. sharp/default/stumble의 기존 눈썹처럼 보이는 선은 눈 본체/새 눈썹 중 한 곳에서만 담당하여 이중 눈썹을 피한다. 구체 path는 비교 표본에서 조정 가능한 구현값이다.
  6. normal은 선택한5종, stumble은 놀란 눈, weary는 지친 눈을 우선한다. stumble/weary 때 gender 주변 특징을 보존하되 같은 gender/안경에서 eyeStyle을 바꾸어도 임시 눈 본체는 동일해야 한다. 이후 normal로 그리면 선택 눈이 복원된다. expression 때문에 gender/eyeStyle을 저장하거나 수정하지 않는다.
  7. none/sunglasses는 기존 위치에 눈을 한 번 그린다. square/round는 기존 렌즈 다음에 눈을 한 번만 그려 선택 눈이 보이게 한다. 선글라스는 눈 다음에 불투명 렌즈를 그리는 순서를 유지한다. 안경/모자가 일부 눈 주변 특징을 가리는 것은 허용하며 턱선 차이는 남아야 한다.
  8. 오류/반환: 순수 렌더링으로 끝낸다. 새 예외·네트워크·타이머·effect·저장·폼 상태는 추가하지 않고 원래 정규화/fallback을 유지한다. JSX 공개 props, 키/클래스와 frame 수를 유지한다.

### I02. 실제 얼굴 도형과 기존 눈 계약 검증
- Related Files:
  - `src/game/pixel/genderAppearanceArt.test.tsx` :: gender별 얼굴/눈 실제 도형 테스트; new
  - `src/game/pixel/expandedCharacterArt.test.tsx` :: 기존 pupil/눈/표정 단언 조정; modify only where new structure requires
  - `src/game/pixel/characterAppearanceArt.test.tsx` :: 얼굴/머리/피부/나이대 회귀; modify if needed
  - `src/game/pixel/pursuerAppearance.test.tsx` :: 기존 나이대·소품 기준; read-only unless a directly changed face selector requires an update

#### Details
- 기존 테스트 패턴: renderToStaticMarkup으로 `<svg>`를 만들고 DOMParser(image/svg+xml)로 읽는다. getAttribute/contains를 사용하며 XML document에 jest-dom matcher를 쓰지 않는다. helper geometry는 path/rect의 d/x/y/width/height/fill을 비교하고 metadata/class 차이만으로 성공하지 않는다.
- young/older 각각에서 같은 선택으로 gender만 바꾸어 얼굴 외곽/눈 주변 실제 geometry가 다르고, `.officer-hair-front`, 선택 모자/안경, palette 피부색 및 older 나이선이 유지되는지 확인한다.
- 두 gender×눈5종×일반 안경 none/square/round: `.officer-eyes`가1개, 각 gender 내 normal 눈 본체5종이 구분되고 gender 주변 도형도 실제로 다르다. 여성 lash와 남성/여성 brow가 실제 도형을 가진다. 선글라스는 같은 선택 눈이 먼저, 불투명 렌즈가 나중이다.
- 두 gender/두 나이대에서 normal→stumble/weary→normal의 복원과 입력 객체 무변경을 확인한다. 과거 look 및 undefined/default도 기존 fallback으로 렌더링된다. 저장 스키마 validator나 기본값을 고치지 않는다.
- 기존 expanded 테스트는 `OfficerEyeArt`의 첫 path가 곧 framed pupil이라고 가정한다. wrapper가 생기면 `.officer-eye-shape` 내부의 실제 pupil을 찾도록 바꾸고 원래 framed default pupil `M16 12H18V14H16ZM25 12H27V14H25Z`의 보존 의도는 유지한다. 테스트를 삭제하거나 모든 눈의 구분/표정 복원 검증을 완화하지 않는다.
- 얼굴만 구현하는 Task이므로 체형 차이 assertion은 T02에서 추가한다. 장면/저장/UI 테스트를 불필요하게 늘리지 않는다.

## Acceptance Criteria
- [x] 같은 선택에서 young/older 모두 성별에 따른 얼굴형/눈 주변 도형이 달라진다.
- [x] 눈5종, 일반 안경 속 단일 눈, 선글라스와 normal/stumble/weary의 의미를 유지한다.
- [x] 피부색/머리/소품/나이대와 선택 객체가 보존된다.
- [x] 몸통/팔/가방/좌표/clip/저장 모델과 게임 규칙은 변경하지 않는다.
- [x] 지정 테스트/lint/build/diff 검증 후 결과·한계를 기록한다.

## Validation
- `npm test -- --run src/game/pixel/genderAppearanceArt.test.tsx src/game/pixel/characterAppearanceArt.test.tsx src/game/pixel/expandedCharacterArt.test.tsx src/game/pixel/pursuerAppearance.test.tsx --maxWorkers=2` — 새 실제 도형/기존 눈·소품 회귀 통과.
- `npm run lint` — 오류 없음.
- `npm run build` — 타입 검사와 빌드 통과. 기존500kB chunk 경고는 유지할 수 있다.
- `git diff --check` — 오류 없음.
- T03이 얼굴/체형 비교 표본과 최종 통합 검증을 담당한다. 이 Task 결과를 전체 작업/배포 완료로 표시하지 않는다.

## Commit Message
```text
feat(character): distinguish face shapes and eye details by gender

Plan: 2026-11-04-character-gender-visual-distinction
Phase: P01-visual-distinction
Task: T01-distinct-face-and-eyes

- Strengthen facial contours brows and lashes while preserving selected eyes
- Keep age cues glasses expressions and existing appearance values
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending
- Next after successful commit: T02-gender-body-and-pose-fit. phase/plan/current를 done1/3 및 Active T02로 동기화한다. 기존 미커밋 pixel-theme.css와 무관한 파일은 스테이징하지 않는다.

## Validation Results — 2026-11-04
- 공통 OfficerHeadArt에서 여성 얼굴 외곽/피부/턱/목과 귀/볼/입을 정수 도형으로 맞췄다. 좁힌 턱 위에 기존 넓은 피부 rect를 덮지 않도록 함께 수정했고 목 아래쪽 x16..22/y23.5의 접점을 보존했다. 남성 얼굴 기본 외곽과 기존 나이대/선택 팔레트는 유지했다.
- OfficerEyeArt의 선택 눈 본체를 .officer-eye-shape로 분리하고 성별/표정에 따른 .officer-eyebrows 및 여성 .officer-eyelashes를 연결했다. 기존 sharp/default/stumble 내부의 눈썹 선을 중복 그리지 않게 정리했다. 안경 속 default pupil 좌표는 유지하고 기존 검사 selector만 새 wrapper에 맞췄다.
- 지정4파일246/246 통과(14.41초). 새32개 사례에서 실제 contour의 수평 단면을 검사하여 여성 턱/피부가 더 좁고 목이 연결되는지 확인했다. 두 나이대·성별·일반 안경에서 눈5종과 단일 눈, 눈썹/속눈썹의 실제 도형, 임시 표정의 eyeStyle 독립성/복원, 선택 객체 무변경, 피부4색·머리·소품·나이선·legacy/missing fallback을 확인했다. 기존 눈/가방/몸통/포즈/발 회귀도 통과했다.
- npm run lint, npm run build, git diff --check 통과. 검증은 집중 테스트→lint→build 순으로 수행했다. 기존 chunk 용량 경고는 유지하며 새로운 패키지나 설정은 추가하지 않았다.
- 기존 TEMP 렌더러로 현재 OfficerHeadArt의 남녀/young·older/눈5종/안경/놀람·지침28개 정적 표본을 생성하고 faces.png를 육안 확인했다. 같은 짧은 머리·색상에서도 턱선과 눈 주변이 구분된다. TEMP/character-gender-visual-distinction-2026-11-04/t01/{faces.svg,faces.png,samples.json}에 보존했다. 브라우저/모바일/애니메이션 검증은 아니며 종합 비교와 실제 장면 검증은 T03에 남긴다. 차단된 Chrome 실행은 재시도하지 않았다.
- 검증 로그 TEMP/gender-face-t01-{tests,lint,build}.log 보존. 원래 몸통/팔/가방/신발/전체 transform/clip/모션/저장 모델은 수정하지 않았다. 기존 pixel-theme.css의2줄 사용자 변경과 무관한 파일은 보존하고 이번 커밋에서 제외했다. 추가 범위 발견: 특이사항 없음. push/배포는 수행하지 않았다.
