# Plan: Character Gender Visual Distinction

- Date: 2026-11-04
- Status: complete
- Decision: [Character Gender Visual Distinction](../decisions/2026-11-04-character-gender-visual-distinction.md)

## Goal
같은 머리·눈·옷·소품에서 성별만 전환해도 얼굴과 몸통의 차이가 실제 게임 크기에서 보이도록 개선한다. 도망자/추격자의 나이대와 모든 꾸미기 선택, 착지·모션·저장 규칙은 보존한다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `complete` | 공통 얼굴·체형 개선과 편집/장면 자동 검증 완료; 실제 모바일 미검증 기록 | [P01](../phases/2026-11-04-character-gender-visual-distinction/P01-visual-distinction/phase.md) |

## Tasks and Order
| Task | Observable outcome | Principal files |
| :--- | :--- | :--- |
| T01 | 눈5종·안경·표정을 유지하며 얼굴형/눈 주변 차이 강화 | `OfficerAppearanceParts.tsx`, 신규 `genderAppearanceArt.test.tsx`, 기존 픽셀 테스트 |
| T02 | 같은 옷에서도 다른 어깨/몸통과 자연스러운 팔·가방 연결 | `OfficerAppearanceParts.tsx`, `PixelOfficer.tsx`, `OvertimeOfficer.tsx`, `OfficerBagArt.tsx`, 픽셀 테스트 |
| T03 | 성별만 전환하여 미리보기/두 모드/모든 엔딩에 전달되는지 확인 | 꾸미기·GameScreen·장면·엔딩 테스트, 비교 표본과 최종 검증 기록 |

T01 → T02 → T03 순서의 단일 Phase다. 얼굴은 양 렌더러가 공유하므로 먼저 독립 검증할 수 있다. 몸통과 포즈별 팔·가방은 함께 바꾸어야 중간 커밋에 연결이 끊어진 캐릭터가 남지 않는다. 마지막에는 실제 편집 입력과 장면 전달, 시각 비교 및 전체 회귀를 확인한다.

## Existing Contracts — Unchanged
- 저장 모델 `CharacterAppearance = { version: 2, runner: CharacterLook, pursuer: CharacterLook }`와13개 필드/문자열 ID를 유지한다. `gender: "male" | "female"`의 렌더링만 달라진다.
- `CharacterLook`: gender, hairStyle, hairColor, skinTone, outfit, outfitColor, hat, glasses, shoes, shoeColor, eyeStyle, bag, bagColor. 모두 필수이며 nullable이 아니다. 기존 legacy version1 정규화와 role별 기본값을 유지한다.
- `OfficerVariant = "young" | "older"`는 나이대이며 gender와 독립이다. older 여성도 나이 든 얼굴/현재 소품을 유지한다.
- 눈5종(default/round/smile/sleepy/sharp), 표정3종(normal/stumble/weary), 안경4종(none/square/round/sunglasses), 옷5종(shirt/suit/cardigan/hoodie/vest)을 보존한다.
- 게임4프레임(idle/run-a/run-b/stumble), 야근4포즈(standing/grabbing/dragged/seated), 가방5종과 별도 색상·앞뒤 레이어를 보존한다.
- 모든 새 차이는 정수 좌표의 로컬 도형으로 그린다. 전체 캐릭터 scale, `translate(-32 -80) scale(2)`, 신발 바닥 y=40, 발 clip rect(-34,-88,68,84), 장면 좌표와 모션 CSS를 유지한다.

## Visual Direction
- 남성: 기존 각진 얼굴과 몸통을 기준으로 분명한 눈썹/어깨선. 여성: 눈/안경 위치를 유지하면서 더 분명히 좁아지는 턱, 가는 눈썹과 짧은 바깥 속눈썹, 좁은 어깨와 완만히 정리된 몸통.
- 피부색·옷 색상·장발이나 특정 소품으로 성별 차이를 대신하지 않는다. 성별 변경 시13개 선택 중 gender만 바뀐다. 치마·화장·별도 체형 옵션은 추가하지 않는다.
- 정확한 픽셀 도형은 Task의 시작안과 연결 조건을 사용하고 동일한 조건의 남녀 비교 표본을 보며 다듬는다. 이는 확정된 표현 방향 안의 구현 선택이며 추가 사용자 승인 단계가 아니다.
- 일반 안경 안의 선택 눈은 하나만 그린다. 선글라스는 눈을 가릴 수 있고 이때는 얼굴/몸통 윤곽이 구분을 담당한다. 넘어짐·야근 표정은 임시 표현으로 유지한다.

## Regression Traps
- 기존 여성 턱선 위에 y=19의 넓은 피부 사각형을 그대로 얹으면 좁힌 윤곽을 다시 메운다. 피부·턱·목 도형을 함께 맞춘다.
- round/smile/sleepy/sharp 및 안경 속 기본 눈에 gender 표현이 없었다. 기본 눈만 수정하면 사용자가 눈을 바꾼 순간 원래 문제가 재발한다. 눈 도형과 눈썹/속눈썹을 분리하되 pupil을 중복 렌더링하지 않는다.
- 기존 `sharp`와 기본/넘어짐 눈 일부에는 눈썹처럼 보이는 선이 포함된다. 새 눈썹과 겹쳐 이중 눈썹이 되지 않게 해당 선의 역할을 정리한다. 표정 우선순위는 보존한다.
- 몸통은 공통 함수지만 팔은 두 렌더러의 포즈마다 별도다. 몸통만 좁히거나 전체 캐릭터를 축소하지 않는다. 어깨 가까운 소매와 손 사이를 연결하고 손·신발의 기존 기준점은 보존한다.
- 조끼는 흰 소매를 사용한다. 체형을 바꾸어도 옷 색상으로 덮지 않는다. 기존 가방의 색상·종류는 유지하며 끈만 필요한 범위에서 맞춘다.
- 새 torso clipPath를 추가하면 장면의 clip 개수/발 경계 검증 및 ID 의미가 바뀐다. 이 작업은 의복 도형/디테일을 직접 맞추며 새 clip이나 전역 변환을 추가하지 않는다.
- `characterAppearanceArt.test.tsx`는 여성 fixture의 소매를 과거 x좌표로 찾는다. 필요한 좌표를 바꾸면 의미 있는 소매 selector로 갱신하되 색상/손/발 검증을 삭제하지 않는다. 남성 기본 도형을 검증하는 `pursuerAppearance.test.tsx`의 기존 단언은 유지한다.
- SVG DOMParser 결과에는 HTML document의 defaultView가 없어 jest-dom matcher가 실패할 수 있다. 픽셀 단위 테스트는 기존처럼 getAttribute/contains를 사용한다. 실제 RTL 모달 DOM에는 jest-dom을 사용할 수 있다.
- 이전 전체 테스트에서 동시 lint/build와 넓은 DOM 탐색이 시간 초과/후속 실패를 유발했다. UI 쿼리는 dialog 안으로 좁히고 마지막 전체 테스트는 무거운 검증과 겹쳐 실행하지 않는다. timeout/skip/config로 실패를 숨기지 않는다.

## Verification Strategy
- T01: 같은 조건 남녀의 얼굴 실제 도형, 각 성별에서5개 눈 구분, 일반 안경 속 단일 눈, 상황별 임시 눈과 복원, 나이대/머리/피부색 유지. 얼굴 비교 표본은 T03의 종합 표본에서 확인한다.
- T02: 두 나이대×두 성별×옷/포즈의 torso 차이와 팔 접점, 모든 가방의 연결·색상·그리기 순서, 발 y=40/외부 transform/기존 clip 보존. 기존 렌더러와 별도 테스트용 캐릭터를 만들지 않는다.
- T03: 실제 편집에서 gender만 변경하여 선택 보존/즉시 외형 변화를 확인하고, title→stage→infinite 및 두 엔딩으로 전달한다. 계정 응답 rerender가 플레이/카운트다운을 초기화하지 않는 기존 검증을 유지한다.
- 비교 표본에는 같은 조건의 남녀, young/older, 모자·안경 없음과 일반 안경/선글라스, 옷5종, 가방 및 넘어짐/야근을 포함한다. 가능한 브라우저에서320×568/390×844/768×1024/1440×900을 확인한다.
- 이전 Chrome 자동 실행 차단을 우회하지 않는다. 허용된 브라우저 도구가 없으면 기존 정적 SVG 렌더러로 대체하고 실제 모바일·native keyboard·애니메이션 미검증을 명시한다. 정적 렌더링 도구가 사라졌으면 확인 가능한 SVG/DOM 범위를 기록하고 임의의 설치/브라우저 실행으로 대체하지 않는다.
- T03에서 집중 테스트 후 전체 `npm test -- --run --maxWorkers=2`, lint, frontend build를 실행한다. 정확한 테스트 수와 남은 수동 검증을 기록한다. API/저장 경로를 변경하지 않으므로 이번 시각 변경만을 위한 운영 DB/emulator 테스트나 새 저장 테스트는 추가하지 않는다.

## Boundaries and Adjacent Findings
- 구현/테스트 파일 변경은 `/memory-execute`부터 한다. 이번 계획은 .memory 문서만 작성한다.
- 게임 규칙, 점수·랭킹·시간·추격 속도, 인증/API/DB/저장 모델, 꾸미기 선택지/페이지 재설계, 새 애니메이션, 패키지/번들 성능 개선, Git push/배포는 포함하지 않는다.
- 기존 미커밋 `src/game/pixel-theme.css`의 모바일 조작 버튼 간격 변경은 보존하고 각 커밋에서 제외한다. 무관한 untracked 파일도 보존한다.
- 추가 Task가 필요한 새 인접 결함은 발견하지 않았다. 이전 계획에서 미완료로 남긴 실제 모바일/계정/Cosmos 통합 확인은 인계하되 이번 계획에서 Azure 작업으로 확장하지 않는다.

## Progress
- done: 3/3 (구현/자동 검증 완료; 수동 미검증은 아래 기록)
- Active: 없음
- T01 완료 (`8e2f3a8`): 공통 얼굴형·눈썹·속눈썹을 개선했다. 지정4파일246/246(14.41초), lint/build/diff check 통과. 정적28개 얼굴 표본을 확인했고 실제 브라우저/모바일/애니메이션은 미검증이다. 선택 눈5종과 안경/표정/기존 나이대/선택을 보존한다.
- T02 완료 (`34f0944`): 여성 어깨·몸통/옷 디테일과 모든 포즈의 소매·가방끈 연결을 조정했다. 지정8파일362/362(19.50초), 손/백팩 검사 보강 후64/64(6.33초), lint/build/diff check 통과. 픽셀 연결·외곽 이탈0·손 좌표·발 y40/기존 모션을 검증하고 정적64표본을 확인했다. 기존 older 남성 run-b의1px 손-소매 틈도 동일 포즈 연결 범위에서 보완했다.
- T03 완료 (`05356a7`): 실제 편집과 두 모드/모든 엔딩의 gender 전달·다른 선택/진행 보존을 확인했다. 지정498/498, 전체57파일1784/1784(139.43초), lint/build/diff check 통과. 같은 조건 남녀76표본을 원래 크기에 가까운 표시와2배 확대로 비교했고 실제 장면 정적 SVG4개도 확인했다. 본체 전달 누락이 없어 테스트7파일만 보강했다.
- 허용된 브라우저 도구가 없어 실제4개크기 모바일 레이아웃/스크롤/터치/native keyboard/애니메이션은 미검증이다. 이전 Chrome 차단을 우회하지 않았으며 기존 Cosmos/계정 통합 확인은 출시 전 필요하다. 기존 pixel-theme.css 미커밋 변경 및 로컬 http://127.0.0.1:5173/ 데모를 보존했다. push/배포는 수행하지 않았다.
