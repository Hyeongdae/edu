# Task: T03 Hosted Company Auth

## Status: done

## Goal
배포본은 SWA 회사 세션을 한 번 사용하고 로컬은 기존 MSAL/DEV 데모로 동작하도록 인증 진입을 분리한다. 회사 principal 확인에 실패하면 게임을 보여주지 않는다.

## Decision Summary
- Precondition: P01-T01/T02 complete. 이번 Task는 인증/UI 경계이며 서버 기록 연결은 T04다. 중간 산출물은 아직 배포하지 않는다.
- 회사 테넌트의 구성원/등록 게스트 허용, 별도 그룹 필터 없음. 테넌트 제한은 뒤의 SWA provider가 강제한다. 브라우저 principal만으로 테넌트 검증을 했다고 주장하지 않는다.
- 로컬 .env.local 값/기존 SPA callback/오디오 재생 정책을 바꾸지 않는다.

## Implementation

### I01. Minimal game identity and auth mode
- Related Files:
  - `src/auth/gameAccount.ts` :: GameAccount; new.
  - `src/auth/authConfig.ts` :: AuthMode/getAuthMode/configuration validation; modify.
  - `src/vite-env.d.ts` :: VITE_AUTH_MODE declarations; modify.
  - `src/main.tsx` :: mode selection before MSAL creation; modify.
  - `src/App.tsx` :: AppProps/GameAppShell/ProtectedAppShell; modify.
  - `src/game/GameScreen.tsx` :: account prop type only; modify.
  - `src/auth/AuthGate.tsx` :: existing local gate read-only unless directly necessary.
- **Signatures & Types**:
```typescript
interface GameAccount {
  homeAccountId: string;
  username: string;
  name?: string | null;
}
type AuthMode = "entra-spa" | "azure-static-web-apps";
function getAuthMode(env: { VITE_AUTH_MODE?: string }): AuthMode;
interface AppProps {
  configurationError: string | null;
  localDemoMode?: boolean;
  authMode?: AuthMode; // default entra-spa for existing callers/tests
}
```
- Missing/blank VITE_AUTH_MODE keeps existing local entra-spa; unknown nonblank value is explicit configuration error, never permissive fallback.
- main resolves auth mode first. Hosted branch renders App with mode and no MSAL PublicClientApplication/MsalProvider; does not require VITE_ENTRA_CLIENT_ID/TENANT_ID/REDIRECT_URI. Hosted branch wins over any accidental localDemoMode flag; DEV is still required for local demo.
- Local branch keeps current three env validation, MSAL single-tenant login and current demo AccountInfo value structurally assignable to GameAccount.
- GameScreen only consumes homeAccountId/name/username, so use minimal type instead of constructing fake MSAL tokens/tenant claims. Test fixtures using AccountInfo remain compatible.
- GameAppShell maintains one audio controller per account lifecycle and current autoplay behavior. No new autoplay request or duplicate audio instance on status rerender.

### I02. Hosted identity bootstrap
- Related Files:
  - `src/auth/hostedAuth.ts` :: types/parser/fetchHostedAccount/getHostedLoginUrl; new.
  - `src/auth/HostedAuthGate.tsx` :: retry/loading/sign-in/render-prop; new.
  - `src/App.tsx` :: hosted branch wraps GameAppShell; modify.
- **Signatures & Types**:
```typescript
interface HostedPrincipal {
  identityProvider: "aad"; userId: string; userDetails: string; userRoles: string[];
}
type HostedIdentity = { status: "authenticated"; account: GameAccount }
  | { status: "signed-out" };
function parseHostedIdentity(value: unknown): HostedIdentity;
function fetchHostedAccount(signal: AbortSignal): Promise<HostedIdentity>;
function getHostedLoginUrl(returnPath?: string): string;
interface HostedAuthGateProps {
  children: (account: GameAccount) => React.ReactNode;
}
```
- **Execution Flow / Logic**:
  1. GET same-origin `/.auth/me`, credentials include, cache no-store; allow expected envelope {clientPrincipal:null|object}. Non-JSON, bad status/shape and unexpected provider/roles are explicit failure.
  2. null principal => signed-out sign-in button, no children. Valid aad userId and authenticated role => homeAccountId=userId, username=userDetails, name=userDetails. userDetails is platform-verified; no form/localStorage identity.
  3. Loading/error/signed-out are separate UI states. Error has retry; signed-out has "회사 계정으로 로그인". No auto-refresh redirect loop and no second MSAL prompt.
  4. Login path `/.auth/login/aad?post_login_redirect_uri=...` only accepts same-origin relative path beginning "/" but not "//", external schemes/backslashes/control chars. Invalid input returns "/" safely. Use normal navigation rather than trying to fetch login HTML as identity.
  5. Abort outstanding request on unmount and ignore obsolete completions using request generation guard; retry after abort is supported (StrictMode mount lifecycle).
  6. Account change remounts account-bound shell with key=homeAccountId, disposing old audio/store in subsequent T04. Never show previous user's GameScreen during new lookup.
- No source config or UI can grant access on failed auth. Actual assets/API protection is P02-T01, not this component.

### I03. Relevant auth and current UI regressions
- Related Files:
  - `src/auth/authConfig.test.ts` :: mode precedence/config; modify.
  - `src/auth/hostedAuth.test.ts`, `src/auth/HostedAuthGate.test.tsx`; new.
  - `src/App.test.tsx` :: current title/start/settings selectors and hosted/local branches; modify.
- Tests cover valid aad/guest platform identity, signed-out null, other provider/no role/bad body, HTTP error, retry, delayed stale response/unmount, safe redirect paths.
- Hosted config branch must render identity gate without creating MSAL or requiring local IDs; a local demo flag cannot override hosted mode. Existing DEV demo still works locally; PROD ignores demo.
- Existing App tests assume controls/old game start on initial screen. Update only relevant expectations to title → "게임 시작" → stage start, and settings opens audio controls. Preserve title "덱스 탈출 넘버원", guide only at title, exact subtitle.
- Test one audio owner and cleanup under auth/account changes; do not rewrite game flow or skip obsolete tests to get green.

## Acceptance Criteria
- [x] Hosted authentication uses one SWA identity and no extra MSAL login.
- [x] Loading/failure never mounts game; retries and account switch dispose stale work.
- [x] Existing local MSAL and DEV-only demo remain valid; current title/audio tests pass.

## Validation
- `npm run test -- --run src/auth/authConfig.test.ts src/auth/hostedAuth.test.ts src/auth/HostedAuthGate.test.tsx src/App.test.tsx --maxWorkers=2`.
- `npm run lint`; `npm run build`.
- Hosted build in PowerShell: set process `$env:VITE_AUTH_MODE='azure-static-web-apps'`, run `npm run build`, restore previous process env in finally. No .env.local edit or credential output. A hosting build alone does not verify real Entra login.
- `git diff --check`.

## Commit Message
```text
feat(auth): bootstrap hosted company sessions without a second login

Plan: 2026-10-30-azure-company-game-deployment
Phase: P01-company-records
Task: T03-hosted-company-auth

- Separate hosted SWA identity from local MSAL and development demo
- Preserve current title flow and single audio controller ownership
```

## Progress
- [x] 구현 완료
- [x] 검증 통과
- commit: `f56b4fe`

## Execution Evidence (2026-10-30)
- Added minimal GameAccount, strict getAuthMode selection and typed VITE_AUTH_MODE. Missing/blank mode keeps local SPA; unsupported mode displays a configuration error and cannot fall back to demo. Hosted entry does not construct a PublicClientApplication or MsalProvider and does not require local SPA environment IDs.
- Added hostedAuth.ts: same-origin GET /.auth/me with credentials/include, no-store, explicit JSON response validation and safe relative login return URL. Provider must be aad, ID nonempty and authenticated role present; unsupported/malformed principal fails closed, null is explicit signed-out. Direct-endpoint custom claims do not override verified platform details.
- Added HostedAuthGate: separate loading/signed-out/error/success states, explicit company login link, retry, effect-scoped generation/AbortSignal guard and unmount cleanup. Stale StrictMode responses cannot replace the newer identity; no automatic login loop or background polling that resets an active run.
- App hosted branch wins over local demo/SPA configuration. Local demo additionally checks DEV. GameAppShell is keyed by actual account ID so an identity change disposes old audio/game and creates a new owner; ordinary same-account renders do not duplicate audio. GameScreen changes are account type only.
- Supporting scoped files: src/main.test.tsx verifies actual entry initialization and MSAL-constructor precedence; src/app.css adds button layout for the native login navigation link. No visual redesign or new game/audio rule.
- Corrected the three existing App tests to navigate current title -> game start -> stage start -> settings. The previous volume assertion was stale after the existing 0.6 BGM gain; expected playback0.18 for stored volume0.3 without changing audioController source or preferences.
- Auth validation command including the blueprint's four files plus src/main.test.tsx passed78/78 across5 files, zero skipped. Covers hosted/guest/null/error identities, malformed JSON/status/provider, encoded external/control-character redirects, retry/abort/stale responses, DEV/PROD mode precedence, existing title/subtitle, audio fallback/preferences/account cleanup.
- npm run lint and normal npm run build passed; local JS587.13kB/CSS76.01kB. A second hosted build with process-only VITE_AUTH_MODE=azure-static-web-apps, all three local SPA IDs blank and VITE_LOCAL_DEMO_MODE=true passed (JS587.08kB/CSS76.01kB). Environment restored in finally; .env.local unchanged, no IDs/secrets printed.
- Existing >500kB bundle warning remains as explicitly deferred. Diff/whitespace checks passed. No product test skips, dependency upgrades, legacy record migration/deletion or game-engine changes.
- This is bootstrap/UI verification, not a live Entra session or route-security proof. SWA tenant enforcement and protected assets/API require P02. Hosted GameScreen still uses the interim local records until T04; this intermediate build was not published. No Azure resource/callback/credential changes or Git push.

## Next
P01-T04-cloud-records-game-integration. 아직 회사 공유 저장 연결 전이므로 URL 릴리스를 하지 않는다.
