# 🚀 Project Memory Starter Kit

> **"AI에게 대화창으로 매번 길게 설명하지 마세요. 파일 기반 메모리로 세션을 영구 유지하세요."**

이 스타터킷은 프로젝트에 복사해 넣는 것만으로 **3가지 전문 AI 스킬(`/grill-me`, `/memory-plan`, `/memory-execute`)**과 **파일 기반 메모리 구조**를 즉시 활성화해 주는 경량 패키지입니다.

---

## ⚡ 1분 설치법

1. 이 `project-memory-starter` 폴더 안에 있는 아래 2개 폴더를 **내 프로젝트 루트**에 복사합니다:
   - **`.agents/`**: 3대 AI 스킬 정의 폴더
   - **`.memory/`**: 메모리 파일들이 저장될 폴더

*(Cursor, Antigravity 등 스킬 지원 도구에서 즉시 슬래시 커맨드로 인식됩니다.)*

---

## 🔄 3단계 워크플로우

```text
  [1단계: 요구사항 인터뷰]        [2단계: 계획 및 청사진 생성]          [3단계: 순차 실행 및 포인터 전진]
    /grill-me <기능명>    ───→    /memory-plan <기능명>      ───→    /memory-execute (또는 "current 보고 진행해줘")
  (decisions/ 확정)              (plans/ & Task 청사진 생성)        (구현 ➔ 테스트 ➔ 커밋 ➔ 포인터 이동)
```

### 1단계: `/grill-me <기능명>`
- AI가 한 번에 딱 1개씩 추천 선택지와 함께 질문을 던집니다.
- 답변을 고르면 애매한 점이 모두 해결될 때까지 인터뷰를 진행하고, 확정된 결정을 `.memory/decisions/{기능명}.md`에 저장합니다.

### 2단계: `/memory-plan <기능명>`
- **(철칙: 이 단계에서는 코드를 전혀 작성하지 않습니다.)**
- 앞서 확정된 결정을 바탕으로 전체 계획(`plans/`), 마일스톤(`phases/`), 그리고 각 Task의 상세 스펙/테스트 명령어가 적힌 **Task 청사진(`T01...md`)**을 일괄 생성합니다.
- `.memory/current.md` 포인터를 첫 번째 작업(T01)으로 자동 초기화합니다.

### 3단계: `/memory-execute` 또는 `"current 보고 이어서 해줘"`
- `.memory/current.md`가 가리키는 Task 청사진만 읽고 정답 코드를 구현합니다.
- 테스트 커맨드를 실행하여 통과하면 자동으로 커밋하고, 상위 `phase.md` 진행률을 올린 뒤, **`current.md` 포인터를 다음 Task(T02)로 자동 전진**시킵니다.
- **퇴근 후 다음 날 새 채팅창을 열고 `"current 보고 이어서 해줘"` 한 줄만 치면 1초 만에 다음 작업으로 직행합니다.**

---

## 📂 폴더 구조 및 역할

```text
.memory/
├── current.md                          ← [포인터] 지금 어디를 작업 중인지 가리키는 20줄 파일
├── decisions/
│   └── YYYY-MM-DD-{기능명}.md          ← [결정] 인터뷰로 확정된 기술 결정 박제
├── plans/
│   └── YYYY-MM-DD-{기능명}.md          ← [계획] 전체 목표 및 Phase 마일스톤 목록
└── phases/
    └── YYYY-MM-DD-{기능명}/            ← [청사진] 날짜별 계획 하위 폴더
        └── P01-{마일스톤}/
            ├── phase.md                ← 진행률 대시보드
            ├── T01-{작업명}.md         ← 파일, 심볼, 모델 스키마, 테스트 커맨드
            └── T02-{작업명}.md

.agents/skills/
├── grill-me/SKILL.md                   ← 인터뷰 스킬
├── memory-plan/SKILL.md                ← 계층 계획 수립 스킬
└── memory-execute/SKILL.md             ← 순차 실행 및 포인터 전진 스킬
```

---

## 📁 예시 살펴보기

`examples/` 폴더에 세미나에서 설명한 **'쇼핑몰 상품 API 구축'** 실물 파일들이 들어있습니다. 어떻게 계획되고 작성되는지 참고해 보세요!


## 토큰 사용량 조회
프로젝트 루트에 압축 해제 후:
# CLI 실행
& .\.codeburn\codeburn.ps1 sessions -p today --provider copilot --no-pager
# VS Code MCP 등록
& .\.codeburn\install.ps1


## 시각화 스킬
/visualize 내용입력

## 계단 내려오기 게임 로컬 실행

메인 게임은 위쪽 추격자를 피해 계단을 내려오는 5단계 게임입니다. `D`는 한 칸 내려가기, `J`는 방향을 바꾸며 내려가기, `Space`는 장애물을 넘어 두 칸 이동입니다. 모바일에서는 내려가기·방향 바꾸기·점프 버튼을 사용합니다. 각 단계는 0점부터 시작하고 목표는 150/200/250/300/350점, 제한시간은 90/75/65/60/50초입니다. 클리어한 다음 단계가 해금되며 체크포인트에서 계속하거나 종료할 수 있습니다.

내려오기 최초 실행 시 이 브라우저·접속 주소의 기존 오르기 랭킹(v1~v5)과 단계 해금 기록(v1)을 한 번 초기화합니다. 새 기록은 `stair-descent:leaderboard:v1`과 `stair-descent:stage-progress:v1`에 저장하고, `stair-descent:records-reset:v1` 값 `1`로 초기화 완료를 표시합니다. 이후 재접속해도 새 기록은 유지됩니다. 로그인·세션·오디오 설정은 보존합니다. 기존 로컬 실험 `/descent-test.html`은 개발 서버의 별도 1단계 테스트이며 기본 배포 빌드에는 포함하지 않습니다.

### Entra 설정 없이 브라우저에서 미리 플레이하기

`.env.local`에 아래 값을 넣으면 개발 서버에서만 `로컬 테스트 사용자`로 게임이 열립니다. 이 계정의 랭킹은 현재 브라우저에만 저장됩니다.

```env
VITE_LOCAL_DEMO_MODE=true
```

저장한 뒤 다음 명령을 실행하고 `http://localhost:5173/`을 여세요. 환경 변수를 바꾼 뒤에는 개발 서버를 다시 시작해야 합니다.

```powershell
npm run dev
```

이 데모 모드는 Vite 개발 서버에서만 작동하며 프로덕션 빌드에서는 Entra 로그인이 필요합니다.

### 준비

1. Node.js 20.19 이상을 설치합니다.
2. 저장소 루트에서 `.env.example`을 `.env.local`로 복사합니다.
3. 회사 Entra ID 앱 등록에서 **Single-page application** 플랫폼을 추가하고 `http://localhost:5173`을 redirect URI로 등록합니다.
4. `.env.local`에 앱의 Client ID와 회사 Tenant ID를 입력합니다. Client Secret은 브라우저 앱에 넣지 않습니다.

```env
VITE_ENTRA_CLIENT_ID=회사 앱 등록의 Client ID
VITE_ENTRA_TENANT_ID=회사 Tenant ID
VITE_ENTRA_REDIRECT_URI=http://localhost:5173
```

### 실행과 검증

```powershell
npm install
npm run dev
```

테스트와 프로덕션 빌드는 다음 명령으로 실행합니다.

```powershell
npm run test -- --run
npm run lint
npm run build
```

Entra 환경변수가 비어 있으면 로그인 화면 대신 필요한 설정 안내가 표시됩니다.

### 오디오 출처와 라이선스

BGM과 효과음은 `public/audio/`에 포함되어 있습니다. 원본 출처, 저작자, 사용 권한, 변경 여부는 [오디오 라이선스 기록](./public/audio/LICENSES.md)을 확인하세요. 특히 계단 발소리는 CC BY-SA 3.0 자료라 재배포할 때 출처와 라이선스 표기를 유지해야 합니다.
