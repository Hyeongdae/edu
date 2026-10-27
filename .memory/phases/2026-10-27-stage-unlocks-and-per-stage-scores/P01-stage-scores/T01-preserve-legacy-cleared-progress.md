# Task: T01 Preserve Legacy Cleared Progress

## Status: done

## Goal

랭킹 초기화에 앞서 구v4에만 남은 유효 클리어 이력을 모든 계정의 progress:v1에 안전하게 합친다. 실패해도 복구 근거를 보존하고 알려진 진행도를 반환한다. 이 Task는 아직 기존 랭킹v4·400점 게임 규칙과 양립해야 한다.

## Decision Summary

- 최종 기능은 다음 단계 해금/단계별0점150~350/도전 단계v5랭킹이다. 이 Task는 그 전제인 진행도 보존만 구현한다. v5 활성화·해금/점수/랭킹 의미 변경·v4 삭제는 T02다.
- 실제 클리어만 해금 근거다. 구v4의 bestStage는0~5 클리어 값으로 복구 가능하지만 v1/v2/v3이나 향후v5에서는 클리어를 추론하지 않는다. 일반 사용자 저장소를 도구로 변경하지 않는다.

## Implementation

### I01. Shared all-account legacy progress migration

- Related Files:
  - `src/game/stageProgress.ts` :: `readEntries`, `storageTarget`, `readStageProgress`, `saveStageProgress`, new `migrateLegacyStageProgress` — modify
  - `src/game/types.ts` :: `ClearedStage` — read-only, `0 | 1 | 2 | 3 | 4 | 5`
  - `src/game/stageRules.ts` :: `isClearedStage` — read-only
  - `src/leaderboard/leaderboard.ts` :: existing v4 schema — read-only; keep old ranking behavior in this Task

#### Details

- **Signatures & Types** (기존 반환 형태 유지):

  ```typescript
  export interface StageProgressEntry { accountId: string; highestClearedStage: ClearedStage; }
  export interface ReadStageProgressResult { highestClearedStage: ClearedStage; available: boolean; }
  export interface SaveStageProgressResult {
    highestClearedStage: ClearedStage; saved: boolean; error?: "storage-unavailable";
  }
  export interface StageProgressMigrationResult { entries: StageProgressEntry[]; available: boolean; }
  export function migrateLegacyStageProgress(storage?: Storage): StageProgressMigrationResult;
  export function readStageProgress(accountId: string, storage?: Storage): ReadStageProgressResult;
  export function saveStageProgress(accountId: string, clearedStage: ClearedStage, storage?: Storage): SaveStageProgressResult;
  ```

- **Data & Schema Fields**:
  - Destination `stair-climb:stage-progress:v1`: JSON array of `{accountId:string(nonempty),highestClearedStage:ClearedStage}`. Existing valid rows retained; duplicate account IDs merged by maximum. Use Map, including safe handling of `__proto__` as an ordinary account ID.
  - Legacy source `stair-climb:leaderboard:v4`: JSON array, each usable row `{accountId:string(nonempty),displayName:string,bestStage:ClearedStage,bestScore:number(integer>=0),achievedAt:string(valid Date.parse)}`. No extra legacy fields required; validate whole row before using bestStage. A valid bestStage0 supplies no positive unlock. Merge valid duplicate legacy rows by maximum; invalid rows ignored.
  - Malformed JSON/non-array is an empty collection, not a thrown storage-access failure. Do not infer stages from scores, names, oldv3, newv5 or other accounts. No new migration marker or storage key.
  - `available=true` means both input reads succeeded and any required merged progress write succeeded. No deletion is performed by this API, including on success. `entries` always contains all valid values that could actually be read, even if `available=false`.

- **Execution Flow / Logic**:
  1. Resolve supplied Storage or `window.localStorage` inside try/catch. Getter failure returns `{entries:[],available:false}`. Validate public account arguments (nonempty string) and clearedStage0..5 before storage access; invalid input still throws RangeError.
  2. Read progress:v1 and rank:v4 independently, retain valid rows from successful reads, and note any access exception. Merge each account's maximum known cleared value. A missing account with only legacy stage0 need not create a row. Never lower valid progress or discard unrelated account rows.
  3. If either getItem threw, return merged known entries/available:false and perform no setItem. This avoids replacing a collection when some account rows could not be read. Do not hide known legacy progress just because the other read failed.
  4. If all reads succeeded and any legacy value raises existing progress, write the full merged array once to progress:v1. Do not rewrite on repeated calls with no higher contribution. If setItem throws, return known merged entries/available:false, retain both source/destination raw values; retry on a later call.
  5. Never call removeItem on v4, v1/v2/v3 ranking, newv5, progress, audio, auth or other keys in this Task. T02 will conditionally clean old rankv4 after this API reports success.
  6. `readStageProgress(account)` calls migration, returns current account's merged highest or0 plus available flag. Reading can persist a required migration; document and test this intended side effect.
  7. `saveStageProgress(account,cleared)` calls migration, computes max(candidate,merged current highest). If unavailable, return that max/saved:false/error without any extra write using partial input. If available and max differs, write full merged entries with current candidate, preserving other accounts. No-op for lower/equal candidates returns saved:true with no extra write. setItem failure returns known highest/saved:false/error. Subsequent restored storage must permit a successful retry.
  8. Preserve existing public result field names so current GameScreen works without implementation edits. Its old v4 fallback remains until T02; T01's higher progress comes from the same actual old cleared-stage source.

### I02. Idempotence and failure regressions

- Related Files:
  - `src/game/stageProgress.test.ts` :: account progress suite — modify
  - `src/game/GameScreen.test.tsx` :: existing v4 preload/progress write assertions — modify only if migration's intended extra progress write affects them
  - Remaining exact17 validation files below — run, do not rewrite unrelated expectations

#### Details

- Add v4-only multiple accounts→one merged progress write, max(existing,legacy), duplicate/special IDs, invalid rows/JSON, no inference fromv1/v2/v3/v5, stage0, and no regression of valid old progress.
- Confirm v4 raw data and all audio/auth/other sentinels stay byte-for-byte unchanged. Existing v5 sentinel stays untouched. No removeItem calls. Repeated read/StrictMode initializations must not rewrite migrated progress.
- Fail each getter, each getItem key separately, and progress setItem. Preserve known values, available:false, no destructive partial write, later retry success. Test unknown other account rows are never overwritten when either source cannot be read. Test save on failed migration keeps max candidate/known value but does not corrupt storage.
- Test migration all accounts even when reading a single current account; later account switching gets its own saved highest.
- Existing UI test fixtures preloading v4 can now legitimately cause one migration write before any clear. Distinguish that write from actual-clear writes using call timing/key/payload; do not delete single-final-save assertions or mock away migration in its tests.
- Keep existing game score400/old recordStage/old unlock assertions unchanged here. They change in T02, not this Task. No new package, browser test prop, test skips, longer timeouts or lint disables.

## Acceptance Criteria

- [x] All usable v4 cleared progress is merged monotonically across all accounts.
- [x] Repeated reads avoid redundant writes and never delete old/new ranking or other data.
- [x] Read/write failures retain known values without partial overwrite; recovery retries succeed.
- [x] Existing v4/400point game and exact17file regression/lint/build still pass.

## Validation

- `npm.cmd test -- --run src/game/stageProgress.test.ts` — migration and old progress suite pass.
- `npm.cmd test -- --run src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts` — all pass; previous baseline433, add cases and record actual count, do not assert a guessed total.
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`
- No browser/user storage mutation required in T01. Record build size and any actual warning separately.

## Commit Message

```text
feat(progress): preserve legacy cleared stages before ranking reset

Plan: 2026-10-27-stage-unlocks-and-per-stage-scores
Phase: P01-stage-scores
Task: T01-preserve-legacy-cleared-progress

- Merge valid version-four cleared history into account progress
- Retain source rankings and known progress across storage failures
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: pending
- After success: mark this Task done, record actual validation and implementation hash, phase done1/3/T02 in_progress, current Active T02 `T02-stage-scores-unlocks-and-ranking.md`. Do not mark the final feature complete; score/unlock/ranking changes are not yet active.

## Validation Results — 2026-10-27

- `src/game/stageProgress.ts`: `migrateLegacyStageProgress`와 반환 타입을 추가했다. 두 원본을 독립적으로 읽고 유효한 모든 계정의 최고 클리어를 Map으로 병합한다. 읽기/이관 쓰기가 모두 가능할 때 필요한 progress:v1 저장만 수행하며 원본 랭킹과 기타 키는 삭제하지 않는다. `readStageProgress`는 알려진 최대값과 available을 반환하고 최초 필요한 이관을 저장할 수 있다. `saveStageProgress`는 불완전한 읽기 상태의 후보 덮어쓰기를 차단한다.
- `stageProgress.test.ts`: 36개 검증을 추가해 전체53개가 됐다. 전 계정/중복·특수ID/0단계/잘못된 행·JSON/기존 더 높은 진행도/비대상 버전·오디오·인증 보존/독립 읽기 실패/이관 및 후보 쓰기 실패/복구 재시도/명시 Storage/입력 선검증을 확인했다.
- `GameScreen.test.tsx`: 기존 StrictMode 재마운트 검증 한 곳을 갱신했다. 기존 기대값은 setItem0회였으나 새 계약의 progress:v1 이관1회를 정확한 키/배열 내용으로 확인한다. 재마운트 뒤에도1회이며 v4랭킹 쓰기는0회, 기존 랭킹/오디오/인증/기존 구버전 정리 검증은 유지한다. GameScreen 구현과 게임 규칙은 변경하지 않았다.

| Command | Result |
| :--- | :--- |
| `npm.cmd test -- --run src/game/stageProgress.test.ts` | PASS,1파일53/53tests,1.91s |
| 위 Validation의 정확한17파일 명령 | 최초468pass/1fail(위 StrictMode 저장 기대값), 수정 후17파일469/469PASS,43.50s |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS, tsc --noEmit + Vite8.3.5; JS551.80kB(gzip154.18kB), CSS55.50kB(gzip10.77kB) |
| `git diff --check` | PASS |

- 로그: `C:\Users\DEX\AppData\Local\Temp\stair-stage-scores-t01-2026-10-27\stage-progress-tests.log`, `regression-17-files.log`, `regression-17-files-final.log`, `lint.log`, `build.log`.
- 이번 빌드에는 chunk 경고 문구가 없었지만 기존500kB 초과 크기 이슈는 남는다. 테스트 환경은jsdom이며 일반 브라우저 저장소를 직접 읽거나 지우지 않았다. 실제 브라우저/소리 청취/전체 App suite/Entra·배포 검증은 하지 않았다.
- 연계 주의(코드 확인): 기존 GameScreen 초기화는 아직 readLeaderboard(v4)를 먼저 호출한다. 기존 랭킹 읽기는 잘못된 행이 섞인 v4 전체를 손상 데이터로 정리할 수 있다. 새 이관 API는 유효한 개별 행을 보존하지만, T02의 v5 연결에서 반드시 v4를 읽어 정리하기 전에 이관을 호출해야 한다. 현재 Task의 read-only 랭킹/UI 구현을 임의 수정하지 않았으며 이 순서는 이미 T02 계획의 선행 계약이다.
- T01 완료는 이관 기반 완성이다. 다음 단계 해금/150~350점/0점 Continue/도전 단계v5랭킹은 T02에서 구현한다. 별도 인접 작업은 추가하지 않았다.
