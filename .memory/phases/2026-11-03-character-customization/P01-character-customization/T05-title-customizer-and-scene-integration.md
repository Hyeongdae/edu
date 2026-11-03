# Task: T05 Title Customizer and Scene Integration

## Status: done

## Goal
타이틀의 `캐릭터 꾸미기`를 열어 두 역할의 부위와 색상을 즉시 미리 보고 자동 저장한다. 선택한 외형을 실제 단계·무한 플레이와 기존 모든 엔딩에 연결하고 모바일에서 조작 가능한 첫 버전을 완성한다.

## Decision Summary
- T01~T04 완료 후 실행한다. 별도 화면 모드를 추가하기보다 기존 타이틀 배경 위의 modal을 사용한다.
- 계정 store가 제공하는 draft와 저장 상태를 화면에 연결한다. 로컬 데모에서는 이번 접속의 메모리 미리보기로 동작한다.

## Implementation

### I01. 접근 가능한 꾸미기 dialog
- Related Files:
  - `src/character/CharacterCustomizationDialog.tsx` :: `CharacterCustomizationDialogProps`, `CharacterCustomizationDialog`; new
  - `src/character/character-customization.css` :: 타이틀 버튼, dialog/preview/옵션/모바일 스타일; new
  - `src/character/CharacterCustomizationDialog.test.tsx` :: 독립 선택, 키보드, 저장 상태 표시; new
  - `shared/characterAppearance.ts` :: 카탈로그·검증·clone; read-only
  - `src/company/types.ts` :: T03 `AppearanceBinding`; read-only
  - `src/game/pixel/PixelOfficer.tsx` :: T04 optional appearance renderer; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export interface CharacterCustomizationDialogProps {
    binding: AppearanceBinding;
    storageMode: "account" | "session";
    onClose: () => void;
  }
  export function CharacterCustomizationDialog(props: CharacterCustomizationDialogProps): ReactElement;
  // T03 AppearanceBinding:
  // value: CharacterAppearance; status: idle|pending|saving|saved|error|auth-required;
  // errorMessage:string|null; update(next):void; retry():void;
  ```
- **Data & Schema Fields**:
  - 편집 대상 role은 로컬 UI state `runner|pursuer`, 초기 runner다. 저장값은 version1과 두 look 전체이며 gender/hairStyle/hairColor/skinTone/outfit/outfitColor/hat/glasses/shoes/shoeColor를 포함한다.
  - 카탈로그와 한국어 레이블은 `APPEARANCE_OPTIONS`를 사용한다. UI에 서버에 없는 옵션/임의 색상 입력을 만들지 않는다.
- **Execution Flow / Logic**:
  1. 기존 게임 스타일 안에 `role="dialog"`, `aria-modal="true"`, 제목 `캐릭터 꾸미기`와 닫기 버튼을 제공한다. `useId`로 제목/tabpanel/label ID를 만든다.
  2. 도망자/추격자 탭으로 편집 대상을 바꾼다. tablist/tab/tabpanel 관계, ArrowLeft/Right·Home/End·선택 탭의 tabIndex를 구현한다. role 전환만으로 외형 저장을 요청하지 않는다.
  3. 선택 역할의 preview에 PixelOfficer를 idle, direction right로 그린다. runner는 young, pursuer는 older를 사용한다. SVG `viewBox="-48 -96 96 112"`를 사용해 발과 모자가 잘리지 않게 한다.
  4. `성별`, `머리스타일`, `머리색`, `피부색`, `옷`, `옷 색상`, `모자`, `안경`, `신발`, `신발 색상`별 fieldset/legend와 radio 선택을 제공한다. 색상 swatch에도 텍스트 이름과 선택 표시를 함께 제공한다.
  5. 한 필드를 고르면 현재 binding.value를 clone하고 그 역할의 해당 필드만 바꾼 전체 값을 binding.update에 전달한다. 다른 역할과 다른 부위를 초기화하지 않는다. 선택 렌더링은 최신 binding.value를 사용하며 초기 props 복사만으로 고정하지 않는다.
  6. account 표시: idle=`캐릭터를 골라보세요.`; pending=`변경한 외형을 저장할 예정이에요.`; saving=`외형 저장 중…`; saved=`계정에 저장했어요.`; error는 errorMessage와 `다시 시도`; auth-required는 `외형을 저장하려면 회사 계정으로 다시 로그인해 주세요.`를 표시한다. 상태는 `aria-live="polite"`를 사용한다.
  7. session 표시: `로컬 미리보기 · 이번 접속에서만 유지돼요.`. 계정 저장 완료나 API 오류로 표시하지 않는다.
  8. dialog mount 시 닫기 버튼으로 focus, Tab/Shift+Tab으로 내부 focus 순환, Escape/닫기/배경 직접 클릭으로 onClose를 호출한다. 옵션이나 내부 빈 영역 클릭이 닫히지 않게 한다. 저장 상태 변경 때 사용자의 focus를 강제로 이동하지 않는다.
  9. 닫기를 저장 완료 대기와 연결하지 않는다. T03의 계정 store는 dialog보다 오래 살아 있어 저장/재시도를 담당한다.
  10. CSS는 새 파일에서 `.stair-game.pixel-theme` 아래로 한정한다. 데스크톱은 preview/옵션2열,720px 이하에서는 위쪽 preview와 아래 스크롤 옵션으로 구성한다. close/status를 스크롤로 영구 잃지 않도록 header/footer를 고정 flex 영역으로 둔다.
  11. 옵션 터치 영역은 최소44×44px, preview SVG는 모바일144×168px/데스크톱192×224px를 기준으로 한다.320px 폭에서도 가로 overflow와 모자/신발 잘림이 없어야 한다.
  12. 타이틀 버튼이5개가 되므로 새 CSS에서 작은 화면의 action gap/높이를 조정한다. 내용이 viewport 높이를 넘는 경우 기존 타이틀 내부 스크롤로 모든 버튼에 접근하게 한다.

### I02. 타이틀 진입과 계정/로컬 외형 소유권
- Related Files:
  - `src/game/GameScreen.tsx` :: `ActiveGameDialog`, open/close guards, focus 복원 effect, 타이틀 actions, scene/ending props; modify
  - `src/game/GameScreen.test.tsx` :: 타이틀 진입/모드 전환/외형 적용/입력 차단 회귀; modify
  - `src/App.tsx` :: account key와 GameAppShell 수명; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  type ActiveGameDialog = "settings" | "instructions" | "leaderboard" | "pause" | "customization" | null;
  // GameScreen 안의 로컬 데모용 상태. 모든 hook은 infinite 분기 return 전 선언한다.
  const [localAppearance, setLocalAppearance] = useState(getDefaultCharacterAppearance);
  ```
- **Execution Flow / Logic**:
  1. 타이틀 actions에 `캐릭터 꾸미기` 버튼을 추가하고 ref, aria-haspopup/expanded/controls를 연결한다. 기존4개 버튼은 유지한다.
  2. `openGameDialog("customization")`는 타이틀·ready·다른 dialog 없음·전환 중 아님일 때만 허용한다. 기존 activeDialogRef와 state를 같은 handler에서 동기화한다.
  3. 새 dialog가 열리면 타이틀 section을 inert/aria-hidden으로 만들고 닫힌 뒤 trigger로 focus를 복원한다. 기존 title leaving의 inert 조건과 합친다. dialog 자체는 inert title section의 자식에 넣지 않는다.
  4. 꾸미기가 열린 동안 D/J/Space와 타이틀 모드 선택이 게임을 시작시키지 못하게 한다. 현재 무한 모드 inline onClick도 activeDialogRef guard를 통과하도록 연결한다.
  5. account binding은 `companyRecords?.appearance`를 사용한다. 없으면 localAppearance를 value로 하고 update→setLocalAppearance, status=idle/error=null/retry=no-op인 session binding을 만든다. fake binding이 기존 optional 항목을 생략해도 테스트가 렌더링 가능해야 한다.
  6. 실제 장면용 외형은 매 render의 최신 binding.value다. `initialProfile` useState에 외형을 캡처하지 않는다. 상태 변경 때문에 gameState나 countdown을 재생성하지 않는다.
  7. localAppearance는 GameScreen가 소유하므로 조건부로 InfiniteModeScreen를 렌더한 뒤 타이틀로 돌아와도 유지된다. 전체 reload/계정 key 변경 시 초기화된다. localStorage나 production API로 로컬 외형을 저장하지 않는다.
  8. 계정 store 저장이 pending/error여도 preview 및 같은 접속의 게임에는 마지막 선택을 사용한다. 이후 reload/다른 기기는 서버에 저장 완료된 값만 복원한다.
  9. open/close는 게임 제한시간이나 BGM 정책을 새로 만들지 않는다. 타이틀에서 열리므로 진행 중인 게임을 새로 멈추는 경로가 없다.

### I03. 실제 장면과 모든 엔딩 연결
- Related Files:
  - `src/game/StairScene.tsx` :: `StairSceneProps`, player/pursuer PixelOfficer calls; modify
  - `src/infinite/InfiniteModeScreen.tsx` :: props 및 InfiniteStairScene 호출; modify
  - `src/infinite/InfiniteStairScene.tsx` :: props와 두 캐릭터 호출; modify
  - `src/game/OfficeExitEnding.tsx` :: `OfficeExitEndingProps`와 PixelOfficer 호출; modify
  - `src/game/OvertimeCaptureEnding.tsx` :: `OvertimeCaptureEndingProps`와4개 OvertimeOfficer 호출; modify
  - `src/game/GameScreen.tsx` :: animated/complete 엔딩의 모든 call site; modify
  - 해당 장면/엔딩의 기존 `.test.tsx`, `src/infinite/InfiniteModeScreen.test.tsx` :: 외형 전파 회귀; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // StairSceneProps, InfiniteModeScreenProps 및 InfiniteStairScene props에 추가
  appearance?: CharacterAppearance;
  // OfficeExitEndingProps에 추가: 도망자만 등장한다.
  appearance?: CharacterLook;
  // OvertimeCaptureEndingProps에 추가
  appearance?: CharacterAppearance;
  ```
- **Execution Flow / Logic**:
  1. GameScreen→StairScene에 전체 appearance를 전달하고 renderer별 runner/pursuer look을 분리한다. 타이틀 배경과 실제 플레이 모두 같은 StairScene 경로를 사용한다.
  2. GameScreen→InfiniteModeScreen→InfiniteStairScene에 같은 전체 appearance를 전달한다. InfiniteModeScreen의 hooks, input, timer, pause/restart, result 저장에는 외형 state를 섞지 않는다.
  3. OfficeExitEnding의 animated와 complete 호출 모두 runner look을 전달한다. 야근 엔딩 animated/complete에는 전체 외형을 전달하고 young dragged/seated 및 older grabbing/standing에 각 역할 look을 사용한다.
  4. optional 외형이 빠진 직접 테스트 호출은 기존 역할별 기본값을 사용한다.
  5. scene 내 계단/캐릭터 draw order, transform, clipping, 카메라와 실제 위치 모델은 바꾸지 않는다. 특히 무한 모드는 전체 계단을 그린 뒤 캐릭터를 그리는 현재 순서를 유지한다.
  6. 모자·안경·머리·의상은 시각 정보다. 추격 간격, 속도, 장애물, 점수, 판정 모델의 입력으로 사용하지 않는다.

### I04. 기능 통합 및 로컬 시연 검증
#### Details
- dialog 테스트: 각 역할의 여러 부위를 연달아 골라도 다른 역할 보존, 탭/라디오 키보드 조작, 상태 문구·재시도, Escape/focus 순환, local 저장 안내, 모자/신발이 preview에 실제 반영됨을 확인한다.
- GameScreen 테스트: 꾸미기 버튼은 타이틀에 표시, dialog 닫기 focus 복원, dialog 중 모드/D/J 시작 차단, 선택 외형이 타이틀·단계·무한 전환 후 유지됨을 확인한다. 기존 버튼4개 가정이 있으면5개로 정확하게 갱신한다.
- 계정 binding mock의 update→서버 확인 rerender와 오류→retry를 확인한다. 단순히 콜백 호출만 확인하지 않고 최종 표시값이 바뀌는지 본다.
- 엔딩/장면 fixture로 서로 구분되는 runner/pursuer 외형을 전달하고 실제 모자/안경/색상 부위를 검증한다. 정상/complete 두 엔딩 변형 모두 포함한다.
- 로컬 demo 서버(5175가 이미 사용 중이면 프로세스를 종료하지 말고 빈 포트 선택): PowerShell 프로세스의 `VITE_AUTH_MODE=entra-spa`, `VITE_LOCAL_DEMO_MODE=true`를 설정한 뒤 `npm run dev -- --host 127.0.0.1 --port 5175 --strictPort`. 실행 종료 시 임시 환경값을 복원한다.
- 브라우저 확인 크기:320×568,390×844,768×1024,1440×900. 타이틀5개 버튼 접근, 탭/옵션 스크롤, preview의 모자·긴 머리·신발, 단계 내려가기/무한 올라가기에서 발 착지와 버튼 간격을 확인한다. 캡처가 가능하면 임시 디렉터리에 보관하고 관찰 결과를 Task Progress에 기록한다.
- 로컬은 실제 운영 계정 저장을 대신 검증하지 않는다. 계정 간 지속성은 T02/T03의 저장소·store 검증과 기존 CI에서 확인하고, 배포 후 실제 계정 시연은 배포 요청이 있을 때 수행한다.

## Acceptance Criteria
- [x] 타이틀에서 꾸미기를 열고 두 역할의 모든 옵션·색상을 독립 선택할 수 있다.
- [x] 즉시 미리보기와 계정 자동 저장·오류·재시도 표시가 실제 store와 연결된다.
- [x] 로컬 데모는 서버 없이 꾸미기를 시험하고 모드/타이틀 이동 후 선택을 유지한다.
- [x] 단계·무한·타이틀·퇴근·야근의 모든 캐릭터에 선택 외형이 일치한다.
- [x] 모바일/키보드에서 모든 항목과 닫기에 접근하고 게임 입력이 새지 않는다.
- [x] 앞서 요청한 모바일 좌우 버튼 간격 수정과 기존 점수/추격/일시정지 동작을 보존한다.

## Validation
- `npm test -- --run src/character/CharacterCustomizationDialog.test.tsx src/game/GameScreen.test.tsx src/infinite/InfiniteModeScreen.test.tsx src/game/StairScene.test.tsx src/infinite/InfiniteStairScene.test.tsx src/game/OfficeExitEnding.test.tsx src/game/OvertimeCaptureEnding.test.tsx --maxWorkers=2` — 신규 연결 검증 통과.
- 위 집중 검증에서 수정이 필요한 경우 수정 후 해당 실패 경로를 재검증하고, 마지막에 `npm test -- --run --maxWorkers=2`를1회 실행하여 전체 회귀를 확인한다.
- `npm --prefix api test` — 프로필/외형/점수 호환 회귀 통과.
- `npm run lint` — 오류 없음.
- `npm run build` 및 `npm --prefix api run build` — frontend/API 타입과 번들 성공.
- `git diff --check` — 공백 오류 없음. 작업 전부터 있던 CSS 변경을 제거하거나 무관한 untracked 파일을 커밋하지 않는다.
- 계획의 브라우저 시연 항목은 실제 확인 결과와 미확인 항목을 구분해 보고한다. 운영 배포나 실제 계정 저장을 확인했다고 추정하지 않는다.

## Commit Message
```text
feat(character): add title customization and apply looks across game scenes

Plan: 2026-11-03-character-customization
Phase: P01-character-customization
Task: T05-title-customizer-and-scene-integration

- Add an accessible mobile-friendly character editor with save feedback
- Apply account or local preview appearances to both modes and all endings
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: 936e26b

## Validation Results — 2026-11-03
- 지정7개 파일211/211 통과(56.53초). 역할별 옵션 독립성, 실제 SVG 미리보기, 자동 저장 상태/오류/재시도, 모달 입력 차단·초점 복원, 두 모드와 모든 엔딩의 외형 전달을 확인했다.
- 전체 frontend/shared 회귀: 54파일1474/1474 통과(141.62초, maxWorkers=2). API 단위 테스트4파일186/186 통과.
- npm run lint, npm run build, npm --prefix api run build, git diff --check 통과. JS647.11kB(gzip178.64kB), CSS92.97kB(gzip15.88kB). 번들 크기 개선은 이번 범위에 포함하지 않았다.
- 격리된 Chrome에서320×568,390×844,768×1024,1440×900으로 타이틀5버튼, 도망자/추격자 선택, 옵션 스크롤, 닫기·저장 안내의 고정 영역을 확인했다. 가로 넘침이 없고 preview는 모바일144×168/데스크톱192×224로 표시된다.
- 실제 브라우저의 Tab·방향키로 역할 탭과 기본 radio 선택, 닫은 뒤 trigger 초점 복원을 검증했다. 단계/무한 모드에서 선택 외형이 유지되고 pause→title→다른 모드에서도 유지되며, 계단 좌표·그리기 순서·모션은 기존대로다.
- 브라우저 예외0. 증거: C:/Users/DEX/AppData/Local/Temp/character-t05-evidence/ 아래22개PNG, layout-results.json, keyboard-and-play.json. 테스트 로그는 TEMP/character-t05-{focused-final,full,api,lint,build}.log에 보존했다. 검토용 격리 Chrome은 종료했고 기존5173 개발 서버는 유지했다.
- 계정 저장 성공·실패 UI는 실제 store binding 계약과 T02/T03 회귀로 검증했다. 운영 계정과 Cosmos를 직접 변경하지 않았고 emulator 통합3건은 로컬 환경이 없어 미실행이다. 배포 전 CI 통합 검증 및 배포 후 실제 계정 저장 확인이 남는다.
- 기존 미커밋 src/game/pixel-theme.css의 모바일 버튼 간격 변경은 보존하고 이 Task 커밋에서는 제외했다. 추가 범위가 필요한 발견: 특이사항 없음.
