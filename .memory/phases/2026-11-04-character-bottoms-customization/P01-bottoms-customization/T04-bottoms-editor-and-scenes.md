# Task: T04 Bottoms Editor and Scenes

## Status: done

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
- [x] 15개 편집 그룹에서 하의4종/6색을 양 역할/성별에 독립적으로 선택한다.
- [x] 다른 선택/반대 역할/저장 상태·초점과 게임 진행을 유지한다.
- [x] 두 모드와 타이틀/퇴근/야근의 실제 도형·색상으로 하의 전달을 검증한다.
- [x] 최종 전체 frontend/API/빌드/lint/배포 검사 통과, emulator 실행 상태와 실제 모바일 미검증 여부를 명시한다.
- [x] task/phase/plan/current를 동기화하고 Active Task는 없음으로 종료한다.

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
- [x] 구현 완료
- [x] 검증 통과 (실제 브라우저/계정 및 조건부 emulator 미검증은 아래 참조)
- commit: `d480239`

## Execution Result — 2026-11-05
- 2026-11-04 시작한 T04를 날짜 변경 후 이어서 완료했다. 기존 계획/Phase 폴더의 생성 날짜2026-11-04는 유지한다.
- CharacterCustomizationDialog의 FIELDS에 bottoms/하의와 bottomsColor/하의 색상을 추가하고 outfit/outfitColor의 표시 이름을 상의/상의 색상으로 바꿨다. 총15개 그룹을 기존 공통 radio 렌더러와 즉시 미리보기/자동 저장 경로에 연결했다. 별도 저장소/버튼은 없다.
- 기존 responsive CSS/모달 초점·키보드/역할 탭/저장 상태·재시도를 재사용했다. 같은 성별·다른 성별에서 색상을 유지한 종류 전환과 종류를 유지한 색상 전환, 반대 역할 보존, 성별 왕복/저장 상태 갱신 후 선택 보존을 실제 radio로 검증했다.
- GameScreen에서 실제 편집→단계 모드→일시정지/타이틀→무한 모드→다시 편집 왕복과 계정 draft/retry를 검사했다. 하의만 다른 계정 응답으로 카운트다운/점수/시간/추격 위치가 리셋되지 않는지 확인했다. 두 모드·타이틀·퇴근/야근의 실제 SVG 하의/피부/명암을 검사했다. 장면 발 clip 검사는 새 하의 내부 clip과 구분해 장면 직속 정의만 검사하며 기존84 높이/앵커 조건을 유지했다.
- 초기 지정8파일337통과/1시간초과는 기존 긴 왕복 검사의 범용 radio 검색 비용이었다. 항목 그룹 내부로 쿼리를 좁혀 동일 동작/검증을 유지했다. 해당 통합6건은 필터 실행에서 모두 통과했다(나머지107건은 필터 제외).
- 첫 전체 실행은 2026-11-04 17:01부터 다음 날까지 실행 환경 중단/시계 점프가 관측되어56891.97초로 기록됐다. 서로 무관한4파일의4건이 약3시간/12시간 단위 시간초과를 기록했다. 중단된 환경의 결과를 유효한 최종 결과로 쓰지 않고 코드/설정 변경 없이 재실행했다. 프로세스 종료 시도 전 이미 runner가 끝나 실제 프로세스 종료는 없었다. TEMP/t04/interrupted-run-summary.json에 도구 출력 기반 요약을 남겼다.
- 다음 전체 실행1978통과/3시간초과(217.42초)에서 편집 조합1건과 기존5단계 종료2건이5초를 조금 넘었다. 편집 선택 helper는 legend로 해당 fieldset을 찾은 뒤 내부 radio만 질의하게 했고, 모든 그룹의 접근성 이름 검사는 별도로 유지했다. 종료 hook의 동기 setTimeout에 맞춰 fake clock을3.999초/4초로 나누어 같은 종료/점수/다시하기 검증을 유지하고 경계 검증을 보강했다. 실제 게임 타이머나 config/timeout/skip/worker를 완화하지 않았다.
- 최종 전체 frontend/shared59파일1981/1981, 실패/skip0,141.40초(2026-11-05 08:54:45 시작) 통과. API4파일211/211, 배포 검사26/26, 최종 lint/프런트엔드·API 타입 검사와 build/diff check 통과. TEMP/bottoms-t04-all.log 및 이전 실패 로그 bottoms-t04-all-before-query-optimization.log에 결과를 보존했다. 변경 후 편집15/15와 종료2/2 필터 검사도 통과했다.
- 최종 JS668.29kB(gzip184.08kB)/CSS92.97kB(gzip15.88kB), API39.3kB. 기존500kB chunk 경고는 유지되며 이번 작업에서 번들 설정을 변경하지 않았다.
- TEMP/character-bottoms-customization-2026-11-04/t04/에 현재 컴포넌트의 editor HTML(15그룹), appearance JSON, 두 계단/퇴근/야근의 실제 SVG·PNG4개와 evidence.json을 생성·육안 확인했다. T02의 하의/색/부츠/포즈80조건 원래 크기/2배 표본은 렌더러 변경이 없어 재사용했다. 이들은 정적 렌더링이며 브라우저 스크린샷/애니메이션 재생/반응형 레이아웃 검증이 아니다.
- 허용된 브라우저 도구가 없어320×568,390×844,768×1024,1440×900 실제 레이아웃/터치/스크롤/native keyboard/애니메이션은 미검증이다. 이전 Chrome 실행 차단을 우회하지 않았다. CSS 변경 필요를 입증하는 별도 결함은 발견하지 않아 기존 CSS/화면 크기/모바일 버튼 간격을 유지했다.
- 로컬 http://127.0.0.1:5173/ HTTP200, DEV=true/로컬 데모=true와 최신 하의/상의 모듈 제공을 확인했다(응답 원본을UTF-8로 확인). 기존 서버를 유지한다. 실제 회사 계정 저장 복원과 운영 Cosmos는 확인하지 않았다.
- 2026-11-04/05 모두 http://127.0.0.1:8080/ready 미준비로 Cosmos emulator 통합은 미실행이다. T03의 전체16사례는 배포 전 기존 CI에서 필수다. 운영 연결/기록 수정으로 대체하지 않았다. API/DB/게임 규칙/실제 장면 본체/애니메이션/CSS는 이번 Task에서 변경하지 않았다. push/배포 없음. 별도 범위로 추가할 결함은 특이사항 없음.
