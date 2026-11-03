# Task: T01 Appearance Contracts

## Status: done

## Goal
도망자·추격자의 외형을 같은 카탈로그와 검증 규칙으로 표현하고, 기존 단계·무한 결과를 병합해도 저장된 외형이 보존되는 공통 계약을 만든다.

## Decision Summary
- React와 Azure SDK에 의존하지 않는 `shared/characterAppearance.ts`를 브라우저와 API가 함께 사용한다.
- 외형은 기존 프로필의 optional 필드다. 기존 외형 미설정 계정과 테스트 fixture를 한 번에 마이그레이션하지 않는다.

## Implementation

### I01. 카탈로그, 스키마, 기본값
- Related Files:
  - `shared/characterAppearance.ts` :: 아래 타입·상수·검증/복사 함수; new
  - `shared/characterAppearance.test.ts` :: 입력 경계·기본값 독립성; new

#### Details
- **Signatures & Types**:
  ```typescript
  export type CharacterRole = "runner" | "pursuer";
  export interface CharacterLook {
    gender: "male" | "female";
    hairStyle: "short" | "side-part" | "bob" | "ponytail";
    hairColor: "black" | "brown" | "gray" | "blond";
    skinTone: "light" | "peach" | "tan" | "deep";
    outfit: "shirt" | "suit" | "cardigan";
    outfitColor: "ivory" | "navy" | "purple" | "teal" | "rose";
    hat: "none" | "straw" | "cap";
    glasses: "none" | "square" | "round";
    shoes: "dress" | "sneakers";
    shoeColor: "black" | "brown" | "white";
  }
  export interface CharacterAppearance {
    version: 1;
    runner: CharacterLook;
    pursuer: CharacterLook;
  }
  export interface AppearanceOption<T extends string> {
    value: T;
    label: string;
    swatch?: string;
  }
  export const APPEARANCE_OPTIONS: {
    readonly [K in keyof CharacterLook]: readonly AppearanceOption<CharacterLook[K]>[];
  };
  export function getDefaultCharacterLook(role: CharacterRole): CharacterLook;
  export function getDefaultCharacterAppearance(): CharacterAppearance;
  export function isCharacterLook(value: unknown): value is CharacterLook;
  export function isCharacterAppearance(value: unknown): value is CharacterAppearance;
  export function cloneCharacterAppearance(value: CharacterAppearance): CharacterAppearance;
  export function resolveCharacterAppearance(value: unknown): CharacterAppearance;
  export function areCharacterAppearancesEqual(a: CharacterAppearance, b: CharacterAppearance): boolean;
  export interface SaveAppearanceRequest { appearance: CharacterAppearance }
  export function isSaveAppearanceRequest(value: unknown): value is SaveAppearanceRequest;
  ```
- **Data & Schema Fields**:
  - 모든 필드가 필수이며 `null`은 허용하지 않는다. `CharacterLook`는 위10개 필드만, `CharacterAppearance`는 `version/runner/pursuer`만, 저장 요청은 `appearance`만 허용한다.
  - `Reflect.ownKeys`로 숨은 추가 필드도 거부한다. 배열·숫자·빈 객체·임의 hex 색상·prototype 속성만으로 필드를 채운 객체를 허용하지 않는다.
  - 카탈로그 순서와 한국어 레이블: gender 남성/여성; hairStyle 짧은 머리/가르마/단발/묶은 머리; hairColor 검정/갈색/회색/금색; skinTone 밝은 피부/살구빛 피부/구릿빛 피부/짙은 피부; outfit 셔츠/정장/카디건; outfitColor 아이보리/남색/보라/청록/장밋빛; hat 없음/밀짚모자/캡 모자; glasses 없음/사각 안경/둥근 안경; shoes 구두/운동화; shoeColor 검정/갈색/흰색.
  - 색상 옵션의 `swatch`: hairColor `#20283e/#6d412c/#52556a/#c79843`; skinTone `#e9b58b/#f5c49a/#c88e60/#86533a`; outfitColor `#e6f2f3/#30466d/#746184/#397f82/#b66a87`; shoeColor `#10182c/#6f4935/#e6ecef`. 다른 옵션에는 swatch를 넣지 않는다.
  - runner 기본값: `male/short/black/peach/shirt/ivory/none/none/dress/black` (위 필드 순서).
  - pursuer 기본값: `male/side-part/gray/light/suit/purple/straw/square/dress/black`.
- **Execution Flow / Logic**:
  1. `is*`는 값의 카탈로그 포함 여부와 정확한 own-key를 확인하고 boolean을 반환한다. 알 수 없는 값을 조용히 유효한 저장 요청으로 바꾸지 않는다.
  2. 기본값과 clone은 항상 새로운 runner/pursuer 객체를 만든다. 두 역할이나 두 계정이 같은 mutable 객체를 공유하지 않는다.
  3. `resolveCharacterAppearance(unknown)`는 유효한 외형의 깊은 복사 또는 기본값을 반환한다. 이 함수는 표시/기존 저장값 복구용이고 서버 요청 검증을 대체하지 않는다.
  4. equality는 version과 두 역할의10필드를 명시적으로 비교한다. JSON 필드 순서에 의존하지 않는다.
  5. 남녀 선택이 머리스타일/옷/소품의 허용 목록을 바꾸거나 다른 필드를 자동 변경하지 않는다.

### I02. 프로필 및 점수 병합 호환
- Related Files:
  - `shared/companyRecords.ts` :: `SharedProfile`, `SaveAppearanceResponse`, `mergeSharedResult`, `mergeSharedInfiniteScore`; modify
  - `shared/companyRecords.test.ts` :: 두 점수 경로의 외형 보존; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // SharedProfile의 기존 accountId/displayName/highestClearedStage/best/infiniteBest 유지
  appearance?: CharacterAppearance;
  export interface SaveAppearanceResponse { profile: SharedProfile }
  ```
- **Data & Schema Fields**: `SharedProfile.appearance`가 없으면 기존 기본 외형이다. 이번 단계에서 필드를 required로 바꾸거나 기존 순위 DTO에 외형을 넣지 않는다.
- **Execution Flow / Logic**:
  1. `mergeSharedResult`는 새 프로필을 명시적으로 구성하므로 previous에 외형이 있는 경우 복사해 반환한다.
  2. `mergeSharedInfiniteScore`의 spread 경로도 같은 필드를 보존하고 입력 previous를 mutate하지 않는다.
  3. 점수가 갱신되지 않는 no-op 경로는 기존 `changed:false` 의미를 유지한다. 외형 기본값을 채우려고 점수 write를 발생시키지 않는다.
  4. identity, 최고 성과 비교, 남은 시간, 해금 단계, timestamp 규칙은 기존 함수를 그대로 따른다.

## Acceptance Criteria
- [x] 두 역할의 모든 카탈로그 옵션을 유효하게 조합하고 부정 입력은 거부한다.
- [x] 기본값/clone/resolve를 수정해도 원본과 다른 역할의 값이 바뀌지 않는다.
- [x] 외형이 있는 프로필에서 단계 결과 갱신·무한 결과 갱신·동점 no-op 모두 외형을 보존한다.
- [x] 외형 없는 기존 프로필과 fixture는 타입 및 기존 동작을 유지한다.

## Validation
- `npm test -- --run shared/characterAppearance.test.ts shared/companyRecords.test.ts --maxWorkers=2` — 입력 경계, 복사 독립성과 두 결과 병합 테스트 통과.
- `npm run lint` — 오류 없음.
- `npm run build` — 타입 검사와 빌드 성공. 기존 bundle 크기 경고는 기록한다.
- `npm --prefix api run build` — 새 shared import가 서버 번들에서도 해석됨.
- 이 Task의 새 테스트는 실제 입력/기록 유실 경계를 검증한다. 옵션 상수 전체를 그대로 복사한 snapshot 테스트로 대체하지 않는다.

## Commit Message
```text
feat(character): define appearance catalog and shared contracts

Plan: 2026-11-03-character-customization
Phase: P01-character-customization
Task: T01-appearance-contracts

- Define independent runner and pursuer looks with validated pixel options
- Preserve optional appearance when merging stage and infinite records
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Validation Results — 2026-11-03
- 지정한 shared 테스트2개 파일205/205 통과(1.95초). 입력 경계, 숨은 추가 필드·상속 필드, 역할/계정 간 복사 독립성, 두 모드 점수 병합 후 외형 보존을 확인했다.
- `npm run lint`: 통과, 오류/경고 없음.
- `npm run build`: 통과. JS635.04kB(gzip174.70kB), CSS88.41kB(gzip15.27kB). 기존500kB 초과 chunk 경고가 있다.
- `npm --prefix api run build`: 통과. 서버 bundle28.5kB.
- 계정 미설정 상태의 optional 필드를 유지했으며, 실제 Cosmos 외형 저장/API 및 화면은 후속 Task에서 연결한다.
- 기존 모바일 버튼 CSS 수정은 보존했다. 추가 범위가 필요한 발견: 특이사항 없음.
