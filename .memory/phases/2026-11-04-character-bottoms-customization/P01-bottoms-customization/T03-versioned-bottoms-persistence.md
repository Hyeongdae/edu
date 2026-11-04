# Task: T03 Versioned Bottoms Persistence

## Status: done

## Goal
T01/T02의 v3 하의 계약을 public/API/클라이언트에 연결한다. 기존 v1/v2 외형을 손실 없이 읽고 하의 포함15필드 저장·재접속·두 모드 점수 갱신을 지원하되 기존 점수·해금·계정 격리를 유지한다. 새 편집 그룹의 노출은 T04다.

## Decision Summary
- 최신 계약은 `shared/bottomsCharacterAppearance.ts`의 version3, 필수 bottoms(trousers/jeans/shorts/skirt)와 bottomsColor(black/navy/gray/beige/brown/white), 기존13필드다. 정상 v1/v2 읽기에는 긴바지/남색만 보완한다.
- Cosmos 문서 schemaVersion1, DB/container stair-climb/players, /accountId 및 점수 대기열 version2는 유지한다. 명시적 외형 저장은 v3만 허용한다. 계획2026-11-04-character-bottoms-customization/P01-bottoms-customization.

## Implementation

### I01. public 계약과 Cosmos 읽기/쓰기
- Related Files:
  - `shared/characterAppearance.ts` :: export 진입점 — modify to re-export bottomsCharacterAppearance.
  - `api/src/playerRepository.ts` :: PlayerDocument, decodeDocument, encodeDocument, readStored, saveAppearance — modify.
  - `shared/companyRecords.ts` :: SharedProfile/SaveAppearanceResponse, mergeSharedResult/mergeSharedInfiniteScore — existing consumer, change only if a type/clone adaptation is required.
  - `api/src/handlers.ts` :: handlers.appearance 및 요청 검증 — reuse public validator; change only if needed.
  - `shared/expandedCharacterAppearance.ts`, `shared/legacyCharacterAppearance.ts` :: 고정 과거 계약 — read-only.
  - `api/src/errors.ts`, `principal.ts`, `index.ts` :: 기존 오류/인증/라우트 — read-only.

#### Details
- **Signatures & Types**:
  ```typescript
  // 각 CharacterAppearance는 최신 public(v3), fixed expanded(v2), fixed legacy(v1)에서 import.
  interface PlayerDocument extends ItemDefinition {
    id: string;
    accountId: string;
    schemaVersion: 1;
    displayName: string;
    highestClearedStage: ClearedStage;
    bestStage?: GameStage;
    bestScore?: number;
    remainingTimeCs?: number;
    achievedAt?: string;
    infiniteBestScore?: number;
    infiniteAchievedAt?: string;
    appearance?: CharacterAppearance | ExpandedCharacterAppearance | LegacyCharacterAppearance;
  }
  // 외부 시그니처는 그대로이며 CharacterAppearance는 이제 v3다.
  saveAppearance(actor: AuthenticatedActor, appearance: CharacterAppearance): Promise<SharedProfile>;
  // readStored의 반환 shape도 그대로 유지한다.
  // Promise<{ profile: SharedProfile; etag: string; appearanceNeedsUpgrade: boolean } | null>
  ```
- **Data & Schema Fields**:
  - 원본 Cosmos 문서는 v1/v2/v3 appearance가 있을 수 있다. 반환 SharedProfile.appearance는 optional 최신 v3만 보증한다. 외형 없음은 계속 없음이며 GET이 새 문서를 만들지 않는다.
  - 기존 bestStage/bestScore/remainingTimeCs/achievedAt, infiniteBestScore/infiniteAchievedAt, highestClearedStage와 id/accountId는 보존한다. 문서의 schemaVersion과 외형 version을 혼동하지 않는다.
- **Execution Flow / Logic**:
  1. public export를 새 모듈로 한 번 전환한다. decodeDocument의 기존 normalizeCharacterAppearance 호출은 v1/v2 모두 정상화해야 한다. 이미 잘못된 외형을 생략하는 repository 정책은 유지하고 이를 정상 v2까지 생략하는 실수와 구분한다. 나머지 문서 손상 검증은 완화하지 않는다.
  2. readStored의 appearanceNeedsUpgrade는 원본 appearance가 정확한 v1 또는 v2인지 각 고정 validator로 판단한다. 현재 v1만 보는 분기를 두 버전으로 확장한다. `raw.version !== 3`처럼 손상 데이터까지 정상 upgrade로 간주하지 않는다.
  3. saveAppearance는 엄격한 v3 검증 후 입력을 clone하고 현재 5회 409/412 재시도/ETag IfMatch를 유지한다. 정상 v2를 읽어 normalize한 결과와 요청 v3가 같은 기본 하의여도 appearanceNeedsUpgrade=true이면 명시적 첫 저장은 실제 v3 replace를 해야 한다. 이미 저장된 동일 v3/동일 displayName이면 기존 no-op로 반환한다.
  4. encodeDocument는 최신 v3를 clone해 쓴다. 실제 점수 향상/해금/이름 변경 등 기존 로직상 쓰기가 필요한 stage/infinite 저장은 정상화된 외형을 보존해 v3로 쓴다. 기존 점수/해금 no-op일 때는 읽기용 정상화만 이유로 DB를 쓰지 않는다.
  5. handler는 기존 authenticated 경계와 isSaveAppearanceRequest를 그대로 사용한다. v1/v2/누락/unknown bottoms/색상/과잉 필드는 invalid-request400이다. 세션 없음401, 계정/요청 헤더 검증과 CSRF 성격의 X-Game-Request 검증은 기존대로, 5회 충돌은 conflict409, storage 문제는503이다. 응답에 SDK/credential/ETag를 노출하지 않는다.
  6. DB/컨테이너/throughput/index/Auth/배포 설정을 수정하지 않는다.

### I02. 클라이언트 응답과 계정 store
- Related Files:
  - `src/company/recordApi.ts` :: isSharedProfile, normalizeSharedProfile, fetchProfile, postResult, postInfiniteResult, postAppearance — reuse/modify as needed.
  - `src/company/CompanyRecordStore.ts` :: updateAppearance, saveAppearanceDraft, mergeProfile, queue serialization — reuse; modify only if required for v3.
  - `src/company/types.ts` :: AppearanceBinding — public type consumer, no new sync states.
  - `src/game/GameScreen.tsx`, `src/infinite/InfiniteModeScreen.tsx`, `src/infinite/InfiniteStairScene.tsx`, `src/game/StairScene.tsx`, `OfficeExitEnding.tsx`, `OvertimeCaptureEnding.tsx` :: public type consumers; only necessary v3 fixture/type adaptations.

#### Details
- **Signatures & Types**:
  ```typescript
  export function isSharedProfile(value: unknown, accountId: string): value is SharedProfile;
  export function normalizeSharedProfile(value: unknown, accountId: string): SharedProfile | null;
  export async function postAppearance(accountId: string, payload: SaveAppearanceRequest,
    signal: AbortSignal): Promise<SaveAppearanceResponse>;
  // AppearanceBinding = { value: CharacterAppearance; status: existing AppearanceSyncStatus;
  // errorMessage: string | null; update(next: CharacterAppearance): void; retry(): void }
  ```
- **Data & Schema Fields**: AppearanceBinding.value와 SharedProfile.appearance는 최신 v3다. /api/profile은 profile 자체를, /api/appearance는 `{profile}`, 점수 저장은 기존 `{submissionId,profile,entries}`를 유지한다. 응답 필드를 추가하지 않는다.
- **Execution Flow / Logic**:
  1. 일반 fetchProfile/postResult/postInfiniteResult는 normalizeSharedProfile로 정상 v1/v2 wire appearance를 v3로 바꾸고 accountId·기존 점수/해금을 검증한 새 객체만 반환한다. null/손상 appearance가 명시되어 있으면 클라이언트는 기존대로 invalid-response를 반환한다. `isSharedProfile` type guard 자체는 과거 raw 객체를 최신 타입이라고 통과시키지 않는다.
  2. postAppearance는 요청을 strict v3 검증/clone한다. 응답은 원본부터 isSharedProfile로 검증된 실제 v3여야 하고 요청 외형과 equal해야 한다. 구버전/필드 누락/다른 하의를 기본값으로 보완하여 저장 성공 처리하지 않는다. 요청 후 호출자가 draft를 바꿔도 보낸 스냅샷은 그대로다.
  3. 기존 API path/credentials include/no-store/manual redirect/abort/15초 timeout과 fixed error 메시지를 유지한다. transport 오류/401/timeout에서 UI 초안과 재시도 상태가 사라지지 않게 한다.
  4. 400ms debounce, appearanceRevision, pending→saving→saved/error/auth-required 상태와 점수/외형 직렬 쓰기를 유지한다. 늦게 도착한 이전 하의 응답이 새 선택/반대 역할/점수를 되돌리지 않게 한다. 점수 응답이 appearanceDraft를 덮지 않는 기존 정책도 유지한다.
  5. 로컬 세션 메모리 외형도 public v3 default/clone을 사용하고 영구 기록을 추가하지 않는다. 계정 변경/stop/abort는 기존 수명주기를 그대로 따른다. 점수 대기열 JSON의 version2는 절대3으로 바꾸지 않는다.

### I03. 버전 전환/저장 회귀 및 emulator
- Related Files:
  - `shared/characterAppearance.test.ts`, `shared/bottomsCharacterAppearance.test.ts` :: public v3 기대값/기존 입력 경계 — modify.
  - `shared/expandedCharacterAppearance.test.ts` :: public export 확인만 v3로 조정; 고정 v2 validator/정규화의 기대는 유지 — modify narrowly.
  - `shared/companyRecords.test.ts`, `src/company/recordApi.test.ts`, `CompanyRecordStore.test.ts` :: 하의 보존/HTTP/저장 경합 — modify.
  - `api/src/playerRepository.test.ts`, `api/src/handlers.test.ts` :: 버전별 읽기/쓰기/400/충돌 — modify.
  - `api/test/fixtures.ts`, `api/test/playerRepository.integration.test.ts` :: 필요한 최신 fixture/실제 emulator v2 사례 — modify.
  - `src/character/CharacterCustomizationDialog.test.tsx` 및 public 계약을 사용하는 기존 테스트 :: version2 literal/수동13필드 fixture만 최신 계약으로 조정 — modify when required; 13개 편집 그룹 기대는 T04 전까지 유지.
  - `api/test/cosmosEmulatorHarness.ts`, vite/api vitest config, workflow :: read-only.

#### Details
- 고정 v1/v2 테스트의 입력 version2 거부/허용 의미를 일괄 치환하지 않는다. public.v3 비교 테스트의 invalid 버전은4로 옮기고 fixed v2의 version3 거부는 유지한다. 최신 fixture는 getDefaultCharacterAppearance를 바탕으로 하고 과거 wire fixture는 고정 모듈을 명시적으로 import한다.
- API: 비기본 v2의 눈·가방·머리·성별·옷을 보존한 GET이 v3을 반환하면서 raw 문서/ETag/replace count가 동일함을 검사한다. 동일한 기본 하의를 명시 저장하면 첫 1회 v3로 전환되고 두 번째 동일 저장은 no-op여야 한다.
- 저장된 v1/v2 각각의 stage/infinite 점수 no-op와 실제 쓰기를 구분한다. 최신 하의(예: 도망자 skirt/beige, 추격자 shorts/white) 저장 후 두 점수 갱신/동시409create/412replace/새 repository 세션에서도 15필드와 점수/해금이 보존되어야 한다.
- HTTP: 실제 fetch mock을 통해 v2 프로필/두 점수 응답이 모두 v3으로 반환되는지, v3 외형 저장 요청 JSON과 그대로 같은 응답을 확인한다. v2 저장 응답, 잘못된 bottomsColor, 다른 계정, 누락/다른 하의, 늦은 응답은 성공으로 인정하지 않는다.
- Store: 빠른 종류/색 변경, in-flight 중 추가 변경, 실패 재시도/401→재인증, 점수 큐 처리, 서로 다른 계정/세션 복원을 검증한다. fake timers/deferred promise로 순서를 제어하고 timeout을 늘리지 않는다.
- Emulator: 기존 v1 사례의 저장 후 버전 기대를3으로 갱신하고 v2 원본 사례를 별도로 더한다. fixture는 accountId별 해시ID, schemaVersion1, highestClearedStage1, bestStage2/bestScore80/remainingTimeCs4000/정상 achievedAt, infiniteBestScore60/정상 infiniteAchievedAt와 비기본 v2 외형을 사용한다. GET 전후 ETag 동일 → 명시 저장 후 v3 → 같은 v3 재저장 ETag 동일을 확인한다. stage 점수81 또는 infinite61로 각각 실제 쓰기도 확인한다. 각 사례는 독립 계정 ID를 써 기존 랭킹 시나리오에 간섭하지 않게 한다.
- Emulator endpoint는 `http://127.0.0.1:8081/`, readiness는 `http://127.0.0.1:8080/ready`다. 기존 harness는 운영 GAME_RECORDS_* 설정이 하나라도 있으면 실행을 거부하고 test_UUID DB만 지운다. 이 보호를 완화하지 않는다. 미준비 시 실행하지 않고 원인/타입 검증과 CI 필수 조건을 기록한다.

## Acceptance Criteria
- [x] public/API/클라이언트가 모두 v3이며 정상 v1/v2의 기존 선택을 보존한다.
- [x] GET/점수 no-op는 쓰지 않고 최초 명시 저장/실제 점수 쓰기는 v3 하의를 보존한다.
- [x] 잘못된 요청/저장 응답을 성공으로 처리하지 않고 기존 auth/ETag/직렬화/계정 분리를 유지한다.
- [x] 편집 그룹 노출은 아직13개이며 T03 타입/단위 검증이 독립적으로 통과한다.
- [x] emulator 검증의 실행/미실행 상태를 명시하고 운영 기록을 수정하지 않는다.

## Validation
- `npm run test -- --run shared/characterAppearance.test.ts shared/bottomsCharacterAppearance.test.ts shared/expandedCharacterAppearance.test.ts shared/companyRecords.test.ts src/company/recordApi.test.ts src/company/CompanyRecordStore.test.ts src/character/CharacterCustomizationDialog.test.tsx --maxWorkers=2` — public 계약/계정 저장/기존 편집 회귀 통과.
- `npm --prefix api test` — API 단위 검증 전체 통과.
- `npm run lint`, `npm run build`, `npm --prefix api run build`, `git diff --check` — 모두 통과. API build의 타입 검사는 통합 테스트 파일도 포함한다.
- Emulator가 준비되고 운영 설정이 없는 전용 프로세스에서 `$env:COSMOS_EMULATOR_ENDPOINT='http://127.0.0.1:8081/'; npm --prefix api run test:integration` — 모든 기존/새 사례 통과. 환경 미준비면 미검증으로 기록하며 운영 연결로 대체하지 않는다.

## Commit Message
```text
feat(records): persist versioned bottoms without resetting player records

Plan: 2026-11-04-character-bottoms-customization
Phase: P01-bottoms-customization
Task: T03-versioned-bottoms-persistence

- Activate version-three account appearances with version-one and version-two read compatibility
- Preserve stage and infinite records across appearance saves and concurrent writes
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (조건부 emulator 실행은 아래 미실행 기록 참조)
- commit: pending

## Execution Result — 2026-11-04
- public characterAppearance.ts를 bottomsCharacterAppearance의v3로 전환했다. repository의 PlayerDocument는 v1/v2/v3를 읽고 appearanceNeedsUpgrade는 원본이 정확한 v1 또는 v2일 때만 true다. 정상화한 값이 요청과 같아도 최초 명시 저장은 v3로 실제 쓰며 이후 같은 v3 저장은 no-op다.
- 기존 normalizeSharedProfile/HTTP 저장 확인/CompanyRecordStore/공통 점수 merge가 public 계약을 사용하므로 본체 변경 없이15필드에 연결되었다. 읽기는 구버전을 정상화하지만 외형 저장 성공은 원본부터 strict v3이고 요청과 같을 때만 인정한다. 기존 auth/ETag5회 충돌 재시도/400ms debounce/revision/점수 직렬화/계정 격리는 유지했다.
- v1/v2의 GET·랭킹 읽기와 두 점수 no-op가 원본 문서를 쓰지 않는지, 명시 저장/실제 점수 개선이 원래 선택과 하의를 보존하는지 API 단위로 검증했다. 409create/412replace 이후에도 최신 하의/점수/해금이 남는 사례를 포함했다.
- 실제 fetch mock을 거친 v1/v2 프로필/두 점수 응답, v3의 비기본 하의15필드 POST와 응답 확인, 잘못되거나 누락된 하의/색상·구버전 echo 거부를 검사했다. store의 빠른 선택/지연 응답/실패 재시도/401복구/점수 큐/계정 전환에 비기본 하의를 연결하고 새 HTTP-backed store 세션 복원을 추가했다.
- 편집 그룹은13개와 옷/옷 색상 라벨을 그대로 유지했다. public 버전 기대를3으로 바꾸고 수동13필드 CharacterLook fixture에 기본 하의2필드를 보완했다. 고정 v1/v2 모듈 자체는 변경하지 않았고 고정 v2 validator의 version3 거부 검사는 유지했다. 점수 대기열 version2/계정 문서 schemaVersion1은 유지한다.
- 초기 프런트엔드 타입 검사에서 버전2 literal과 수동13필드 픽셀 fixture2곳의 타입 오류를 확인해 새 public 계약에 맞게 갱신했다. 테스트/config/timeout/skip 완화는 없다.
- 지정7파일450/450(10.92초), 최종 관련 픽셀2파일을 포함한9파일662/662(21.12초), API4파일211/211(최종2.81초), lint/프런트엔드·API 타입·빌드/diff check 통과. 프런트엔드 JS668.23kB(gzip184.06kB)/CSS92.97kB(gzip15.88kB), API39.3kB. 기존500kB chunk 경고 유지.
- Cosmos readiness http://127.0.0.1:8080/ready가 응답하지 않아 실제 emulator 통합은 실행하지 않았다. 기존v1 쓰기 기대를v3로 갱신하고 v2의 GET/ETag 보존·첫 명시 저장·두 점수 no-op/실제 쓰기 통합3사례를 추가했다. 기존 동시 쓰기/새 세션 사례도 비기본 하의를 사용하며 API tsc로 통합 파일을 검증했다. 전체 통합16사례의 실제 실행은 로컬 emulator 준비 후 또는 배포 전 기존 CI에서 필수다. 운영 연결로 대체하거나 harness 보호를 완화하지 않았다.
- 실제 회사 계정/운영 Cosmos/브라우저/모바일 확인과 push/배포는 수행하지 않았다. DB/컨테이너/인덱스/Auth/게임 규칙/그림·모바일 버튼 간격을 변경하지 않았다. 별도 범위 결함은 특이사항 없음.
