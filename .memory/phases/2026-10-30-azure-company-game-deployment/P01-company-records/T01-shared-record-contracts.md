# Task: T01 Shared Record Contracts

## Status: done

## Goal
프런트와 API가 같은 순위·해금·결과 검증을 사용하도록 순수 TypeScript 계약을 만든다. 서버나 UI를 아직 연결하지 않으므로 이 Task만으로 독립 검증 가능하다.

## Decision Summary
- 회사 공유 상위 10위, 계정당 최고 성적 하나. 실제 최고 클리어 단계는 최고 성적의 시도 단계와 별개다.
- 새 서비스는 빈 기록/0단계 클리어에서 시작한다. 기존 로컬 기록/엔진을 변경하지 않는다.
- Plan: 2026-10-30-azure-company-game-deployment. 후속 T02가 이 계약으로 API를 만들고 T04가 UI에 연결한다.

## Implementation

### I01. Shared contracts and pure rules
- Related Files:
  - `shared/companyRecords.ts` :: DTO/type guards/validation/merge/comparison; new.
  - `src/game/stageRules.ts` :: `getStageRule/getHighestUnlockedStage/isGameStage/isClearedStage`; read-only.
  - `src/game/types.ts` :: `GameStage/ClearedStage/StageResult`; read-only. `src/game/stageResult.ts` captures/validates results but does not export the StageResult type.
  - `src/leaderboard/leaderboard.ts` :: 기존 순위 기준 참고; read-only.
  - `tsconfig.json` :: include에 shared 추가; modify.

#### Details
- **Signatures & Types**:
```typescript
type ResultInput = Pick<StageResult, "stage" | "score" | "remainingTimeCs" | "outcome">;
interface SharedBest {
  accountId: string; displayName: string; bestStage: GameStage;
  bestScore: number; remainingTimeCs: number; achievedAt: string;
}
interface SharedProfile {
  accountId: string; displayName: string;
  highestClearedStage: ClearedStage; best: SharedBest | null;
}
interface AuthenticatedActor { accountId: string; displayName: string; }
interface SubmitResultRequest { submissionId: string; result: ResultInput; }
interface SubmitResultResponse {
  submissionId: string; profile: SharedProfile; entries: SharedBest[];
}
interface LeaderboardResponse { entries: SharedBest[]; }
type ApiErrorCode = "unauthenticated" | "invalid-request" | "stage-locked"
  | "conflict" | "storage-unavailable";
interface ApiError { error: { code: ApiErrorCode; message: string }; }
type ResultValidation = { ok: true } | {
  ok: false; code: "invalid-request" | "stage-locked"; message: string;
};
function isSubmitResultRequest(value: unknown): value is SubmitResultRequest;
function validateResultForProfile(result: ResultInput, highest: ClearedStage): ResultValidation;
function compareSharedPerformance(a: SharedBest, b: SharedBest): number;
function getSharedTopScores(entries: readonly SharedBest[], limit?: number): SharedBest[];
function mergeSharedResult(previous: SharedProfile | null, actor: AuthenticatedActor,
  input: ResultInput, serverNowIso: string): { profile: SharedProfile; changed: boolean };
```
- Export DTOs/functions; type-only imports for existing game types. stageRules pure functions may be imported at runtime. Browser/React/storage/Node imports are forbidden here.
- `isSubmitResultRequest` rejects arrays/null/extra own keys, including accountId/displayName/tenant/highestClearedStage/endedAtMs. Only request keys submissionId/result and four result keys accepted. submissionId is UUID (crypto.randomUUID compatible); outcome only cleared/caught/time-limit; stage 1..5; numbers safe integers.
- **Data & Schema Fields**: no undefined score/time, no independent nullable best fields. achievedAt server UTC ISO, not client time. Actor nonempty identity is verified by API, not deserialized from request.
- **Execution Flow / Logic**:
  1. Per stage: time 0..durationMs/10, score 0..target+3. Current rules: durations 90000/75000/65000/60000/50000ms, goals150/200/250/300/350. Max one action scores4 (bonus jump); clear may overshoot by3.
  2. cleared requires score>=target; caught/time-limit score<target; time-limit requires remainingTimeCs=0. caught may have0. A valid stage must be <=min(5,highest+1), else stage-locked.
  3. Compare bestStage DESC, bestScore DESC, remainingTimeCs DESC. Then achievedAt ASC; exact same timestamp uses accountId lexical deterministic tie. Return negative when a ranks ahead.
  4. Merge requires caller to validate first; reject actor/previous identity mismatch and invalid serverNowIso with programmer error. Missing previous => actor identity, highest0, bestnull. On cleared set highest=max(previous, input.stage); failure never advances it.
  5. Compare only performance triple to decide personal improvement. Equal/worse preserves original best/time; new better performance stores the whole new triple/time. Do not compare new server timestamp to overwrite an equal best. Verified current displayName may update profile/best name separately.
  6. Return changed false on a wholly identical retry. No persistent submission receipt is required: monotonic merge is idempotent even after ACK loss.
  7. top scores returns a new array, default10; do not mutate source. Input is already one row/account; defensively deduplicate by account retaining best. Validate positive limit.
- Rule constants stay owned by stageRules. Do not create another divergent stage timing table or refactor engine.

### I02. Boundary and regression tests
- Related Files: `shared/companyRecords.test.ts` :: contracts/merge; new.
- Scenarios: all5 stage limits, unlocked stage rejection, exact target/target+3/target+4, negative/fractional/NaN/Infinity/unsafe integers, wrong outcomes, spoofed identity/unknown keys, malformed UUID.
- Merge scenarios: fresh clear/failure, replay same submission data with later server time unchanged, better lower-time/worse higher-time according to full tuple, higher stage lower score, no independent score/time maxima, name change with timestamp retention, higher clear retained after worse result, immutable inputs.
- Ranking: top10, exact-time deterministic order, source unmodified, one entry/account. A caught stage2 best must not falsely clear stage2.

## Acceptance Criteria
- [x] Shared types expose no client-owned identity or achievement time in submitted payload.
- [x] Valid retries preserve strongest best tuple and highest actual clear.
- [x] Tests and TypeScript/lint/build pass without changing existing game behavior or credentials.

## Validation
Run from repo root:
- `npm run test -- --run shared/companyRecords.test.ts --maxWorkers=2` — all cases pass, no skips.
- `npm run lint` — no new errors.
- `npm run build` — shared source typechecked and existing frontend builds. Existing bundle warning is not a new failure.
- `git diff --check`.
No Azure/GitHub mutation, frontend integration, or resource creation in T01.

## Commit Message
```text
feat(records): define shared company record contracts and merge rules

Plan: 2026-10-30-azure-company-game-deployment
Phase: P01-company-records
Task: T01-shared-record-contracts

- Define validated stage result and server profile DTOs
- Preserve best performance tuples and monotonic cleared stages
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `e880da2`

## Execution Evidence (2026-10-30)
- Added shared/companyRecords.ts: exported DTOs, strict own-key request guard, stage/unlock validation using existing stageRules, deterministic top-ten ordering, and immutable monotonic personal-best/clear merging.
- Added shared/companyRecords.test.ts: 137/137 tests passed, 0 skipped, explicitly in Node environment without DOM/storage APIs. Includes malformed/forged requests, all five boundaries, whole-tuple preservation, timestamp ties, duplicate retries, immutable inputs and reread/merge order scenarios.
- npm run lint passed; npm run build passed (TypeScript and Vite). Existing JS583.75kB/CSS75.93kB output and bundle-size warning remain; no frontend runtime import/UI or game-rule changes.
- git diff --check passed. Actual Azure concurrency/session checks belong to subsequent tasks; this task's merge tests do not claim cloud/API validation.
- Corrected blueprint reference paths to actual src/leaderboard/leaderboard.ts and StageResult exported from src/game/types.ts. No changes to those existing source files, authentication, records storage or credentials.
- mergeSharedResult expects prior validation against the latest profile; malformed requests are rejected by isSubmitResultRequest + validateResultForProfile. Actual actor verification and conditional writes are the API task's responsibility.

## Next
Update this task/phase/current via memory-execute; next is P01-T02-functions-table-api. Stage only this Task's implementation and relevant memory files, not unrelated untracked files.
