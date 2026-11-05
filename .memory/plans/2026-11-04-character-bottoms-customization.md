# Plan: Character Bottoms Customization

- Date: 2026-11-04
- Status: complete
- Decision: [Character Bottoms Customization](../decisions/2026-11-04-character-bottoms-customization.md)

## Goal
도망자와 추격자에게 긴바지·청바지·반바지·치마 및 독립적인 6색 하의를 선택한다. 기존 꾸미기와 계정별 점수·해금을 보존하고, 미리보기/타이틀/두 모드/퇴근·야근 엔딩에 동일한 선택을 표시한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `complete` | 과거 외형 호환, 공통 하의 도형, 계정 연결, 편집/장면 검증 | [P01](../phases/2026-11-04-character-bottoms-customization/P01-bottoms-customization/phase.md) |

## Tasks and Order
| Task | Observable outcome | Principal files |
| :--- | :--- | :--- |
| T01 | 기존 v1/v2를 보존하는 독립 v3 계약과 15개 필드 카탈로그 준비 | `shared/bottomsCharacterAppearance.ts`, 해당 테스트 |
| T02 | 네 하의를 모든 게임/엔딩 포즈에 실제 도형으로 표시 | `OfficerBottomsArt.tsx`, `officerPalette.ts`, `PixelOfficer.tsx`, `OvertimeOfficer.tsx`, 공통 부위 |
| T03 | public/API/클라이언트 계약을 v3로 함께 연결하고 기존 기록 보존 검증 | `shared/characterAppearance.ts`, `api/src/playerRepository.ts`, `src/company/recordApi.ts`, 저장/통합 테스트 |
| T04 | 편집창에 하의/색상을 추가하고 실제 장면·반응형 최종 검증 | `CharacterCustomizationDialog.tsx`, 필요 시 꾸미기 CSS, 편집/화면/엔딩 테스트 |

T01 → T02 → T03 → T04를 한 Phase에서 순차 실행한다. T01은 public export를 v2로 유지한다. T02에서 v1/v2/v3를 모두 그릴 수 있게 준비한 뒤 T03에서 public 계약을 v3로 전환한다. T04에서 새 항목을 사용자에게 노출한다. 각 Task 종료 시 타입 검사와 기존 동작이 성립해야 하며 중간 단계를 운영에 배포하지 않는다.

## Final Contract
- `CharacterAppearance = { version: 3; runner: CharacterLook; pursuer: CharacterLook }`.
- 기존 v2의 13개 필드에 필수 문자열 `bottoms`와 `bottomsColor`를 추가한다. null/누락을 정상 v3으로 보정하지 않는다.
- `bottoms`: `trousers` 긴바지, `jeans` 청바지, `shorts` 반바지, `skirt` 치마.
- `bottomsColor`: `black` 검정, `navy` 남색, `gray` 회색, `beige` 베이지, `brown` 갈색, `white` 흰색.
- 기존 v1은 10개 선택을 보존하고 기존 눈/가방 기본값과 하의 기본값을 보완한다. 기존 v2는 13개 선택을 보존하고 하의만 `trousers`/`navy`로 보완한다. 읽기만으로 문서를 쓰지 않는다.
- 고정 과거 모듈 `legacyCharacterAppearance.ts`(v1), `expandedCharacterAppearance.ts`(v2)는 그대로 보존한다. 새 계약은 `bottomsCharacterAppearance.ts`, public 진입점은 `characterAppearance.ts`다.
- 새 저장은 엄격한 v3만 허용한다. 외형의 version과 계정 문서 `schemaVersion: 1`, 점수 대기열 `version: 2`를 구분한다.
- Cosmos `stair-climb/players`, `/accountId`, 해시 ID, 기존 랭킹 쿼리/인덱스는 변경하지 않는다. 클라이언트와 API를 동일 계약으로 함께 출시해야 한다.

## Color and Drawing Defaults
색상은 실제 하의 도형의 앞/뒤 명암으로 적용한다. 아래 수치는 결정문에서 허용한 첫 색상안을 구체화한다.

| ID | Front / catalog swatch | Back shade | Deep shade |
| :--- | :--- | :--- | :--- |
| black | `#283247` | `#161e2f` | `#10182c` |
| navy | `#354766` | `#2c3b59` | `#22304c` |
| gray | `#788394` | `#525f71` | `#394657` |
| beige | `#c8b38b` | `#95815f` | `#6f6048` |
| brown | `#785039` | `#4d3325` | `#34251d` |
| white | `#e6edf2` | `#b1bfcc` | `#8092a4` |

- 기본 남색 긴바지는 기존 다리 좌표/색상과 신발 y=40을 유지한다.
- 청바지는 다리 위에 솔기·주머니/밑단 디테일을 더한다. 반바지는 짧은 옷과 선택 피부색 다리, 치마는 연결된 밑단과 피부색 다리로 구분한다.
- 상의/신발/가방/성별 선택과 독립적이며 종류 전환 시 색상을 유지한다. 전체 scale/카메라/계단/게임 규칙은 변경하지 않는다.
- 현재 `.overtime-officer-leg-front/back`는 엔딩 CSS가 움직인다. 공통 하의 부품을 도입해도 해당 그룹과 신발의 포함 관계를 보존한다.

## Validation and Release Boundary
- Task별 좁은 의미 검증 후 T04에서 전체 frontend/shared, API, lint, 두 build, 배포 검사를 한 번 수행한다. 유사 반복 테스트나 timeout/skip 완화로 통과시키지 않는다.
- 새 계약 정규화/복사/동등 비교, v1/v2 읽기 무변경, 명시 저장의 v3 전환, 두 모드 점수 쓰기의 하의 보존, ETag 충돌/계정 분리와 실제 HTTP 응답 검증을 포함한다.
- 실제 SVG 도형·색·포즈·피부/신발·레이어와 편집 동작/두 모드/엔딩 전달을 검증한다. 클래스 이름 존재만으로 모양을 검증했다고 하지 않는다.
- 허용된 도구가 있으면 320×568, 390×844, 768×1024, 1440×900에서 스크롤·초점·모바일 터치와 애니메이션을 확인한다. 이전 Chrome 자동 실행 차단을 우회하지 않는다. 대체 정적 SVG/DOM 확인은 실제 브라우저 검증과 구분한다.
- Cosmos 통합은 기존 로컬 emulator harness만 사용한다. 준비되지 않은 경우 새 통합 사례를 작성/타입 검증하고 미실행을 기록한다. 배포 전 CI에서 emulator 검증을 통과해야 한다. 실제 회사 기록을 테스트용으로 수정하지 않는다.
- 이번 계획은 Git push·배포·Azure 자원 변경·Docker 설치·기타 게임/UI 개선을 포함하지 않는다. 최종 출시 요청이 오면 프런트엔드/API를 함께 배포한다.

## Regression Traps
- 정확한 13필드 validator를 직접 15필드로 바꾸면 과거 데이터가 손상으로 판정된다. v2 모듈을 고정하고 별도 v3 정규화 계층을 사용한다.
- 렌더러가 v2 normalize를 계속 쓰면 v3 선택이 기본 캐릭터로 돌아간다. 머리/가방/팔레트까지 v3를 입력받도록 연결한다.
- v1만 보고 `appearanceNeedsUpgrade`를 계산하면 정상화된 v2와 v3가 같을 때 최초 하의 저장을 DB 쓰기 없이 성공 처리할 수 있다. v1/v2 모두 구분한다.
- 일반 GET/점수 응답은 과거 외형을 정상화하지만 외형 저장 확인 응답은 원본부터 실제 v3여야 한다. 하의가 없는 응답을 기본값으로 채워 저장 성공으로 오인하지 않는다.
- 13개 그룹/`옷` 라벨/버전2라는 기존 테스트 가정은 해당 전환 Task에서 갱신한다. 고정 v1/v2 validator 테스트는 그대로 유지한다.
- 스커트 아래 피부는 공통 피부색을 사용하고 부츠 윗부분은 마지막에 그려 가림을 유지한다. 좌우 반전과 포즈 그룹/발 기준을 바꾸지 않는다.
- 기존 모바일 버튼 간격2줄은 이미 `ae9d9b1`로 커밋·배포된 상태다. 이를 미커밋으로 오인하거나 되돌리지 않는다. 무관한 untracked 파일은 추가하지 않는다.

## Adjacent Findings
- 새 범위를 요청해야 할 별도 결함은 발견하지 않았다. 과거 외형 호환과 포즈별 도형 연결은 이번 기능에 직접 필요한 작업이다.
- 현재 직전 출시 `ae9d9b1`/Actions41782715701은 성공했다. 이전 출시의 실제 emulator 결과는 하의 기능의 새 검증을 대신하지 않는다.

## Progress
- done: 4/4 (구현/자동 검증 완료)
- Active: 없음
- T01 완료 (`2d6b996`): 독립 v3 하의 계약과 카탈로그/정규화/복사·동등 비교를 준비했다. 기존 모든 선택을 보존하며 고정 v1/v2와 public v2는 유지한다. 지정4파일328/328(3.65초), lint/프런트엔드·API 타입 검사와 빌드/diff check 통과. UI/실제 저장/렌더러는 후속 Task다. 기존 번들 용량 경고 유지, 별도 결함 없음. push/배포는 수행하지 않았다.
- T02 완료 (`e30fea8`): 공통 하의4종/6색을 두 역할의 게임4프레임·야근4포즈에 연결했다. 지정9파일481/481(30.80초), 새 하의 최종115/115(10.75초), lint/build/diff check 통과. 기본 긴바지32조건이 기존097c26c와 PNG 바이트 동일하고 새 하의80조건의 원래 표시 크기/2배 정적 표본을 확인했다. 불필요한 clip 생성과 한 테스트에 몰린 조합을 정리해 원래 장면 검사/timeout을 유지했다. public/API/UI는 아직 v2다. 실제 브라우저 애니메이션/모바일 및 실제 계정은 미검증이며 push/배포 없음.
- T03 완료 (`d7b6e24`): public/API/클라이언트를v3로 전환했다. 정상 v1/v2를 보존해 읽고 최초 명시 저장과 실제 점수 쓰기만 최신 형식으로 쓰며 읽기/점수 no-op는 쓰지 않는다. 지정7파일450/450, 최종 관련9파일662/662(21.12초), API211/211, lint/프런트엔드·API build/diff check 통과. 통합3사례를 추가했지만 로컬 emulator readiness 미준비로 전체16사례의 실제 실행은 배포 전 CI 필수로 남는다. 기존13개 편집 그룹/DB/Auth/게임 규칙을 유지했고 push/배포 없음.
- T04 완료 (`d480239`, 2026-11-05): 하의4종/색6종을 기존 편집/즉시 미리보기/자동 저장 경로에 노출하고 상의·하의를 구분했다. 실제 편집부터 두 모드·모든 엔딩까지 선택과 게임 진행 보존을 검증했다. 최종 frontend/shared1981/1981(59파일), API211/211, 배포 검사26/26, lint/프런트엔드·API build/diff check 통과. 정적4장면 확인 및 로컬 데모 http://127.0.0.1:5173/ HTTP200 확인. 실제 모바일/브라우저·회사 계정 복원과 emulator16사례 CI 검증은 출시 전 필요하다. 기존 번들 경고 유지, push/배포 없음, 별도 범위 결함 없음.
