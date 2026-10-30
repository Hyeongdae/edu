# Phase: P01 Company Records

## Goal
클라우드 서비스 생성 없이도 계약, API, 호스팅 인증, 비동기 저장의 회귀를 자동 검증할 수 있는 애플리케이션을 완성한다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 공유 DTO, 검증, 최고 성적/해금 합병 | [T01](./T01-shared-record-contracts.md) |
| T02 | `done ✅` | Functions API, Table ETag 저장과 격리 통합 테스트 | [T02](./T02-functions-table-api.md) |
| T03 | `in_progress 🔵` | SWA hosted identity와 기존 로컬 인증 분기 | [T03](./T03-hosted-company-auth.md) |
| T04 | `pending` | 계정별 재전송 큐, profile bootstrap, 게임 공유 기록 연결 | [T04](./T04-cloud-records-game-integration.md) |

## Progress
- done: 2/4 (active: T03)
- T01 `e880da2`: shared contracts 137/137 tests, lint, TypeScript/Vite build and diff check passed (2026-10-30). No Azure/GitHub mutations or frontend integration.
- T02 `be54a6b`: API unit94/94 and actual isolated Azurite integration10/10 additionally verified on Node22.23.4, shared137/137, ci/lint/API and frontend builds/diff passed. Production dependency audit0; development-only Azurite chain has4 moderate advisories. No Azure creation, actual Entra login or Git push.
- Dependencies: T01 → T02 → T03 → T04.
- Exit gate: root 전체 테스트/lint/build와 API unit/integration/build 통과; 기존 로컬 모드 및 연출/시계 유지.
- Next phase: [P02 Azure Release](../P02-azure-release/phase.md).

## Source
[Plan](../../../plans/2026-10-30-azure-company-game-deployment.md), [Decisions](../../../decisions/2026-10-30-azure-company-game-deployment.md).
