# Task: T04 Bottoms Editor and Scenes

## Status: pending

## Goal
타이틀의 캐릭터 꾸미기에 상의/하의 구분과 하의4종·색6종을 노출한다. 선택이 미리보기·타이틀·두 모드·퇴근/야근 엔딩까지 전달되고 계정 저장 상태와 게임 진행을 보존함을 최종 검증한다.

## Decision Summary
- T01~T03 완료 전제: public/API는 version3, 양쪽 look는 기존13개+bottoms/bottomsColor의15필드이며 정상 v1/v2는 기본 긴바지/남색만 보완한다. 모든 렌더러는 최신 하의를 지원한다.
- 기존 타이틀 진입/도망자·추격자 탭/미리보기/400ms 자동 저장을 재사용한다. 하의와 색상 변경은 반대 역할이나 다른 필드를 초기화하지 않는다. 계획2026-11-04-character-bottoms-customization/P01-bottoms-customization.

## Implementation

### I01. 선택 그룹과 미리보기
- Related Files:
  - `src/character/CharacterCustomizationDialog.tsx` :: FIELDS, updateField, options/preview — modify.
  - `src/character/character-customization.css` :: options overflow/모바일 레이아웃 — modify only if demonstrated necessary.
  - `shared/characterAppearance.ts` :: 최신 계약/카탈로그 public 진입점 — read-only.
  - `src/game/GameScreen.tsx` :: 로컬 appearance/계정 AppearanceBinding/타이틀 편집 진입 — reuse; only fix a verified missing connection.

#### Details
- **Signatures & Types**:
  ```typescript
  // 기존 props와 handler 시그니처를 유지한다.
  export interface CharacterCustomizationDialogProps {
    binding: AppearanceBinding;
    storageMode: "account" | "session";
    onClose: () => void;
  }
  const FIELDS: readonly [keyof CharacterLook, string][];
  function updateField<K extends keyof CharacterLook>(field: K, value: CharacterLook[K]): void;
  ```
- **Data & Schema Fields**:
  - FIELDS 순서/라벨: gender 성별, hairStyle 머리스타일, hairColor 머리색, skinTone 피부색, eyeStyle 눈 모양, outfit 상의, outfitColor 상의 색상, bottoms 하의, bottomsColor 하의 색상, hat 모자, glasses 안경, shoes 신발, shoeColor 신발 색상, bag 가방, bagColor 가방 색상.
  - 총15개 fieldset을 렌더링한다. 카탈로그의 하의는 긴바지/청바지/반바지/치마, 하의 색상은 검정/남색/회색/베이지/갈색/흰색이며 ID는 trousers/jeans/shorts/skirt와 black/navy/gray/beige/brown/white다. 임의의 hex 직접 입력은 추가하지 않는다.
- **Execution Flow / Logic**:
  1. 기존 옷/옷 색상은 상의/상의 색상으로 라벨만 바꾼다. 저장 필드 outfit/outfitColor를 바꾸지 않는다. 기존 공통 fieldset 렌더러로 새2그룹을 연결한다.
  2. updateField는 cloneCharacterAppearance(binding.value) 후 현재 role의 해당 필드만 바꾸고 binding.update를 호출한다. 종류 변경 시 색상 유지, 색상 변경 시 종류 유지, 성별 변경 시 선택 하의와 다른14필드 유지다. 다른 역할의15필드는 그대로다.
  3. 기존 PixelOfficer 미리보기는 고른 look를 전달받아 실제 하의/피부/신발을 그린다. 192×224/모바일144×168 표시 크기, viewBox와 발 위치를 무작정 키우거나 축소하지 않는다.
  4. 기존 저장 예정/저장 중/완료/실패/재로그인 안내와 retry, account/session 모드를 유지한다. 로컬은 메모리에서 즉시 반영되고 배포 계정은 기존 자동 저장 경로를 따른다. 미리보기용 별도 저장소나 저장 버튼을 만들지 않는다.
  5. 탭/fieldset/legend/radio 이름, Tab/Shift+Tab focus trap, 좌우/Home/End 탭 전환, Escape/배경/닫기를 유지한다. radio/카탈로그 선택은 focus를 빼앗지 않고 저장 상태 변경이 옵션을 재마운트하지 않게 한다.
  6. 기존 CSS는 max-height100%, min-height0, options overflow-y:auto,720px 미만 세로 배치, 44px 터치 영역을 갖는다. 15그룹이 들어가도 이를 먼저 재사용한다. 새 항목 때문에 footer/닫기/끝 옵션이 실제로 가려지는 증거가 있을 때만 이 파일에서 최소 수정한다. 공통 pixel-theme/모드 HUD/모바일 조작 버튼 간격을 바꾸지 않는다.

### I02. 편집 동작/모든 장면 전달 검증
- Related Files:
  - `src/character/CharacterCustomizationDialog.test.tsx` :: 15그룹/역할/하의/색상/성별/초점/저장 상태 — modify.
  - `src/game/GameScreen.test.tsx` :: 로컬 편집 왕복/계정 하의 갱신/게임 진행 보존/타이틀 — modify.
  - `src/infinite/InfiniteModeScreen.test.tsx`, `InfiniteStairScene.test.tsx` :: 무한 모드 하의 전달/계단/입력 보존 — modify.
  - `src/game/StairScene.test.tsx`, `OfficeExitEnding.test.tsx`, `OvertimeCaptureEnding.test.tsx` :: 실제 하의/엔딩 포즈 — modify.
  - `src/company/CompanyRecordStore.test.ts`, `recordApi.test.ts` :: 기존 T03 계약·저장 회귀 — reuse; only add a missing editor-to-store case.
  - `src/game/pixel/bottomsAppearanceArt.test.tsx` :: 실제 도형/발/색 불변조건 — reuse.
  - `src/game/StairScene.tsx`, `src/infinite/InfiniteStairScene.tsx`, `src/game/OfficeExitEnding.tsx`, `OvertimeCaptureEnding.tsx` :: 기존 appearance props 전달 — read-only unless a missing connection is demonstrated.

#### Details
- **Signatures & Types**: 장면/모드/엔딩 props는 기존 `appearance?: CharacterAppearance` 또는 `appearance?: CharacterLook`를 유지한다. 새로운 모드/게임 엔진 상태/랭킹 데이터 필드를 추가하지 않는다. 테스트 fixture는 최신 public default를 바탕으로 생성한다.
- **Execution Flow / Logic**:
  1. 실제 radio로 도망자 skirt/beige, 추격자 shorts/white를 고르고 탭을 왕복해 선택/미리보기/반대 역할 보존을 확인한다. 종류 바꾼 뒤 색상 유지 및 색상 바꾼 뒤 종류 유지를 검사한다. 남성/여성 어느 쪽에서도 네 하의가 모두 선택 가능해야 한다.
  2. 상의/가방/부츠와 하의 조합을 선택한 뒤 gender만 바꿔 실제 성별 도형은 변하지만 나머지14필드가 그대로 남는지 확인한다. 다시 바꾸어도 초기화하지 않는다.
  3. 13그룹 기대를15로, 이전 옷 라벨을 상의로 바꾸고 getByRole(group,{name:정확한라벨}) 안으로 radio 쿼리를 좁힌다. 의도한 접근성/선택 테스트를 유지하며 query 이름 변경을 이유로 테스트를 삭제하지 않는다.
  4. account 저장 pending/saving/saved/error/auth-required, retry, 로컬 세션 문구와 Tab/Escape/탭 방향키를 확인한다. jsdom fireEvent 검증은 실제 native radio 방향키/모바일 검증과 구분한다.
  5. GameScreen에서 실제 타이틀→꾸미기→선택→닫기→단계 모드/무한 모드→타이틀/다시 열기 왕복을 검사한다. 3초 카운트다운과 원래 D/J/Space 규칙/단계·무한 조작 차이는 유지한다.
  6. 계정 AppearanceBinding.value가 하의만 다른 값으로 갱신될 때 점수/제한시간/추격 위치/카운트다운을 리셋하지 않는다. pending/error 상태가 바뀌어도 장면이 바뀌지 않아야 한다.
  7. 미리보기/타이틀/단계/무한 각 캐릭터 아래 실제 새 `.officer-bottoms`의 종류/색과 채워진 path/피부색을 검사한다. 끝났을 때의 퇴근 walking/야근 grabbing·dragged·seated에도 같은 선택이 보이는지 검사한다. 단순 상위 props mock/문자열에 의존하지 않는다.
  8. 발 y=40, 좌우 반전 transform, 계단 모델/카메라/clip, 두 모드 진행 방향과 입력/넘어짐/추격/일시정지·카운트다운을 기존 기대대로 유지한다. 화면 배치나 게임 규칙을 이번 작업에 섞지 않는다.

### I03. 최종 표본과 검증 기록
- Related Files:
  - `.memory/phases/2026-11-04-character-bottoms-customization/P01-bottoms-customization/phase.md` :: 4/4 및 검증/미검증 동기화 — modify after passing.
  - `.memory/plans/2026-11-04-character-bottoms-customization.md` :: 완료 상태/실제 결과 — modify after passing.
  - `.memory/current.md` :: 완료와 다음 Active Task 없음 — modify after passing.

#### Details
- 실제 부품의 SSR SVG로 같은 나이대·성별·상의·소품에서 하의만 바꾼 원래 크기/2배 비교 표본을 TEMP에 보존한다. 두 역할/6색/부츠/피부/앉기·끌려가기의 가림과 밑단 연결, 실제 계단·퇴근·야근 장면 표본을 확인한다. 이미지 생성 모델이나 새 외부 폰트/리소스는 필요 없다.
- 허용된 브라우저 도구가 있으면 320×568,390×844,768×1024,1440×900에서 닫기/하의 선택/마지막 그룹·저장 안내 접근, 모바일 스크롤·터치/키보드·애니메이션을 확인한다. 이전 Chrome 자동 실행 blocked by policy를 다른 경로로 우회하지 않는다.
- 브라우저 도구가 없으면 정적 표본/DOM 범위만 확인하고 실제 브라우저4크기/터치/native keyboard/애니메이션은 미검증으로 기록한다. 실제 로그인 계정 복원이나 Cosmos 확인을 정적 표본/단위 테스트로 대신 했다고 하지 않는다.
- 최종 전체 회귀는 변경 확정 후 한 번 실행한다. 추가 실패/수정이 있으면 영향을 받는 검사와 필요한 전체 검사를 다시 실행하고 실패·원인·최종 결과를 남긴다. 이전 출시의1784/198/13/26 결과를 새 하의 결과로 재사용하지 않는다.
- 별도 요청 없이 push/배포/라이브 계정 테스트를 하지 않는다. 후속 출시 시 프런트엔드/API 동시 배포와 탭 새로고침을 인계한다.

## Acceptance Criteria
- [ ] 15개 편집 그룹에서 하의4종/6색을 양 역할/성별에 독립적으로 선택한다.
- [ ] 다른 선택/반대 역할/저장 상태·초점과 게임 진행을 유지한다.
- [ ] 두 모드와 타이틀/퇴근/야근의 실제 도형·색상으로 하의 전달을 검증한다.
- [ ] 최종 전체 frontend/API/빌드/lint/배포 검사 통과, emulator 실행 상태와 실제 모바일 미검증 여부를 명시한다.
- [ ] task/phase/plan/current를 동기화하고 Active Task는 없음으로 종료한다.

## Validation
- `npm run test -- --run src/character/CharacterCustomizationDialog.test.tsx src/game/GameScreen.test.tsx src/game/StairScene.test.tsx src/infinite/InfiniteModeScreen.test.tsx src/infinite/InfiniteStairScene.test.tsx src/game/OfficeExitEnding.test.tsx src/game/OvertimeCaptureEnding.test.tsx src/game/pixel/bottomsAppearanceArt.test.tsx --maxWorkers=2` — 실제 편집/장면/발 기준 통과.
- `npm run test -- --run --maxWorkers=2` — 최종 전체 frontend/shared 통과. 의미 없는 timeout/skip/worker 설정 변경 금지.
- `npm --prefix api test` 및 `npm run test:deployment` — API/배포 설정 회귀 통과.
- `npm run lint`, `npm run build`, `npm --prefix api run build`, `git diff --check` — 통과.
- T03 이후 저장 관련 수정이 없고 emulator를 이미 통과했다면 반복하지 않는다. 새 저장 변경 또는 T03 미실행이 있고 로컬 emulator가 준비되었으면 전용 프로세스에서 `$env:COSMOS_EMULATOR_ENDPOINT='http://127.0.0.1:8081/'; npm --prefix api run test:integration` 실행. 미준비면 미실행으로 명시하고 배포 전 CI 검증을 필수로 남긴다.

## Commit Message
```text
feat(character): expose bottoms customization and verify every scene

Plan: 2026-11-04-character-bottoms-customization
Phase: P01-bottoms-customization
Task: T04-bottoms-editor-and-scenes

- Add independent bottoms and color controls while preserving all appearance selections
- Verify both modes, office endings and final regression boundaries
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
