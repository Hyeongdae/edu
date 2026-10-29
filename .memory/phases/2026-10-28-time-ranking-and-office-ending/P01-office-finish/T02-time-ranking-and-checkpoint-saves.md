# Task: T02 Time Ranking and Checkpoint Saves

## Status: done

## Goal

메인 랭킹을 단계 → 점수 → 남은 시간(0.01초)으로 비교하고 매 단계 클리어 즉시 저장한다. 구 랭킹만 초기화하고 해금/새 성적을 보존한다. 체크포인트·결과·랭킹 행에 같은 시간을 표시한다.

## Decision Summary

- D01~D04 확정. T01 결과 계약을 사용하며 성적은 동일 도전의 tuple로 저장한다.
- Depends on T01. T01 StageResult={stage,score,remainingTimeCs,endedAtMs,outcome}, GameState.stageResult:null|StageResult, formatRemainingTimeCs(number):string이 제공된다.
- 기존 공용 ascent API/테스트의 시간 없는 v5는 호환한다. 메인 descent v2는 시간이 필수이며 이전 descent v1은 재사용하지 않는다.

## Implementation

### I01. Bounded ranking reset

- Related Files:
  - `src/game/recordStorage.ts` :: 상수/`prepareDescentLeaderboard` — modify.
  - `src/leaderboard/leaderboard.ts` :: `readFromStorage` — modify.
  - `src/game/stageProgress.ts` :: 해금 저장 — read-only.

#### Signatures & Types

```typescript
export const DESCENT_LEADERBOARD_KEY = "stair-descent:leaderboard:v2";
export const LEGACY_DESCENT_LEADERBOARD_KEY = "stair-descent:leaderboard:v1";
export function prepareDescentLeaderboard(storage: Storage): DescentRecordPreparation;
// Existing DescentRecordPreparation = { complete: boolean }
```

#### Execution Flow / Logic

1. 기존 prepareDescentRecords와 DESCENT_PROGRESS_KEY=stair-descent:stage-progress:v1, DESCENT_RESET_KEY=stair-descent:records-reset:v1은 그대로 사용한다. 기존 marker를 지우거나 재설정하지 않는다.
2. 새 helper는 old descent leaderboard v1의getItem/removeItem만 수행한다. 없으면complete true, get/remove 예외는false로 반환. storage.clear/key/enumeration 사용 금지.
3. descent readFromStorage에서 기존 prepareDescentRecords 후 새 helper를 호출하고 항상 v2를 읽는다. 구키 정리 실패가 유효한 v2를 숨기거나 제거하지 않게 한다. 새 marker는 불필요하다: 정리 대상은항상v1, v2를 삭제하지 않으므로 재시도도 안전하다.
4. v1-only이면 빈 새 랭킹으로 시작, v1+v2이면v2보존. StrictMode/재방문/정리 실패 후 재시도에서 새 기록과 해금 byte를 보호한다. getv2 예외는 기존 read/save의 저장 불가 결과로 처리한다.
5. ascent v5/구 이관은 별도 scope로 유지한다. stage progress가 옛 랭킹에서 해금을 복원하는 경로를 새 descent reset에 연결하지 않는다.

### I02. Ranking schema, comparison and best record

- Related Files:
  - `src/leaderboard/leaderboard.ts` :: `LeaderboardEntry`, `comparePerformance`, `isLeaderboardEntry`, `getTopScores`, `saveBestScore` — modify.
  - `src/game/stageRules.ts` :: `getStageRule` — read-only.
  - `src/game/stageResult.ts` :: formatter — read-only.

#### Signatures & Types

```typescript
export interface LeaderboardEntry {
  accountId: string;
  displayName: string;
  bestStage: GameStage;
  bestScore: number;
  remainingTimeCs?: number; // ascent v5 legacy compatibility only
  achievedAt: string;
}
export interface TimedLeaderboardEntry extends LeaderboardEntry {
  remainingTimeCs: number; // descent v2 JSON rows MUST include this
}
// Private helpers:
function isLeaderboardEntry(value: unknown, scope: GameRecordScope): value is LeaderboardEntry;
function comparePerformance(
  a: Pick<LeaderboardEntry, "bestStage" | "bestScore" | "remainingTimeCs">,
  b: Pick<LeaderboardEntry, "bestStage" | "bestScore" | "remainingTimeCs">,
): number;
// Existing exported signatures remain callable:
export function readLeaderboard(storage?: Storage, scope?: GameRecordScope): LeaderboardEntry[];
export function getTopScores(entries: LeaderboardEntry[], limit?: number): LeaderboardEntry[];
export function saveBestScore(
  entry: Omit<LeaderboardEntry, "achievedAt">,
  storage?: Storage,
  now?: Date,
  scope?: GameRecordScope,
): SaveBestScoreResult;
```

#### Data & Schema Fields

- descent v2 JSON 배열: accountId(빈문자열불가), displayName(string), bestStage1..5, bestScore(integer>=0), remainingTimeCs(safe integer0..단계durationMs/10), achievedAt(parse 가능한ISO시각).
- descent에서 missing/undefined/null/string/fraction/NaN/Infinity/negative/상한초과 시간은 유효하지 않다. 저장 함수는 저장소 접근 전에 RangeError, 읽기는 기존 corrupt-data 처리 규칙을 따른다.
- ascent legacy는 time 생략 허용, 제공된 time에는 같은 숫자 검증을 적용한다. main v2에 time 생략 호환을 적용하지 않는다.

#### Logic

0. 읽기 검사는 parsed.every(row => isLeaderboardEntry(row, scope))로 호출한다. every(isLeaderboardEntry)로 넘겨 배열 index가 scope 인수로 들어가는 일을 피한다.
1. comparePerformance는 b.bestStage-a.bestStage || b.bestScore-a.bestScore || (b.remainingTimeCs??0)-(a.remainingTimeCs??0).
2. getTopScores는 위 순서 후 achievedAt 오름차순. 기존 입력 불변성과 limit behavior 보존.
3. 개인 최고 비교도 동일 함수를 사용한다. stage/score가 같고 시간이1cs라도 높으면 갱신, 낮거나 완전 동점이면기존행/이름/achievedAt 보존하고 setItem0회.
4. 높은단계·높은점수 우선은 시간보다 먼저다. 다른 도전의 score/time를 합치지 않는다. 저장 결과 실패/entries 반환은 기존 API 관례를 따른다.

### I03. Save snapshots and show the same time

- Related Files:
  - `src/game/GameScreen.tsx` :: 랭킹 저장 effect, start reset, checkpoint/result props — modify.
  - `src/game/CheckpointPanel.tsx` :: props/남은시간/저장오류 — modify.
  - `src/leaderboard/LeaderboardPanel.tsx` :: 행 시간 — modify.
  - `src/game/pixel-theme.css` :: leaderboard remaining/checkpoint/result small layout — modify scoped selectors only.
  - `src/descent/DescentGameScreen.tsx` / auth / audio / game.css — read-only.

#### Signatures & Types

```typescript
// Add required snapshot time and optional error to CheckpointPanelProps:
remainingTimeCs: number;
rankingError?: boolean;
// Existing stage, score, onContinue/onQuit, disabled, progressError remain.
// LeaderboardPanelProps remain entries/currentAccountId.
```

#### Execution Flow / Logic

1. GameScreen 저장은 gameState.stageResult를 유일한 성적 원본으로 삼는다. null이면 저장하지 않는다. stage/score/time을 snapshot에서 함께 읽고, 현재 accountId/name과 scope descent로 saveBestScore를 호출한다.
2. terminal 전용 boolean scoreSavedRef와 start의 reset을 제거한다. effect 의존성은 account.homeAccountId/name과 stageResult 참조이며, status/leaderboard 재렌더로 같은 후보를 다시 만들지 않는다.
3. StrictMode 재실행은 saveBestScore의 완전 동점=쓰기0 규칙으로 보호한다. 이는 같은 처리를 반복해도 기록이 바뀌지 않는 성질이다. cleanup에서 취소된 표시 timeout이 별도 guard 때문에 영원히 다시 예약되지 않는 구현을 피한다.
4. 저장은 effect 본문에서 동기적으로 실행한다. setLeaderboard/setSaveError를 늦추는 기존 setTimeout(0)은 cleanup한다. 두 번째 effect도 필요한 표시 갱신을 예약한다. CP→quit는 snapshot 참조가 같아 재저장되지 않고, Continue는 null, 새 결과는 새 snapshot으로 처리한다.
5. accountId가 없으면 저장하지 않고 saveError를 표시한다. 저장 실패에도 continue/quit/play가 가능하다. 기존 진행도 오류와 ranking 오류를 별도로 처리한다. checkpoint에 rankingError를 전달하고 기존 결과와 같은 저장 실패 문구를 표시한다.
6. checkpoint와 game-over 결과에 formatRemainingTimeCs(snapshot.remainingTimeCs)를 표시한다. 랭킹 행의 leaderboard-time에 남은 시간 12.34초처럼 표시한다. ascent legacy의 undefined는 시간 미기록이며 main v2 행에는 항상 값이 있다.
7. 시간 추가 후에도 이름/단계/점수를 읽도록 grid를 접는다. 320px/큰 글자에서 가로 overflow를 만들지 않는다. live HUD는 기존 정수초, 결과 기록은0.01초다.

### I04. Regression coverage

- Modify `src/leaderboard/{leaderboard.test.ts,LeaderboardPanel.test.tsx}`, `src/game/{recordStorage.test.ts,GameScreen.test.tsx,CheckpointPanel.test.tsx,stageProgress.test.ts}`.
- descent용 기존 newRank/main 저장 fixture에 remainingTimeCs를 추가하고 키는 DESCENT_LEADERBOARD_KEY(v2)를 사용한다. ascent 시간 없는 fixture는 유지한다.
- 기존 CP에서는 랭킹 저장하지 않음 기대값을 CP 즉시 저장으로 바꾼다. StrictMode/quit의 같은 후보에서 setItem이 증가하지 않는지 확인한다.
- T01 엔진/결과 source는 read-only. 새 요구와 관계있는 타입/fixture 기대값만 관련 검사에서 보완할 수 있다. 인증/오디오/단독 저장 차단 검사는 변경하지 않는다.

#### Required cases

- 단계 우선>점수 우선>시간,1cs 차이, 세 항목 동점이면 먼저 달성, 개인 최고 시간만 개선/악화, 서로 다른 도전의 필드 혼합 방지, 입력 불변/limit.
- v1-only 초기화, v1+유효v2 보존, 모든 계정의 진행도 byte 보존, get/remove 실패 후 재시도, StrictMode/재방문, 새v2 보존, 저장소 getter/read/write 실패와 손상된 행, 잘못된 시간을 저장소 접근 전 거절.
- 각 단계 clear 즉시 저장, CP95초 후 quit도 원래 시간/추가 쓰기0회, Continue0점 후 중도 잡힘은 현재 단계의 score/time,5단계 final clear 즉시 저장, 같은 성적 반복 쓰기0, 계정별 기록/이름/저장 실패 UI.
- 표시와 순위 일치,0.00/0.01/90.00초, TOP10/current-player 표시. 320px/긴 이름/큰 글자는 후속 브라우저 검사로 확인한다.

## Acceptance Criteria

- [x] main 시간 랭킹과 개인 최고가 같은 tuple 비교를 사용한다.
- [x] CP clear 시점에 v2 저장, quit/repaint/StrictMode의 같은 성적 추가 쓰기0회.
- [x] 구 랭킹만 초기화하고 해금/새 랭킹/auth/audio 보존.
- [x] 지정29파일·lint·build·diff 통과와 실제 결과/제한 기록.

## Validation

```powershell
npm.cmd test -- --run src/game/stageResult.test.ts src/game/pursuerCatchUp.test.ts src/game/recordStorage.test.ts src/game/StairScene.test.tsx src/descent/descentEngine.test.ts src/descent/descentSceneModel.test.ts src/descent/descentGate.test.ts src/descent/DescentTestApp.test.tsx src/descent/descentViewState.test.ts src/descent/DescentGameScreen.test.tsx src/descent/DescentScene.test.tsx src/game/stageRules.test.ts src/game/gameEngine.test.ts src/game/timedPursuit.test.ts src/game/stairRoute.test.ts src/game/stairObstacles.test.ts src/game/stairSceneModel.test.ts src/game/ControlButtons.test.tsx src/game/GameHud.test.tsx src/game/GameScreen.test.tsx src/game/CheckpointPanel.test.tsx src/game/StageSelectPanel.test.tsx src/game/stageProgress.test.ts src/leaderboard/leaderboard.test.ts src/leaderboard/LeaderboardPanel.test.tsx src/audio/AudioControls.test.tsx src/audio/audioController.test.ts src/audio/audioPreferences.test.ts src/auth/authConfig.test.ts --maxWorkers=2
npm.cmd run lint
npm.cmd run build
& 'C:/Program Files/Git/cmd/git.exe' diff --check
```

모든 명령 통과, skip0. 로그는 `%TEMP%/time-ranking-and-office-ending-2026-10-28/`의 Task별 폴더. 실행 당시 실제 test 수/시간/빌드 크기·경고를 기록한다. 테스트 timeout/skip/config/package 변경 금지.


## Commit Message

```text
feat(leaderboard): rank by remaining time and save every stage clear

Plan: 2026-10-28-time-ranking-and-office-ending
Phase: P01-office-finish
Task: T02-time-ranking-and-checkpoint-saves

- Version descent rankings and preserve stage unlocks during reset
- Compare stage, score and centiseconds for ranks and personal bests
- Save checkpoint results immediately and display their frozen time
```

## Progress

- [x] 구현 완료
- [x] 검증 통과
- commit: implementation commit containing this Task; hash recorded in subsequent memory sync.

## Validation Results — 2026-10-29

- 지정29파일 **912/912tests**, skip0, workers2,54.62초 통과. T01까지864개에 T02 신규48개를 추가했다. 최종 근거 `regression-29.log`.
- 집중4파일103/103(29.54초), 추가 검사 포함138/138(3.83초) 통과. 2026-10-28/T02/regression-initial.log의47실패/817통과는 새 필수시간 없는 fixture와 기존 CP 미저장 기대값 등이 남아 있던 중간 결과다. 기존 ascent 무시간 fixture는 유지하고 descent 시간 fixture와 CP 즉시 저장 기대를 보완했다. timeout/skip/config/package 변경 없음.
- 새 검사: 단계/점수/1cs/먼저 달성 순서, 개인 최고1cs 개선·동점 무쓰기·도전 필드 혼합 방지, 전 단계 예산 상한·잘못된 시간의 저장소 접근 전 거절, v1만 정리·v2/다계정 해금 byte 보존·구키 get/remove 실패 후 재시도, CP/결과/랭킹 시간 표시와 별도 오류 상태.
- GameScreen 신규13검사와 기존 갱신 검사에서 모든 단계 clear 즉시 저장,123ms 입력의0.01초 내림,StrictMode/이름 변경 rerender/95초 대기·Quit의 추가 쓰기0,stage2 실패의 해당 단계 시간,저장 실패에도 continue/quit,동점 개인 최고 시간 개선만 갱신,timeout0.00초,재마운트의 해금/v2 보존을 확인했다.
- lint 오류0/경고0, TypeScript/Vite build 및 git diff --check 통과. JS557.13kB(gzip155.82)/CSS57.91kB(gzip11.04); 기존500kB chunk 경고 출력. 기본 build는 기존 index.html이며 엔트리/배포 설정은 바꾸지 않았다.
- 증거 폴더 `C:/Users/DEX/AppData/Local/Temp/time-ranking-and-office-ending-2026-10-29/T02/`: focused-initial.log/focused-expanded.log/regression-29.log/lint.log/build.log. 테스트 종료 후 lint와 build를 순서대로 실행했다.
- 제품6파일/검사5파일 변경. T01 engine/types/stageResult·진행도·단독·인증·오디오·단계/추격 규칙·패키지/설정 source는 baseline efda9c2와 동일하다. 브라우저/320px·큰 글자 실제 배치는 후속 T04에서 검증한다. CSS는480px 이하에서 랭킹 성적을 두 번째 행으로 접도록 했다.
- 신규 범위 밖 결함: 특이사항 없음. 기존 번들 경고/App 전체 suite 부채는 이번 Task에서 수정하지 않았다.
