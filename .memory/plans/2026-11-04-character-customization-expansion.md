# Plan: Character Customization Expansion

- Date: 2026-11-04
- Status: complete
- Decision: [Character Customization Expansion](../decisions/2026-11-04-character-customization-expansion.md)

## Goal
타이틀 꾸미기에서 기존 선택지를 늘리고, 도망자와 추격자의 눈 5종 및 가방 5종·색상 4종을 각각 선택한다. 기존 계정 외형을 보존하면서 새 외형을 저장하고, 두 모드와 모든 엔딩에서 동일한 선택을 표시한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `complete` | 기존 외형 호환, 픽셀 확장, 계정 연결과 편집 화면 구현/자동 검증 완료 | [P01](../phases/2026-11-04-character-customization-expansion/P01-appearance-expansion/phase.md) |

## Tasks and Order
| Task | Outcome | Principal files |
| :--- | :--- | :--- |
| T01 | version 1을 보존하는 version 2 계약과 정규화 | `shared/legacyCharacterAppearance.ts`, `expandedCharacterAppearance.ts`, `characterAppearance.ts` |
| T02 | 새 머리·옷·모자·안경·신발, 눈과 가방을 모든 포즈에 렌더링 | `OfficerAppearanceParts.tsx`, `OfficerBagArt.tsx`, `officerPalette.ts`, `PixelOfficer.tsx`, `OvertimeOfficer.tsx` |
| T03 | 최신 계약을 API·클라이언트의 기본 계약으로 연결 | 공통 export, `api/src/playerRepository.ts`, `src/company/recordApi.ts`, 저장/계정 회귀 테스트 |
| T04 | 13개 선택 그룹과 모든 실제 장면의 통합 검증 | `CharacterCustomizationDialog.tsx`, 꾸미기 CSS, 화면·장면·엔딩 테스트 |

순서: T01 → T02 → T03 → T04. 한 기능이므로 Phase 하나로 유지한다. T01은 현재 public export를 version 1로 유지하고 새 계약을 별도 모듈에 준비한다. T02가 두 계약을 그릴 수 있게 된 후 T03에서 기본 계약을 version 2로 전환한다. 이렇게 해야 각 Task의 타입 검사와 기존 테스트가 독립적으로 통과하고, 아직 그릴 수 없는 선택지가 먼저 화면에 나타나지 않는다.

## Final Contract
- `CharacterAppearance = { version: 2, runner: CharacterLook, pursuer: CharacterLook }`.
- 기존 10개 필드에 `eyeStyle`, `bag`, `bagColor`를 추가한다. 문자열 ID만 저장한다.
- `eyeStyle`: `default | round | smile | sleepy | sharp`; 기본 `default`.
- `bag`: `none | backpack | laptop | crossbody | briefcase`; 기본 `none`.
- `bagColor`: `black | brown | navy | beige`; 기본 `black`.
- 기존 version 1은 정확한 과거 카탈로그로 검증한 뒤 기존 선택을 모두 복사하고 새 필드만 보완한다. version 2의 누락 필드를 version 1로 오인하여 복구하지 않는다.
- 잘못된 입력을 기본 캐릭터로 바꾸어 저장하지 않는다. API 저장은 유효한 version 2만 허용한다. 저장 문서의 정상 version 1은 읽을 수 있고 명시적인 저장 또는 실제 점수 갱신 때 version 2로 쓴다. 단순 읽기와 읽기용 정규화는 DB를 수정하지 않는다.
- 전체 계정 문서의 `schemaVersion: 1`, Cosmos DB `stair-climb/players`, `/accountId`, 해시 문서 ID, 기존 점수/해금 필드는 유지한다. 외형의 `version`과 계정 문서의 버전을 혼동하지 않는다.

## Added Catalog
기존 선택지는 모두 보존한다. 아래 색상 수치는 결정문에서 허용한 첫 버전 색상 기본안을 구체화한 것이다.

| Field | Added IDs and labels | Base colors |
| :--- | :--- | :--- |
| hairStyle | `long` 장발, `curly` 곱슬머리 | 기존 머리색 사용 |
| hairColor | `blue` 파랑, `pink` 분홍 | `#386da8`, `#b96391` |
| outfit | `hoodie` 후드티, `vest` 조끼 | 기존/추가 옷 색상 사용 |
| outfitColor | `black` 검정, `sky` 하늘색, `orange` 주황, `beige` 베이지 | `#283247`, `#76b6d2`, `#d58b43`, `#c8b38b` |
| hat | `beanie` 비니, `beret` 베레모 | 옷 색상 사용 |
| glasses | `sunglasses` 선글라스 | 고정 어두운 렌즈 |
| shoes | `boots` 부츠 | 신발 색상 사용 |
| shoeColor | `navy` 남색, `red` 빨강, `beige` 베이지 | `#2a4168`, `#ab4f5f`, `#c5b38a` |
| eyeStyle | `default` 기본, `round` 동그란 눈, `smile` 웃는 눈, `sleepy` 졸린 눈, `sharp` 날카로운 눈 | 기존 눈 색상 사용 |
| bag | `none` 없음, `backpack` 백팩, `laptop` 노트북 가방, `crossbody` 크로스백, `briefcase` 서류가방 | 별도 bagColor |
| bagColor | `black` 검정, `brown` 갈색, `navy` 남색, `beige` 베이지 | `#263247`, `#785039`, `#30466d`, `#c8b38b` |

## Rendering and UI Rules
- 두 역할 모두 모든 옵션을 즉시 사용할 수 있다. 성별 선택은 다른 부위나 가방 선택을 초기화하지 않는다.
- 평상시에는 선택한 눈을 쓴다. 넘어짐의 놀란 눈과 야근의 지친 눈은 임시 표현이며 저장된 eyeStyle을 바꾸지 않는다.
- 일반 안경 안에서도 선택한 눈이 보이도록 눈 그리기를 통합한다. 선글라스 착용 시에는 눈이 가려질 수 있다.
- 가방의 뒤 레이어는 몸 뒤에, 끈·앞 레이어는 옷 위와 팔·다리 아래에 그린다. 노트북 가방과 크로스백은 가방 모양·끈이 구분되고 서류가방은 손 옆 손잡이로 구분된다.
- 일반 캐릭터의 원본 32×40 좌표, 신발 바닥 y=40, 현재 이동 transform과 단계 장면의 발 clipping을 유지한다. 가방이나 장발 때문에 계단·카메라·판정을 바꾸지 않는다.
- 타이틀의 꾸미기 모달과 계정 store를 재사용한다. 새 3개 그룹을 더해 13개 그룹으로 만들며 미리보기·선택·저장 상태가 모바일에서도 접근 가능해야 한다.

## Verification Strategy
- T01: 신규 계약·과거 데이터 보존·엄격한 저장 입력·정규화 복사 테스트. 기존 public version 1 계약 테스트 유지.
- T02: 실제 SVG 도형/색, 정상/상황별 눈, 일반 안경과 선글라스, 모든 역할/포즈의 가방 레이어와 발 기준선 검증. 단순 클래스 존재만으로 외형 검증을 끝내지 않는다.
- T03: 실제 버전 전환, 프로필과 두 점수 응답의 version 1 정규화, version 2 저장/재시도/충돌/계정 분리, 새 세션 복원과 DB 읽기 무변경 검증. 기존 emulator harness에 과거 문서 보존 케이스를 추가한다.
- T04: 13개 선택 그룹, 역할 독립성, bag none의 색상 유지, 저장 실패/초점/키보드, 타이틀/단계/무한/모든 엔딩 전달. 320×568,390×844,768×1024,1440×900 브라우저 확인 후 전체 회귀 한 번 실행.
- 각 Task에는 정확한 검증 명령과 커밋 메시지를 둔다. 계획 작성 중에는 구현·테스트를 실행하지 않는다.
- Cosmos 통합은 로컬 emulator가 준비된 경우에만 실행하고 실제 회사 데이터로 대체하지 않는다. 미준비 시 검증 누락을 명시하고 기존 CI 통합 검증을 배포 전 필수로 남긴다.

## Regression Traps
- 현재 정확한 필드 검사에 새 필드를 무조건 추가하면 version 1 외형이 손상 데이터로 처리된다. 과거 전용 validator를 별도로 보존한다.
- 현재 `decodeDocument`는 잘못된 외형을 생략한다. 정상 version 1까지 생략하지 않도록 기본값 표시와 정상화/검증을 구분한다.
- `isSharedProfile` 타입 가드는 version 2의 정규화된 객체만 보증한다. version 1 응답을 true로 통과시킨 뒤 원본을 version 2라고 반환하지 않는다.
- `postAppearance` 확인 응답은 실제 version 2여야 한다. version 1을 기본값으로 보완한 응답으로 새 가방/눈 저장 성공을 추정하지 않는다.
- 현재 일반 안경이 자기 눈을 다시 그린다. 새로운 눈 위에 기존 기본 눈을 덮어 그리지 않게 한다.
- `OfficerShoeArt`를 변경할 때 부츠를 위로 확장하고 y=40 기준선을 유지한다. 가방도 기존 단계 clipping 영역 안에서 디자인한다.
- 기존 테스트에는 version 2를 잘못된 버전으로 취급하는 fixture, 머리 4개/옷 3개/그룹 10개 가정이 있다. 전환 Task에서 의미에 맞춰 갱신하고 실제 invalid 버전 검증은 유지한다.
- 점수 대기열의 `{ version: 2, pending: ... }`는 외형 버전과 무관하다. 일괄 치환하지 않는다.
- `src/game/pixel-theme.css`의 기존 미커밋 모바일 무한 모드 버튼 간격 변경을 보존하고 이번 Task 커밋에 섞지 않는다.

## Boundaries and Adjacent Findings
- 범위에 추가할 별도 결함은 발견하지 않았다. 새 필드/버전과 일반 안경의 눈 연결은 요청을 구현하는 데 필요한 작업이다.
- 기존 계정 저장의 실제 운영 검증과 emulator 검증은 배포 전후 확인 대상이다. 이번 계획은 Git push, 배포, Azure 리소스 변경, 라이브 계정 수정, Docker 설치, 번들 성능 개선을 포함하지 않는다.
- 클라이언트/API를 함께 출시한 뒤 이미 열린 구버전 탭은 새로고침한다. 구버전 실행 코드에 새 옵션을 제공하는 별도 호환 API는 만들지 않는다.

## Progress
- done: 4/4 (구현/자동 검증 완료; 미검증 영역은 아래 기록)
- Active: 없음
- T01 완료 (`20fbcb6`): 지정shared257/257, API186/186, lint/frontend·API build 통과. 과거 계약을 그대로 보존하고 version2 정규화와 카탈로그를 준비했다. 새 옵션의 화면/저장 활성화와 렌더링은 후속 Task에서 수행한다.

- T02 완료 (`ab16a10`): 지정7파일289/289, lint/build 통과. 새 스타일·눈·가방을 모든 포즈에 연결하고 정적25표본/90개 clip 비교를 확인했다. Chrome 실행은 자동 승인 검토에서 차단되어 정적 SVG 렌더링으로 대체했다. public 계약은 아직version1이다.

- T03 완료 (`445e014`): public/API/클라이언트 계약을version2로 전환하고 정상v1 읽기/13필드 저장/기록 보존을 검증했다. 지정584/584·API198/198·lint/frontend·API build 통과. emulator 통합3건을 추가했으나 로컬 readiness 미준비로 실행하지 않았으며 배포 전 CI 통합 확인이 필요하다.

- T04 완료 (`b5b989e`): 편집창13개 그룹과 두 역할/모드/모든 엔딩을 연결했다. 지정214/214·GameScreen112/112·최종 전체56파일1714/1714·API198/198·lint/frontend·API build/diff check 통과. 기존 반응형 CSS와 장면 좌표/모션/게임 규칙을 보존했다. 정적 장면 표본을 확인했고 Chrome 실행 차단에 따른4개크기 실제 브라우저 확인과 emulator/실제 계정 검증은 미완료로 남긴다. 배포 전 수동 UI 확인과 CI 통합 통과가 필요하다. 기존 미커밋 pixel-theme.css는 제외했으며 push/배포는 하지 않았다. 로컬 데모 http://127.0.0.1:5173/ 유지.
