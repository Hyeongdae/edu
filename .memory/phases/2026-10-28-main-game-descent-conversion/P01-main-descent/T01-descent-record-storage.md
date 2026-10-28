# Task: T01 Descent Record Storage

## Status: done

## Goal

기존 저장 API에 명시적인 내려오기 scope를 준비하여 구 기록을 복원하지 않는 새 랭킹·해금 저장을 fake Storage로 검증한다. main UI에는 아직 연결하지 않아 현재 상승 게임의 실제 기록을 먼저 초기화하지 않는다.

## Decision Summary

- 사용자: main5단계 유지/내려오기 전환/구 랭킹·해금 모두 초기화. 새 기록은 이후 계속 저장하며 인증·오디오 유지.
- 이번 Task는 optional scope 지원과 테스트만 추가한다. API defaultascent와 기존 migration 동작을 보존한다. `GameScreen`/App/scene/실험/실제 브라우저 Storage는 수정하지 않는다.

## Implementation

### I01. Scoped record constants and bounded cleanup

- Related Files:
  - `src/game/recordStorage.ts` :: GameRecordScope/DESCENT_* constants/prepareDescentRecords — new
  - `src/game/recordStorage.test.ts` :: cleanup/idempotency/failure/sentinel cases — new

#### Details

- **Signatures & Types**:

  ```typescript
  export type GameRecordScope = 'ascent' | 'descent';
  export const DESCENT_LEADERBOARD_KEY = 'stair-descent:leaderboard:v1';
  export const DESCENT_PROGRESS_KEY = 'stair-descent:stage-progress:v1';
  export const DESCENT_RESET_KEY = 'stair-descent:records-reset:v1';
  export interface DescentRecordPreparation { complete:boolean; }
  export function prepareDescentRecords(storage:Storage):DescentRecordPreparation;
  ```

- **Data & Schema Fields**:
  - Reset marker exact string`1`. Not JSON/not an account row/not a generation timestamp.
  - Immutable allowlist, in order: `stair-climb:leaderboard:v1`, `v2`, `v3`, `v4`, `v5` (each full prefix), then `stair-climb:stage-progress:v1`. These are the only removeItem targets in preparation.
  - New records reside under the two DESCENT keys. No new data marker is needed before saving an actual record. Missing new keys mean empty ranking/highest0.
  - This module has no dependency on stageProgress/leaderboard/App/auth; no import cycle. The caller supplies Storage. Do not obtain window storage at module import time.

- **Execution Flow / Logic**:
  1. Read reset marker in try/catch. Exact`1`→return{complete:true} with no legacy access/write. If marker read throws, return{complete:false}; never throw from preparation.
  2. For each allowlisted key independently: getItem; if non-null removeItem. Catch each failure, continue the remaining keys, mark incomplete. Do not enumerate length/key() or inspect unrelated data. Empty string is present and should be removed.
  3. Only if every key was read/removed successfully set marker to`1`; if setItem fails return incomplete. On incomplete leave marker unset/unchanged so later preparation may retry only old keys. Do not clear/write new leaderboard/progress, restore legacy data, or use browser clear().
  4. Returncomplete describes cleanup only. Failure to delete an old key does not make valid new records unreadable or prevent a new key write. Callers subsequently perform normal new-key read/write and report those failures through existing result types.
  5. With exact marker`1`, subsequently reintroduced old keys stay ignored; do not restart initialization or purge new records. This is a per-browser/origin transition for all old accounts, not a per-account reset.

### I02. Add scope to stage progress without changing defaults

- Related Files:
  - `src/game/stageProgress.ts` :: readEntries/readStageProgress/saveStageProgress — modify
  - `src/game/stageProgress.test.ts` :: descent scope cases, legacy coverage retained — modify
  - `src/game/stageRules.ts`, `src/game/types.ts` — read-only

#### Details

- **Signatures & Types**:

  ```typescript
  // imports GameRecordScope from './recordStorage'
  export interface StageProgressEntry {accountId:string;highestClearedStage:ClearedStage;}
  export interface ReadStageProgressResult {highestClearedStage:ClearedStage;available:boolean;}
  export interface SaveStageProgressResult {highestClearedStage:ClearedStage;saved:boolean;error?:'storage-unavailable';}
  export interface StageProgressMigrationResult {entries:StageProgressEntry[];available:boolean;}
  export function migrateLegacyStageProgress(storage?:Storage):StageProgressMigrationResult; // unchanged
  export function readStageProgress(accountId:string,storage?:Storage,scope?:GameRecordScope):ReadStageProgressResult;
  export function saveStageProgress(accountId:string,clearedStage:ClearedStage,storage?:Storage,scope?:GameRecordScope):SaveStageProgressResult;
  // private readEntries can accept a key defaulting to old progress:v1.
  ```

- **Data & Schema Fields**:
  - ClearedStage=`0|1|2|3|4|5`, default0. accountId nonempty string. Serialized progress remains an array of StageProgressEntry. Max merge of duplicate account rows, independently valid entries only; invalidJSON/non-array/invalid account or stage rows are ignored as current parseArray/readEntries does.
  - Defaults scopeascent and old key`stair-climb:stage-progress:v1`. Legacy rankv4 migration must retain current independent reads/known-max/all-account write/order/failure semantics when scope omitted or explicitlyascent.
  - descent key is DESCENT_PROGRESS_KEY. Never infer clears from either new or old ranking scores/stages. A new rankstage5 is not a cleared-stage row.

- **Execution Flow / Logic**:
  1. Existing argument validation remains RangeError for empty/non-string account or invalid clearedStage. Resolve optional supplied Storage or window.localStorage inside existing try/catch, not outside.
  2. ascent branch follows current migrateLegacyStageProgress unchanged. New optional scope must not cause cleanup merely because module is imported or a default legacy API is called.
  3. descent read: prepareDescentRecords(target), then read only DESCENT_PROGRESS_KEY via the existing parser/validator. Return matching account max or0,availabletrue. New-key getItem/getter failure returns0/availablefalse. A preparationcompletefalse alone does not set availablefalse when the new key can be read.
  4. descent save: prepare; read new entries; max(existing account, supplied clearedStage); write new array only when max increases (no pointless empty/unchanged write). Keep other valid accounts and never lower an account's clear. Returnhighest/savedtrue. If the new read fails, do not overwrite unknown accounts; returnsupplied highest/savedfalse/error. Write failure returns computedknown highest/savedfalse/error. No partial-read overwrite and no legacy migration fallback.
  5. Preserve existing exported migration API for backward-compatible callers/tests. Do not repurpose or remove it in T01. An optional private keyed parser is allowed; no wholesale module rewrite.

### I03. Add scope to leaderboard without importing old unlocks

- Related Files:
  - `src/leaderboard/leaderboard.ts` :: readFromStorage/readLeaderboard/saveBestScore — modify
  - `src/leaderboard/leaderboard.test.ts` :: descent scope and sorting/save cases — modify
  - `src/game/recordStorage.ts` :: constants/preparation — reuse
  - `src/leaderboard/LeaderboardPanel.tsx`, `src/game/GameScreen.tsx` — read-only

#### Details

- **Signatures & Types**:

  ```typescript
  export interface LeaderboardEntry {accountId:string;displayName:string;bestStage:GameStage;bestScore:number;achievedAt:string;}
  export interface SaveBestScoreResult {entries:LeaderboardEntry[];saved:boolean;error?:'storage-unavailable';}
  export function readLeaderboard(storage?:Storage,scope?:GameRecordScope):LeaderboardEntry[];
  export function saveBestScore(entry:Omit<LeaderboardEntry,'achievedAt'>,storage?:Storage,now?:Date,scope?:GameRecordScope):SaveBestScoreResult;
  export function getTopScores(entries:LeaderboardEntry[],limit?:number):LeaderboardEntry[]; // unchanged
  ```

- **Data & Schema Fields**:
  - GameStage1..5, score nonnegative integer, account nonempty, displayName string, achievedAt parseable date string. Keep current schema/validation/duplicate-account handling and actual-stage+that-stage-score pairing. Do not use `updatedAt`.
  - scope defaultascent uses old rankv5 and existing clearLegacyScores→migrateLegacyStageProgress behavior. descent uses DESCENT_LEADERBOARD_KEY and preparation only; no clearLegacyScores/migration call in that branch.

- **Execution Flow / Logic**:
  1. Resolve browser storage with current getter guard. ReadFromStorage chooses its key/scope; descent prep runs before new read but incomplete prep is nonfatal. New key null→[]. Only a malformed new rank can remove the NEW leaderboard key via existing corruption handling; this is separate from one-time reset and must not run for valid new data.
  2. readLeaderboard returns[] on new getter/read error; saveBestScore uses throwing internal read to avoid treating a failed read as known-empty. On new read error save returnssavedfalse and does not overwrite unseen rows.
  3. Keep comparePerformance stage-desc then score-desc, getTopScores ties earlier achievedAt, defaultlimit10. save replaces an account only for a strictly better pair; ties/worse keep the whole old row, name/time included. now defaultsnewDate. Do not split a bestStage from one attempt and bestScore from another.
  4. Save writes only the chosen rank key; failures returnentries/savedfalse/error. No progress write caused by a descent ranking read/save. A bestStage5 ranking does not unlock2..5. Ascent legacy behavior and current read/save API errors remain unchanged.

### I04. Required tests and boundaries

- Related Files: the three storage test files above — new/modify; existing GameScreen/audioPreferences/authConfig tests — run unchanged.

#### Details

- All six old keys present with multiple accounts/highest5; valid new keys absent→descent ranking[]/progress0, only six old removals,marker1 writeonce; auth/audio/session/unrelated/new marker keys never removed. Marker1 re-entry/Strict double API calls preserve newly saved rank/progress and produce no further reset write. Blank or other marker value triggers cleanup as incomplete transition, never new-record clearing.
- Marker get/set throw; individual legacy get/remove throw and later retry; one cleanup failure must not hide valid new rows, lower new progress or repeat-delete a new record. If cleanupcompletefalse, subsequent new-key saves still work. New-key get failure is different: don't overwrite unknown rank/progress; writefailure returns existing result error and in-memory known clear.
- Getter throw before public API, injected fake Storage independence, invalid JSON/schema/new account duplicates, exact targeted reset keys and no clear()/session access. Spy original migrateLegacyStageProgress if helpful: descent path must not call it; defaultascent still does.
- New account A clear1/rank2score80; B clear3/rank3score150: isolate account maxima, stage-first ranking, tie/worse whole row preservation, 0 clear produces no redundant write; read/rankv5 old cannot resurrect progress. Markerdoes not itself imply any account cleared a stage.
- Keep all current ascent migration tests including v4 write-before-removal, partial-read no overwrite, all-account merge and old-v5 preservation. Do not blind-replace their key strings or weaken assertions. No real browser navigation or actual localStorage data deletion in this Task.

## Acceptance Criteria

- [x] Explicit descent calls start empty, never migrate old data, and preserve new ranking/progress after initialization.
- [x] Six-key cleanup is idempotent/retry-safe and preserves authentication/audio/unrelated/new records under failure.
- [x] Default ascent APIs/current main behavior and existing unit coverage remain intact; main is not wired yet.
- [x] Specified tests/lint/build/diff checks pass, actual counts and storage failure evidence recorded.

## Validation

- `npm.cmd test -- --run src/game/recordStorage.test.ts src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/game/GameScreen.test.tsx src/audio/audioPreferences.test.ts src/auth/authConfig.test.ts --maxWorkers=2`
- `npm.cmd run lint`
- `npm.cmd run build`
- `git diff --check`
- `git diff --name-only bdf18d5 -- src/game/GameScreen.tsx src/game/StairScene.tsx src/descent descent-test.html src/App.tsx src/auth src/audio src/main.tsx index.html vite.config.ts package.json package-lock.json` — no Task changes to these paths.
- Do not run a browser against a real user profile or call real storage helpers from a console. Tests use isolated jsdom/fake Storage only.

## Commit Message

```text
feat(game): prepare fresh scoped records for the main descent conversion

Plan: 2026-10-28-main-game-descent-conversion
Phase: P01-main-descent
Task: T01-descent-record-storage

- Add bounded legacy reset and independent descent record keys
- Preserve new records on retries and keep ascent API defaults
- Verify storage failures account isolation and unchanged main behavior
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: `9b6ba54`
- After success: Task done/commit, phase done1/3/T02 in_progress, current Active T02; do not implement the next Task in this invocation.

## Execution Evidence — 2026-10-28

- 지정된 6파일 테스트 **242/242 통과** (32.11초, `--maxWorkers=2`). timeout/skip/config 변경 없음. lint 오류·경고 없음, build 성공, `git diff --check` 통과.
- 새 `recordStorage`는 marker exact `1`에서 즉시 반환하고 6개 구키만 정리한다. marker 읽기/쓰기 실패, 구키 각각의 get/remove 실패 12조합, 후속 재시도와 새 계정 기록 저장·보존을 fake Storage로 검증했다. `clear`/열거를 금지한 fake와 auth/audio/session/unrelated byte equality를 사용했다.
- stageProgress와 leaderboard의 최종 optional scope 기본값은 ascent다. descent는 새 키만 사용하며 랭킹으로 해금을 유추하지 않는다. 새키 읽기 실패 시 덮어쓰기 방지, 쓰기 실패 반환, 계정별 max/랭킹 pair·동점 보존, 중복·잘못된 schema·특수 계정명·blocked getter와 supplied Storage 독립성을 검증했다. 기존 ascent 테스트는 유지했다.
- baseline `bdf18d5` 대비 명시된 main/scene/실험/App/auth/audio/entry/config/package 읽기 전용 경로의 diff는 비어 있다. 실제 브라우저나 실제 사용자 저장소에는 접근하지 않았다. main은 여전히 상승·기존 저장 scope다.
- 빌드 산출물: JS552.85kB(gzip154.43kB), CSS55.50kB(gzip10.77kB), 기존 500kB 초과 chunk 경고 출력. 번들 설정은 변경하지 않았다.
- 로그: `%TEMP%\main-descent-records-t01-2026-10-28\tests.log`, `lint.log`, `build.log`. T02의 main 하강 전환/저장 연결/오디오 focus 복구와 T03 브라우저 검증은 미수행이다.
- 범위 밖 신규 결함 발견: 특이사항 없음.
