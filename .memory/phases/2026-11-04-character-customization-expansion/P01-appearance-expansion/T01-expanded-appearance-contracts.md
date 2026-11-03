# Task: T01 Expanded Appearance Contracts

## Status: done

## Goal
기존 version 1 외형을 손실 없이 version 2로 읽을 수 있는 엄격한 계약·카탈로그·정규화 함수를 준비한다. 이 Task에서는 현재 API/UI가 사용하는 public 계약을 version 1로 유지하여 다음 렌더러 Task 전에도 기존 동작과 타입 검증이 성립하게 한다.

## Decision Summary
- 확장 필드는 eyeStyle/bag/bagColor이며 새 저장 형식은 version 2다. 정상 version 1 데이터는 기존 10필드를 보존하고 새 3필드만 기본값으로 보완한다.
- 과거 validator와 카탈로그를 고정한 모듈과 최신 계약 모듈을 분리한다. 임의의 부분 객체를 정상 외형으로 보정하지 않는다. 계획: 2026-11-04-character-customization-expansion, Phase P01-appearance-expansion.

## Implementation

### I01. 과거 계약의 고정과 현재 public export 유지
- Related Files:
  - `shared/characterAppearance.ts` :: 현재 모든 export — public 진입점; modify
  - `shared/legacyCharacterAppearance.ts` :: 기존 전체 계약·함수·고정 카탈로그; new
  - `shared/characterAppearance.test.ts` :: 현재 version 1의 public 회귀; read-only
  - `shared/companyRecords.ts` :: 기존 public 계약 소비자; read-only

#### Details
- **Signatures & Types**:
  - 현재 characterAppearance.ts 본문을 legacyCharacterAppearance.ts로 그대로 옮긴다. 이 파일의 기존 이름을 유지한다: CharacterRole, CharacterLook, CharacterAppearance, AppearanceOption, APPEARANCE_OPTIONS, getDefaultCharacterLook, getDefaultCharacterAppearance, isCharacterLook, isCharacterAppearance, cloneCharacterAppearance, resolveCharacterAppearance, areCharacterAppearancesEqual, SaveAppearanceRequest, isSaveAppearanceRequest.
  - characterAppearance.ts는 이 Task 종료 시 `export * from "./legacyCharacterAppearance";`만 제공하는 진입점으로 만든다. T03에서 이 진입점의 대상만 최신 모듈로 전환한다.
- **Data & Schema Fields**:
  - Legacy CharacterAppearance: version:1, runner/pursuer:Legacy CharacterLook.
  - Legacy CharacterLook 정확히10필드: gender male/female; hairStyle short/side-part/bob/ponytail; hairColor black/brown/gray/blond; skinTone light/peach/tan/deep; outfit shirt/suit/cardigan; outfitColor ivory/navy/purple/teal/rose; hat none/straw/cap; glasses none/square/round; shoes dress/sneakers; shoeColor black/brown/white.
  - 과거 카탈로그를 미래 옵션으로 확장하지 않는다. unknown key, Symbol key, 필드 누락과 잘못된 enum을 거부하는 기존 의미도 그대로 보존한다.
- **Execution Flow / Logic**:
  1. 기존 API/UI/test import 경로가 모두 기존 public 진입점을 통해 동일한 version 1 구현을 받도록 한다.
  2. 기존 source/test의 version literal, 옵션 개수, API 계약은 이번 Task에서 수정하지 않는다.
  3. 새 모듈은 이 legacy 모듈을 직접 import한다. public 진입점을 역참조하지 않아 T03 전환 뒤 순환 import가 생기지 않게 한다.

### I02. version 2 계약과 확장 카탈로그
- Related Files:
  - `shared/expandedCharacterAppearance.ts` :: 최신 타입·카탈로그·기본값·validator; new

#### Details
- **Signatures & Types**:
  ```typescript
  // CharacterRole, AppearanceOption<T>는 legacy 모듈에서 type re-export한다.
  export interface CharacterLook {
    gender: "male" | "female";
    hairStyle: "short" | "side-part" | "bob" | "ponytail" | "long" | "curly";
    hairColor: "black" | "brown" | "gray" | "blond" | "blue" | "pink";
    skinTone: "light" | "peach" | "tan" | "deep";
    outfit: "shirt" | "suit" | "cardigan" | "hoodie" | "vest";
    outfitColor: "ivory" | "navy" | "purple" | "teal" | "rose" | "black" | "sky" | "orange" | "beige";
    hat: "none" | "straw" | "cap" | "beanie" | "beret";
    glasses: "none" | "square" | "round" | "sunglasses";
    shoes: "dress" | "sneakers" | "boots";
    shoeColor: "black" | "brown" | "white" | "navy" | "red" | "beige";
    eyeStyle: "default" | "round" | "smile" | "sleepy" | "sharp";
    bag: "none" | "backpack" | "laptop" | "crossbody" | "briefcase";
    bagColor: "black" | "brown" | "navy" | "beige";
  }
  export interface CharacterAppearance { version: 2; runner: CharacterLook; pursuer: CharacterLook }
  export const APPEARANCE_OPTIONS: {
    readonly [K in keyof CharacterLook]: readonly AppearanceOption<CharacterLook[K]>[];
  };
  export function getDefaultCharacterLook(role: CharacterRole): CharacterLook;
  export function getDefaultCharacterAppearance(): CharacterAppearance;
  export function isCharacterLook(value: unknown): value is CharacterLook;
  export function isCharacterAppearance(value: unknown): value is CharacterAppearance;
  export function cloneCharacterAppearance(value: CharacterAppearance): CharacterAppearance;
  export function areCharacterAppearancesEqual(a: CharacterAppearance, b: CharacterAppearance): boolean;
  export interface SaveAppearanceRequest { appearance: CharacterAppearance }
  export function isSaveAppearanceRequest(value: unknown): value is SaveAppearanceRequest;
  ```
- **Data & Schema Fields**:
  - 13필드는 전부 필수이며 null을 허용하지 않는다. 선택하지 않는 모자/안경/가방은 문자열 none으로 표현한다.
  - 두 역할의 기존 10필드 기본값은 legacy.getDefaultCharacterLook(role)을 복사한다. eyeStyle=default, bag=none, bagColor=black을 더한다. appearance.version은 항상2다. 호출마다 runner와 pursuer, 반환 전체 객체는 서로 독립적인 새 객체다.
  - 기존 APPEARANCE_OPTIONS의 label/swatch를 유지하고 새 선택지를 뒤에 추가한다. 다음이 정확한 추가 카탈로그다:

  | Field | value → label | swatch |
  | :--- | :--- | :--- |
  | hairStyle | long → 장발, curly → 곱슬머리 | 없음 |
  | hairColor | blue → 파랑, pink → 분홍 | #386da8, #b96391 |
  | outfit | hoodie → 후드티, vest → 조끼 | 없음 |
  | outfitColor | black → 검정, sky → 하늘색, orange → 주황, beige → 베이지 | #283247, #76b6d2, #d58b43, #c8b38b |
  | hat | beanie → 비니, beret → 베레모 | 없음 |
  | glasses | sunglasses → 선글라스 | 없음 |
  | shoes | boots → 부츠 | 없음 |
  | shoeColor | navy → 남색, red → 빨강, beige → 베이지 | #2a4168, #ab4f5f, #c5b38a |
  | eyeStyle | default → 기본, round → 동그란 눈, smile → 웃는 눈, sleepy → 졸린 눈, sharp → 날카로운 눈 | 없음 |
  | bag | none → 없음, backpack → 백팩, laptop → 노트북 가방, crossbody → 크로스백, briefcase → 서류가방 | 없음 |
  | bagColor | black → 검정, brown → 갈색, navy → 남색, beige → 베이지 | #263247, #785039, #30466d, #c8b38b |

- **Execution Flow / Logic**:
  1. legacy 모듈의 카탈로그와 타입을 직접 import하고 새 배열/객체를 만든다. 기존 옵션 객체를 재사용해도 되지만 과거 배열에는 push하거나 새 필드를 붙이지 않는다.
  2. 옵션 객체, 각 배열, 카탈로그를 runtime에서 모두 freeze한다. readonly 타입만으로 보호했다고 가정하지 않는다.
  3. LOOK_FIELDS는 정확히13필드이며 key 검사는 기존처럼 Reflect.ownKeys 기반으로 한다. 객체 아닌 값/배열, 누락/추가 필드, inherited-only 필드, 알 수 없는 문자열과 임의 hex 색상을 거부한다.
  4. 최신 isCharacterAppearance는 version===2와 정확한 부모3필드, 두 최신 look을 요구한다. version 1을 true로 반환하지 않는다.
  5. 최신 clone/equality는 13필드 전체와 version을 다룬다. JSON key 순서에 의존하지 않으며 eyeStyle/bag/bagColor 차이도 구분한다.
  6. 저장 요청은 정확히 appearance 한 필드와 유효한 version 2만 허용한다. 읽기 fallback 함수를 저장 요청 검증에 사용하지 않는다.

### I03. 과거 입력의 정규화와 화면 전용 fallback
- Related Files:
  - `shared/expandedCharacterAppearance.ts` :: normalizeCharacterLook, normalizeCharacterAppearance, resolveCharacterLook, resolveCharacterAppearance; new
  - `shared/expandedCharacterAppearance.test.ts` :: version 2 경계와 과거 호환; new

#### Details
- **Signatures & Types**:
  ```typescript
  export function normalizeCharacterLook(value: unknown): CharacterLook | null;
  export function normalizeCharacterAppearance(value: unknown): CharacterAppearance | null;
  export function resolveCharacterLook(value: unknown, role: CharacterRole): CharacterLook;
  export function resolveCharacterAppearance(value: unknown): CharacterAppearance;
  ```
- **Execution Flow / Logic**:
  1. normalizeCharacterLook: 유효한 최신 look이면 새 객체로 복사한다. 아니면 엄격한 legacy.isCharacterLook을 통과한 경우에만 기존10필드를 복사하고 새3필드를 기본값으로 더한다. 그 외에는 null이다.
  2. normalizeCharacterAppearance: 엄격한 최신 전체 객체가 유효하면 깊은 복사한다. 아니면 엄격한 legacy 전체 객체가 유효한 경우에만 version2+두 정규화 look을 만든다. `{version:2, runner:legacyLook, ...}` 같은 불완전한 version2를 version1처럼 보정하지 않는다.
  3. normalize는 입력을 수정하거나 freeze하지 않으며 입력의 참조를 결과에 남기지 않는다. 두 역할 중 하나라도 잘못된 경우 전체 appearance 정규화는 null이다.
  4. resolveCharacterLook은 normalize 결과 또는 해당 역할의 새 기본값을 반환한다. resolveCharacterAppearance는 normalize 결과 또는 전체 기본값이다. 둘 다 화면 표시용이며 저장소/API가 유효하지 않은 값을 성공으로 바꾸는 데 쓰지 않는다.
- **Tests**:
  - 순수 계약 테스트 파일에는 기존 계약 테스트와 같이 `// @vitest-environment node`를 사용한다. DOM이 필요하지 않은 검증이다.
  - 각 카탈로그 항목의 양 역할/성별 허용, 새3필드의 정확한 기본값, freeze, 기본값과 clone의 참조 분리.
  - version1에서 각 역할의 10필드를 모두 기본값과 다르게 만든 fixture를 JSON 왕복 후 normalize하여 전부 보존되는지 확인한다. version1 입력에 새 스타일 ID를 끼운 경우는 거부한다.
  - version2 완성 객체·정상 version1·누락·손상·추가 key·Symbol·미래 version3·부모version과 look필드 불일치를 구분한다.
  - 부분 version2의 신규 필드 누락을 임의 기본값으로 치유하지 않는다. 유효하지 않은 version2는 저장 입력 false, normalize null, 표시 resolve만 defaults다.
  - 기존 public import는 여전히version1이며 legacy카탈로그가 확장되지 않았음을 확인한다.

## Acceptance Criteria
- [x] 최신13필드/모든 새 선택지가 유효한 version2로 엄격히 검증된다.
- [x] 정상 version1은 10필드를 보존하여 독립적인 version2 객체로 정규화된다.
- [x] 잘못된 입력·부분version2를 저장 성공으로 바꾸지 않는다.
- [x] 현재 public version1 API/UI·기존 테스트의 동작과 타입이 유지된다.

## Validation
- `npm test -- --run shared/expandedCharacterAppearance.test.ts shared/characterAppearance.test.ts shared/companyRecords.test.ts --maxWorkers=2` — 새 계약/과거 계약/점수 병합 통과.
- `npm --prefix api test` — 현재 API version1 회귀 통과.
- `npm run lint` — 오류 없음.
- `npm run build` 및 `npm --prefix api run build` — 타입/번들 성공.
- `git diff --check` — 공백 오류 없음. 기존 pixel-theme.css 변경과 무관한 untracked 파일은 스테이징하지 않는다.

## Commit Message
```text
feat(character): prepare expanded appearance contract and legacy normalization

Plan: 2026-11-04-character-customization-expansion
Phase: P01-appearance-expansion
Task: T01-expanded-appearance-contracts

- Preserve the original appearance schema behind the current public exports
- Add strict version two catalogs and lossless legacy normalization
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: pending

## Validation Results — 2026-11-04
- 지정한 shared3파일257/257 통과(2.43초). 새13필드/카탈로그, 과거10필드 전체보존, 부분version2 거부, 정확한 key검사, 참조분리와 public version1 유지까지 검증했다.
- 기존 API4파일186/186 통과(4.46초). npm run lint, npm run build, npm --prefix api run build, git diff --check 통과.
- legacyCharacterAppearance.ts는 이동 전 Git blob과 해시가 동일하여 기존 계약 본문을 그대로 보존했음을 확인했다. 기존 shared/characterAppearance.test.ts와 shared/companyRecords.ts를 수정하지 않았다.
- 새 정규화/복사는 이미 검증된 알려진 필드를 명시적으로 복사하여, 유효한 필드가 비열거 속성으로 주어져도 누락하지 않는다. 입력은 수정하거나 freeze하지 않으며 표시 fallback과 저장용 strict validation을 분리했다.
- 빌드: JS647.11kB(gzip178.64kB), CSS92.97kB(gzip15.88kB). 기존500kB chunk 경고 유지. 새 계약은 아직 public UI/API에 활성화하지 않았다.
- 이 Task는 순수 공통 계약 준비다. 실제 픽셀/UI/계정 마이그레이션 연결과 브라우저 확인은 후속Task에서 수행한다. 이번 Task에서 운영 Cosmos/계정은 수정하지 않았고 emulator 통합 테스트도 실행하지 않았다.
- 기존 미커밋 src/game/pixel-theme.css와 무관한 untracked 파일은 보존했다. 추가 범위가 필요한 발견: 특이사항 없음.
