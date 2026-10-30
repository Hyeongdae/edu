# Phase: P03 Azure Cutover

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` | Create/verify the selected Cosmos container and add secret-safe server app settings alongside the existing Table settings. | [T01](./T01-provision-cosmos-container.md) |
| T02 | `done` | Deploy the Cosmos-backed app and verify a real company-account profile, result, ranking, and cross-device unlock. | [T02](./T02-deploy-and-verify-cosmos.md) |
| T03 | `done` | After T02 verification, remove old Table settings and delete only the dedicated legacy Storage account. | [T03](./T03-delete-legacy-storage.md) |

## Progress
- done: 3/3
- T01 commit: `a904755`
- T03 commit: `e8e335d`
- T03 validation: deployment tests 26/26, lint, build, Azure resource/settings verification, anonymous API redirect (302), user-confirmed Cosmos records remain available.
