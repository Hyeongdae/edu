# Task: T01 Bottoms Appearance Contract

## Status: done

## Goal
기존 v1/v2의 모든 외형 선택을 보존하는 독립적인 v3 타입·카탈로그·검증·정규화를 준비한다. public/API/UI는 아직 v2로 유지하여 이 Task만으로 타입 검사와 기존 동작이 통과하게 한다.

## Decision Summary
- 새 필드는 bottoms/bottomsColor이며 하의4종/색6종을 독립적으로 선택한다. 과거 정상 외형에만 긴바지/남색을 보완한다.
- 계획2026-11-04-character-bottoms-customization, Phase P01-bottoms-customization. `expandedCharacterAppearance.ts`는 고정 v2로 보존하고 새 v3 모듈을 추가한다.

## Implementation

### I01. 독립 계약과 카탈로그
- Related Files:
  - `shared/bottomsCharacterAppearance.ts` :: 모든 v3 export — new.
  - `shared/expandedCharacterAppearance.ts` :: 고정 v2 타입/카탈로그/검증/정규화 — read-only.
  - `shared/legacyCharacterAppearance.ts` :: 고정 v1 — read-only.
  - `shared/characterAppearance.ts` :: public v2 export — read-only; T03까지 전환 금지.

#### Details
- **Signatures & Types**:
  ```typescript
  // AppearanceOption<T>, CharacterRole은 기존 고정 모듈에서 type re-export한다.
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
    bottoms: "trousers" | "jeans" | "shorts" | "skirt";
    bottomsColor: "black" | "navy" | "gray" | "beige" | "brown" | "white";
  }
  export interface CharacterAppearance { version: 3; runner: CharacterLook; pursuer: CharacterLook }
  export const APPEARANCE_OPTIONS: {
    readonly [K in keyof CharacterLook]: readonly AppearanceOption<CharacterLook[K]>[];
  };
  export function getDefaultCharacterLook(role: CharacterRole): CharacterLook;
  export function getDefaultCharacterAppearance(): CharacterAppearance;
  export function isCharacterLook(value: unknown): value is CharacterLook;
  export function isCharacterAppearance(value: unknown): value is CharacterAppearance;
  export function normalizeCharacterLook(value: unknown): CharacterLook | null;
  export function normalizeCharacterAppearance(value: unknown): CharacterAppearance | null;
  export function resolveCharacterLook(value: unknown, role: CharacterRole): CharacterLook;
  export function resolveCharacterAppearance(value: unknown): CharacterAppearance;
  export function cloneCharacterAppearance(value: CharacterAppearance): CharacterAppearance;
  export function areCharacterAppearancesEqual(a: CharacterAppearance, b: CharacterAppearance): boolean;
  export interface SaveAppearanceRequest { appearance: CharacterAppearance }
  export function isSaveAppearanceRequest(value: unknown): value is SaveAppearanceRequest;
  ```
- **Data & Schema Fields**:
  - 15개 필드는 전부 필수 문자열 ID이며 null을 허용하지 않는다. none은 기존 모자/안경/가방에만 사용하고 하의에 none을 추가하지 않는다.
  - 기존 13개 항목의 카탈로그/label/swatch는 v2에서 재사용하고 변경하지 않는다. bottoms 순서는 trousers→긴바지, jeans→청바지, shorts→반바지, skirt→치마다.
  - bottomsColor 순서는 black→검정/#283247, navy→남색/#354766, gray→회색/#788394, beige→베이지/#c8b38b, brown→갈색/#785039, white→흰색/#e6edf2다.
  - 두 역할 기본값은 v2.getDefaultCharacterLook(role)에 bottoms=trousers, bottomsColor=navy만 더한다. getDefaultCharacterAppearance는 새 객체 두 개와 version3을 반환한다.
- **Execution Flow / Logic**:
  1. LOOK_FIELDS의 정확한 15개 키를 선언하고 `Reflect.ownKeys`로 Symbol/non-enumerable를 포함해 여분/누락을 거부한다. envelope는 version/runner/pursuer, request는 appearance 한 필드만 허용한다. enum은 고정 카탈로그 ID만 허용하며 색상 hex를 입력으로 받지 않는다.
  2. 카탈로그의 옵션 객체/배열/바깥 객체를 freeze한다. v2 카탈로그를 변이하지 않는다. 함수 내부에서 public characterAppearance를 역참조해 순환 import를 만들지 않는다.
  3. normalizeCharacterLook는 정확한 v3 look를 복사하고, 아니면 v2.normalizeCharacterLook로 정확한 v1 또는 v2 look인지 확인한 뒤 두 필드만 보완한다. 하의 두 필드 중 하나만 있는14필드/알 수 없는 필드/혼합 look는 null이다. look 자체에는 버전 필드가 없으므로 정확한13필드 객체는 정상 v2 look로 인정한다. 양쪽 하의 필드가 없는 version3 envelope까지 인정한다는 뜻은 아니다.
  4. normalizeCharacterAppearance는 정확한 v3 envelope면 복사한다. 아니면 v2.normalizeCharacterAppearance로 정확한 과거 envelope를 확인하고 원래 선택을 모두 복사해 version3을 만든다. version3이라고 선언했으나 13필드인 envelope를 과거 데이터로 복구하지 않는다.
  5. resolve*는 표시 전용으로 normalize 실패 시 역할별 기본값을 반환한다. 저장 검증은 resolve*를 사용하지 않는다. clone은 두 역할과 전체 envelope를 깊이 독립 복사하고 입력의 참조를 보존하지 않는다. equal은 version과 15개 필드를 비교하며 JSON 키 순서에 영향받지 않는다.
  6. invalid input은 false/null로 반환한다. 정상 v1/v2를 strict v3 isCharacterAppearance/isSaveAppearanceRequest가 true로 통과시키지는 않는다. 읽기 호환과 쓰기 검증을 구분한다.

### I02. 계약/과거 데이터 회귀 검증
- Related Files:
  - `shared/bottomsCharacterAppearance.test.ts` :: v3 전체 계약·과거 변환 — new.
  - `shared/expandedCharacterAppearance.test.ts`, `shared/characterAppearance.test.ts` :: 고정 v2 및 아직 v2 public 회귀 — read-only.

#### Details
- 15개 그룹/옵션 개수(2,6,6,4,5,9,5,4,3,6,5,5,4,4,6), 고정 v2의13개 그룹과 public v2 유지, 모든 역할/성별에서 하의/색상 전체 허용을 검증한다.
- 정상 v1의 원래10선택, v2의 원래13선택을 비기본값으로 채워 변환 전후 비교한다. 새 fields만 보완되는지, 원본 변이/공유 참조가 없는지 확인한다. JSON 왕복/키 재배열도 검사한다.
- 잘못된 version(0/4/string3/null), envelope 누락, 역할별 혼합버전, 하의/색상 누락·null·unknown ID·추가 문자열/Symbol 키를 strict v3 validator가 거부한다. 표시 정규화는 정확한 과거 look만 인정하며14필드 객체는 거부하고, version3 envelope의 누락은 정상화하지 않는다.
- 색상만/하의만 변경했을 때 equal=false, clone의 하의 변경이 원본/반대 역할에 영향 없음, default 호출 간 격리 및 freeze를 검사한다.

## Acceptance Criteria
- [x] 별도 v3 계약에 15개 필드/하의4/색6이 있고 strict 저장과 과거 읽기 정규화가 분리된다.
- [x] 과거 모든 선택을 보존하고 기본 하의 두 필드만 더한다. 잘못된 최신 데이터를 복구하지 않는다.
- [x] 고정 v1/v2와 public v2, API/렌더러/UI는 그대로다. T01 단독 검증이 통과한다.

## Validation
- `npm run test -- --run shared/bottomsCharacterAppearance.test.ts shared/expandedCharacterAppearance.test.ts shared/characterAppearance.test.ts shared/companyRecords.test.ts --maxWorkers=2` — 신규/기존 계약 모두 통과.
- `npm run lint` — 통과.
- `npm run build` 및 `npm --prefix api run build` — public v2를 유지한 상태에서 타입/빌드 통과. 기존 chunk 용량 경고와 신규 오류를 구분한다.
- `git diff --check` — 통과. 고정 v1/v2/public 파일에 의도치 않은 변경 없음.

## Commit Message
```text
feat(character): define backward compatible bottoms appearance contract

Plan: 2026-11-04-character-bottoms-customization
Phase: P01-bottoms-customization
Task: T01-bottoms-appearance-contract

- Add strict version-three bottoms and color catalog
- Preserve version-one and version-two choices without activating the new public contract
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `2d6b996`

## Execution Result — 2026-11-04
- `shared/bottomsCharacterAppearance.ts`와 테스트만 추가했다. 고정 v1/v2, public export, API/DB/그림/편집 화면은 변경하지 않았다.
- 최신15필드, 하의4종·6색의 고정 카탈로그, 엄격한 저장 검증과 표시 전용 정규화/기본값을 분리했다. 정상 v1/v2는 원래 선택을 보존해 읽고 하의 기본값만 보완한다. 기존 v1의 눈/가방 기본값은 고정 v2 정규화를 재사용한다.
- 필수 키의 non-enumerable 선택을 명시적 복사로 보존하며 여분 Symbol/숨겨진 키/상속으로만 제공된 필드는 거부한다. 정확한13필드 standalone look는 과거 데이터로 인정하지만 하의가 빠진 version3 envelope와14필드 look는 거부한다.
- 지정4파일 테스트328/328, 실패/skip 없음,3.65초. 린트/프런트엔드·API 타입 검사와 빌드/diff check 통과.
- 프런트엔드 JS663.62kB(gzip182.84kB)/CSS92.97kB(gzip15.88kB), 기존500kB chunk 경고 유지. API bundle36.4kB. 아직 public v2이므로 이번 새 계약은 게임 번들/실제 저장 동작을 활성화하지 않는다.
- UI/브라우저/실제 계정/Cosmos 통합은 이번 계약 Task 범위가 아니며 실행하지 않았다. push/배포 없음. 발견한 별도 범위 결함: 특이사항 없음.
