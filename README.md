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

로컬 모드에서는 기존 내려오기 전환 시의 브라우저별 정리 동작을 유지합니다. 기록은 `stair-descent:leaderboard:v2`와 `stair-descent:stage-progress:v1`에 저장하며, 시간 정보가 없는 이전 내려오기 랭킹(v1)은 정리합니다. `stair-descent:records-reset:v1` 값 `1`은 기존 오르기 기록 정리가 끝났다는 표시입니다. 로그인·세션·오디오 설정은 보존합니다. 회사 배포 모드는 이 로컬 저장·정리를 호출하지 않고 별도 서버 기록을 사용합니다. 기존 로컬 실험 `/descent-test.html`은 개발 서버의 별도 1단계 테스트이며 배포 산출물에서 제외합니다.

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

1. CI와 API에 맞춰 Node.js 22.12 이상인 Node 22를 준비합니다.
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

기본 `VITE_AUTH_MODE=entra-spa` 모드에서 Entra 환경변수가 비어 있으면 필요한 설정 안내가 표시됩니다. 배포 모드에서는 아래의 SWA 세션을 사용합니다.

## 회사 게임 Azure 배포

배포 구성은 `Hyeongdae/edu`의 `main`을 대상으로 합니다. 실제 URL과 검증 결과는 첫 배포 후 `deploy/RELEASE.md`에 기록합니다. 현재 구성 파일만으로 배포 완료나 회사 로그인이 검증된 것은 아닙니다.

배포본은 `VITE_AUTH_MODE=azure-static-web-apps`로 빌드하며, Static Web Apps의 회사 Entra 로그인 세션을 사용합니다. 브라우저에서 MSAL 로그인을 다시 요구하지 않습니다. 회사 테넌트의 구성원과 그 테넌트에 등록된 게스트를 허용하며, 개인 Microsoft 계정이나 다른 테넌트 계정은 이 회사 테넌트의 유효한 게스트가 아니면 대상이 아닙니다. 게임 파일과 API 모두 인증을 요구합니다. 서버용 비밀값을 `VITE_` 환경변수에 넣지 않습니다.

공유 상위 10위는 계정별 최고 성적 하나를 단계·점수·남은시간 순서로 비교합니다. 최고 클리어 단계는 별도 저장해 다른 기기에서도 다음 단계가 열립니다. 새 공유 저장소는 모두 1단계부터 시작하며 기존 로컬 테스트 기록을 가져오거나 삭제하지 않습니다. 진행 중인 플레이는 복원하지 않습니다. 결과 전송에 실패하면 해당 계정·접속 주소의 `stair-descent:company:production:pending:v1:<계정 ID>` 대기열에서 순서대로 재시도합니다. 로그인이 만료되면 같은 계정으로 다시 로그인해야 하며, 브라우저 저장 자체가 차단된 경우에는 새로고침 전 저장 경고를 확인하세요.

### 배포 준비와 리소스 생성

새 전용 리소스 그룹, **Static Web Apps Standard**, 비공개 인증을 사용하는 전용 Table Storage를 사용합니다. Standard와 저장소 사용량에 따른 비용이 발생할 수 있습니다. 첫 URL은 Azure 기본 HTTPS 호스트이고, custom domain은 이번 범위에 포함하지 않습니다.

```powershell
# 기본값: 생성 예정 항목만 표시. Azure/GitHub 로그인이나 변경을 수행하지 않음.
powershell.exe -NoProfile -File deploy/Deploy-DexEscape.ps1
```

실제 생성 단계에서는 인증된 Azure CLI와 GitHub CLI가 필요합니다. 회사 구독·테넌트가 일치하고 기존 앱 등록을 수정할 수 있는 앱 소유자 계정이어야 합니다. GitHub 계정에는 해당 저장소 push와 Actions secrets 설정 권한이 필요합니다. CLI가 PATH에 없으면 `-AzureCliPath` / `-GhPath`로 지정합니다. 필요한 회사 로그인은 CLI의 정상 브라우저/디바이스 인증으로 완료하며 비밀번호나 MFA 코드를 파일·채팅에 저장하지 않습니다.

Entra 앱 소유권은 Azure 리소스 생성 권한을 부여하지 않습니다. 기본 실행은 새 전용 리소스 그룹도 만들기 때문에 구독 범위 그룹 생성 권한이 필요합니다. 권한 범위를 줄이려면 먼저 PlanOnly에 표시된 이름으로 **비어 있는 새 전용 RG**를 만들고 소유 태그 `project=dex-escape`, `repository=Hyeongdae/edu`, `environment=production`을 붙여 달라고 관리자에게 요청하세요. 그런 다음 사용자에게 이 RG 범위의 Contributor를 부여하면 다음처럼 RG 안의 게임 리소스만 생성할 수 있습니다:

```powershell
.\deploy\Deploy-DexEscape.ps1 -UseExistingResourceGroup -Apply -SubscriptionId <구독-ID> -TenantId <테넌트-ID> -ClientId <기존-앱-Client-ID>
```

PlanOnly가 `-SubscriptionId`/`-TenantId`/`-ClientId` 입력 후 보여주는 실제 대상 이름을 먼저 확인하세요. 이 모드는 그 이름과 정확히 일치하는 태그가 달린 빈 RG만 받아들이고 그 RG에서 RBAC 권한을 확인합니다. 역할 할당이나 구독 전환은 하지 않습니다. `Forbidden` 또는 빈 권한 목록이면 회사 관리자에게 전용 RG 생성과 해당 범위의 접근을 요청하거나, 이미 권한이 있는 회사 계정으로 로그인하세요.

```powershell
# 실제 리소스 생성 Task에서만 실행. 식별자는 실제 회사 값으로 지정.
# TenantId/ClientId를 생략하면 기존 .env.local의 공개 SPA 식별자를 읽음.
.\deploy\Deploy-DexEscape.ps1 -Apply -SubscriptionId <구독-ID> -TenantId <테넌트-ID> -ClientId <기존-앱-Client-ID>
```

도구는 소유권 태그와 저장된 대상을 확인하며, 다른 앱의 리소스를 가져오거나 삭제하지 않습니다. 기존 SPA/Web 콜백과 다른 자격 증명을 보존하고, 새 사이트의 `/.auth/login/aad/callback`만 Web 콜백에 추가합니다. 기존 Enterprise App이 사용자 할당을 요구하면 선택한 테넌트 전체 공개 범위와 다르므로 먼저 설정을 확인해야 합니다. 리전이 지원되지 않으면 생성 전에 중단하며 `-Location`으로 지원 리전을 선택합니다.

실제 대상은 비밀값 없는 `deploy/azure.resources.json`에 기록합니다. 중간 실패 재개용 `deploy/.provision-state.local.json`은 Git에서 제외합니다. 이 파일들은 사이트 이름/URL·소유 대상·자격 증명 keyId/만료 메타데이터만 담습니다. `tenantFingerprint`는 구독·테넌트·앱 식별자 조합에 묶인 해시이며, 다른 대상으로 실수로 재실행하면 변경 전에 중단합니다. 사이트와 저장소를 매 배포마다 새로 만들지 말고 같은 대상을 재사용하세요.

서버 설정은 `AZURE_CLIENT_ID`, `GAME_ENTRA_CLIENT_SECRET`, `GAME_RECORDS_CONNECTION_STRING`, `GAME_RECORDS_TABLE`입니다. 비밀값은 접근을 제한한 임시 JSON 파일 또는 stdin으로만 전달하고 정리합니다. Entra 비밀은 180일 만료로 추가하며, 만료 7일 이내의 재실행에서는 필요한 새 비밀을 추가해 서버 설정을 갱신합니다. 이전·다른 앱 비밀을 자동 삭제하지 않습니다. 비밀 생성 직후 실패했다면 소유한 고아 자격 증명이 남을 수 있으므로 새 로그인이 검증된 뒤 keyId 기준으로 운영자가 정리합니다.

### GitHub Actions와 로컬 산출물 검증

저장소 설정:

| 종류 | 이름 | 용도 |
| --- | --- | --- |
| Actions secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` | 이 게임 사이트의 배포 토큰 |
| Actions variable | `ENTRA_TENANT_ID` | 회사 테넌트 UUID |
| Actions variable | `AZURE_DEPLOY_ENABLED` | 준비가 끝난 뒤 `true`로 설정 |

워크플로는 PR에서 검증만 수행하고, 검증이 성공한 `main` push만 배포합니다. preview 배포나 PR 댓글을 만들지 않습니다. 동일 SHA의 산출물만 내려받으며, 프런트를 재빌드하지 않고 생성된 회사 인증 config를 확인한 뒤 업로드합니다. 설정이 빠지거나 테스트가 실패하면 배포하지 않습니다.

```powershell
npm ci
npm --prefix api ci
npm run test:deployment
npm run test -- --run --maxWorkers=2
npm --prefix api test
npm --prefix api run test:integration
npm run lint
npm --prefix api run build
$env:VITE_AUTH_MODE = 'azure-static-web-apps'
npm run build
npm run stage:api
# 실제 배포에서는 회사 테넌트 UUID를 사용. PR 검증은 비밀값 없이 테스트 fixture 사용.
$env:ENTRA_TENANT_ID = '<회사-테넌트-UUID>'
npm run build:swa-config
$env:GITHUB_SHA = 'local' # 로컬 검사 전용; Actions에서는 실제 커밋 SHA가 자동 제공됨.
node scripts/verify-release.mjs
```

위 환경변수는 현재 셸에만 적용됩니다. 로컬 개발로 돌아갈 때 설정을 복원하거나 새 셸을 사용하세요. 순서는 **빌드 → API staging → config 생성 → 검증**입니다. Vite 빌드는 `dist`를 다시 만들므로 config를 먼저 생성하면 사라집니다. `release/api`는 실행 파일·패키지·운영 의존성만 담고, Azurite/테스트/로컬 설정은 업로드하지 않습니다. 개별 동시성 테스트는 임시 로컬 에뮬레이터를 사용하며 기존 에뮬레이터 DB나 실제 회사 저장소에 연결하지 않습니다.

최종 배포 단계에서는 실제 회사 로그인, 익명 접근 차단, 서버 결과 저장, 독립된 두 브라우저/기기의 단계 해금 복원을 확인한 뒤 URL을 전달합니다. 점수 스냅샷 검증은 포함하지만 모든 클라이언트 조작을 막는 서버 재현형 안티치트는 별도 범위입니다.

### 오디오 출처와 라이선스

BGM과 효과음은 `public/audio/`에 포함되어 있습니다. 원본 출처, 저작자, 사용 권한, 변경 여부는 [오디오 라이선스 기록](./public/audio/LICENSES.md)을 확인하세요. 특히 계단 발소리는 CC BY-SA 3.0 자료라 재배포할 때 출처와 라이선스 표기를 유지해야 합니다.
