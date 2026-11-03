# Phase: P01 Character Customization

- Status: in_progress
- Plan: [Character Customization](../../../plans/2026-11-03-character-customization.md)
- Decision: [Confirmed decisions](../../../decisions/2026-11-03-character-customization.md)

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` ✅ | 옵션 카탈로그, 기본값, 외형 데이터 계약과 점수 병합 호환 (`8898b74`) | [T01](./T01-appearance-contracts.md) |
| T02 | `done` ✅ | Cosmos 외형 왕복, 인증된 저장 API, 기록 동시 저장 보존 (`5f98abb`) | [T02](./T02-account-appearance-api.md) |
| T03 | `in_progress` 🔵 | 클라이언트 API, 계정 store의 400ms 자동 저장·실패·재시도 | [T03](./T03-appearance-autosave.md) |
| T04 | `pending` | 공통 픽셀 부위와 이동/야근 전체 포즈 렌더링 | [T04](./T04-customizable-pixel-characters.md) |
| T05 | `pending` | 타이틀 꾸미기 UI, 모든 장면 연결, 통합 검증 | [T05](./T05-title-customizer-and-scene-integration.md) |

## Progress
- done: 2/5 (active: T03)

## Execution Rules
- Active Task 하나씩 실행하고 해당 청사진의 검증을 통과한 뒤 커밋한다.
- 각 커밋 메시지에 `Plan: 2026-11-03-character-customization` 헤더를 사용한다.
- 완료 Task의 Status, 이 표와 진행률, `.memory/current.md`를 함께 동기화한다.
- 기존 `src/game/pixel-theme.css`의 미커밋 모바일 버튼 간격 수정을 보존한다.
- 운영 Cosmos 자격 증명이나 실제 사용자 기록을 단위/통합 테스트에 사용하지 않는다. 통합 테스트는 기존 로컬 emulator harness를 사용한다.
