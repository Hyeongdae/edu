# Task: T04 Expanded Editor and Scene Validation

## Status: pending

## Goal
꾸미기 창에서 눈·가방·가방 색상을 포함한13개 항목을 골라 실제 게임에 적용한다. 두 역할의 선택을 독립적으로 보존하고 모바일·키보드·계정 저장 상태와 모든 장면을 검증하여 확장 계획을 완료한다.

## Decision Summary
- T01~T03 완료 후 실행한다. shared/characterAppearance.ts는 version2 최신 계약을 export하며 API/store는 정상화된 version2를 다룬다. 렌더러는 추가 스타일과 눈/가방을 이미 그린다.
- 기존 타이틀 꾸미기 모달과 400ms 자동 저장을 재사용한다. 로컬은 메모리만 사용하고 실제 운영 계정에 테스트 데이터를 쓰지 않는다. score/추격/시간/판정을 바꾸지 않는다.

## Implementation

### I01. 기존 모달의13개 선택 그룹과 미리보기
- Related Files:
  - `src/character/CharacterCustomizationDialog.tsx` :: FIELDS, CharacterCustomizationDialog; modify
  - `src/character/character-customization.css` :: 기존 옵션 줄바꿈/scroll/focus; modify only as needed
  - `src/character/CharacterCustomizationDialog.test.tsx` :: 전체 선택·역할·저장·초점; modify
  - `shared/characterAppearance.ts` :: version2 계약·카탈로그·clone; read-only
  - `src/company/types.ts` :: AppearanceBinding; read-only
  - `src/game/pixel/PixelOfficer.tsx` :: 준비된 최신/과거 look 렌더링; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export interface CharacterCustomizationDialogProps {
    binding: AppearanceBinding;
    storageMode: "account" | "session";
    onClose: () => void;
  }
  export function CharacterCustomizationDialog(props: CharacterCustomizationDialogProps): ReactElement;
  // 기존 함수 시그니처를 바꾸지 않는다.
  const FIELDS: readonly [keyof CharacterLook, string][];
  ```
- **Data & Schema Fields**:
  - FIELDS 순서: gender 성별, hairStyle 머리스타일, hairColor 머리색, skinTone 피부색, eyeStyle 눈 모양, outfit 옷, outfitColor 옷 색상, hat 모자, glasses 안경, shoes 신발, shoeColor 신발 색상, bag 가방, bagColor 가방 색상.
  - 신규 eyeStyle 선택지: default 기본 / round 동그란 눈 / smile 웃는 눈 / sleepy 졸린 눈 / sharp 날카로운 눈.
  - bag: none 없음 / backpack 백팩 / laptop 노트북 가방 / crossbody 크로스백 / briefcase 서류가방.
  - bagColor: black 검정 / brown 갈색 / navy 남색 / beige 베이지. 각 swatch는 카탈로그를 사용한다.
  - 기존 필드에 추가된 스타일과 색상도 현재 APPEARANCE_OPTIONS 매핑으로 모두 표시되어야 한다. 임의 UI 전용 ID나 서버에 없는 색상을 추가하지 않는다.
- **Execution Flow / Logic**:
  1. 기존 도망자/추격자 tablist/tabpanel과 useId, 각 fieldset/legend, 실제 radio 선택·선택 표시·색상 label을 유지하고 새3개 그룹을 추가한다.
  2. 한 필드를 고를 때 최신 binding.value를 clone하고 해당 역할의 해당 필드만 바꿔 binding.update에 전체 version2를 전달한다. 성별/옷/눈/가방 전환이 다른 필드나 다른 역할을 초기화하지 않는다.
  3. 가방 없음이어도 bagColor 그룹을 보이고 조작 가능하게 둔다. 가방 없음→색상 선택→다시 가방 선택 시 고른 색상을 사용한다. none 상태에서 색상을 없애거나 default로 되돌리지 않는다.
  4. 선택 즉시 기존 PixelOfficer preview에 현재 역할의 look을 전달한다. preview는 idle/right이므로 선택한 normal 눈과 가방이 모두 보여야 한다. 새 상태/별도 preview 복사본을 두어 실제 게임과 분리하지 않는다.
  5. 기존 account 상태문구 idle/pending/saving/saved/error/auth-required와 retry를 유지한다. session은 계속 `로컬 미리보기 · 이번 접속에서만 유지돼요.`다. 새 필드 때문에 저장 UI를 새로 구현하지 않는다.
  6. 모달 초기 초점, Tab/ShiftTab focus trap, native radio 이동, 역할 탭의 화살표/Home/End, Escape·닫기·배경 클릭과 trigger 초점 복원을 유지한다. 선택/저장 상태 갱신 때 close로 초점을 되돌리지 않는다.
  7. desktop preview/options2열,720px 이하 위 preview/아래scroll을 유지한다. header/footer가 스크롤에 밀리지 않고 모든13그룹이 접근 가능하게 한다. 터치 영역 최소44×44px, 라벨과 선택 표시를 유지한다. 새 그룹을 숨기거나 작은 아이콘만으로 대체하지 않는다.
  8. 기존 preview viewBox=-48 -96 96 112 및144×168/192×224 크기에서 장발·비니·백팩·부츠가 모두 보이는지 확인한다. 실제 부위가 범위를 벗어나면 T02의 해당 도형을 최소 수정하여 맞추며 main scene 좌표/카메라/clip을 바꾸지 않는다.
- **Tests**:
  - 그룹10개 기대를13개로 바꾸고 새 그룹 명칭과 전체 label/radio를 확인한다.
  - runner에 long/hoodie/backpack/navy/round, pursuer에 curly/vest/beret/briefcase/brown/sharp 등을 연속 선택한 후 각각 실제 도형·색·확인 상태가 유지되는지 검사한다. 선택 성별을 바꿔도 다른 선택을 보존한다.
  - none에서 bagColor를 변경해도 UI값이 남고 착용 시 반영되는지 검사한다. backpack/laptop/crossbody/briefcase의 구분을 실제 SVG로 확인한다.
  - 선글라스를 벗기면 이전 eyeStyle을 다시 표시하고 일반 안경에서는 선택한 눈이 보이는지 확인한다. bag none 외형에 실제 가방 도형이 없어야 한다.
  - account 상태 재렌더/에러 retry/저장 중에도 최신 선택·focus가 유지된다. session은 API성공/실패라고 표시하지 않는다.

### I02. 실제 타이틀·모드·엔딩의 외형 전달 확인
- Related Files:
  - `src/game/GameScreen.tsx` :: 현재 localAppearance/appearanceBinding/타이틀/장면 전달; inspect, modify only if a requested-field integration gap is found
  - `src/game/GameScreen.test.tsx` :: 사용자 조작부터 실제 두 모드·엔딩까지; modify
  - `src/infinite/InfiniteModeScreen.test.tsx`, `src/infinite/InfiniteStairScene.test.tsx` :: 무한 모드 외형/점수 유지; modify
  - `src/game/StairScene.test.tsx` :: 단계 모드 외형/clip/anchor; modify
  - `src/game/OfficeExitEnding.test.tsx`, `src/game/OvertimeCaptureEnding.test.tsx` :: animated/complete 외형; modify
  - `src/game/OfficeExitEnding.tsx`, `src/game/OvertimeCaptureEnding.tsx`, `src/infinite/InfiniteModeScreen.tsx`, `src/infinite/InfiniteStairScene.tsx`, `src/game/StairScene.tsx` :: 기존 props 경로; inspect, no coordinate redesign

#### Details
- **Signatures & Types**:
  - 기존 전달 계약은 그대로다. GameScreen/InfiniteModeScreen/StairScene/InfiniteStairScene/OvertimeCaptureEnding에는 전체 CharacterAppearance, OfficeExitEnding에는 runner CharacterLook을 전달한다. 이 타입은 이제 public version2다.
  - `localAppearance`는 GameScreen이 소유하는 메모리 상태다. `companyRecords?.appearance`가 있으면 실제 계정 binding을 쓴다. 모드 조건부 return 전에 모든 hook을 유지한다.
- **Execution Flow / Logic**:
  1. 타이틀 `캐릭터 꾸미기`에서 선택하고 닫으면 같은 타이틀 배경의 두 캐릭터가 갱신되는지 확인한다.
  2. 단계 선택→시작3초→플레이→일시정지→확인 후 타이틀→무한 모드→시작3초를 거쳐 눈/가방/추가색상이 유지되는지 확인한다. 모달 중 배경 mode/D/J/Space입력 차단과 초점복원도 유지한다.
  3. account binding의 draft/save확인 재렌더가 진행 중인 점수·시간·추격·카운트다운을 초기화하지 않는지 확인한다. 새 메모리/스토어 소유자를 모드 안에 만들지 않는다.
  4. 퇴근 animated/complete는 runner가방과 normal선택눈을, 야근 animated/complete는 두 역할의 가방과 상황별 weary/normal눈을 확인한다. dragged/seated의 runner는 지친눈이어도 선택 eyeStyle 자체는 보존한다.
  5. 기존 motion class/data attributes/두 모드의 정반대 진행방향과 발 anchor를 유지한다. 무한 모드의 전체 계단→캐릭터 순서를 보존하여 다음 계단이 몸을 가리지 않게 한다.
  6. 실제 저장은 API→store→binding 경로(T03)에서 확인한다. GameScreen에 raw version1 fixture를 타입 단언해 넣어 호환을 검증했다고 간주하지 않는다. HTTP 읽기 경계가 정상화한 version2를 화면에 전달해야 한다.
- **Tests**:
  - 실제 모달 선택, controlled binding 재렌더, 최종 scene DOM을 확인한다. update callback 호출 검증만으로 마치지 않는다.
  - session 선택이 모드/타이틀 이동 동안 유지되고 unmount/reload 뒤 초기화되며 appearance localStorage/실서버 호출이 없는지 검사한다.
  - 두 엔딩의 animated/complete와 네 야근 pose의 실제 가방 종류/색, 눈 표현과 정상복귀를 확인한다.
  - 기존 단계/무한 score·pause·restart·랭킹·입력·오디오 동작을 변경하지 않는다. 새 외형 때문에 테스트가 실패하면 타입/도형/필드 전달 원인을 고치고 timeout/skip/config로 감추지 않는다.

### I03. 브라우저와 최종 검증·기록
- Related Files:
  - `src/character/character-customization.css` :: 실제 화면에서 확인된 배치 문제만 보완; modify if necessary
  - 이 Task 파일, 상위 phase.md, plan.md, `.memory/current.md` :: 검증 결과와 완료 상태; modify after successful validation

#### Details
1. 기존 개발 서버가 같은 프로젝트/로컬 데모인지 확인한 뒤 재사용한다. 사용 중인 서버나 포트를 임의로 종료하지 않는다. 서버가 없으면 빈 포트에 VITE_AUTH_MODE=entra-spa, VITE_LOCAL_DEMO_MODE=true로 `npm run dev -- --host 127.0.0.1 --port 5175 --strictPort`를 실행한다. 임시 환경 변수는 별도 변수에 보관하고 복원하며 background process는 Hidden으로 띄운다.
2. 320×568,390×844,768×1024,1440×900을 확인한다. 타이틀5버튼, 두 역할 탭,13그룹끝까지스크롤, 라벨/44px터치영역, close/footer고정, 가로넘침0을 확인한다. 새 얼굴·장발·모자·가방·부츠가 preview에서 잘리지 않아야 한다.
3. 실제 브라우저에서 radio의 방향키/Tab, 역할탭 화살표/Home/End, Escape·닫은 뒤 초점 복원을 확인한다. JavaScript로 연속 click할 경우 React가 새 props를 반영할 렌더 사이를 기다려 실제 사용자 이벤트 순서와 맞춘다.
4. 새 가방을 포함한 두 캐릭터로 단계/무한 모드를 직접 시작하고 착지·방향 전환·가방레이어를 확인한다. 넘어짐/야근 때 눈 표현이 바뀌어도 다시 정상/꾸미기창에서는 저장된 눈이 남아야 한다. 운영 계정/실제 랭킹을 테스트 목적으로 변경하지 않는다.
5. screenshot/로그는 TEMP의 task전용 폴더에 보존하고 결과·미검증 항목·사용 링크를 Task Progress에 적는다. 검토용임시파일을 repo에 커밋하지 않고 자신이 만든 격리 browser만 종료한다. 기존 개발 서버는 유지한다.
6. 지정검증 후 전체회귀를 한 번 실행한다. 실패수정이 생기면 해당 경로를 먼저 재검증하고 마지막에 필요한 전체검증을 수행한다. 정확한 파일/테스트 수와 build/lint 결과를 기록한다.
7. 모든 구현검증 성공 후 Task done/커밋, phase done4/4, plan complete, current ActiveTask없음으로 동기화한다. emulator/실제계정 미검증을 숨기거나 운영 배포 완료로 표시하지 않는다. push/배포는 별도 요청 범위다.

## Acceptance Criteria
- [ ] 13개 그룹에서 양 역할의 모든 선택과 색상이 독립적으로 동작한다.
- [ ] 즉시 preview와 실제 두 모드·타이틀·모든 엔딩에 새 외형이 전달된다.
- [ ] 가방 없음/색상 유지, 눈 선택과 상황별 표정, 일반 안경/선글라스 조합이 의도대로다.
- [ ] 모바일/키보드·초점·저장 상태·실패 재시도·로컬 메모리 규칙을 유지한다.
- [ ] 기존 계단·발 위치·모션·판정·조작·점수·추격·시간·랭킹을 보존한다.
- [ ] 검증 결과/미검증 영역을 기록하고 계획 포인터를 완료 상태로 갱신한다.

## Validation
- `npm test -- --run src/character/CharacterCustomizationDialog.test.tsx src/game/GameScreen.test.tsx src/infinite/InfiniteModeScreen.test.tsx src/game/StairScene.test.tsx src/infinite/InfiniteStairScene.test.tsx src/game/OfficeExitEnding.test.tsx src/game/OvertimeCaptureEnding.test.tsx --maxWorkers=2` — 새 선택과 실제 연결 회귀 통과.
- `npm test -- --run --maxWorkers=2` — 최종 전체 frontend/shared 회귀 통과.
- `npm --prefix api test` — API 계약/기록 보존 회귀 통과.
- `npm run lint`, `npm run build`, `npm --prefix api run build`, `git diff --check` — 오류 없음.
- T03의 emulator 통합 검증 결과를 확인한다. 실행 환경이 없으면 미실행을 명시하고 기존 CI 통과가 배포 전 필요함을 남긴다. 이 작업에서 Docker를 설치하거나 운영 DB를 사용하지 않는다.
- 기존 미커밋 src/game/pixel-theme.css와 무관한 파일을 스테이징하지 않는다.

## Commit Message
```text
feat(character): expose expanded customization and verify all game scenes

Plan: 2026-11-04-character-customization-expansion
Phase: P01-appearance-expansion
Task: T04-expanded-editor-and-scene-validation

- Add eye and independent bag selections to the accessible character editor
- Verify mobile controls saved appearance and all mode and ending scenes
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
