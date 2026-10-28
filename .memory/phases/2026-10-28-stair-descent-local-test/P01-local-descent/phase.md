# Phase: P01 Local Descent

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | done ✅ | 저장 없는1단계 adapter와 하강 좌표 모델 | [T01](./T01-descent-engine-and-scene-model.md) |
| T02 | in_progress 🔵 | 독립 로컬 HTML·화면·모션·오디오·조작 통합 | [T02](./T02-isolated-local-descent-screen.md) |
| T03 | pending | 실제 하강 플레이/원본 보존/저장 무접근/반응형 검증 | [T03](./T03-descent-browser-validation.md) |

## Progress

- done: 1/3 (active: T02)
- Status: in_progress
- 2026-10-28 계획 작성 당시에는 문서/실행 포인터만 준비했다.
- 2026-10-28 T01 `0225893` 완료. 신규 순수 adapter/model과 두 테스트를 구현했다. 지정8파일356/356tests(9.07s), lint/build/diff check 통과. 원본 게임/저장소/설정/패키지 변경 없음.1단계 최종cleared/마지막 장애물stage1 결정/하강 좌표와 모든 모션점·NPC 가시성 재계산을 확인했다. JS551.91kB(gzip154.18kB), CSS55.50kB(gzip10.77kB), 기존500kB chunk 경고 유지.
- 다음 T02에서 실제 로컬 화면/진입점/모션/오디오를 연결한다. T01에는 화면/서버/실제 브라우저 검증이 없다. 증거는 `%TEMP%\stair-descent-t01-2026-10-28\`와 T01 Validation Results에 기록했다.

## Execution Rule

`.memory/current.md`의 Active Task 한 개만 구현·검증·커밋한다. 성공 후 Task done→지정 커밋→phase 진행률→current 다음 Task 순으로 동기화한다. 새 제품 코드는 `src/descent/`와 `descent-test.html`에만 추가한다. 기존 게임/기록/인증/설정은 읽기 전용이다. T03의 필수 실제 브라우저 검증이 통과해야 plan completed/Active Task none으로 전환한다.

## Source and History

- [확정 결정](../../../decisions/2026-10-28-stair-descent-local-test.md)
- [전체 계획](../../../plans/2026-10-28-stair-descent-local-test.md)
- 이전 Stage Unlocks and Per-Stage Scores 완료: T01 `f5ef960`, T02 `f35254f`, T03 `20f8425`, 동기화 `8d9b31d`. 이전 계획은 변경하지 않는다.
- 원본 리팩터링/공용 랭킹/Entra·배포/번들 개선/내려오기5단계는 범위 밖이다.
