# Phase: P02 Azure Release

## Goal
테스트를 통과한 게임/API를 회사 테넌트 전용 새 Standard 사이트에 배포하고 실제 작동하는 URL을 전달한다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done ✅` | auth/config 산출물, main Actions, 기본 PlanOnly 배포 도구 | [T01](./T01-deployment-config-and-workflow.md) |
| T02 | `done ✅` | grill-me-edu에 Standard 사이트/저장소, Entra/GitHub 설정 | [T02](./T02-provision-company-resources.md) |
| T03 | `in_progress 🔵` | main release, 실제 로그인/공유 기록 검증 및 URL | [T03](./T03-release-and-verify-url.md) |

## Progress
- done: 2/3 (active: T03; P01 complete4/4)
- T02 complete2026-10-30: actual user Contributor on grill-me-edu allowed scoped create in that existing shared group. New dedicated Standard site URL `https://ashy-cliff-0e5e4b600.1.azurestaticapps.net`, separate tagged private Storage/table, additive company app callback/180-day credential, server settings and correct repository secret/vars verified. Original 20 resource names remain; unrelated Automation publish by another principal was separately identified. Deploy still pending; T03 tests public protection/login/API/company records and releases main SHA.
- T02 source final commit `df5a933`; prerequisite implementation fixes `f1ddac4` (fail-fast Azure RBAC) and `87336ca` (reuse existing scoped group). T02 validation25/25, lint/diff and actual live config verification passed. No secret values tracked. Use T03 for deployment URL acceptance.
- T01 `b2d2172`: protected config, exact-SHA allowlisted production artifacts, main-only Actions and default-PlanOnly owned-resource tools complete. Helpers22/root1269/API95/Azurite10, lint/build, real package/config verification and official actionlint passed. No live resources/credentials/GitHub settings/push/release created; T02 verifies actual permissions and provisions the approved dedicated target.
- P01 final implementation `42466f6`, root1269/API95/Azurite10 passing. No production site has been provisioned/released by this plan yet.
- Dependencies: P01 complete → T01 → T02 → T03.
- T01: 클라우드/원격 변경 없음. T02: 승인된 전용 리소스와 설정만 실제 변경. T03: Git push/Actions 배포.
- Exit gate: 실사이트 URL, 정확한 배포 SHA와 run URL, 익명 접근 차단, 회사 로그인, 서버 기록과 기기 간 해금 복원 증거.
- 테스트/권한이 미확인인 상태를 완료로 기록하지 않는다.

## Source
[Plan](../../../plans/2026-10-30-azure-company-game-deployment.md), [Decisions](../../../decisions/2026-10-30-azure-company-game-deployment.md).
