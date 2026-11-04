# Phase: P01 Visual Distinction

- Status: complete
- Plan: [Character Gender Visual Distinction](../../../plans/2026-11-04-character-gender-visual-distinction.md)
- Decision: [Confirmed decisions](../../../decisions/2026-11-04-character-gender-visual-distinction.md)

## Tasks
| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | `done` ✅ | 얼굴형·눈썹·속눈썹과 눈/안경/표정 호환 (`8e2f3a8`) | [T01](./T01-distinct-face-and-eyes.md) |
| T02 | `done` ✅ | 체형·모든 포즈의 팔 접점·가방끈 연결 (`34f0944`) | [T02](./T02-gender-body-and-pose-fit.md) |
| T03 | `done` ✅ | 편집/두 모드/엔딩 전달 및 최종 자동 검증 (`05356a7`); 실제 모바일 미검증 | [T03](./T03-editor-and-scene-validation.md) |

## Progress
- done: 3/3 (active: 없음; 구현/자동 검증 완료)
- T01 완료 (`8e2f3a8`): 지정4파일246/246(새32사례), lint/build/diff check 통과. 실제 도형의 턱/목 단면, 눈5종·안경·임시 표정/복원·나이대·선택 보존을 확인했다. 현재 공통 얼굴의 정적28표본을 확인했으며 실제 브라우저/모바일/애니메이션 검증은 아니다.
- T02 완료 (`34f0944`): 여성 어깨/몸통과 옷5종을 맞추고 모든 게임/야근 포즈의 소매·손, 필요한 가방끈/백팩 연결을 보완했다. 지정8파일362/362, 추가 손/백팩 검사64/64, lint/build/diff check 통과. 원래 손·발·변환·clip/모션과 남성 기본 몸통을 보존했다.
- T02 정적64표본(옷20/포즈24/가방20)을 확인했다. 기존 older 남성 run-b의1px 손-소매 틈도 같은 포즈 연결 범위에서 보완했다.
- T03 완료 (`05356a7`): 지정11파일498/498, 최종 frontend/shared57파일1784/1784(139.43초), lint/build/diff check 통과. 실제 gender radio/다른12필드·역할 보존/저장상태/초점과 두 모드·모든 엔딩의 실제 도형 전달, 진행/카운트다운/좌표/clip 보존을 확인했다. 원래 크기에 가까운 표시와2배 확대의76조건 표본 및 실제 장면 SVG4개를 정적으로 확인했다.
- 실제 브라우저 도구가 없어4개 화면 크기의 모바일 레이아웃/터치/스크롤/native keyboard/애니메이션은 미검증이다. 이전 Chrome 차단을 우회하지 않았고 실제 계정/Cosmos 통합은 별도 출시 전 확인으로 인계한다. 기존 pixel-theme.css와 로컬5173 데모를 보존했으며 push/배포는 하지 않았다.

## Execution Rules
- .memory/current.md의 Active Task 하나만 읽어 구현·검증·커밋한 뒤 phase/plan/current를 동기화한다.
- 각 Task 커밋은 청사진의 메시지와 `Plan: 2026-11-04-character-gender-visual-distinction`을 사용한다.
- gender는 기존 version2 필드이며 신규 저장 필드/DB/API/UI 선택지는 추가하지 않는다.
- T01은 얼굴/눈만, T02는 몸통과 포즈별 팔/가방을 원자적으로 연결한다. T03은 실제 선택/장면 통합과 최종 표본 검증을 맡는다.
- 원본 발 y=40, translate/scale, clip/계단/카메라/모션과 게임 규칙을 보존한다. 남성 기본 몸통/손/발 도형을 그대로 두고 새 체형을 상대적으로 구분한다.
- 브라우저 차단을 우회하지 않는다. static/DOM과 실제 브라우저 확인을 구분하여 보고한다. 운영 계정/DB를 테스트에 쓰지 않는다.
- 기존 pixel-theme.css 미커밋 변경과 무관한 파일은 보존하고 스테이징하지 않는다.
