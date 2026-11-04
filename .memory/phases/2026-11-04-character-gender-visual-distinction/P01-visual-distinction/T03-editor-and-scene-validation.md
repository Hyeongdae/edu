# Task: T03 Editor and Scene Validation

## Status: pending

## Goal
사용자가 꾸미기 창에서 gender만 전환했을 때 얼굴/체형이 즉시 바뀌고 나머지 선택이 유지된다. 두 역할/모드/엔딩의 전달과 같은 조건의 남녀 비교 표본을 확인하고 최종 자동 검증 및 남은 수동 검증을 기록한다.

## Decision Summary
- T01은 얼굴/눈, T02는 몸통·모든 포즈·가방 연결을 구현한 상태다. 이 Task는 실제 사용자 입력부터 최종 장면까지 검증하며 새 저장 모델이나 꾸미기 UI를 만들지 않는다.
- 외형 변경은 기존 계정 자동 저장/로컬 세션 메모리를 사용한다. 게임 진행·카운트다운·랭킹과 원본 발/장면 크기를 보존한다. 운영 계정/DB에 테스트하지 않는다.

## Implementation

### I01. 실제 성별 전환과 선택·상태 보존
- Related Files:
  - `src/character/CharacterCustomizationDialog.test.tsx` :: 실제 controlled 편집과 SVG 미리보기; modify
  - `src/game/GameScreen.test.tsx` :: `title character customization integration` — 역할/모드/엔딩 전달; modify
  - `src/character/CharacterCustomizationDialog.tsx` :: `updateField`, preview — inspect; modify only if requested-field propagation is actually missing
  - `src/game/GameScreen.tsx`, `src/infinite/InfiniteModeScreen.tsx` :: `localAppearance`/account binding 및 props — inspect; modify only if an integration gap is found
  - `src/company/types.ts`, `shared/characterAppearance.ts` :: 기존 binding/저장 계약; read-only

#### Details
- **Signatures & Types** (유지):
  ```typescript
  interface CharacterAppearance { version: 2; runner: CharacterLook; pursuer: CharacterLook }
  interface CharacterLook {
    gender: "male" | "female";
    hairStyle: "short" | "side-part" | "bob" | "ponytail" | "long" | "curly";
    hairColor: "black" | "brown" | "gray" | "blond" | "blue" | "pink";
    skinTone: "light" | "peach" | "tan" | "deep";
    outfit: "shirt" | "suit" | "cardigan" | "hoodie" | "vest";
    outfitColor: "ivory" | "navy" | "purple" | "teal" | "rose" | "black" | "sky" | "orange" | "beige";
    hat: "none" | "straw" | "cap" | "beanie" | "beret";
    glasses: "none" | "square" | "round" | "sunglasses";
    shoes: "dress" | "sneakers" | "boots";
    shoeColor: "black" | "brown" | "white" | "navy" | "red" | "beige";
    eyeStyle: "default" | "round" | "smile" | "sleepy" | "sharp";
    bag: "none" | "backpack" | "laptop" | "crossbody" | "briefcase";
    bagColor: "black" | "brown" | "navy" | "beige";
  }
  interface CharacterCustomizationDialogProps {
    binding: AppearanceBinding; storageMode: "account" | "session"; onClose: () => void;
  }
  ```
- **Data & Schema Fields**: `AppearanceBinding`의 value는 전체 CharacterAppearance, status는 idle/pending/saving/saved/error/auth-required, errorMessage는 string|null, update(value)는 전체 외형을 전달하고 retry()는 기존 저장 재시도다. 새 상태/저장 필드가 없다. 기존13그룹 순서/라벨과 `gender` radio 남성/여성을 유지한다. variant(young/older)와 gender를 혼동하지 않는다.
- **Execution Flow / Logic**:
  1. 실제 Harness의 useState로 binding.value를 소유하고 update가 즉시 새 값을 반영하도록 한다. 두 역할에 머리·옷·눈·가방을 미리 선택하거나 유효한 완전한 version2 fixture를 주고, 같은 역할에서 남성→여성→남성을 실제 radio 입력으로 전환한다.
  2. 매 전환에서 성별 외12필드와 반대 역할 전체가 보존되는지 비교한다. update payload는 항상 전체 version2이며 기본 머리/옷으로 초기화하지 않는다. 미리보기 안의 `.officer-face-outline`, `.officer-eyebrows`, `.officer-torso-outline` 등 실제 path/rect가 달라지는지 확인하고 data-gender 변경만으로 성공 처리하지 않는다.
  3. 계정 pending/saving/saved/error/retry 상태가 rerender되어도 선택/미리보기/현재 focus가 유지된다. 성별 전환이 기존 눈/가방 상태를 덮어쓰지 않는다. session 모드는 기존 '이번 접속에서만 유지돼요' 문구를 유지하고 API 성공/영구 저장으로 표시하지 않는다.
  4. GameScreen localAppearance는 모드 조건부 return 이전에 소유되어 타이틀↔단계↔무한 동안 유지된다. 실제 타이틀 꾸미기에서 역할별 성별을 정한 뒤 닫기/초점 복원, 단계 시작3초→플레이/일시정지→타이틀→무한 시작3초→플레이를 확인한다. 기존 왕복 테스트를 필요한 만큼 확장하거나 짧은 독립 사례로 나누어 한 테스트가 과도하게 길어지지 않게 한다.
  5. 실제 account binding의 gender만 바꾼 canonical version2를 rerender하여 현재 scene DOM이 달라지되 진행 점수/시간/추격 위치/카운트다운 시작이 초기화되지 않는 기존 검증을 보강한다. 이를 위해 CompanyRecordStore/API를 새로 구현하거나 raw version1 fixture를 GameScreen에 단언하여 넣지 않는다.
  6. 에러/상태/반환: 기존 Escape/Tab/role arrow/Home/End, 배경 입력 차단, 닫기/trigger focus 복원과 저장 실패 재시도를 보존한다. 전달 누락이 실제 발견된 경우에만 해당 props 경로를 최소 수정하고, 새 소유 상태/타이머/세이브 API는 만들지 않는다.

### I02. 두 모드와 모든 엔딩의 도형/기준점 전달
- Related Files:
  - `src/game/StairScene.test.tsx`, `src/infinite/InfiniteStairScene.test.tsx` :: 두 역할의 얼굴/몸통과 발 위치; modify
  - `src/game/OfficeExitEnding.test.tsx`, `src/game/OvertimeCaptureEnding.test.tsx` :: animated/complete와 모든 야근 포즈; modify
  - `src/infinite/InfiniteModeScreen.test.tsx` :: props 변경 시 외형/점수 유지; modify if the existing case needs added coverage
  - `src/game/StairScene.tsx`, `src/infinite/InfiniteStairScene.tsx`, `src/game/OfficeExitEnding.tsx`, `src/game/OvertimeCaptureEnding.tsx` :: 기존 appearance props 전달; inspect, no coordinate redesign

#### Details
- StairScene/InfiniteStairScene/OvertimeCaptureEnding은 전체 CharacterAppearance를, OfficeExitEnding은 runner CharacterLook을 받는다. 게임4프레임과 야근4포즈는 T02에서 구현된 공통 얼굴/옷을 사용한다. 별도 테스트용 캐릭터/렌더러를 만들어 실제 장면을 우회하지 않는다.
- 같은 stage/infinite 상태에 gender만 바꾼 props를 rerender하고 실제 얼굴/몸통이 바뀌는지 확인한다. 단계 runner translate(260 216), 무한 player translate(260 204), 전체 transform/발 y=40와 기존 clip은 유지한다. 무한 모드의 전체 계단 다음에 배우를 그리는 순서를 보존한다.
- 퇴근 animated/complete의 runner, 야근 animated/complete의 dragged/seated runner와 grabbing/standing pursuer를 확인한다. gender/나이대/눈/옷/가방/색상을 각각 유지하고 야근 runner는 weary, pursuer는 normal인 현재 표현을 보존한다. 저장된 eyeStyle은 상황 표정 때문에 달라지지 않는다.
- 기존 결과·랭킹·pause·restart·countdown 검증은 유지한다. 새clipPath 추가는 요청 범위가 아니며 기존 GameScreen의 scene2개→clip2개/ID 고유/발 rect(-34,-88,68,84) 단언을 그대로 통과시킨다.

### I03. 비교 표본 및 최종 검증 기록
- Related Files:
  - `src/game/pixel/genderAppearanceArt.test.tsx` :: T01/T02 실제 도형 검사; inspect, modify only if visual evidence reveals a directly requested defect
  - `src/game/pixel/OfficerAppearanceParts.tsx`, `PixelOfficer.tsx`, `OvertimeOfficer.tsx`, `OfficerBagArt.tsx` :: 비교 중 발견한 요청 범위의 외형 결함만 수정 가능
  - 이 Task/상위 phase.md/plan.md/`.memory/current.md` :: 완료 결과·제약·커밋 포인터; modify after successful validation

#### Details
1. 기존 dev 서버가 동일 repo/로컬 데모인지 먼저 확인하고 재사용한다. 이전 데모는 http://127.0.0.1:5173/ PID11840이었다. 현재 존재 여부를 확인하되 사용자 서버를 종료하지 않는다. 새 서버가 필요하면 빈 포트에 VITE_AUTH_MODE=entra-spa, VITE_LOCAL_DEMO_MODE=true로 실행하고 task 전용 env 변수만 복원한다. background 실행은 Hidden으로 한다. auth/client/tenant 설정이나 배포 서버를 변경하지 않는다.
2. **필수 비교 표본**: 같은 머리/피부/옷/눈/소품을 고정하고 gender만 바꾼 좌우 쌍을 만든다. 최소 young/older×bare face(모자/안경 없음), 일반 안경, 선글라스/모자 조합을 넣고 옷5종·눈5종은 별도 비교 행으로 보여준다. 전체 캐릭터 idle/run/넘어짐/야근 dragged/seated 및 백팩/서류가방을 포함해 손·끈 접점을 확인한다. 원래 크기에 가까운 표시와 확대본을 함께 확인하여 확대본에서만 차이가 나는 것으로 끝내지 않는다.
3. 허용된 브라우저 도구가 있으면320×568/390×844/768×1024/1440×900에서 타이틀→꾸미기, 두 역할의 gender 전환, 옵션 보존/스크롤/초점, 두 모드 착지, 엔딩을 확인한다. 실제 회사 계정/랭킹에 테스트 기록을 쓰지 않는다.
4. 이전 Chrome 자동 실행은 자동 승인 검토가 blocked by policy로 거절했다. 같은 실행을 다른 경로로 우회하지 않는다. 허용된 도구가 없다면 기존 TEMP의 esbuild+React SSR 및 `@resvg/resvg-js` 정적 렌더러로 실제 컴포넌트를 그린다. `%TEMP%/character-expansion-t02-renderer/node_modules/@resvg/resvg-js`와 `%TEMP%/character-expansion-t04-static.cjs`는 참고 가능한 이전 도구다. 필요한 표본만 새 Task 전용 TEMP 폴더에 만들며 도구가 없으면 임의 설치하지 말고 SVG/DOM 확인 범위와 한계를 명시한다.
5. 정적 렌더링은 실제 컴포넌트/현재 도형을 사용한다. 게임 프레임은 idle/run-a/run-b/stumble 중 하나씩 가시화하여 겹쳐 그리지 않는다. 필요한 CSS 최종 위치를 명시 적용한 엔딩은 정적 표본이라고 기록하고 애니메이션 검증으로 취급하지 않는다. resvg 다수 표본에서 불필요한 시스템 폰트 로딩은 끈다. 브라우저 screenshot과 정적 PNG를 명확히 구분한다.
6. 로그/그림/표본 인덱스는 `%TEMP%/character-gender-visual-distinction-2026-11-04/`에 저장하고 repo에 임시 도구/PNG를 커밋하지 않는다. 수동 미검증은 결과에 남기며 구현 성공과 운영 배포를 혼동하지 않는다.
7. 지정 집중 테스트를 먼저 통과시키고 전체 테스트를 무거운 lint/build와 겹치지 않게 한 번 실행한다. 실패가 있으면 원인을 고친 후 필요한 집중/전체 검증을 다시 한다. 이전 baseline은 frontend/shared56파일1714/1714이며 새 테스트 수는 실제 결과를 기록한다. testTimeout/skip/workers 설정은 바꾸지 않는다.
8. 검증 후 Task done/청사진 커밋→phase done3/3/plan complete/current Active Task없음으로 갱신한다. 실제 모바일/브라우저나 이전 Cosmos 통합 미실행을 숨기지 않는다. 기존 pixel-theme.css 미커밋 변경과 무관한 파일은 제외한다. push/배포는 하지 않는다.

## Acceptance Criteria
- [ ] 실제 gender radio 입력으로 얼굴과 몸통이 바뀌고 다른12개 선택/반대 역할이 보존된다.
- [ ] 기존 계정 상태/초점/실패 재시도와 로컬 메모리 동작을 유지한다.
- [ ] 두 모드와 퇴근/야근의 모든 역할·포즈에 선택이 전달된다.
- [ ] 기존 진행/카운트다운/발/좌표/clip/계단 그리기 순서를 보존한다.
- [ ] 같은 조건의 남녀 비교를 실제 크기/확대본에서 확인하고 static/browser/수동 미검증 범위를 구분한다.
- [ ] 집중/전체 자동 검증 결과와 남은 확인을 기록하고 계획 체인을 완료 상태로 동기화한다.

## Validation
- `npm test -- --run src/character/CharacterCustomizationDialog.test.tsx src/game/GameScreen.test.tsx src/game/pixel/genderAppearanceArt.test.tsx src/game/pixel/characterAppearanceArt.test.tsx src/game/pixel/expandedCharacterArt.test.tsx src/game/pixel/pursuerAppearance.test.tsx src/infinite/InfiniteModeScreen.test.tsx src/game/StairScene.test.tsx src/infinite/InfiniteStairScene.test.tsx src/game/OfficeExitEnding.test.tsx src/game/OvertimeCaptureEnding.test.tsx --maxWorkers=2` — 요청 범위의 사용자 입력/도형/실제 장면 집중 회귀 통과.
- `npm test -- --run --maxWorkers=2` — 전체 frontend/shared 회귀 통과, 정확한 파일/테스트 수 기록.
- `npm run lint` — 오류 없음.
- `npm run build` — 타입/빌드 통과, 기존 chunk 경고 및 실제 용량 기록.
- `git diff --check` — 오류 없음.
- API/DB/schema 변경이 없어 새 emulator/운영 계정 테스트를 만들거나 실행하지 않는다. 이전 Cosmos 통합 미실행은 별도 출시 전 확인으로 인계한다.

## Commit Message
```text
test(character): verify gender changes across editor and game scenes

Plan: 2026-11-04-character-gender-visual-distinction
Phase: P01-visual-distinction
Task: T03-editor-and-scene-validation

- Verify gender-only edits preserve all other appearance choices
- Validate both modes endings and side-by-side visual evidence
```

## Progress
- [ ] 구현/연결 검증 완료
- [ ] 자동 검증 통과
- [ ] 비교 표본 확인 및 실제 브라우저/모바일 확인 여부 기록
- commit: pending
- Next after successful commit: 없음. phase/plan/current를 done3/3 및 Active Task없음으로 동기화하고 전체 구현 결과·미검증 사항·로컬 링크를 보고한다.
