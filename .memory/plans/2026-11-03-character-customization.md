# Plan: Character Customization

- Date: 2026-11-03
- Status: in_progress
- Decision: [Character Customization](../decisions/2026-11-03-character-customization.md)

## Goal
타이틀의 `캐릭터 꾸미기`에서 도망자와 추격자의 남녀 표현, 머리스타일·색상, 피부색, 옷·색상, 모자, 안경, 신발·색상을 각각 선택한다. 미리보기에 즉시 반영하고 로그인 계정에 자동 저장하여 다른 기기에서도 복원한다. 단계·무한 모드와 타이틀 배경, 퇴근·야근 엔딩에서 같은 외형을 사용한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `in_progress` | 공통 옵션, 계정 저장, 픽셀 부위, 타이틀 편집 화면을 순차 연결 | [P01](../phases/2026-11-03-character-customization/P01-character-customization/phase.md) |

## Tasks and Order
| Task | Outcome | Principal files |
| :--- | :--- | :--- |
| T01 | 첫 버전 옵션 카탈로그와 호환 가능한 외형 계약 | `shared/characterAppearance.ts`, `shared/companyRecords.ts` |
| T02 | 기존 기록을 보존하는 인증된 외형 저장 API | `api/src/playerRepository.ts`, `handlers.ts`, `index.ts` |
| T03 | 계정별 400ms 자동 저장과 오래된 응답 처리 | `src/company/recordApi.ts`, `types.ts`, `CompanyRecordStore.ts` |
| T04 | 모든 포즈에서 조합 가능한 픽셀 캐릭터 | `src/game/pixel/OfficerAppearanceParts.tsx`, `PixelOfficer.tsx`, `OvertimeOfficer.tsx` |
| T05 | 타이틀 꾸미기 화면과 모든 실제 장면 연결 | `src/character/CharacterCustomizationDialog.tsx`, `character-customization.css`, `src/game/GameScreen.tsx`, 장면/엔딩 컴포넌트 |

순서: T01 → T02 → T03 → T04 → T05. 저장 계약과 렌더러는 UI를 연결하기 전에도 기존 화면에서 독립 검증할 수 있다. 하나의 기능이므로 Phase는 하나로 유지한다.

## First-Version Catalog
선택지는 모두 바로 사용할 수 있다. 남녀 선택과 다른 부위의 선택을 독립적으로 유지한다.

| Field | IDs | UI labels |
| :--- | :--- | :--- |
| gender | `male`, `female` | 남성, 여성 |
| hairStyle | `short`, `side-part`, `bob`, `ponytail` | 짧은 머리, 가르마, 단발, 묶은 머리 |
| hairColor | `black`, `brown`, `gray`, `blond` | 검정, 갈색, 회색, 금색 |
| skinTone | `light`, `peach`, `tan`, `deep` | 밝은 피부, 살구빛 피부, 구릿빛 피부, 짙은 피부 |
| outfit | `shirt`, `suit`, `cardigan` | 셔츠, 정장, 카디건 |
| outfitColor | `ivory`, `navy`, `purple`, `teal`, `rose` | 아이보리, 남색, 보라, 청록, 장밋빛 |
| hat | `none`, `straw`, `cap` | 없음, 밀짚모자, 캡 모자 |
| glasses | `none`, `square`, `round` | 없음, 사각 안경, 둥근 안경 |
| shoes | `dress`, `sneakers` | 구두, 운동화 |
| shoeColor | `black`, `brown`, `white` | 검정, 갈색, 흰색 |

## Shared Architecture
- `CharacterAppearance = { version: 1, runner: CharacterLook, pursuer: CharacterLook }`.
- 기존 `SharedProfile`과 Cosmos `PlayerDocument`에 optional `appearance` 필드를 추가한다. 없으면 기존 기본 캐릭터를 사용하며 읽기만으로 계정 문서를 새로 쓰지 않는다.
- `POST /api/appearance`는 인증된 계정의 외형만 갱신하고 `{ profile }`을 반환한다. 계정 ID를 본문에서 받지 않는다.
- 기존 Cosmos DB `stair-climb/players`, `/accountId` 파티션과 해시 문서 ID를 유지한다. 외형은 계정 point read/write이므로 새 컨테이너나 정렬 인덱스가 필요하지 않다.
- 서버의 외형 저장과 두 모드의 결과 저장은 ETag 조건부 갱신을 사용하여 서로의 필드를 보존한다. 여러 기기의 외형 변경은 마지막으로 저장된 전체 외형을 사용한다.
- 클라이언트는 선택 즉시 표시하고 400ms 후 저장한다. 같은 계정의 점수 저장과 외형 저장을 기존 store에서 직렬 실행한다. 저장 응답이 와도 그 뒤에 고른 외형을 되돌리지 않는다.
- 로컬 데모는 메모리에서만 미리보기한다. 회사 기록 API를 호출하거나 계정 저장 성공으로 표시하지 않는다.

## Completion Criteria
- 도망자/추격자의 각 옵션과 색상이 독립적으로 동작한다.
- 계정 저장 완료 후 같은 계정의 새 세션에 외형이 복원되고 다른 계정으로 새지 않는다.
- 외형 저장 전후 단계·무한 최고 기록, 남은 시간, 해금 단계가 보존된다.
- 모든 포즈와 엔딩에서 선택한 부위가 표시되고 발 위치·계단·게임 판정이 유지된다.
- 320px 모바일부터 데스크톱까지 미리보기, 선택 목록, 닫기와 재시도가 접근 가능하다.
- 기존 프로필에 외형 필드가 없거나 외형만 손상되어도 게임 기록 로딩을 막지 않는다.

## Verification Strategy
- T01: 카탈로그와 계약 단위 테스트, 점수 병합의 외형 보존.
- T02: 저장소·핸들러 테스트로 계정 경계, 유효성, 409/412 재시도와 기록 보존 확인. 실제 Cosmos emulator 검증 케이스도 추가하고 기존 CI에서 실행한다.
- T03: 가짜 시계·지연 응답으로 debounce, 빠른 연속 변경, 실패/재시도, 계정 전환을 검증한다.
- T04: 두 역할·방향·모든 포즈의 부위 표시, 기본 외형, 신발 기준선 검증.
- T05: 편집 화면/실제 게임 연결 검증 후 전체 테스트, lint, frontend/API build. 로컬 데모 브라우저에서 모바일·데스크톱 미리보기 확인.
- 계획 단계에서는 테스트나 구현을 실행하지 않는다. Git 푸시·배포·운영 계정 기록 변경은 계획 산출물이 아니다.

## Existing State and Regression Traps
- 작업 시작 시 `src/game/pixel-theme.css`에 모바일 무한 모드 좌우 버튼 간격 수정이 남아 있다. 꾸미기 스타일은 새 CSS로 분리하여 그 변경을 보존한다.
- `mergeSharedResult`는 프로필을 명시적으로 재구성한다. 외형을 여기에 보존하지 않으면 단계 점수 저장 후 외형이 사라진다.
- `encodeDocument`도 명시적 필드만 쓴다. 서버의 두 점수 경로 모두 외형 왕복이 필요하다.
- `CompanyRecordStore.acceptProfile`은 늦게 오는 응답을 받는다. 저장 확인 외형과 미저장 선택 외형을 분리해야 화면이 과거 외형으로 돌아가지 않는다.
- 일반 게임과 야근 엔딩의 픽셀 구현은 별도다. 색만 바꾸는 것으로 끝내지 않고 같은 부위 컴포넌트를 연결한다.
- 인증·프로필·순위 스키마와 이전 점수 대기열은 기존 계정과 함께 계속 사용한다. 새 외형 항목이 없다고 기존 응답을 거부하지 않는다.

## Adjacent Findings
추가 범위를 결정해야 하는 별도 결함은 발견하지 않았다. 기존 미배포 모바일 CSS 변경은 보존 대상이며 이 계획의 별도 Task로 늘리지 않는다.

## Progress
- done: 2/5
- Completed: P01-T01 (`8898b74`), P01-T02 (`5f98abb`). T02 API tests186/186, shared tests205/205, lint/API build passed.
- Emulator 통합 테스트3건을 추가했으나 로컬 emulator가 없어 미실행. 기존 CI의 통합 검증은 배포 전 필수다.
- Active: P01-T03
