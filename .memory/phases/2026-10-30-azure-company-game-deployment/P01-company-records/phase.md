# Phase: P01 Company Records

## Goal
클라우드 서비스 생성 없이도 계약, API, 호스팅 인증, 비동기 저장의 회귀를 자동 검증할 수 있는 애플리케이션을 완성한다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | 공유 DTO, 검증, 최고 성적/해금 합병 | [T01](./T01-shared-record-contracts.md) |
| T02 | `done ✅` | Functions API, Table ETag 저장과 격리 통합 테스트 | [T02](./T02-functions-table-api.md) |
| T03 | `done ✅` | SWA hosted identity와 기존 로컬 인증 분기 | [T03](./T03-hosted-company-auth.md) |
| T04 | `done ✅` | 계정별 재전송 큐, profile bootstrap, 게임 공유 기록 연결 | [T04](./T04-cloud-records-game-integration.md) |

## Progress
- done: 4/4 (active: none; phase complete)
- T01 `e880da2`: shared contracts 137/137 tests, lint, TypeScript/Vite build and diff check passed (2026-10-30). No Azure/GitHub mutations or frontend integration.
- T02 `be54a6b`: API unit94/94 and actual isolated Azurite integration10/10 additionally verified on Node22.23.4, shared137/137, ci/lint/API and frontend builds/diff passed. Production dependency audit0; development-only Azurite chain has4 moderate advisories. No Azure creation, actual Entra login or Git push.
- T03 `f56b4fe`: hosted session bootstrap and local-auth isolation; 78/78 targeted auth/App/entry tests, lint, normal and hosted-without-SPA-IDs builds/diff passed. Account-bound audio cleanup and stale request protection verified. Shared frontend records and actual hosted login are still pending.
- T04 `42466f6`: hosted profile bootstrap, account FIFO/retry, shared ranking/unlocks and save notices. Full root1269/1269 (42 files/0 skips), API95/95, real isolated Azurite10/10, lint and API/normal/hosted builds/diff passed. Existing18 stale pursuit-time expectations verified against unchanged HEAD files and corrected in tests only; game rules/engine unchanged. No real Azure/Entra configuration or deployment.
- Exit gate met. Proceed to P02-T01; historical T03 pending shared-frontend work is now complete, real company login remains P02.
- Dependencies: T01 → T02 → T03 → T04.
- Exit gate: root 전체 테스트/lint/build와 API unit/integration/build 통과; 기존 로컬 모드 및 연출/시계 유지.
- Next phase: [P02 Azure Release](../P02-azure-release/phase.md).

## Source
[Plan](../../../plans/2026-10-30-azure-company-game-deployment.md), [Decisions](../../../decisions/2026-10-30-azure-company-game-deployment.md).
