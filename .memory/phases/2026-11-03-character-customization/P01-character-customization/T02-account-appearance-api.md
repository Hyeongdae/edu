# Task: T02 Account Appearance API

## Status: done

## Goal
`POST /api/appearance`로 로그인한 계정의 외형을 저장하고, 기존 점수·해금·무한 최고 기록을 보존한 프로필을 반환한다. 다른 계정이나 동시 점수 저장이 외형을 덮어쓰지 않도록 한다.

## Decision Summary
- T01 완료 후 실행한다. Cosmos `stair-climb/players`의 기존 해시 ID와 `/accountId` 파티션을 사용한다.
- 외형 데이터는 optional이며 누락/손상은 기본 표시로 복구한다. 점수 데이터 검증을 약화하지 않는다.

## Implementation

### I01. 저장 문서 왕복과 ETag 병합
- Related Files:
  - `api/src/playerRepository.ts` :: `PlayerRepository`, `PlayerDocument`, `decodeDocument`, `encodeDocument`, `createPlayerRepository`, `createPlayerRepositoryFromEnvironment`; modify
  - `api/src/playerRepository.test.ts` :: 기존 저장소 단위 테스트 및 외형 동시성 시나리오; modify
  - `api/test/playerRepository.integration.test.ts` :: 기존 emulator의 독립 계정/충돌 테스트; modify
  - `shared/characterAppearance.ts` :: `CharacterAppearance`, `isCharacterAppearance`, `cloneCharacterAppearance`; read-only
  - `shared/companyRecords.ts` :: `SharedProfile`와 두 결과 merge 함수; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // 기존 PlayerRepository에 추가한다.
  saveAppearance(actor: AuthenticatedActor, appearance: CharacterAppearance): Promise<SharedProfile>;
  // 기존 PlayerDocument에 추가한다. schemaVersion은 기존 1을 유지한다.
  appearance?: CharacterAppearance;
  ```
- **Data & Schema Fields**:
  - `CharacterAppearance`는 `{ version:1, runner:CharacterLook, pursuer:CharacterLook }`이다. 각 look은 gender, hairStyle, hairColor, skinTone, outfit, outfitColor, hat, glasses, shoes, shoeColor의 문자열 ID10개로 구성된다. 저장 전에 T01의 strict validator로 검사한다.
  - 기존 문서 필드: `id=getPlayerRowKey(accountId)`, `accountId`, `schemaVersion:1`, `displayName`, `highestClearedStage`, optional `bestStage/bestScore/remainingTimeCs/achievedAt`, optional `infiniteBestScore/infiniteAchievedAt`. 모두 보존한다.
  - 외형 미설정 문서는 `SharedProfile.appearance`를 생략한다. 외형만 유효하지 않은 문서도 이 필드를 생략하여 표시 측의 기본값으로 복원한다. 잘못된 점수/계정 스키마는 기존처럼 `storage-unavailable`이다.
- **Execution Flow / Logic**:
  1. `saveAppearance` 진입 시 `isCharacterAppearance`가 거짓이면 `RecordServiceError("invalid-request")`로 끝낸다. 외형 값은 깊은 복사한다.
  2. 기존 `readStored(actor)`로 최신 프로필과 ETag를 읽는다. 없으면 `{...actor, highestClearedStage:0, best:null, infiniteBest:null}`을 사용한다.
  3. 최신 프로필에 검증된 전체 appearance만 교체한다. 저장된 표시 이름은 actor 기준으로 갱신하되 best/infiniteBest의 displayName도 기존 규칙에 맞게 동기화하고 점수·시간·해금은 보존한다.
  4. 기존 계정은 `item.replace(document,{accessCondition:{type:"IfMatch",condition:etag}})`, 신규는 `items.create(document)`를 사용한다. 신규409·기존412일 때 최신 문서를 다시 읽고 최대5회 재시도한다. 같은 오래된 문서를 그대로 재전송하지 않는다.
  5. 두 기기가 동시에 서로 다른 외형을 저장하면 마지막 성공 write의 전체 외형을 사용한다. 동시 점수 write는 각 재시도 시 현재 저장된 외형을 보존한다.
  6. `encodeDocument`는 유효한 profile.appearance가 있을 때만 해당 필드를 복사한다. 기존 `submit`과 `submitInfiniteScore`가 이 인코더와 T01 merge를 통해 외형을 보존하는지 확인한다.
  7. 동등한 외형의 재시도는 같은 최종 상태를 만든다. 신규 계정의 첫 기본 외형 저장은 문서를 만들 수 있으며, 외형 없는 문서를 단순 조회할 때는 write하지 않는다.
  8.5회 충돌은 기존 `conflict`409, 저장소 장애는503으로 매핑한다. key/ETag/Cosmos 내부 메타데이터를 공개 응답에 넣지 않는다.

### I02. 인증된 HTTP 경계
- Related Files:
  - `api/src/handlers.ts` :: `createRecordHandlers`, `readResultBody`, 반환 handlers 타입; modify
  - `api/src/index.ts` :: lazy repository proxy, route registration; modify
  - `api/src/handlers.test.ts` :: repository mock, 외형 route 인증/유효성/오류 테스트; modify
  - `api/src/principal.ts`, `api/src/errors.ts` :: 기존 actor/오류 체계; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // createRecordHandlers의 반환 객체에 추가
  appearance: (req: HttpRequest, ctx: InvocationContext) => Promise<HttpResponseInit>;
  // T01에서 이미 정의한 계약
  interface SaveAppearanceRequest { appearance: CharacterAppearance }
  interface SaveAppearanceResponse { profile: SharedProfile }
  ```
- **Data & Schema Fields**: `POST /api/appearance`, JSON body `{appearance}`. body의 accountId, score, stage, 기타 필드를 거부한다. 응답은200 `{profile}`이며 성공 응답의 profile.appearance는 입력과 동등해야 한다.
- **Execution Flow / Logic**:
  1. `index.ts`에 `app.http("appearance", { methods:["POST"], authLevel:"anonymous", route:"appearance", handler:handlers.appearance })`를 등록한다. `anonymous`는 기존 SWA 인증 헤더 검사를 제거하는 의미가 아니다.
  2. 기존 `authenticated(req,action)`을 먼저 통과한다. `x-ms-client-principal`에서 actor를 구하며 `X-Game-Account`가 actor와 다르면401로 끝내고 repository에 접근하지 않는다.
  3. 기존 body reader를 재사용하거나 `readJsonBody`로 내부 이름을 통일한다. JSON content-type, `X-Game-Request:1`, 스트리밍8KiB 제한을 유지한다. 다른 route의 동작을 바꾸지 않는다.
  4. `isSaveAppearanceRequest`로 검증한 다음 `repository.saveAppearance(actor,payload.appearance)`를 호출한다.
  5.200/400/401/409/413/503 모두 기존 JSON 오류 체계와 `Cache-Control:no-store`를 사용한다.
  6. 외형 저장 후 랭킹 쿼리를 호출하지 않는다. 순위 장애가 외형 저장 성공을503으로 바꾸지 않게 한다.
  7. `index.ts`의 lazy repository proxy에도 `saveAppearance`를 전달한다. 미인증 요청 시 비밀 설정을 미리 읽는 경로를 만들지 않는다.

### I03. 유실 방지 검증
#### Details
- repository 단위 테스트: 기존 외형 없는 doc의 조회 output 유지, 외형 round-trip, 손상 외형만 fallback, 다른 계정 분리, 외형→단계점수→무한점수 순서에서 모두 보존, 신규409/기존412 후 최신 기록 보존,5회 conflict.
- handler 단위 테스트: 미인증/계정 불일치에서 storage 미접근, 카탈로그 밖 ID/hex/버전/추가 키/부분 look/초과 body 거부, 정상200 profile 외형, storage503, 랭킹 메서드 호출 없음.
- emulator 케이스: 같은 계정의 외형 저장과 단계·무한 점수 동시 저장을 기존 `holdFirstItemReadsTogether`로 충돌시킨 뒤 새 repository로 읽어 외형·최고점·해금 모두 확인한다. 새 계정 외형 저장이 문서1개만 생성하는지 확인한다.
- 운영 DB 설정/키를 emulator 테스트에 넣지 않는다. 기존 harness는 production env가 있으면 실행을 거절하는 구조를 유지한다.

## Acceptance Criteria
- [x] 기존 계정의 기록을 바꾸지 않고 두 캐릭터 외형을 저장·조회할 수 있다.
- [x] 두 점수 저장 경로와 외형 저장의 충돌 후에도 최신 기록과 외형이 함께 남는다.
- [x] 본문으로 다른 계정을 선택하거나 카탈로그 외 값을 저장할 수 없다.
- [x] 외형만 손상되었다고 기존 랭킹/프로필 로딩 전체가 실패하지 않는다.
- [x] 새 컨테이너·처리량·정렬 인덱스를 만들지 않는다.

## Validation
- `npm --prefix api test` — 기존 및 새 repository/handler 테스트 통과.
- `npm test -- --run shared/characterAppearance.test.ts shared/companyRecords.test.ts --maxWorkers=2` — shared 계약 회귀 없음.
- `npm run lint` — 오류 없음.
- `npm --prefix api run build` — 타입과 Functions 서버 번들 성공.
- Emulator가 이미 실행 중인 경우 `COSMOS_EMULATOR_ENDPOINT=http://127.0.0.1:8081/`를 해당 프로세스에만 설정하고 `npm --prefix api run test:integration`으로 실제 충돌 케이스를 확인한다. 실행 환경이 없으면 미실행으로 명시하고 기존 GitHub Actions의 통합 테스트를 배포 전 필수 검증으로 남긴다. 운영 Cosmos로 대체하지 않는다.

## Commit Message
```text
feat(api): persist account character appearances without losing records

Plan: 2026-11-03-character-customization
Phase: P01-character-customization
Task: T02-account-appearance-api

- Add authenticated validated appearance saves to existing player documents
- Preserve appearance and both ranking records across ETag retries
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Validation Results — 2026-11-03
- `npm --prefix api test`: 4파일186/186 통과(3.01초). 외형 왕복/기록 보존, 계정 경계, 신규409·갱신412 재시도, 입력/크기 경계, 공개 오류 응답을 확인했다.
- 지정한 shared 테스트: 2파일205/205 통과(1.12초).
- `npm run lint`: 통과, 오류/경고 없음.
- `npm --prefix api run build`: 통과. API bundle31.9kB이며 통합 테스트 코드도 TypeScript 검사에 포함되었다.
- 실제 emulator 통합 테스트3건(다른 계정 분리, 외형+단계+무한 동시 create/update)을 추가했다. 로컬 `http://127.0.0.1:8080/ready`에 emulator가 없어 실행하지 않았다. 기존 GitHub Actions의 `test:integration`은 배포 전 필수 검증으로 유지한다.
- 운영 Cosmos 접근/리소스 변경/실사용자 기록 수정/배포는 수행하지 않았다. 기존 모바일 버튼 CSS 수정은 보존했다.
- 추가 범위가 필요한 발견: 특이사항 없음.
