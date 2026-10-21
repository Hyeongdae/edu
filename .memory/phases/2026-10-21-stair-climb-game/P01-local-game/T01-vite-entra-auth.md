# Task: T01 Vite React 및 Entra 로그인

## Status: done

## Goal
빈 저장소에서 실행 가능한 Vite + React + TypeScript SPA를 만들고, 회사 Entra ID 계정으로 로그인하기 전에는 게임 경로가 표시되지 않는 인증 게이트를 제공한다.

## Decision Summary
- `npm` 기반 Vite React TypeScript, `@azure/msal-browser`, `@azure/msal-react` 사용.
- 단일 테넌트 authority 사용. Tenant ID 또는 Client ID가 없으면 인증을 우회하지 않고 설정 안내를 표시한다.

## Implementation

### I01. 프로젝트 골격과 설정
- Related Files:
  - `package.json` :: scripts와 의존성 — 수정
  - `index.html` :: 앱 진입 HTML — 수정
  - `vite.config.ts` :: Vite 설정 — 신규
  - `tsconfig.json`, `tsconfig.app.json` :: TypeScript 설정 — 신규
  - `src/vite-env.d.ts` :: Vite 환경변수 타입 — 신규
  - `.gitignore` :: `node_modules`, 빌드 출력, `.env.local` 제외 — 수정
  - `.env.example` :: 공개 설정 이름 예시 — 신규
  - `README.md` :: 로컬 설치·인증 설정 지침 — 수정

#### Details
- **Signatures & Types**: Vite 기본 진입은 `src/main.tsx`의 `createRoot(document.getElementById("root")!).render(...)`를 사용한다. TypeScript는 `strict: true`로 설정한다.
- **Data & Schema Fields**: 환경변수는 `VITE_ENTRA_CLIENT_ID: string`, `VITE_ENTRA_TENANT_ID: string`, `VITE_ENTRA_REDIRECT_URI: string`로 선언하고 모두 런타임에서 비어 있을 수 있음을 처리한다. `.env.example`에는 빈 값 또는 설명용 값만 둔다.
- **Execution Flow / Logic**:
  1. 새 Vite React TypeScript 템플릿을 저장소 루트에 생성한다.
  2. `dev`, `build`, `preview`, `lint`, `test` 스크립트를 `package.json`에 정의한다. 테스트 러너는 Vitest, DOM 환경은 jsdom으로 설정한다.
  3. `.env.local`은 `.gitignore`에 포함하고 문서에는 `.env.example`을 복사해 값을 설정하는 절차와 `http://localhost:5173` 리디렉션 URI 등록 필요성을 적는다.
  4. 앱 이름과 HTML lang은 `ko`로 지정한다.
- **Error & Exception Handling**: 루트 엘리먼트가 없으면 명확한 오류를 내고, 환경변수가 빠진 경우 앱 시작이 깨지지 않도록 한다. 인증 컴포넌트가 누락된 설정 메시지를 표시한다.
- **State Transition & Return**: 성공 시 `npm run dev`로 `http://localhost:5173`에서 앱이 실행된다.

### I02. MSAL 단일 테넌트 로그인 게이트
- Related Files:
  - `src/auth/authConfig.ts` :: `msalConfig`, `loginRequest` — 신규
  - `src/auth/AuthGate.tsx` :: 인증 진입 및 설정 오류 표시 — 신규
  - `src/App.tsx` :: 로그인 전후 화면 분기 — 수정
  - `src/main.tsx` :: `MsalProvider` 초기화 — 수정

#### Details
- **Signatures & Types**:
  ```ts
  export const msalConfig: Configuration;
  export const loginRequest: RedirectRequest;
  export function AuthGate(props: { children: React.ReactNode }): JSX.Element;
  ```
- **Data & Schema Fields**: `msalConfig.auth.clientId`는 `VITE_ENTRA_CLIENT_ID`, `authority`는 `https://login.microsoftonline.com/${VITE_ENTRA_TENANT_ID}`, `redirectUri`는 `VITE_ENTRA_REDIRECT_URI`에서 온다. `loginRequest.scopes`는 로그인에 필요한 최소값인 `openid`, `profile`만 요청한다. Client Secret은 만들거나 프런트엔드에 저장하지 않는다.
- **Execution Flow / Logic**:
  1. 세 환경변수가 모두 있으면 `PublicClientApplication`을 만들고 MSAL provider로 앱을 감싼다.
  2. `useMsal`과 `useIsAuthenticated`를 사용해 계정이 없을 때 로그인 버튼을 보여준다. 로그인 동작은 `instance.loginRedirect(loginRequest)`를 호출한다.
  3. 로그인 계정이 있으면 활성 계정을 `instance.setActiveAccount`로 정하고 보호된 자식 화면을 렌더링한다.
  4. 보호된 `App`은 활성 계정 또는 `accounts[0]`을 골라, `account` prop으로 후속 게임 화면에 전달한다.
  5. 로그인 중에는 진행 표시를 렌더링한다.
- **Error & Exception Handling**: 일부 설정이 빠지면 로그인 버튼을 노출하지 않고 필요한 환경변수 이름을 안내한다. MSAL 로그인 실패는 페이지 전체를 비우지 않고 사용자 메시지와 다시 로그인 동작을 제공한다. `common` 또는 다중 테넌트 authority를 사용하지 않는다.
- **State Transition & Return**: 미인증 상태에서는 로그인 화면만 보이고 인증 완료 시 보호된 앱으로 이동한다.

### I03. 최소 앱 셸과 테스트 기반
- Related Files:
  - `src/App.tsx` :: 임시 보호 화면 — 수정
  - `src/App.test.tsx` :: 인증 게이트 화면 검증 — 신규
  - `src/auth/authConfig.test.ts` :: 환경변수 검증 테스트 — 신규
  - `src/test/setup.ts` :: Testing Library setup — 신규
- **Data & Schema Fields**: MSAL mock은 계정이 없는 상태와 계정이 있는 상태를 각각 제공한다. 환경 설정 검증 함수는 테스트가 직접 `AuthEnvironment`를 주입할 수 있게 한다.
- **Execution Flow / Logic**: 미인증이면 회사 계정 로그인 안내가 보이고, 인증된 계정이면 `게임 앱 준비 중` 보호 화면이 보이는 최소 시나리오를 검증한다. 실제 자격 증명 없이 테스트 가능해야 한다. 환경변수 누락, 전체 값 입력, 단일 테넌트 authority 문자열 구성을 단위 테스트한다.
- **Error & Exception Handling**: MSAL 인스턴스를 mock하여 네트워크 또는 조직 계정이 없는 상태에서도 자동 검증이 가능하도록 한다.

## Acceptance Criteria
- [ ] `npm install` 후 개발 서버가 실행되고, React 앱 셸이 표시된다.
- [ ] Entra 환경변수 누락 시 사용자에게 설정 안내가 표시되며 로그인 우회로 게임에 진입하지 못한다.
- [ ] 설정이 존재하면 단일 테넌트 authority를 이용해 로그인 버튼이 동작한다.
- [ ] 로그인 전후 화면 분기 테스트가 통과한다.

## Validation
- `npm run test -- --run` — 인증 화면 테스트 통과.
- `npm run lint` — ESLint 오류 없음.
- `npm run build` — TypeScript 검사 및 Vite 프로덕션 빌드 성공.
- 실제 로그인 수동 확인은 Entra 앱 등록 값과 localhost SPA redirect URI를 설정한 뒤 수행한다.

## Commit Message
```text
feat(app): scaffold React app with Entra sign-in

Plan: 2026-10-21-stair-climb-game
Phase: P01-local-game
Task: T01-vite-entra-auth

- Create a strict TypeScript Vite React app
- Gate the app behind single-tenant Entra ID sign-in
```

## Progress
- [x] 구현 완료
- [x] 검증 통과 (npm run test -- --run, npm run lint, npm run build)
- commit: Git 설치 후 누락된 커밋을 복구 중
