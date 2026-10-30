# Phase: P02 Azure Release

## Goal
테스트를 통과한 게임/API를 회사 테넌트 전용 새 Standard 사이트에 배포하고 실제 작동하는 URL을 전달한다.

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `pending` | auth/config 산출물, main Actions, 기본 PlanOnly 배포 도구 | [T01](./T01-deployment-config-and-workflow.md) |
| T02 | `pending` | 실제 권한 확인, 전용 Azure/Entra/GitHub 설정 | [T02](./T02-provision-company-resources.md) |
| T03 | `pending` | main release, 실제 로그인/공유 기록 검증 및 URL | [T03](./T03-release-and-verify-url.md) |

## Progress
- done: 0/3 (active: none; awaiting P01)
- Dependencies: P01 complete → T01 → T02 → T03.
- T01: 클라우드/원격 변경 없음. T02: 승인된 전용 리소스와 설정만 실제 변경. T03: Git push/Actions 배포.
- Exit gate: 실사이트 URL, 정확한 배포 SHA와 run URL, 익명 접근 차단, 회사 로그인, 서버 기록과 기기 간 해금 복원 증거.
- 테스트/권한이 미확인인 상태를 완료로 기록하지 않는다.

## Source
[Plan](../../../plans/2026-10-30-azure-company-game-deployment.md), [Decisions](../../../decisions/2026-10-30-azure-company-game-deployment.md).
