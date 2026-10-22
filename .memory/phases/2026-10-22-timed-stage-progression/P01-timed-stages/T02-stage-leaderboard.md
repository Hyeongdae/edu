# Task: T02 Stage Leaderboard

## Status: pending

## Goal
도달 단계→점수로 개인 최고와 TOP10을 비교하고 실제 단계 기록을 랭킹에 표시한다. 승인된 기존 점수 키만 초기화하고 새 v2 기록과 다른 브라우저 설정은 보존한다.

## Decision Summary
- 도달 단계가 높은 기록을 우선하고 같은 단계면 높은 점수, 완전 동점이면 먼저 저장한 기록을 표시한다. 개인 최고는 한 판의 단계/점수 쌍으로 갱신한다.
- 기존 v1 점수는 삭제를 승인받았다. 단계 판정/가져오기는 하지 않으며 오디오·인증·다른 localStorage 데이터는 초기화하지 않는다.

## Implementation

### I01. 새 기록 스키마, 비교와 랭킹 키 정리
- Related Files:
  - `src/leaderboard/leaderboard.ts` :: `LeaderboardEntry`, `isLeaderboardEntry`, `readFromStorage`, `readLeaderboard`, `getTopScores`, `saveBestScore`, private comparison/legacy-cleanup helpers; modify
  - `src/game/types.ts` :: T01 `GameStage`; read-only
  - `src/leaderboard/leaderboard.test.ts` :: schema/comparison/migration/errors; modify

#### Details
- **Previous Task Contract**: `GameStage=1|2`; GameState.stage records the reached stage and persists through game-over. Stage 1 timeouts have stage1; promotion sets stage2 once. score remains cumulative.
- **Signatures & Types**:
  ```typescript
  interface LeaderboardEntry {
    accountId: string;
    displayName: string;
    bestStage: GameStage;
    bestScore: number;
    achievedAt: string;
  }
  interface SaveBestScoreResult {
    entries: LeaderboardEntry[];
    saved: boolean;
    error?: "storage-unavailable";
  }
  function readLeaderboard(storage?: Storage): LeaderboardEntry[];
  function getTopScores(entries: LeaderboardEntry[], limit?: number): LeaderboardEntry[];
  function saveBestScore(entry: Omit<LeaderboardEntry, "achievedAt">, storage?: Storage, now?: Date): SaveBestScoreResult;
  ```
- **Data & Schema Fields**:
  - Storage key=`stair-climb:leaderboard:v2`; legacy key=`stair-climb:leaderboard:v1`. Persist a JSON array, not a new wrapper object.
  - bestStage is required and exactly numeric 1 or 2. Keep current accountId nonempty string, displayName string, bestScore non-negative integer and achievedAt valid date string validation. Runtime save rejects invalid stage/score/accountId with RangeError before touching storage.
  - Do not enforce bestStage from score or infer missing stages. Real gameplay enforces promotion; storage validation must not reclassify records. Keep browserStorage's guarded localStorage access and optional injected Storage used by tests.
- **Execution Flow / Logic**:
  1. Before reading v2 records for a public read/save, check getItem(legacyKey). If present, removeItem(legacyKey). If absent, no write/delete is needed. This is idempotent under StrictMode and does not clear existing v2 entries. No additional marker key is required.
  2. Legacy cleanup and v2 getItem happen outside the malformed-JSON catch. Cleanup/read failures are actual storage failures; do not treat them as a valid empty migrated store.
  3. Parse/validate v2 as now. Malformed v2 JSON or missing/invalid bestStage yields an empty list and best-effort removal of only v2. If malformed-v2 removal fails but setItem later works, saving a valid replacement may still succeed, as the current implementation permits. Keep existing account deduplication behavior.
  4. Private performance comparison uses stage first then score. `getTopScores` sorts copies by `b.bestStage-a.bestStage || b.bestScore-a.bestScore || Date.parse(a.achievedAt)-Date.parse(b.achievedAt)` and applies the existing default10/nonnegative floored limit.
  5. `saveBestScore` reads through the same cleanup/schema path. If the incoming stage is lower, or same stage and score is lower/equal, keep the entire old entry including displayName/achievedAt. A higher stage replaces the entire old record even with a lower score; same-stage higher score also replaces it. Do not combine old score with new stage.
  6. Create achievedAt from the supplied now (default new Date as existing) only for a genuine improvement/new account, then write only v2. Repeated equal personal records preserve the earlier timestamp and need no setItem.
- **Error & Exception Handling**:
  - `readLeaderboard` returns [] when storage access/legacy cleanup/read fails; this preserves existing nonblocking rendering. Never include legacy data in the fallback.
  - `saveBestScore` retries cleanup/read and returns saved=false/error=storage-unavailable on failure, keeping available entries for failed writes. Existing GameScreen final-result error remains the user notification; do not block play on storage failure.
  - No localStorage.clear(), audio preference reset, authentication cleanup or network leaderboard.
- **State Transition & Return**: only the legacy ranking key may be removed as initialization; already-valid v2 records remain across reload/restart. The planning stage has not deleted real data; cleanup becomes active when this Task is implemented and the updated app reads/saves.

### I02. 실전 저장 호출과 단계 표시
- Related Files:
  - `src/game/GameScreen.tsx` :: final-score save effect; modify
  - `src/leaderboard/LeaderboardPanel.tsx` :: reached-stage/score markup; modify
  - `src/game/pixel-theme.css` :: ranking record layout; modify
  - `src/leaderboard/LeaderboardPanel.test.tsx` :: typed fixtures/display/order; modify
  - `src/game/GameScreen.test.tsx` :: new key/stage payload regressions; modify

#### Details
- **Signatures & Types**: GameScreen and LeaderboardPanel public props stay unchanged. `LeaderboardPanelProps.entries` now naturally uses the updated required-bestStage interface; currentAccountId remains the same string.
- **Data & Schema Fields**:
  - GameScreen saves `{accountId: account.homeAccountId, displayName: account.name || "이름 없음", bestStage: gameState.stage, bestScore: gameState.score}` after game-over.
  - Add gameState.stage to that effect's dependencies. Retain scoreSavedRef, single save per round, BGM stop and failure handling; no save on merely reaching stage2.
  - Right-hand ranking markup: a new `.leaderboard-record` wrapper containing `.leaderboard-stage` span (`N단계`) and existing `.leaderboard-score` strong (`N점`). Keep name/rank/current-player classes, TOP10, empty message, heading/region names and the `나` marker.
- **Execution Flow / Logic**:
  1. In the ranking row, stage and score are one visible record. Use column layout with stage above score so long scores do not truncate the stage into invisibility. An entry reads as `2단계 · 850점` semantically even when stacked in a narrow row.
  2. Put style additions in the existing pixel theme beside ranking rules: `.stair-game.pixel-theme .leaderboard-record` uses min-width0/display grid/gap2px/justify-items:end; stage has muted/gold/cyan palette, nowrap and about0.7rem; score keeps tabular monospace/ellipsis. Keep row name flexible and internal scrolling.
  3. Final timeout/caught states both save the same stage/score record structure. Initialization cleanup uses removeItem, not a v2 setItem of an empty array, so existing 'one final setItem' assertions remain meaningful.
- **Error & Exception Handling**: do not change the existing final result's `기록을 저장하지 못했습니다...` wording or storage-independent restart behavior. No changes to audio/AuthGate/App public APIs.
- **State Transition & Return**: final result still shows points until T03 adds the stage/reason summary. The ranking itself is already stage-aware after T02.

### I03. 기록 초기화와 동점/개인 최고 검증
- Related Files:
  - `src/leaderboard/leaderboard.test.ts`, `src/leaderboard/LeaderboardPanel.test.tsx`, `src/game/GameScreen.test.tsx` :: tests; modify
  - `src/game/gameEngine.test.ts`, `src/audio/audioPreferences.test.ts` :: regression; read-only

#### Details
- Update the storage test's key to v2 and every entry/save fixture to provide bestStage (default1 in the test helper is fine). Panel fixtures may need `1 as const` or explicit LeaderboardEntry typing to avoid number widening. GameScreen's existing v1 saved-key assertion must use v2 and assert bestStage.
- Mixed-stage ranking: stage2/score350 outranks stage1/score999; same stage score descending, exact stage/score ties date ascending; TOP10 and input nonmutation remain.
- Personal best: higher stage/lower score replaces the whole record; lower stage/higher score cannot replace it; same-stage higher score replaces; equal stage/score preserves both timestamp and displayName and performs no write.
- Reject stage0/3/string/undefined, invalid points, empty account ID; v2 missing stage is invalid and never inferred from score.
- Preload only v1→read returns empty/no imported entry, v1 removed; preload v1+valid v2→remove only v1 and return v2 unchanged; subsequent reads/restarts keep v2. Spy that audio/auth/unrelated keys remain and clear() is never called.
- v1 remove failure→read[] and save saved=false without a v2 write. Read/getItem access and setItem quota errors remain nonthrowing. Malformed v2 cleanup failure can still be overwritten if setItem succeeds.
- Important existing fixture trap: the old malformed test mocks getItem to return bad JSON for every key. Replace it with key-aware behavior returning null for v1 and malformed content only for v2. Test legacy cleanup failure separately rather than weakening the new cleanup contract.
- Panel verifies stage label and score in the same listitem, stage-priority ordering and current user/empty state. Avoid pixel-count/color snapshots.
- UI integration uses the existing test-only engine-factory spy method for a fast promotion fixture if needed: save stage1 on timeout, stage2 after promotion+eventual fatal catches; StrictMode saves once, restart retains stored records, storage failure still permits restart.

## Acceptance Criteria
- [ ] 개인 최고 갱신과 TOP10이 같은 단계→점수 비교를 사용한다.
- [ ] 랭킹에 실제 도달 단계와 같은 판의 점수가 함께 표시된다.
- [ ] v1만 초기화하고 v2/오디오/인증/다른 키를 보존한다.
- [ ] 구형 삭제·읽기·저장 실패가 게임을 막지 않으며 최종 결과에서 저장 실패를 알린다.
- [ ] 기존 저장/재시작·동점·빈 랭킹·현재 사용자 표시가 유지된다.

## Validation
- `npm test -- --run src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/game/GameScreen.test.tsx src/game/gameEngine.test.ts src/audio/audioPreferences.test.ts` — all schema/migration/UI regressions pass.
- `npm run lint` — pass.
- `npm run build` — pass. Update all required-field callers in this same Task; do not temporarily make bestStage optional.
- Browser art/layout sign-off is T03. Do not run migration fixtures against a general user browser profile or delete data during planning.

## Commit Message
```text
feat(leaderboard): rank reached stages and reset legacy scores

Plan: 2026-10-22-timed-stage-progression
Phase: P01-timed-stages
Task: T02-stage-leaderboard

- Compare and store stage and score as one personal record
- Replace only the legacy ranking key with version two
```

## Progress
- [ ] 구현 완료
- [ ] 검증 통과
- commit: pending
