# Decisions: Character Bottoms Customization

- Date: 2026-11-04
- Status: Confirmed
- Feature: character-bottoms-customization
- Previous decisions: [Customization Expansion](./2026-11-04-character-customization-expansion.md), [Gender Visual Distinction](./2026-11-04-character-gender-visual-distinction.md)
- Source: 사용자 요청 “하의도 추가해줘” 및 긴바지·청바지·반바지·치마와 별도 색상 선택인 1번 선택.

## D01. 하의 종류와 독립 색상
- **Chosen by user**: 긴바지, 청바지, 반바지, 치마를 제공하고 하의 색상을 따로 고른다.
- **Rationale**: 기존의 고정 남색 바지를 상의와 독립적으로 꾸밀 수 있게 한다.
- **Implementation defaults**: 첫 하의 색상은 검정·남색·회색·베이지·갈색·흰색 6종으로 제공한다. 이 구체적인 색상 목록은 사용자가 개별 지정한 값이 아닌 구현 기본안이다. 종류를 바꿀 때 선택 색상은 유지한다. 청바지는 선택 색상에 솔기·주머니·밑단 디테일을 더해 긴바지와 구분한다.
- **Inherited behavior**: 도망자/추격자 각각 선택하고 성별과 독립적으로 모든 하의를 사용할 수 있다. 성별·하의 변경으로 다른 13개 외형 선택이나 반대 역할 설정을 초기화하지 않는다.

## D02. 편집 화면과 표시
- **Code-derived design**: 현재 CharacterCustomizationDialog의 `옷`과 `옷 색상`은 상의만 제어한다. 기존 선택은 유지하면서 표시 이름을 `상의`, `상의 색상`으로 명확히 하고 다음에 `하의`, `하의 색상`을 배치한다.
- **Implementation defaults**: 하의 모양은 긴바지의 두 다리, 청바지의 솔기/밑단, 반바지의 짧은 밑단과 노출된 다리, 치마의 연결된 밑단으로 구분한다. 반바지/치마 아래 보이는 다리는 고른 피부색과 연결한다. 치마는 짧은 캐릭터 좌표계에 맞는 무릎 부근 길이로 그리며 신발은 별도 선택을 유지한다.
- **Rationale**: 이름이나 색상만 바꾸는 대신 작은 게임 화면에서도 네 종류가 실제 도형으로 구분되어야 한다.

## D03. 두 역할과 모든 장면
- **Inherited / code-derived**: 꾸미기 미리보기, 타이틀 계단, 단계 모드, 무한 모드, 퇴근·야근 엔딩에 공통 적용한다.
- **Code-derived constraints**: PixelOfficer의 idle/run-a/run-b/stumble과 OvertimeOfficer의 standing/grabbing/dragged/seated에 현재 다리 모양과 색상이 각각 직접 작성되어 있다. 두 렌더러를 함께 연결하고 포즈에 맞는 하의/피부/신발 레이어를 유지해야 한다.
- **Implementation constraints**: 기존 팔/가방/성별 몸통의 연결과 앞뒤 순서를 보존한다. 신발 바닥 y=40, 원본 좌표계와 외부 변환을 유지한다. 캐릭터 전체 크기·계단 간격·카메라·게임 판정은 변경하지 않는다.

## D04. 기본 외형과 과거 데이터 호환
- **Code-derived design**: 현재 version 2는 정확히 13개 필드를 검증하므로 새 두 필드를 필수로만 추가하면 기존 외형을 잘못된 값으로 판정한다. 하의 종류/색상을 포함하는 새 외형 계약 version 3을 사용하고 정확한 기존 version 1·2의 읽기 호환을 유지한다.
- **Implementation defaults**: 새 필드는 `bottoms: "trousers" | "jeans" | "shorts" | "skirt"`, `bottomsColor: "black" | "navy" | "gray" | "beige" | "brown" | "white"`로 한다. 기존 외형에는 `trousers`·`navy`만 보완하고 원래 선택을 모두 유지한다. 기본 남색 긴바지는 기존 다리의 `#2c3b59`/`#354766` 계열을 유지한다.
- **Implementation constraints**: 고정된 과거 계약을 별도로 보존하고 정규화·복사·동등 비교·실제 HTTP 프로필/저장 경계를 함께 갱신한다. 읽기만으로 DB를 갱신하지 않는다. 명시적 외형 저장과 실제 점수 쓰기는 최신 계약을 사용하되 점수 무변경 no-op는 불필요하게 쓰지 않는다. 잘못된 새 데이터는 엄격히 검증한다.

## D05. 저장 방식과 출시
- **Inherited**: 회사 계정은 기존 Cosmos DB `stair-climb/players`의 계정별 문서에 자동 저장한다. 로컬 데모는 접속 중 메모리에만 유지한다. 새 DB·컨테이너·인덱스는 추가하지 않는다.
- **Code-derived constraints**: 현재 400ms 자동 저장, ETag 조건부 쓰기, 점수/외형 쓰기 직렬화, 저장 실패·재시도, 지연 응답에 대한 선택 보존을 재사용한다. 점수/단계 해금/두 모드 랭킹을 그대로 보존한다.
- **Release boundary**: 프런트엔드와 API를 같은 외형 계약으로 함께 배포해야 한다. 배포 후 기존 탭은 새로고침한다. 이 인터뷰 자체는 커밋·push·배포를 수행하지 않는다.

## D06. 검증 방향
- **Implementation defaults**: 네 종류/여섯 색상/두 역할/성별/각 포즈에서 실제 하의 도형·색상·피부 노출·신발 바닥을 확인한다. 상의·가방·부츠 조합의 가림, 선택 왕복과 반대 역할 보존, 기존 version 1·2 복원, version 3 저장/재조회, 점수 저장 시 외형 보존을 검증한다.
- **Environment constraints**: 이전 Chrome 실행 차단을 우회하지 않는다. 허용된 브라우저 도구가 없으면 정적 SVG/DOM 검증과 실제 모바일·키보드·애니메이션 수동 미검증을 구분해 기록한다. Cosmos emulator와 운영 계정 확인도 구분한다. 운영 기록을 테스트용으로 수정하지 않는다.

## D07. 다음 작업 경계
- **Workflow**: 이 단계는 결정문 저장으로 종료한다. 다음 명령은 `/memory-plan character-bottoms-customization`이며 계획 작성 후 Active Task를 순서대로 실행한다.
- **Scope**: 구현 코드·테스트 변경·실행·커밋·push·배포는 하지 않는다. 새 계획을 작성하기 전에 완료된 current.md의 포인터를 변경하지 않는다.

## Codebase Notes
- `shared/expandedCharacterAppearance.ts`, `shared/legacyCharacterAppearance.ts`, `shared/characterAppearance.ts`: 기존 계약 보존과 최신 계약 재노출/정규화가 필요하다.
- `src/character/CharacterCustomizationDialog.tsx`: 기존 13개 그룹에 하의 종류/색상 그룹을 더하고 상의 라벨을 명확히 한다.
- `src/game/pixel/PixelOfficer.tsx`, `OvertimeOfficer.tsx`, `officerPalette.ts`: 직접 작성된 다리 도형/색상을 공통 하의 표현과 연결한다. 기존 공통 OfficerShoeArt는 유지한다.
- `src/company/recordApi.ts`, `api/src/playerRepository.ts`: 과거 외형 읽기와 최신 계약 쓰기 및 점수 저장의 외형 보존을 함께 확인한다.

## 요청 밖의 발견 사항
- 별도 범위로 정해야 하는 결함은 발견하지 않았다. 포즈별 하의 연결과 기존 저장 데이터의 버전 호환은 이번 기능에 직접 필요한 작업이다.
- 2026-11-04 직전 배포는 CI/실제 Cosmos emulator 검증을 통과했다. 이번 기능의 구현 후 검증 결과로 대신 간주하지 않는다.
