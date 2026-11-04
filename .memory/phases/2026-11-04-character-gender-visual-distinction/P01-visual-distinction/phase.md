# Phase: P01 Visual Distinction

- Status: in_progress
- Plan: [Character Gender Visual Distinction](../../../plans/2026-11-04-character-gender-visual-distinction.md)
- Decision: [Confirmed decisions](../../../decisions/2026-11-04-character-gender-visual-distinction.md)

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` ✅ | 얼굴형·눈썹·속눈썹과 눈/안경/표정 호환 (`8e2f3a8`) | [T01](./T01-distinct-face-and-eyes.md) |
| T02 | `in_progress` 🔵 | 체형·모든 포즈의 팔 접점·가방끈 연결 | [T02](./T02-gender-body-and-pose-fit.md) |
| T03 | `pending` | 편집/두 모드/엔딩 전달, 비교 표본, 최종 회귀 | [T03](./T03-editor-and-scene-validation.md) |

## Progress
- done: 1/3 (active: T02)
- T01 완료 (`8e2f3a8`): 지정4파일246/246(새32사례), lint/build/diff check 통과. 실제 도형의 턱/목 단면, 눈5종·안경·임시 표정/복원·나이대·선택 보존을 확인했다. 현재 공통 얼굴의 정적28표본을 확인했으며 실제 브라우저/모바일/애니메이션 검증은 아니다.
- T02는 구현 시작 준비 상태다. 몸통/팔/가방은 아직 원래 도형이며 T02에서 연결한다. 종합 비교와 장면/최종 회귀는 T03에 남긴다. 기존 pixel-theme.css 변경과 dev 서버는 보존하고 push/배포는 수행하지 않았다.

## Execution Rules
- .memory/current.md의 Active Task 하나만 읽어 구현·검증·커밋한 뒤 phase/plan/current를 동기화한다.
- 각 Task 커밋은 청사진의 메시지와 `Plan: 2026-11-04-character-gender-visual-distinction`을 사용한다.
- gender는 기존 version2 필드이며 신규 저장 필드/DB/API/UI 선택지는 추가하지 않는다.
- T01은 얼굴/눈만, T02는 몸통과 포즈별 팔/가방을 원자적으로 연결한다. T03은 실제 선택/장면 통합과 최종 표본 검증을 맡는다.
- 원본 발 y=40, translate/scale, clip/계단/카메라/모션과 게임 규칙을 보존한다. 남성 기본 몸통/손/발 도형을 그대로 두고 새 체형을 상대적으로 구분한다.
- 브라우저 차단을 우회하지 않는다. static/DOM과 실제 브라우저 확인을 구분하여 보고한다. 운영 계정/DB를 테스트에 쓰지 않는다.
- 기존 pixel-theme.css 미커밋 변경과 무관한 파일은 보존하고 스테이징하지 않는다.
