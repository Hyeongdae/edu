# Task: T03 Versioned Account Appearance

## Status: done

## Goal
기본 외형 계약을 version2로 전환하고, 정상 version1 문서/프로필 응답을 기존 선택 손실 없이 읽어 새 눈·가방을 계정에 저장한다. 프로필 읽기만으로 DB를 수정하지 않고 점수·해금·동시 쓰기·계정 분리를 보존한다.

## Decision Summary
- T01/T02 완료 후 실행한다. expandedCharacterAppearance.ts의 최신 계약과 normalizer, 양쪽 look을 그릴 수 있는 렌더러가 준비되어 있다. 이 Task가 public 계약 전환 지점이다.
- 저장 API는 version2만 받는다. 과거 저장 문서와 정상 과거 응답은 명시적으로 정규화한다. 캐시된 구버전 실행 코드를 위한 별도 API는 추가하지 않으며 전체 계획 완료 후 클라이언트/API를 함께 배포한다.

## Implementation

### I01. public 계약 전환과 테스트 fixture의 의미 보존
- Related Files:
  - `shared/characterAppearance.ts` :: public exports; modify
  - `shared/expandedCharacterAppearance.ts` :: 최신 계약·normalize 함수; read-only
  - `shared/legacyCharacterAppearance.ts` :: 고정 version1 타입/validator/defaults; read-only
  - `shared/characterAppearance.test.ts` :: 최신 public 계약 검증; modify
  - `src/game/pixel/characterAppearanceArt.test.tsx` :: public 타입 fixture와 개수 가정; modify
  - `src/company/types.ts`, `shared/companyRecords.ts` :: public 계약 소비; inspect, modify only if needed for explicit type imports

#### Details
- **Signatures & Types**:
  ```typescript
  // shared/characterAppearance.ts의 최종 내용:
  export * from "./expandedCharacterAppearance";
  // 최신 CharacterAppearance.version은2이며 runner/pursuer는13필드 look이다.
  // eyeStyle: default|round|smile|sleepy|sharp
  // bag: none|backpack|laptop|crossbody|briefcase
  // bagColor: black|brown|navy|beige
  ```
- **Data & Schema Fields**:
  - 기존 SharedProfile.appearance?:CharacterAppearance와 AppearanceBinding.value:CharacterAppearance가 이제 version2다. 읽기 전 원시 version1을 이 타입이라고 단언하지 않는다.
  - 신규 getDefaultCharacterAppearance는 version2와 기존10필드 기본값, 새3필드 default/none/black을 반환한다. appearance가 없는 프로필에는 서버가 기본 appearance 필드를 자동 추가하지 않는다.
- **Execution Flow / Logic**:
  1. public 진입점만 최신 모듈로 전환한다. 과거 자료를 만드는 테스트는 legacy 모듈을 직접 import하여 version1을 명시한다. legacy 모듈 자체의 카탈로그/기본값을 수정하지 않는다.
  2. public 계약 테스트의 정상 version literal은2로, 유효하지 않은 미래 버전 fixture는3으로 수정한다. version1은 최신 strict predicate false/명시적인 normalize true라는 별도 기대를 둔다.
  3. art 테스트의 customLook() 10필드 literal에는 eyeStyle=default, bag=none, bagColor=black을 더한다. 머리6종/옷5종을 실제 도형으로 확인하도록 개수와 장발 뒤 레이어 기대를 갱신한다. 신규 boots의 위쪽 shaft와 y40 바닥을 확인한다.
  4. 기존 frame4개, 랭킹TOP10, 점수 대기열version2는 외형 카탈로그 개수/버전과 무관하므로 변경하지 않는다. 기존 dialog는 아직10개 그룹이며 새 그룹은 T04에서 추가한다.

### I02. Cosmos 읽기 정규화와 version2 쓰기
- Related Files:
  - `api/src/playerRepository.ts` :: PlayerDocument, decodeDocument, encodeDocument, readStored, saveAppearance; modify
  - `api/src/playerRepository.test.ts` :: 문서 정규화·보존·경쟁; modify
  - `api/src/handlers.ts` :: 기존 appearance request validation; inspect, no route redesign
  - `api/src/handlers.test.ts` :: version2 저장 경계; modify
  - `shared/companyRecords.test.ts` :: 두 점수 병합의 새 필드 보존; modify
  - `api/test/playerRepository.integration.test.ts` :: 실제 legacy 문서 read/write와 충돌; modify
  - `api/test/cosmosEmulatorHarness.ts`, `.github/workflows/azure-company-game.yml` :: 기존 격리 emulator/CI; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  import type { CharacterAppearance as LegacyCharacterAppearance } from "../../shared/legacyCharacterAppearance";
  // 계정 문서의 기존 필드/타입은 그대로 유지한다.
  interface PlayerDocument extends ItemDefinition {
    // id, accountId, schemaVersion:1, displayName, highestClearedStage,
    // bestStage?, bestScore?, remainingTimeCs?, achievedAt?,
    // infiniteBestScore?, infiniteAchievedAt? : 기존과 동일
    appearance?: CharacterAppearance | LegacyCharacterAppearance;
  }
  // readStored의 반환 메타데이터를 확장한다. 응답 JSON으로 노출하지 않는다.
  async function readStored(actor: AuthenticatedActor): Promise<{
    profile: SharedProfile;
    etag: string;
    appearanceNeedsUpgrade: boolean;
  } | null>;
  // 기존 public repository/handler 시그니처는 그대로다.
  saveAppearance(actor: AuthenticatedActor, appearance: CharacterAppearance): Promise<SharedProfile>;
  ```
- **Data & Schema Fields**:
  - 전체 PlayerDocument.schemaVersion=1을 유지한다. appearance.version=2만 새 형식이다. 신규 appearance는13필드를 모두 저장한다.
  - normalizeCharacterAppearance(rawAppearance)는 유효한 version2의 복사 또는 유효한 version1을 보완한 version2를 반환하고, 그 외에는 null이다. 요청용 isCharacterAppearance는 엄격한version2 전용이다.
  - 기존 actor accountId/hash문서ID/partition/account 검증, 점수/시간/해금 유효성은 유지한다. 외형 손상만 있으면 기존처럼 외형 필드만 생략하고 기록은 유지한다.
- **Execution Flow / Logic**:
  1. decodeDocument의 기존 점수/계정 검사 후 원시 appearance를 normalize한다. 정상 version1을 생략하거나 전체 기본 외형으로 초기화하지 않는다. invalid appearance만 생략한다.
  2. readStored는 resource.appearance가 유효한 version1이었는지를 appearanceNeedsUpgrade로 기록한다. getProfile 및 랭킹 조회는 read만 수행하며 create/replace를 호출하지 않는다.
  3. encodeDocument는 정규화된 profile에서 엄격한 version2만 복사하여 쓴다. appearance 없는 계정에는 기본값을 새로 추가하지 않는다. 두 모드 점수의 실제 write에도 현재 외형13필드를 보존한다.
  4. saveAppearance는 현재처럼 입력을 첫 await 전에 검증/깊은 복사한다. version1 payload, 부분version2, 모르는 field/ID, hex색상, accountId 삽입은400 invalid-request다. 본문8KiB/JSON/X-Game-Request:1/인증/X-Game-Account 검증은 그대로다.
  5. saveAppearance의 동일값 no-op는 값/이름이 같고 appearanceNeedsUpgrade=false인 경우만 허용한다. 명시적 저장 요청이 version1 문서를 처음 만난 경우 같은 표시 외형이어도 version2로 조건부 write한다. 이후 같은version2를 재저장하면 no-op다.
  6. 현재409(create)/412(replace) 재시도 최대5회, IfMatch ETag, 재읽기 후 병합을 유지한다. retry마다 최신 점수/해금/외형을 다시 읽고 요청 스냅샷을 적용한다. 무조건 upsert 또는 ETag 생략으로 바꾸지 않는다.
  7. 점수 향상이 없는 기존 no-op는 강제 마이그레이션을 일으키지 않는다. 조회/정규화만으로 전체 DB를 갱신하지 않는다. 충돌 초과409 conflict, 저장소 실패503, 미인증401/403 처리도 기존대로다.
- **Tests**:
  - 과거 문서를 fixture에 직접 넣고 profile이 기존10선택+기본신규3필드를 반환하는지, read 시 create/replace/ETag 변화가 없는지 확인한다.
  - 동일 외형의 첫 명시적 v2저장만 실제 migration write하고 두 번째 동일 저장은 no-op인지 확인한다. 사용자 이름 변경은 기존대로 검증된 이름으로 갱신한다.
  - 새 가방/눈/추가style을 양 역할에 다르게 저장한 뒤 새 repository instance에서 복원하고 다른 actor에게 새지 않는지 확인한다.
  - version1→단계 점수/무한 점수 실제 갱신 시 appearance가2로 저장되며 모든 과거 선택과 점수/시간/해금이 보존되는지 검사한다.
  - 신규 eyeStyle/bag/bagColor를 포함하여 세 경로(외형·단계·무한) 동시409/412 케이스를 갱신한다. ETag/read metadata는 HTTP 프로필/랭킹에 노출되지 않는다.
  - handler의 `{...getDefaultCharacterAppearance(), version:2}`는 이제 유효하다. 미래버전 오류를 테스트하려면3을 쓴다. `{version:2}`만 있는 누락 객체는 여전히 invalid다. 이 둘을 일괄 같은 fixture로 바꾸지 않는다.
  - emulator 테스트는 기존 test_<uuid> DB와 임시 컨테이너만 사용한다. v1raw 문서 create→read ETag동일→v2save→fresh repository→두 점수보존을 확인하고 finally cleanup한다. 운영 Cosmos는 사용하지 않는다.

### I03. HTTP 응답 정규화와 클라이언트 저장 불변식
- Related Files:
  - `src/company/recordApi.ts` :: normalizeSharedProfile, isSharedProfile, fetchProfile, postResult, postInfiniteResult, postAppearance; modify
  - `src/company/CompanyRecordStore.ts` :: acceptProfile, updateAppearance, savePendingAppearance, publish; inspect, modify only for necessary v2 integration
  - `src/company/recordApi.test.ts`, `src/company/CompanyRecordStore.test.ts` :: v1 읽기/v2 저장/지연 응답/계정 테스트; modify
  - `src/test/companyFixtures.ts` :: 최신 타입 fixture; modify only if needed

#### Details
- **Signatures & Types**:
  ```typescript
  export function isSharedProfile(value: unknown, accountId: string): value is SharedProfile;
  export function normalizeSharedProfile(value: unknown, accountId: string): SharedProfile | null;
  // 기존 fetch/post 메서드의 파라미터와 반환 타입은 유지한다.
  ```
- **Execution Flow / Logic**:
  1. isSharedProfile은 accountId/표시이름/점수·해금/시간과 optional 최신appearance를 검증하는 canonical type guard로 유지한다. legacy원본을 true로 반환하여 version2 타입으로 단언하지 않는다.
  2. normalizeSharedProfile은 원시object를 검사하고 appearance가 없으면 부재를 유지한다. 있는 경우 normalizeCharacterAppearance 결과가 null이면 null을 반환한다. 정상화한 새 candidate에 isSharedProfile을 적용한 뒤 성공한 canonical객체만 반환한다. 입력을 수정하지 않고 appearance nested 참조를 복사한다.
  3. fetchProfile, postResult, postInfiniteResult의 profile 부분은 이 함수의 반환값을 사용한다. 두 점수 응답은 submissionId와 기존 entries 검증을 유지하고 반환값의 profile을 실제 정규화 객체로 교체한다. `as SharedProfile`로 원본만 캐스팅하지 않는다.
  4. postAppearance 요청은 엄격한 version2 저장 요청만 허용하고 먼저 복사한다. 확인 응답은 raw profile에 대해 엄격한 isSharedProfile 및 실제 version2 appearance를 요구하며 요청 전체와 equality를 검사한다. version1을 보완하여 저장 완료로 추정하지 않는다.
  5. store는 canonical profile/13필드 draft를 계속 사용한다. 400ms debounce, 직렬 실행, 최신 draft revision 우선, pending/error/auth-required 및 retry, stop/start/계정 전환 epoch를 유지한다. 표시만으로 migration 저장 요청을 만들지 않는다.
  6. legacy응답에서 얻은 canonical profile이 score 응답에 들어와도 pending한 bag/eye 선택을 덮지 않도록 기존 revision 로직을 확인한다. draft는 기존처럼 서버 확인 전까지 남긴다.
  7. 버전 전환은 localStorage 외형 저장을 추가하지 않는다. 점수 대기열의 version2와 키/마이그레이션은 외형 버전과 무관하다.
- **Tests**:
  - raw version1 프로필을 fetchProfile 및 각 score 응답에 넣어 기존 모든선택+신규default3개가 실제반환에 들어오는지 검사한다. raw참조를 바꾸지 않는다. account불일치, 손상/미래appearance, 잘못된점수는 계속invalid-response다.
  - postAppearance가13필드 전체를 v2로 보내며 version1 확인 응답을 성공처리하지 않는지 검사한다. 요청 중 input수정에도 wire snapshot이 유지된다.
  - 새로운 bagColor/eyeStyle을 연속변경·서버늦은응답·실패retry·계정전환에 사용해 최신 선택을 보존한다. 단순 callback호출만 확인하지 말고 최종 store snapshot과 payload를 확인한다.
  - 회사계정 profile없음/appearance없음도 기존처럼 게임이 준비되고, 로컬모드 fallback이 version2라는 점을 확인한다.

## Acceptance Criteria
- [x] public 계약과 새 저장/확인 응답이 엄격한 version2다.
- [x] 정상 과거 문서/프로필은 기존 선택과 기록을 보존하여 정규화된다.
- [x] read는 DB를 수정하지 않고 실제 write와 명시적 최초 외형 저장만 새 형식을 쓴다.
- [x] 인증·계정 경계·동시 점수 보존·지연 응답·재시도와 no-op 규칙을 유지한다.
- [x] 계정 문서 버전/점수 대기열/DB/컨테이너/랭킹 기준은 변경하지 않는다.

## Validation
- `npm test -- --run shared/characterAppearance.test.ts shared/expandedCharacterAppearance.test.ts shared/companyRecords.test.ts src/company/recordApi.test.ts src/company/CompanyRecordStore.test.ts src/company/CompanyRecordsGate.test.tsx src/game/pixel/characterAppearanceArt.test.tsx src/game/pixel/expandedCharacterArt.test.tsx src/character/CharacterCustomizationDialog.test.tsx --maxWorkers=2` — 전환과 기존 UI10그룹/렌더러 회귀 통과.
- `npm --prefix api test` — 저장소/핸들러 단위 회귀 통과.
- 로컬 emulator 준비 확인 후 `COSMOS_EMULATOR_ENDPOINT=http://127.0.0.1:8081/`를 해당 프로세스에 설정하고 `npm --prefix api run test:integration` 실행. PowerShell은 기존 환경값을 변수에 보관하고 try/finally로 복원한다. /ready는8080이다. emulator가 없다면 미실행 사유와 기존 CI 검증 필요를 기록하며 운영 DB로 대체하지 않는다.
- `npm run lint`, `npm run build`, `npm --prefix api run build`, `git diff --check` — 모두 통과.
- 이 Task만으로 운영에 배포하지 않는다. T04까지 완료한 후에만 별도 배포 요청에 따라 통합 artifact를 만든다.

## Commit Message
```text
feat(character): activate versioned account appearance with legacy preservation

Plan: 2026-11-04-character-customization-expansion
Phase: P01-appearance-expansion
Task: T03-versioned-account-appearance

- Normalize legacy account appearances without writes on read
- Save and acknowledge complete version two looks while preserving game records
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `445e014`

## Validation Results — 2026-11-04
- 지정9파일584/584 통과(36.06초). public version2 전환, 기존v1 HTTP응답의 실제값 변환, 엄격한 저장확인 응답, 새로운 눈·가방 draft의 지연응답/실패재시도/계정격리 및 기존UI10그룹을 확인했다.
- API4파일198/198 통과(3.49초). 정상v1 문서 조회 무변경, 첫명시적동일값저장만 v2전환, 후속동일값no-op, 두모드 실제쓰기/무변경쓰기 구분, 점수/시간/해금/새13필드 보존과 충돌 재시도를 확인했다.
- npm run lint, npm run build, npm --prefix api run build, git diff --check 통과. 초기 부츠 테스트의 nullable query 결과 타입만 명시한 뒤 모든 타입 검증이 통과했다.
- 실제 Cosmos emulator 통합 테스트3건(v1읽기ETag불변/명시저장업그레이드, 단계쓰기업그레이드, 무한쓰기업그레이드)을 추가하고 기존409/412 및 새세션 외형 테스트를 새필드로 갱신했다. API tsc는 test 디렉터리를 포함하므로 이 테스트들도 타입검증을 통과했다.
- 로컬 readiness http://127.0.0.1:8080/ready가 준비되지 않아 emulator 통합 실행은 미실행이다. 기존 CI 통합 검증을 배포 전 필수로 남긴다. 운영 Cosmos/회사 계정을 테스트에 쓰거나 변경하지 않았다.
- readStored의 appearanceNeedsUpgrade는 repository 내부에만 둔다. 조회는 쓰지 않고 명시외형저장/실제점수갱신 때만 새형식을 쓴다. 전체문서schemaVersion1, 점수대기열version2, DB/컨테이너/랭킹 및 인증경계는 유지했다.
- CompanyRecordStore의 본체를 수정하지 않고 HTTP에서 실제canonical객체로 변환해 전달했다. strict type guard가 legacy원본을 version2로 단언하지 않고, 외형 저장확인은 raw version2만 인정한다.
- public 전환 때문에 과거준비단계의 테스트(publicv1기대), 새카탈로그 머리6/옷5/부츠 및 literal13필드 fixture를 의미에 맞게 갱신했다. legacy/expanded 계약 구현 자체와 실제 픽셀도형/scene좌표/모션은 변경하지 않았다.
- 빌드 JS657.65kB(gzip181.31kB), CSS92.97kB(gzip15.88kB); API bundle36.4kB. 기존500kB chunk 경고 유지. 검증로그는 TEMP/character-expansion-t03-{focused,api,build,api-build,lint}.log에 보존했다.
- 기존 미커밋 pixel-theme.css 변경은 보존하고 커밋에서 제외했다. 추가범위가 필요한 발견: 특이사항 없음. 새13그룹 편집 및 전체장면/브라우저 검증은 T04에 남겨 두고 push/배포는 수행하지 않았다.
