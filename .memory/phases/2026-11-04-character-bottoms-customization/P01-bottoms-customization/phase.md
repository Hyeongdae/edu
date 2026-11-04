# Phase: P01 Bottoms Customization

- Status: in_progress
- Plan: [Character Bottoms Customization](../../../plans/2026-11-04-character-bottoms-customization.md)
- Decision: [Confirmed decisions](../../../decisions/2026-11-04-character-bottoms-customization.md)

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` ✅ | 고정 v1/v2와 별도 v3 하의 계약/정규화 (`2d6b996`) | [T01](./T01-bottoms-appearance-contract.md) |
| T02 | `done` ✅ | 공통 하의/신발 연결과 모든 게임·엔딩 포즈 (`e30fea8`) | [T02](./T02-bottoms-pixel-rendering.md) |
| T03 | `done` ✅ | v3 계정/API/프로필 전환 및 기존 점수/외형 보존 (`d7b6e24`) | [T03](./T03-versioned-bottoms-persistence.md) |
| T04 | `in_progress` 🔵 | 하의 편집/장면 통합과 최종 검증 — 다음 실행 대상 | [T04](./T04-bottoms-editor-and-scenes.md) |

## Progress
- done: 3/4 (active: T04)
- T01 완료 (`2d6b996`): 새 v3 계약/15필드/하의4종·색6종과 정상 v1/v2 읽기 변환을 추가했다. 지정4파일328/328(3.65초), lint/프런트엔드·API 타입 검사/빌드/diff check 통과. 고정 v1/v2와 public v2/API/그림/UI는 변경하지 않았다. 기존500kB chunk 경고 유지. 실제 저장/렌더링/편집은 후속 Task다.
- T02 완료 (`e30fea8`): 공통 하의/팔레트를 모든 게임·야근 포즈에 연결했다. 지정9파일481/481(30.80초), 새 하의 최종115/115(10.75초), lint/build/diff check 통과. 이전 커밋097c26c와 기본 긴바지32조건 PNG가 바이트 동일하다. 새 하의80조건의 원래 크기/2배 정적 표본을 확인했다. 발 y=40/야근 다리 CSS/기타 외형과 public v2를 유지했다. 실제 브라우저/계정 확인 및 push/배포는 하지 않았다.
- T03 완료 (`d7b6e24`): public/API/클라이언트를v3로 연결하고 v1/v2의 읽기 무변경·최초 명시 저장·두 점수 no-op/개선·지연 응답/재시도·계정 분리/새 세션을 검증했다. 지정7파일450/450, 최종 관련9파일662/662(21.12초), API211/211(2.81초), lint/프런트엔드·API build/diff check 통과. 로컬 emulator 미준비로 통합3추가사례/전체16사례는 타입 검사만 통과했고 실제 실행은 배포 전 CI 필수다. UI는 아직13개 그룹이며 push/배포 없음.

## Execution Rules
- `.memory/current.md`의 Active Task 한 개만 구현·검증·커밋한 뒤 task/phase/plan/current를 동기화한다.
- 각 Task 커밋 메시지에 `Plan: 2026-11-04-character-bottoms-customization`을 사용한다.
- T01/T02는 public v2를 유지한다. T03에서 API/클라이언트 public 계약을 함께 v3로 전환한다. T04에서 새 선택 그룹을 노출한다. 중간 Task를 배포하지 않는다.
- 기존 13개 외형 선택/양쪽 역할/계정 기록·모드·게임 규칙을 보존한다. 기존 v1/v2 모듈은 변경하지 않는다.
- 신발 바닥 y=40과 야근 엔딩의 앞뒤 다리 애니메이션 그룹을 보존한다. 색상만으로 하의 모양을 대체하지 않는다.
- 테스트/타입 오류는 관련 버전/fixture/라벨 의미에 맞게 고친다. 기존 실패를 숨기거나 timeout/skip을 완화하지 않는다.
- 브라우저 차단을 우회하지 않고 정적 표본과 실제 브라우저 검증을 구분한다. 실제 계정/운영 Cosmos에는 테스트 쓰기를 하지 않는다.
- 기존 모바일 조작 간격 및 사용자 untracked 파일을 보존한다. push/배포/자원 수정은 별도 출시 작업이다.
