# Decisions: Character Gender Visual Distinction

- Date: 2026-11-04
- Status: Confirmed
- Feature: character-gender-visual-distinction
- Previous decision: [Character Customization Expansion](./2026-11-04-character-customization-expansion.md)
- Source: 남성에서 여성으로 바꿔도 차이가 작다는 사용자 피드백과 얼굴·체형을 함께 구분하는 1번 선택.

## D01. 얼굴과 체형을 함께 구분
- **Chosen by user**: 얼굴형·턱선·눈썹·속눈썹과 어깨·몸통 윤곽을 함께 조정하여 성별 전환의 시각적인 차이를 강화한다.
- **Rationale**: 같은 머리·옷·눈을 선택한 상태에서도 작은 게임 캐릭터의 외형 변화가 눈에 보여야 한다. 사용자는 얼굴만 바꾸는 안보다 얼굴과 체형을 함께 바꾸는 추천안을 선택했다.
- **Implementation defaults**: 현재 픽셀아트와 회사원 분위기를 유지한다. 남성 표현은 상대적으로 각진 턱과 분명한 눈썹·어깨선, 여성 표현은 둥글게 좁아지는 턱과 가는 눈썹·짧은 속눈썹 및 상대적으로 좁은 어깨·정돈된 몸통 윤곽으로 구분한다. 구체적인 픽셀 좌표와 색상은 구현 시 비교 표본을 보고 조정하는 기본안이며 사용자가 개별 지정한 값은 아니다. 캐릭터가 작아도 읽히게 하되 과장된 신체 표현이나 색상만으로 구분하지 않는다.

## D02. 선택한 꾸미기와 나이대 보존
- **Chosen by user / inherited**: 선택한 머리·옷·소품과 기존 나이대는 유지한다. 성별 선택이 다른 부위의 선택을 초기화하지 않는 기존 규칙을 따른다.
- **Code-derived design**: 도망자와 추격자는 각각 young/older 역할을 사용하고 gender는 별도의 외형 필드다. 여성으로 바꾸더라도 추격자의 나이 든 얼굴 특징은 남기며, 남성으로 바꾸어도 선택한 장발·가방 등이 그대로 남는다.
- **Implementation defaults**: 머리·피부색·옷 종류/색상·모자·안경·눈 모양·신발·가방 종류/색상을 임의로 바꾸지 않는다. 기존 옷 종류를 유지하며 해당 옷의 어깨·몸통 외곽선을 조정한다. 새 의상 종류나 별도의 체형 선택 UI는 추가하지 않는다.

## D03. 눈 모양과 안경·표정의 조합
- **Code-derived design**: 현재 기본 눈 일부만 성별을 반영하고 round/smile/sleepy/sharp 및 일반 안경 속 기본 눈은 성별 차이가 거의 없다. 공통 OfficerEyeArt/OfficerHeadArt에서 눈썹·속눈썹 등을 연결하여 선택한 눈 모양을 바꾸지 않고 특징을 더한다.
- **Rationale**: 현재의 눈 5종 선택을 무시하거나 기본 눈으로 덮어쓰면 꾸미기 기능이 후퇴한다. 눈 주변 장식과 선택한 눈 도형은 구분해서 유지한다.
- **Implementation defaults**: normal에서는 선택 눈 5종을 유지하고 stumble/weary의 놀람·지침 표정도 유지한다. 안경 렌즈 위에 중복 눈을 그리지 않는다. 선글라스는 기존처럼 눈을 가릴 수 있으며 이때도 턱선과 몸통 차이로 구분한다. 표정 변화는 저장된 gender/eyeStyle을 수정하지 않는다.

## D04. 두 역할과 모든 장면에 동일 적용
- **Inherited / code-derived**: 공통 픽셀 렌더러를 사용하여 꾸미기 미리보기, 타이틀 배경, 단계 모드, 무한 모드, 퇴근 및 야근 엔딩에 함께 적용한다.
- **Rationale**: PixelOfficer와 OvertimeOfficer가 OfficerHeadArt/OfficerOutfitArt를 공유하지만 팔·다리는 각 렌더러의 포즈별 도형이다. 머리·몸통만 바꾸어 팔이 떨어져 보이거나 특정 엔딩에서 다른 체형이 되지 않도록 함께 확인해야 한다.
- **Implementation defaults**: idle/run-a/run-b/stumble 및 standing/grabbing/dragged/seated의 연결을 검증한다. 어깨/몸통을 조정할 때 팔과 옷이 맞닿고 기존 가방끈·가방이 자연스럽게 놓이도록 조정한다. 새로운 팔다리 애니메이션이나 게임 화면 재설계는 포함하지 않는다.

## D05. 착지와 저장 계약 유지
- **Code-derived design**: 저장된 gender 값을 그리는 방식만 바꾸므로 CharacterAppearance version 2 및 기존13개 필드, API 계약, Cosmos 문서/DB/컨테이너/인덱스 변경은 필요 없다. 이미 저장된 남성·여성 선택은 새 렌더러로 표시한다.
- **Rationale**: 얼굴형이나 체형을 새 저장 필드로 추가하는 요청이 아니다. 기존 자동 저장·정규화·계정별 분리와 로컬 세션 메모리를 재사용한다.
- **Implementation constraints**: 원본32×40 좌표계, 신발 바닥 y=40, 외부 translate/scale과 발 clip, 계단·카메라·점수·시간·추격 판정은 유지한다. 캐릭터 전체 크기를 줄이거나 확대하는 방식으로 차이를 대신하지 않는다. 외형만 변경하며 게임 규칙·랭킹은 변경하지 않는다.

## D06. 검증 방향과 환경 제약
- **Implementation defaults**: 같은 나이대·머리·옷·눈·소품에서 gender만 바꾼 비교 표본으로 차이를 확인한다. young/older 두 역할, 눈5종과 안경, 옷5종, 가방 및 정상/상황별 표정·포즈를 포함한다. 실제 도형·색상·발 기준과 선택 보존을 검증하며 클래스 이름만으로 차이를 판단하지 않는다.
- **Code-derived constraints**: 이전 작업에서 Chrome 자동 실행이 자동 승인 검토에 의해 blocked by policy로 차단되었다. 허용된 브라우저 도구가 없다면 같은 실행을 우회 재시도하지 않고 기존 TEMP 정적 SVG 렌더러와 DOM 테스트로 확인한다. 정적 표본을 실제 브라우저 애니메이션/모바일 검증이라고 기록하지 않는다.
- **Validation boundary**: 운영 계정이나 Cosmos 기록을 테스트 목적으로 수정하지 않는다. 실제 브라우저·모바일/실제 계정 검증 여부와 정적 비교 범위를 후속 Task에 명시한다.

## D07. 다음 작업 경계
- **Workflow**: 이번 인터뷰는 결정문 저장으로 종료한다. 다음 명령은 `/memory-plan character-gender-visual-distinction`이다. 계획 작성 후 Active Task를 순차 실행한다.
- **Scope**: 이 단계에서는 구현 코드·테스트·Git 커밋·push·배포를 수행하지 않는다. 새 계획을 작성하기 전에는 완료된 character-customization-expansion 계획과 current.md 포인터를 바꾸지 않는다.
- **Existing pending change**: src/game/pixel-theme.css의 기존 미커밋 모바일 조작 버튼 간격 변경을 보존한다.

## Codebase Notes
- src/game/pixel/OfficerAppearanceParts.tsx: 현재 얼굴 윤곽과 일부 기본 눈에만 gender 분기가 있고, 옷/몸통 도형에는 gender 분기가 없다. 공통 얼굴/눈/옷 도형을 개선하는 중심 경로다.
- src/game/pixel/PixelOfficer.tsx 및 OvertimeOfficer.tsx: 팔·다리와 포즈별 도형, 가방 레이어를 공유 부위와 맞춰 확인한다.
- src/character/CharacterCustomizationDialog.tsx: 성별 변경은 현재 전체 외형을 복사한 뒤 해당 역할의 gender만 갱신한다. 이 선택 보존 동작을 유지한다.

## 요청 밖의 발견 사항
- 추가 범위를 정해야 하는 별도 결함은 발견하지 않았다. 선택 눈/안경의 성별 차이와 포즈별 어깨 연결은 이번 외형 개선에 직접 필요한 확인 사항이다.
- 이전 계획의 실제 모바일 브라우저 및 Cosmos emulator/운영 계정 검증은 여전히 배포 전후 확인 대상으로 남아 있다. 이번 인터뷰에서 배포나 저장소 변경 범위로 추가하지 않는다.
