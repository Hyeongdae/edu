# Task: T02 Functions Table API

## Status: pending

## Goal
인증된 개인 profile, 공유 상위10위, 결과 제출 API를 만들고 Azure Table의 실제 조건부 쓰기로 동시 기기/재전송을 검증한다. 실제 클라우드는 만들지 않는다.

## Decision Summary
- Precondition: P01-T01 complete; `shared/companyRecords.ts` DTO/merge/validation available.
- SWA managed Functions Node22; 비공개 Table Storage. 플랫폼 주입 principal만 계정 소스로 사용한다.
- 한 entity의 최고 성적과 highestClearedStage를 함께 조건부 갱신한다. 점수 검증은 스냅샷 범위 검증이며 전체 플레이 재현이 아니다.

## Implementation

### I01. Isolated Node API build and entry points
- Related Files:
  - `api/package.json`, `api/package-lock.json`, `api/tsconfig.json`, `api/host.json` :: package/build/runtime; new.
  - `api/local.settings.example.json` :: non-secret emulator placeholders; new.
  - `api/src/index.ts` :: v4 app.http registrations; new.
  - `api/src/handlers.ts` :: `createRecordHandlers`; new.
  - `api/src/principal.ts` :: `readAuthenticatedActor`; new.
  - `api/src/playerRepository.ts` :: repository/types/Table adapter; new.
  - `api/vitest.config.ts`, `api/vitest.integration.config.ts` :: Node suites; new.
  - `vite.config.ts` :: root Vitest exclude api/** using configDefaults.exclude; modify.
  - `eslint.config.js` :: api Node globals/compiled ignores; modify.
  - `.gitignore` :: api/dist, api/local.settings.json, emulator scratch; modify.
- Dependencies confirmed 2026-10-30: @azure/functions4.17.0, @azure/data-tables13.3.2; dev esbuild0.28.2, vitest5.0.5, typescript6.0.3, @types/node22, azurite3.37.0. Pin actual install resolution in lockfile; Node22 >=22.12 (Vite constraint). Do not change root dependency versions.
- API scripts: `build` = esbuild bundle src/index.ts → dist/index.cjs, platform=node/target=node22/format=cjs/packages=external plus `tsc --noEmit`; `test` = vitest run unit config; `test:integration` = vitest run integration config. package main dist/index.cjs; host.json version2. Functions bindings remain v4 app.http, runtime4.
- Only API entry bundled; shared/companyRecords and pure stageRules included in bundle, Azure npm packages external. No frontend React dependencies or public storage credential.
- Root suite excludes api/** so jsdom does not accidentally run emulator tests; API configs only include their own exact tests. ESLint provides Node globals only to API/scripts that need them.

### I02. Principal, routes, and error contracts
#### Details
- **Signatures & Types**:
```typescript
interface PlayerRepository {
  getProfile(actor: AuthenticatedActor): Promise<SharedProfile>;
  listTopScores(): Promise<SharedBest[]>;
  submit(actor: AuthenticatedActor, input: SubmitResultRequest): Promise<SharedProfile>;
}
function readAuthenticatedActor(header: string | null): AuthenticatedActor | null;
function createRecordHandlers(deps: {
  repository: PlayerRepository;
}): {
  profile(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit>;
  leaderboard(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit>;
  results(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit>;
};
```
- Route registrations: GET `profile`, GET `leaderboard`, POST `results` (Functions supplies /api prefix), authLevel anonymous because SWA verifies session. Every handler independently rejects invalid principal before storage access.
- Header x-ms-client-principal base64 UTF8 JSON max16KiB, object identityProvider=aad, nonempty userId, userRoles includes authenticated. Never derive identity from body/query/email. DisplayName = verified userDetails (provider name mapping handled deployment); trim/bound display text, React escapes it. No direct external Function endpoint or permissive CORS.
- DTOs from T01: SharedProfile {accountId,displayName,highestClearedStage0..5,best:SharedBest|null}; SharedBest {accountId,displayName,bestStage1..5,bestScore,remainingTimeCs,achievedAt}; SubmitResultRequest {submissionId UUID,result:{stage,score,remainingTimeCs,outcome}}. No client timestamp/clear/name fields.
- Require JSON application/json, max8KiB rawbody; require same-origin client marker `X-Game-Request: 1` on POST and do not enable CORS, preventing cross-site form submissions. Client T04 sends it. Reject malformed/body oversized with400/413 using invalid-request code.
- HTTP: success200 JSON; unauthorized401; validation400; locked409(stage-locked); concurrency exhausted409(conflict); storage unavailable503. All data responses Cache-Control:no-store. Exceptions never expose connection string, raw body, principal token, or stack to clients.
- results returns {submissionId echoed,profile,entries}; leaderboard {entries}; profile direct SharedProfile. A post-commit leaderboard read failure may return503; replay must be safe.
- Unit-test handlers by dependency injection, avoid Table call on failed auth/parse.

### I03. Atomic player entities and idempotent merge
- **Data & Schema Fields**:
  - Table `DexEscapePlayers` via `GAME_RECORDS_CONNECTION_STRING` and `GAME_RECORDS_TABLE` server env, fail closed when absent.
  - Entity partitionKey `descent-v1`; rowKey `p_` + sha256(platform userId). schemaVersion1:number, accountId:string, displayName:string, highestClearedStage:0..5.
  - Best fields all absent or all present: bestStage:number,bestScore:number,remainingTimeCs:number,achievedAt:ISOstring. ETag is SDK metadata, not DTO. Invalid persisted row yields controlled503, never silently resets.
- **Execution Flow / Logic**:
  1. Missing personal entity is a normal new profile(highest0,bestnull); missing table/credentials is503. GET does not create a sentinel row.
  2. Read entity+etag, validate result for that profile, merge using T01 rules and repository-injected `now:()=>Date`. Actor mismatch in storedrow is error.
  3. Missing row uses createEntity;409 create race rereads. Existing changed row uses updateEntity Replace with exact etag;412 rereads. Never upsert/wildcard/overwrite newer data.
  4. At most5 attempts; each rerun validates unlock and recomputes full merge. Same/worse result produces no performance replacement. A newer server clock never changes an equal record's earliest achievement.
  5. Keep best tuple and highest actual clear in same entity. Cleared only advances highest; caught/time-limit never does. On concurrent device A clear and B failure, neither best nor highest can decrease.
  6. listTopScores scans partition/playerprefix using SDK paging and retains bounded best10 while iterating all pages, excludes no-best profiles. Do not use only first10 rows (Table isn't score sorted).
  7. Result entries expose only public ranking DTO, never keys/etags/credentials. No arbitrary account update/delete/admin/reset routes or table creation in requests.

### I04. Meaningful automated verification
- Related Files:
  - `api/src/principal.test.ts`, `api/src/handlers.test.ts`, `api/src/playerRepository.test.ts`; new.
  - `api/test/table.integration.test.ts`, `api/test/azuriteHarness.ts`; new.
- Unit cases: malformed/spoofed/missing auth, guest aad actor accepted, JSON/marker limits, unknown accountId body rejected, locked stage, no-best fresh profile, ordering, error mappings, bounded412 retry, postcommit ACK/read failure.
- Integration harness starts this API package's own azurite-table executable with fresh free local port, private temp directory, test-only AZURITE_ACCOUNTS credential; constructs explicit localhost connection string. Never uses production env or root's pre-existing Azurite DBs. Guard hostname and emulatoraccount; no integration test fallback to real Azure.
- Actual SDK TableClient tests: create/read, two clients racing create/update, forced stale ETag412, simultaneous best improvement + clear, replay identical result after ACK loss, paged >10 ranks, stage2 failure retains highest1. Assert one row/account and correct complete tuple/time.
- Clean up only owned emulator process/table/temp path; verify resolved directory before recursive cleanup. Required integration cannot be skipped when emulator unavailable.

## Acceptance Criteria
- [ ] All three routes verify trusted identity and cannot select another actor from payload.
- [ ] Actual Table concurrency tests prove monotonic clear and idempotent strongest tuple.
- [ ] API production build runs Node22 and source contract code is bundled without frontend.
- [ ] No Azure creation, credentials committed/logged, unrelated DB modifications, or frontend behavior changes.

## Validation
From root:
- `npm --prefix api ci`
- `npm --prefix api test`
- `npm --prefix api run test:integration` — isolated actual Azurite tests, no skips.
- `npm --prefix api run build`
- `npm run test -- --run shared/companyRecords.test.ts --maxWorkers=2`
- `npm run lint`; `npm run build`; `git diff --check`.
The known stale App tests are corrected in T03; full root regression is required in T04, not silently excluded there.

## Commit Message
```text
feat(api): persist authenticated company records with conditional table writes

Plan: 2026-10-30-azure-company-game-deployment
Phase: P01-company-records
Task: T02-functions-table-api

- Add authenticated profile leaderboard and result endpoints
- Verify idempotent concurrent writes against isolated Azurite
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending

## Next
P01-T03-hosted-company-auth. memory-execute commits only scoped code/memory and advances pointer once.
