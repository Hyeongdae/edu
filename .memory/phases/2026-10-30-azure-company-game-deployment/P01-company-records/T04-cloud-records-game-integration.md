# Task: T04 Cloud Records Game Integration

## Status: pending

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
  - `src/game/LeaderboardPanel.tsx` :: optional scope/company label; modify.
  - `src/game/leaderboard.ts`, `src/game/stageProgress.ts`, `src/game/core.ts`, `src/game/stageResult.ts` :: existing behavior read-only.
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
- [ ] Other-device saved unlocks exist at initial stage selection.
- [ ] Cloud and local data paths remain separate; no legacy upload or local-data deletion.
- [ ] Captured/cleared results enqueue before scenes end and survive safe retries/account switches.
- [ ] Entire frontend suite and actual emulator API integration pass without changing game rules.

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
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending

## Next
P02-T01-deployment-config-and-workflow; mark P01 done4/4 only after above gates.
