# Phase: P01 Appearance Expansion

- Status: in_progress
- Plan: [Character Customization Expansion](../../../plans/2026-11-04-character-customization-expansion.md)
- Decision: [Confirmed decisions](../../../decisions/2026-11-04-character-customization-expansion.md)

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` ✅ | 과거 카탈로그 고정, 확장 계약·version 1 정규화 준비 (`20fbcb6`) | [T01](./T01-expanded-appearance-contracts.md) |
| T02 | `done` ✅ | 모든 픽셀 포즈에 눈·가방 및 새 스타일 렌더링 (`ab16a10`) | [T02](./T02-expanded-pixel-parts.md) |
| T03 | `done` ✅ | public 계약 전환과 API·클라이언트 저장 호환 (`445e014`) | [T03](./T03-versioned-account-appearance.md) |
| T04 | `in_progress` 🔵 | 편집 UI 13그룹, 실제 장면·모바일 통합 검증 | [T04](./T04-expanded-editor-and-scene-validation.md) |

## Progress
- done: 3/4 (active: T04)
- T01 계약257/257·API186/186, T02 지정7파일289/289·lint/build 통과. 정적25표본과90개 clip 비교 확인. T03 계정 계약 전환 완료: 지정584/584·API198/198·lint/양쪽build 통과. emulator 미준비로 통합3건 추가 후 미실행. T04 편집 UI 연결 준비 상태.

## Execution Rules
- current.md의 Active Task 하나씩 구현·검증·커밋한 뒤 이 표와 포인터를 갱신한다.
- 각 커밋에 `Plan: 2026-11-04-character-customization-expansion`을 포함한다.
- T01/T02 동안 기존 API/UI의 public 계약은 version 1로 유지한다. 렌더러 준비 후 T03에서 version 2로 전환한다.
- 과거 문서 읽기는 쓰기를 유발하지 않으며 실제 쓰기는 새 외형을 사용한다. 계정 문서 schemaVersion과 점수 대기열 version은 변경하지 않는다.
- 기존 미커밋 pixel-theme.css 변경을 보존한다. 새 스타일은 전용 꾸미기 CSS와 공통 SVG 부위에서 구현한다.
- 테스트는 운영 Cosmos/사용자 계정에 연결하지 않는다. 로컬 emulator가 없으면 실제 통합 검증을 수행했다고 기록하지 않는다.
