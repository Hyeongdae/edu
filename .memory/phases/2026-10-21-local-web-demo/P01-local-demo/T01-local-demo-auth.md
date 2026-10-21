# Task: T01 로컬 웹 데모 인증

## Status: done

## Goal
개발자가 Entra 설정 없이 명시적으로 켠 로컬 데모 모드로 게임을 브라우저에서 플레이할 수 있게 하고, MSAL Entra 로그인 흐름 및 프로덕션 빌드의 인증 요구를 유지한다.

## Decision Summary
- 데모 허용 조건은 `import.meta.env.DEV && VITE_LOCAL_DEMO_MODE === "true"`로 고정한다. 플래그 기본값은 꺼짐이다.
- 데모 계정은 ID `local-demo-account`, 이름 `로컬 테스트 사용자`, username `local-demo@localhost`이다. `GameScreen`은 같은 계정을 사용해 현재 브라우저에 최고 점수를 저장한다.

## Implementation

### I01. 개발 전용 데모 모드와 공통 게임 셸
- Related Files:
  - `src/vite-env.d.ts` :: `ImportMetaEnv` — 플래그의 선택적 타입 선언; modify
  - `src/auth/authConfig.ts` :: `isLocalDemoMode` — 개발 환경과 정확한 문자열 `true`를 함께 확인; modify
  - `src/main.tsx` :: `root.render` 분기 — 데모에서 MSAL 초기화 없이 App 실행; modify
  - `src/App.tsx` :: `App`, `ProtectedAppShell`, 새 `GameAppShell` — 데모 계정과 MSAL 계정이 같은 게임 셸/오디오 설정을 사용; modify
  - `.env.example` — 로컬 플래그 설명과 기본값 `false` 추가; modify
  - `README.md` — 로컬 테스트용 `.env.local` 설정과 서버 실행 안내 추가; modify

#### Details
- **Signatures & Types**:
  ```typescript
  // src/auth/authConfig.ts
  export const isLocalDemoMode: boolean =
    import.meta.env.DEV && import.meta.env.VITE_LOCAL_DEMO_MODE?.trim() === "true";

  // src/App.tsx
  interface AppProps {
    configurationError: string | null;
    localDemoMode?: boolean;
  }

  // GameAppShell receives an AccountInfo and owns all existing audio/game-shell state.
  function GameAppShell({ account }: { account: AccountInfo }): JSX.Element;
  ```
- **Data & Schema Fields**:
  - 데모 `AccountInfo`: `homeAccountId: "local-demo-account"`, `environment: "local"`, `tenantId: "local"`, `username: "local-demo@localhost"`, `localAccountId: "local-demo-account"`, `name: "로컬 테스트 사용자"`.
  - `ImportMetaEnv.VITE_LOCAL_DEMO_MODE?: string`.
- **Execution Flow / Logic**:
  1. `isLocalDemoMode`는 Vite `DEV`가 true이고 환경 변수가 trim 뒤 정확히 `true`일 때만 참이다.
  2. `main.tsx`에서 이 값이 참이면 MSAL 인스턴스를 만들지 않고 `<App configurationError={null} localDemoMode />`를 렌더링한다.
  3. 그 외에는 기존 흐름을 유지한다. 설정이 없으면 설정 안내를 렌더링하고, 있으면 기존 MSAL provider를 감싼다.
  4. `App` 데모 경로는 `AuthGate`와 `useMsal` 호출을 건너뛰어 가상 계정으로 `GameAppShell`을 렌더링한다. 일반 경로는 `AuthGate` 후 MSAL 계정을 찾아 동일 `GameAppShell`을 렌더링한다.
  5. 게임 셸과 오디오 동작을 중복 복제하지 않는다. 게임 점수는 `local-demo-account`의 브라우저 로컬 저장소에 기록된다.
  6. `.env.example`에는 `VITE_LOCAL_DEMO_MODE=false`를 둔다. README에는 `.env.local`에 이 값을 true로 바꿔 `npm run dev`를 실행하는 명령과, Entra 없이 실행되는 이 계정은 로컬 확인 전용임을 명시한다.
  7. **Error Handling**: 사용자가 true 이외 값(예: `1`, `True`)을 쓰면 데모 모드를 활성화하지 않고 기존 Entra 설정 안내가 나온다.

### I02. 빌드 및 lint 확인
- Related Files:
  - `src/auth/authConfig.test.ts` — 개발/배포 모드 조건 테스트; modify
  - `src/App.test.tsx` — 데모 모드 UI와 기존 MSAL 셸 회귀 검증; modify
- **Test Scenarios**:
  - 개발 모드와 정확한 `true` 플래그 조합만 데모 허용이다.
  - 데모 경로에서는 화면에 `로컬 테스트 사용자`가 보이고 Entra 로그인 안내가 노출되지 않는다.
  - 기존 Entra 앱 렌더 테스트는 그대로 통과한다.

## Acceptance Criteria
- [ ] `.env.local`에 `VITE_LOCAL_DEMO_MODE=true`를 설정하고 `npm run dev` 후 `http://localhost:5173/`에서 게임을 시작할 수 있다.
- [ ] 데모에서 D/J 키 또는 화면 버튼, 점수, 이벤트 게이지, 추격자, 게임 종료 랭킹, BGM/효과음을 사용할 수 있다.
- [ ] 기본 플래그와 프로덕션 빌드에서는 기존 Entra 인증을 우회하지 않는다.
- [ ] `npm run build`, `npm run lint`, `npm test -- --run`이 통과한다.

## Validation
- `npm run build` — TypeScript와 프로덕션 Vite 빌드 성공
- `npm run lint` — ESLint 오류 없음
- `npm test -- --run` — Vitest 전체 테스트 통과
- 수동: `.env.local`에 `VITE_LOCAL_DEMO_MODE=true` 설정, `npm run dev` 실행 후 브라우저에서 게임 시작 및 D/J 조작 확인

## Commit Message
```text
feat(auth): add local browser demo mode

Plan: 2026-10-21-local-web-demo
Phase: P01-local-demo
Task: T01-local-demo-auth

- Gate demo account behind Vite development mode and explicit opt-in
- Document local game launch without Entra configuration
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: complete
