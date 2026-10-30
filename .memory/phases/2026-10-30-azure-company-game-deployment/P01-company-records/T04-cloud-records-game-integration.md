# Task: T04 Cloud Records Game Integration

## Status: done

## Goal
서버 profile을 로드한 뒤 게임을 만들고, 결과 확정 즉시 계정별 대기열을 통해 공유 랭킹/실제 클리어를 저장한다. 저장 실패에도 게임·체크포인트·연출은 진행한다.

## Decision Summary
- Precondition: P01-T01~T03 complete; shared DTOs, /api routes and GameAccount/HostedAuthGate exist.
- Production only uses company records; local MSAL/demo keeps current local keys and sync behavior.
- Ranking stage/score/time is one tuple; actual clear is independent; no old local data import. Retry/parallel devices cannot decrease a record.

## Implementation

### I01. Typed HTTP client and account-scoped queue
- Related Files:
  - `src/company/types.ts` :: CompanyRecordBinding/store snapshot; new.
  - `src/company/recordApi.ts` :: fetchProfile/fetchLeaderboard/postResult; new.
  - `src/company/CompanyRecordStore.ts` :: external store and durable FIFO; new.
  - `src/company/CompanyRecordsGate.tsx` :: initial bootstrap/useSyncExternalStore; new.
  - `shared/companyRecords.ts` :: existing exact DTOs; read-only unless necessary validator extension.
- **Signatures & Types**:
```typescript
type SyncStatus = "idle" | "saving" | "error" | "auth-required";
interface CompanyRecordBinding {
  profile: SharedProfile; entries: SharedBest[];
  syncStatus: SyncStatus; pendingCount: number; errorMessage: string | null;
  submitResult(result: StageResult): void; retry(): void; refresh(): void;
}
interface PendingResult {
  submissionId: string; createdAt: string; result: ResultInput;
}
interface CompanyRecordStore {
  start(): void; stop(): void; subscribe(listener: () => void): () => void;
  getSnapshot(): Readonly<CompanyStoreSnapshot>;
  submitResult(result: StageResult): void; retry(): void; refresh(): void;
}
type CompanyStoreSnapshot =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; binding: CompanyRecordBinding };
```
- SharedProfile {accountId,displayName,highestClearedStage0..5,best:null|{accountId,displayName,bestStage,bestScore,remainingTimeCs,achievedAt}}.
- Endpoints: GET /api/profile → profile; GET /api/leaderboard → {entries}; POST /api/results with {submissionId,result:{stage,score,remainingTimeCs,outcome}} → {submissionId,profile,entries}. No identity/name/endedAtMs/clear from client.
- Fetch uses credentials include, cache no-store, redirect manual, AbortSignal+15sec timeout. POST application/json and `X-Game-Request: 1`. 401/403/login redirect/opaqueredirect => auth-required, never parse login HTML as official empty data. Validate response shape and current accountId; profile actor mismatch is fatal/retry, not accepted.
- Store constructor is side-effect free, callbacks stable; start loads profile + leaderboard before ready, stop aborts work and cleans listeners/timers. useSyncExternalStore snapshot is cached until change; no infinite rerender.
- Initial server load failure => gate error/retry or login action, GameScreen stays unmounted. Existing stage unlocks arrive before ready initialization. No browser record fallback.
- Queue key `stair-descent:company:production:pending:v1:<encodeURIComponent(accountId)>`, origin-local naturally plus explicit environment/account scope. Versioned JSON {version:1,accountId,pending:PendingResult[]}; validate every item, do not read any legacy browser score/progress key. Invalid queue warns and is quarantined/ignored without global clearing.
- Freeze a new ResultInput copy; maintain WeakMap<StageResult,submissionId> for this store so duplicate effects for same immutable result do not enqueue twice. UUID via crypto.randomUUID, createdAt only for queue diagnostics, not API achievement.
- Persist pending BEFORE POST. FIFO clear must finish before subsequent unlocked-stage result. Reload replays same ID/payload; server max merge makes ACK-loss retry safe. Remove only matching acknowledged ID when response profile matches current actor.
- LocalStorage denied/quota errors: preserve queue in memory, surface refresh-loss warning, still submit without blocking UI. Never delete another account's queue.
- Retry transient network/503/conflict with 1/2/5/10/30sec capped delays, online/manual retry; invalid-request/stage-locked stops automatic loop with actionable notice. Auth-required pauses queue, offers same-origin login; no anonymous write.
- stop/account switch cancels all owned timer/listener/fetch; lifecycle generation guards late results, including StrictMode stop/start on same instance. If remote write completed after abort, next retry remains idempotent.
- Refresh cannot overwrite newer profile with stale lower progress. Serialize refresh behind submissions or sequence/monotonic merge; preserve complete best tuple, not independent field maxima. No crossaccount snapshot reuse.

### I02. Bootstrap and dual persistence integration
- Related Files:
  - `src/App.tsx` :: hosted branch / GameAppShell CompanyRecordBinding; modify.
  - `src/game/GameScreen.tsx` :: props, record initialization, readKnownHighest, clear/result effects, record display; modify.
  - `src/game/CheckpointPanel.tsx` :: optional recordsNotice; modify.
  - `src/leaderboard/LeaderboardPanel.tsx` :: optional scope/company label; modify.
  - `src/leaderboard/leaderboard.ts`, `src/game/stageProgress.ts`, `src/game/gameEngine.ts`, `src/game/stageResult.ts` :: existing behavior read-only.
- GameScreen optional prop `companyRecords?:CompanyRecordBinding`. Local caller unchanged. Hosted App sequence: HostedAuthGate(account) → CompanyRecordsGate(account) → GameAppShell → GameScreen(binding). Key account-bound subtree by current ID.
- **Execution Flow / Logic**:
  1. companyRecords provided: initialize highest from profile.highestClearedStage, initial selected stage=min(5,highest+1), leaderboard from binding. Skip all local progress/score readers, migrations and writers in this branch.
  2. Current readKnownHighest must use max(server highest,in-memory clearedStageThisRun) in company mode; local branch keeps storage logic. A fresh crossdevice profile update may open new stages while ready without resetting intentionally selected lower stage or active play.
  3. Current cleared-stage effect calls local saveStageProgress only in local mode. Company mode updates in-memory progress immediately for CP continue, but cloud highest advances only via frozen cleared result; do not add independent unvalidated progress API.
  4. Current stage-result effect calls stable binding.submitResult exactly once when immutable StageResult appears, before final office/exit scenes finish. Do not wait for result screen visibility. Local branch retains saveBestScore and errors.
  5. Overtime catch .5sec/office2sec, final exit4sec, reduced motion, stage clock, keyboard/pointer, audio controller and focus rules stay unchanged. Binding updates must not reset their effects or game state; avoid whole-binding object in animation timer dependencies.
  6. CP/result show company saving/pending/error/retry status via optional `recordsNotice?:ReactNode`; quitting/continue/retry game stays operable while network fails. Retry button participates in CP focus trap and doesn't submit game input.
  7. Leaderboard scope prop `scope?:"browser"|"company"` defaults browser. Company renders clear shared label and current actor highlight; no "THIS BROWSER" label or "브라우저 저장" error for server mode. Maintain same table shape/top10.
- No gameplay rule, obstacle rate, pursuit interval, stage target/time, visual assets or title wording changes.

### I03. Queue/React/full regression
- Related Files:
  - `src/company/recordApi.test.ts`, `src/company/CompanyRecordStore.test.ts`, `src/company/CompanyRecordsGate.test.tsx`; new.
  - `src/game/GameScreen.test.tsx`, `src/App.test.tsx`, panel tests; modify.
- Cover ACK lost after successful commit and retry sameID, FIFO clear-before-nextstage, reload scopedqueue, blockedstorage, serveroutage/backoff, auth expiry, parsefailure, accountA→B no queuedrecords/lateACK leak, StrictMode lifecycle no duplicate submission, stale profile vs later ACK, callbacks/snapshot stability.
- Gate tests: existing server highest2 initializes stage3; failed read never starts empty official game; no records data from local test keys; retry and unmount cleanup.
- Game tests: snapshot submitted before caught/exit finishes, no resubmit on status rerender, async storage does not pause activeclock, no legacy local record read/write in cloud, failure doesn't trap CP/quit, next stage in-memory unlock while FIFO pending, real-clear vs failed-stage ranking distinction.
- Keep all local tests passing and run entire root suite after T03 selector correction. New meaningful race tests use controlled promises/fake timers; do not weaken assertions/timeouts/skips.

## Acceptance Criteria
- [x] Other-device saved unlocks exist at initial stage selection (server-response bootstrap integration; live multi-device confirmation is P02).
- [x] Cloud and local data paths remain separate; no legacy upload or local-data deletion.
- [x] Captured/cleared results enqueue before scenes end and survive safe retries/account switches.
- [x] Entire frontend suite and actual emulator API integration pass without changing game rules.

## Validation
- `npm run test -- --run --maxWorkers=2` — full root suite, API excluded by separate config, no skips added.
- `npm --prefix api test`; `npm --prefix api run test:integration`; `npm --prefix api run build`.
- `npm run lint`; `npm run build`; `git diff --check`.
- Hosted build with temporary process VITE_AUTH_MODE=azure-static-web-apps and env restoration. Real hosted auth requires P02; mocked principal tests are not live company login evidence.

## Commit Message
```text
feat(game): sync company rankings and stage unlocks through account queues

Plan: 2026-10-30-azure-company-game-deployment
Phase: P01-company-records
Task: T04-cloud-records-game-integration

- Bootstrap server progress before creating the game
- Queue immutable results without blocking play or office scenes
- Keep local demo records isolated from production
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `42466f6`

## Execution Evidence (2026-10-30)
- Added src/company/types.ts, recordApi.ts, CompanyRecordStore.ts and CompanyRecordsGate.tsx. Hosted App now gates GameAppShell/audio/GameScreen on both the current server profile and shared top10; failed initial reads remain retry/login states, not empty official profiles. Local MSAL/demo behavior and records remain browser-local.
- HTTP client uses cookies/no-store/manual redirects/same-origin,15s cancellation, validated actor/profile/ranking/ACK DTOs and fixed public errors. HTML/invalid JSON on gateway503 remains retryable; login redirects/401/403 require authentication. POST includes only UUID + four result fields, never actor/clear/endedAtMs.
- Necessary account-switch integration fix: api/src/handlers.ts checks optional X-Game-Account against the platform-authenticated actor before all repository access; the client always sends this precondition on personal reads/writes. It cannot select/impersonate an actor. If cookies switch A->B before A's queued request reaches the server, it returns401 rather than applying A's result to B. Added API regression; API unit95/95.
- Store construction has no I/O. start/stop own storage reads, listeners, fetch cancellation and retries. Immutable result copies, per-reference WeakMap dedup, account/environment-scoped durable FIFO, matching-ACK removal, serial refresh and monotonic confirmed profile merge cover lost ACKs, stale data and StrictMode stop/start. Storage denial retains in-memory results and displays refresh-loss warnings; malformed queues are ignored with warning, never uploaded or globally cleared.
- Added CompanyRecordsNotice and tests, plus src/test/companyFixtures.ts. Checkpoint/result display pending/retry/login status; normal Tab focus includes nested retry buttons/login links, while gameplay keys do not escape the notice. Continue/quit remain available despite failed saves. Shared leaderboard uses company label and shared deterministic ordering.
- GameScreen cloud branch avoids all local score/progress reads/migrations/writes, initializes selection from confirmed highest clear, and submits StageResult before caught/final scenes finish. Callback/status changes do not reset clocks or the500ms catch/2s office/4s exit durations; remote unlock refresh opens new stages without changing a deliberately selected lower one.
- Full-root gate initially found19 failures:18 existing stale pursuit-time test expectations and one new test fixture requesting unavailable step-8. The new fixture now uses actual retained stairs and normal player movement; no route/runtime code changed.
- Existing-failure baseline proof:12 original test/runtime files were hash-matched to HEAD, then the six unchanged suites ran alone:276 total/258 passed/18 failed. Evidence: %TEMP%/dex-existing-tests-44c53fe6a4624447bb05c35f4d895162.json. A separate archive/junction/cleanup baseline command was rejected by automatic approval review before execution; the non-destructive existing-file check completed instead.
- Required full-suite maintenance (test-only): src/game/gameEngine.test.ts, stageResult.test.ts, stairSceneModel.test.ts; src/descent/DescentGameScreen.test.tsx, descentSceneModel.test.ts, descentViewState.test.ts. Updated old600ms/500ms stage intervals to current500ms/400ms rules, tied expiry/contact fixtures, remaining-time calculations and recovery scheduling. Assertions/branches retained, no skips or weakened timeouts; those same276 tests subsequently passed. Production engine/stage/pursuit/scene/experimental descent logic is unchanged.
- Final root run:1269/1269 tests across42 files,0 failed/0 pending, using --run --maxWorkers=2. Evidence: %TEMP%/dex-company-full-root-2026-10-30.json. Relevant UI/company subset195/195 also passed before the final extra serialized-refresh test.
- API unit95/95, isolated real Azurite integration10/10, API TypeScript/esbuild build17.9kB, lint, normal and hosted builds and diff checks passed. Normal frontend JS600.18kB/CSS76.01kB; hosted JS600.13kB/CSS76.01kB. Hosted build used process-only auth mode, blank local SPA IDs and demo flag=true; env restored in finally, .env.local unchanged. Existing bundle warning remains deferred.
- No new packages/lockfile changes, Azure resources/credentials/settings, GitHub push or real company sign-in performed. Only isolated emulation/mocked UI was used; actual HTTPS/session/shared-record multi-device verification remains the P02 release gate.

## Next
P02-T01-deployment-config-and-workflow; mark P01 done4/4 only after above gates.
