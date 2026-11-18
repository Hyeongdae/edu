# Phase: P01 Account Wallet API

- Status: in_progress
- Plan: [Point Shop and Step Effects](../../../plans/2026-11-18-point-shop.md)
- Decision: [Confirmed decisions](../../../decisions/2026-11-18-point-shop.md)

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` | Define the wallet contract, legacy profile normalization, strict requests, and deterministic wallet mutations | [T01](./T01-shared-wallet-contract.md) |
| T02 | `done` | Persist points and effects in the Cosmos player partition; expose authenticated idempotent coin, purchase, and equip APIs | [T02](./T02-cosmos-wallet-api.md) |
| T03 | `in_progress` | Add client wallet requests and durable retry queue, and isolate the local 1,000-point demo wallet | [T03](./T03-client-wallet-store.md) |

## Progress
- done: 2/3 (active: T03)
