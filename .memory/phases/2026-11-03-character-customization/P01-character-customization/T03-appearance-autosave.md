# Task: T03 Appearance Autosave

## Status: pending

## Goal
계정 store에서 새 외형을 즉시 표시하고 마지막 선택400ms 후 자동 저장한다. 지연 응답·점수 저장·계정 전환이 미저장 선택을 되돌리거나 다른 계정에 전송하지 않도록 한다.

## Decision Summary
- T01/T02 완료 후 실행한다. 기존 `CompanyRecordStore`의 계정 수명과 한 번에 하나의 네트워크 작업을 수행하는 루프를 활용한다.
- 외형은 점수 대기열과 별도 메모리 상태다. 점수 queue의 v1/v2 직렬화·복원은 그대로 유지한다. 모달을 닫아도 store는 계속 저장한다.

## Implementation

### I01. 브라우저 API와 UI 상태 계약
- Related Files:
  - `src/company/recordApi.ts` :: `request`, `isSharedProfile`, `postAppearance`, `CompanyRecordApi`, `companyRecordApi`; modify
  - `src/company/recordApi.test.ts` :: 인증/응답/외형 저장 경계; modify
  - `src/company/types.ts` :: `AppearanceSyncStatus`, `AppearanceBinding`, `CompanyRecordBinding`; modify
  - `shared/characterAppearance.ts`, `shared/companyRecords.ts` :: T01 데이터 계약; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  export async function postAppearance(
    accountId: string,
    payload: SaveAppearanceRequest,
    signal: AbortSignal,
  ): Promise<SaveAppearanceResponse>;
  // CompanyRecordApi에는 기존 주입 fixture와의 호환을 위해 optional로 추가한다.
  postAppearance?: typeof postAppearance;

  export type AppearanceSyncStatus = "idle" | "pending" | "saving" | "saved" | "error" | "auth-required";
  export interface AppearanceBinding {
    value: CharacterAppearance;
    status: AppearanceSyncStatus;
    errorMessage: string | null;
    update(next: CharacterAppearance): void;
    retry(): void;
  }
  // 기존 CompanyRecordBinding에 추가. 실제 store는 ready 시 항상 제공한다.
  appearance?: AppearanceBinding;
  ```
- **Data & Schema Fields**:
  - `CharacterAppearance`: `{version:1,runner,pursuer}`. look 필드는 gender/hairStyle/hairColor/skinTone/outfit/outfitColor/hat/glasses/shoes/shoeColor이며 T01 카탈로그 ID만 사용한다.
  - `SharedProfile.appearance`는 optional이다. 기존 프로필 응답은 계속 유효하다. 필드가 존재하면 `isCharacterAppearance`를 통과해야 한다.
- **Execution Flow / Logic**:
  1. 기존 내부 request의 payload union에 `SaveAppearanceRequest`를 추가하고 동일한 same-origin cookie,15초 timeout, no-store, manual redirect, JSON/error 검사를 재사용한다.
  2. `postAppearance`는 `/api/appearance`에 POST하고 `X-Game-Account`, `X-Game-Request:1`을 기존 경계대로 전달한다.
  3. 응답의 profile이 해당 계정의 유효한 프로필이고, appearance가 반드시 존재하며 요청 외형과 동등한지 검사한다. 누락/다른 외형이면 `RecordApiError("invalid-response")`이고 저장 성공으로 처리하지 않는다.
  4. 실제 `companyRecordApi` 객체는 postAppearance를 항상 제공한다. 테스트용 구형 주입 객체가 메서드를 생략한 경우 update 시 외형 저장 오류를 표시하며 무언가 저장된 것으로 간주하지 않는다.

### I02. 계정 store의 외형 상태와 직렬 자동 저장
- Related Files:
  - `src/company/CompanyRecordStore.ts` :: `start`, `stop`, `acceptProfile`, `publish`, `run`, 새 외형 update/retry/scheduler; modify
  - `src/company/CompanyRecordStore.test.ts` :: 가짜 시계·서버 mock·지연 요청 기반 회귀 테스트; modify
  - `src/company/CompanyRecordsGate.tsx` :: account key와 ready gate 수명 확인; read-only

#### Details
- **Signatures & Types**:
  ```typescript
  // CompanyRecordStore의 계정별 상태. 외부에서 직접 변경하지 않는다.
  private appearanceDraft: CharacterAppearance | null;
  private appearanceRevision: number;
  private appearanceDueAt: number | null;
  private appearanceStatus: AppearanceSyncStatus;
  private appearanceErrorMessage: string | null;
  private appearanceTimer: ReturnType<typeof setTimeout> | undefined;
  // private 이름은 일관되게 유지하고 binding.update/retry에 연결한다.
  updateAppearance = (next: CharacterAppearance): void;
  retryAppearance = (): void;
  ```
- **Data & Schema Fields**:
  - 새 store의 초기값: draft=null, revision=0, dueAt=null, status=`idle`, error=null, timer=undefined.
  - binding.value는 draft가 있으면 그 깊은 복사, 없으면 `resolveCharacterAppearance(profile.appearance)`이다. 서버 확인 프로필과 표시 중 draft를 구분한다.
  - appearance save 요청은 전체 외형 snapshot과 revision을 캡처한다. 미완료 외형은 점수 `PendingResult` 배열에 넣지 않는다.
- **Execution Flow / Logic**:
  1. `updateAppearance`는 active·profile 준비 상태와 strict 외형 검증을 확인한다. 현재 표시값과 동등한 이벤트는 무시한다. 유효한 새 값은 복사하여 draft에 넣고 revision++, status=pending, error=null, dueAt=`Date.now()+400`으로 바꾼 후 publish한다.
  2. debounce timer는 마지막 선택부터400ms에 kick한다. 연속 선택은 timer 하나를 재설정한다. render나 subscribe가 네트워크 작업을 시작하지 않게 한다.
  3. 기존 run 루프 우선순위: 프로필 필요/refresh → 점수 pending → 저장 시각에 도달한 appearanceDraft → 종료. 외형 대기 중이라고 이미 준비된 점수 제출을400ms 지연시키지 않는다.
  4. 외형 write는 루프에서 기존 controller/epoch를 사용해 한 번에 하나만 수행한다. 요청 직전 draft와 revision을 캡처하고 status=saving으로 표시한다.
  5. 성공하면 `acceptProfile(response.profile)`로 서버 확인 프로필을 병합한다. 기존 best/infiniteBest/highestClearedStage 단조 보존 로직을 유지한다. 캡처 revision이 현재 revision과 같을 때만 draft를 비우고 status=saved를 표시한다.
  6. 요청 중 다른 선택이 생겼으면 이전 성공 응답으로 draft/value를 덮어쓰지 않는다. pending 상태로 최신 dueAt을 유지하고 다음 iteration에서 마지막 외형을 저장한다. A가 저장 중일 때 B를 고르고, B가 기존 서버 값과 같더라도 A가 나중에 저장될 수 있으므로 B 저장을 생략하지 않는다.
  7. score/refresh 응답도 미저장 draft를 덮어쓰지 않는다. draft가 없을 때는 새 프로필의 외형을 표시하여 다른 기기에서 저장한 외형이 refresh에 반영되게 한다.
  8. 외형 요청 오류는 별도 catch에서 처리한다. 최신 요청 실패는 draft를 유지하고 status=error, 한국어 errorMessage를 표시한다. 일반 외형 실패로 기존 프로필을 없애거나 점수 sync loop를 영구 정지하지 않는다. `retryAppearance`는 최신 draft를 즉시 다시 예약한다.
  9. 예전 revision 요청이 일반 오류로 실패했으나 새 선택이 이미 있으면 최신 선택은 pending으로 유지한다.401/403은 revision과 관계없이 auth-required로 표시하고 인증 재개 전 자동 반복하지 않는다.
  10. 기존 `online` 이벤트는 error 상태의 외형도 재시도할 수 있게 하되 초기화 시 외형을 기본값으로 덮어쓰지 않는다. 전역 점수 auth 오류 상태를 우회해 외형만 다른 계정으로 쓰지 않는다.
  11. `stop`은 외형 timer와 요청을 정리한다. epoch가 달라진 응답은 상태나 binding을 변경하지 않는다. StrictMode stop/start 재연결은 메모리 draft를 보존하고 새 active epoch에서 debounce를 다시 예약할 수 있어야 한다.
  12. run.finally에서 running을 해제한 뒤 아직 실행 가능한 작업이 있으면 다시 kick하거나 dueAt timer를 예약한다. running 중 발생한 update가 유실되지 않게 한다. 아무 일도 없을 때 무한 microtask loop를 만들지 않는다.
  13. 초깃값을 읽는 것만으로 appearance POST를 실행하지 않는다. 서버 저장이 확인된 경우에만 `saved`를 표시한다.

### I03. 의미 있는 경쟁 조건 검증
#### Details
- 초기 프로필에 외형이 없어도 ready이고 기본 외형을 제공하며 write하지 않는다.
- t=0/100/250ms의3회 선택은 t=650ms 이전에 POST0회,650ms에 최신 전체 외형1회이다.
- A 요청 중 B/C 선택 후 A 응답을 늦게 도착시켜도 화면은 C이고 최종 서버 값도 C이다. A 저장 중 원래 외형으로 되돌린 선택도 마지막에 저장된다.
- 점수 제출과 외형 선택을 섞어 실행해 게임 기록과 마지막 외형이 함께 남고 POST를 병렬 실행하지 않는다.
- 외형503·timeout·잘못된 성공 응답은 미저장 값을 유지한다. 재시도 성공 뒤에만 saved가 된다. 외형 실패 후 새 점수 제출은 기존대로 가능하다.
- 계정A stop 뒤 도착한 응답이 계정B binding이나 API 계정 헤더에 반영되지 않는다.
- 저장 버튼 없이 모달 소비자가 구독을 해제해도 account store가 살아 있으면 마지막 선택을 저장한다. store stop 시 요청을 정리한다.
- 기존 점수 queue의 key/JSON version/내용과 브라우저 저장 실패 처리에 회귀가 없다.

## Acceptance Criteria
- [ ] 선택 즉시 binding.value에 반영되고400ms debounce로 저장된다.
- [ ] 오래된 응답과 되돌리기 선택에서도 마지막 선택이 최종 서버 외형이다.
- [ ] 저장 실패와 로그인 만료가 화면에 구분되고 재시도가 가능하다.
- [ ] 계정·점수 대기열·record gate 수명과 충돌하지 않는다.
- [ ] 기존 fixture가 appearance binding/API 메서드를 생략해도 기존 기능의 타입/테스트가 유지된다.

## Validation
- `npm test -- --run src/company/recordApi.test.ts src/company/CompanyRecordStore.test.ts src/company/CompanyRecordsGate.test.tsx shared/companyRecords.test.ts --maxWorkers=2` — 신규 경쟁 조건 및 기존 기록 로딩/queue 검증 통과.
- `npm run lint` — 오류 없음.
- `npm run build` — 타입/빌드 성공.

## Commit Message
```text
feat(character): autosave appearance through the account record store

Plan: 2026-11-03-character-customization
Phase: P01-character-customization
Task: T03-appearance-autosave

- Debounce account appearance saves and retain the newest selection
- Isolate appearance failures from game results and clean up account lifetimes
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
