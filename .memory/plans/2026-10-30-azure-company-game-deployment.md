# Plan: Azure Company Game Deployment

## Goal
덱스 탈출 넘버원의 현재 React/Vite 게임을 새 Azure Static Web Apps Standard 사이트에 배포하고 실제 HTTPS URL을 전달한다. 회사 Entra 테넌트의 구성원과 등록된 게스트만 게임과 API에 접근하며, 회사 공용 상위 10위와 계정별 단계 해금을 다른 기기에서도 이어 사용한다.

## Source Decisions
[확정 결정문](../decisions/2026-10-30-azure-company-game-deployment.md). 계획 작성일: 2026-10-30. 계획 단계에서는 구현, 리소스 생성, 자격 증명 추가, Git push를 하지 않는다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done` | 결과 계약, 서버 저장, 호스팅 인증, 게임의 공유 기록 연결 | [P01](../phases/2026-10-30-azure-company-game-deployment/P01-company-records/phase.md) |
| P02 | `in_progress` | 검증된 배포 구성, 전용 Azure/Entra 연결, 실제 배포와 URL 검증 | [P02](../phases/2026-10-30-azure-company-game-deployment/P02-azure-release/phase.md) |

## Scope and Architecture
- Azure 기본 `azurestaticapps.net` HTTPS 주소, 새 전용 리소스 그룹/Standard 사이트/비공개 Table Storage. 기존 다른 게임의 리소스는 수정하지 않는다. Standard 및 저장소 비용은 인터뷰에서 승인한 범위다.
- 배포본: 단일 테넌트 custom Entra provider → SWA 세션 → `/.auth/me` → 개인 profile/공유 leaderboard → GameScreen. MSAL을 다시 로그인시키지 않는다.
- 로컬: 현재 MSAL 및 DEV 전용 데모, 로컬 점수/해금 데이터 유지. 기존 로컬 데이터를 공유 서비스에 업로드하거나 삭제하지 않는다.
- API: same-origin managed Azure Functions Node 22, `GET /api/profile`, `GET /api/leaderboard`, `POST /api/results`. SWA 인증 principal로 계정을 결정한다.
- 계정당 최고 성적 하나: 단계, 그 단계 점수, 남은 centiseconds 내림차순, 완전 동률은 먼저 서버에 인정된 기록 우선. 실제 최고 클리어 단계는 별도 단조 증가 필드다.
- 서버는 형식·단계 해금·점수/시간 범위를 검증한다. 클라이언트 결과 스냅샷을 사용하는 이번 범위에 서버 권위 플레이 재현/완전한 부정행위 차단은 포함하지 않는다.
- 개인 entity ETag 조건부 갱신, 더 좋은 성적/높은 클리어의 합병으로 재전송과 동시 기기를 안전하게 처리한다.
- 최초 profile 실패를 신규 계정으로 처리하지 않는다. 결과는 연출 종료가 아닌 결과 확정 시 계정별 FIFO 대기열에 저장한다. 네트워크 실패가 체크포인트/결과 화면을 막지 않는다.

## Execution Order and Gates
1. P01-T01 계약 → T02 API → T03 인증 → T04 게임 통합. 한 번의 `/memory-execute`는 Active Task 하나만 구현한다.
2. P02-T01은 클라우드를 건드리지 않고 배포 구성과 기본 PlanOnly 도구를 만든다.
3. P02-T02는 권한 사전 확인 후 이미 승인된 전용 리소스와 필요한 자격 증명만 생성한다. GitHub 인증이 실제로 필요할 때 본인 로그인 절차를 안내하며 비밀번호/MFA를 받지 않는다.
4. P02-T03은 현재 main의 미배포 변경을 검토·push하고 정확한 Actions SHA, 게임/API, 회사 로그인과 다른 기기 기록 복원을 검증한 뒤 URL을 전달한다.
5. 초기 개발용 빈 사이트 생성이나 HTTP 200만으로 전체 완료를 선언하지 않는다. 실제 로그인 검증과 자동/설정 검증을 구별한다.

## Code-derived Baseline
- src/game/stageRules.ts: 단계별 제한 90/75/65/60/50초, 목표 150/200/250/300/350점; 이 계획은 게임 규칙을 바꾸지 않는다.
- StageResult: stage, score, remainingTimeCs, endedAtMs, outcome(cleared/caught/time-limit). 순위에 누적 점수를 사용하지 않는다.
- GameScreen은 현재 로컬 기록으로 동기 초기화한다. 서버 profile을 받기 전에 마운트하면 다른 기기의 해금이 사라져 보이므로 bootstrap gate가 필수다.
- 야근/퇴근 연출, 타이틀, 픽셀 디자인, 오디오 소유권은 유지한다. 기록 상태 rerender가 시계·애니메이션을 초기화하지 않게 한다.
- 현재 cached Git 상태 main은 origin/main보다 83 commit 앞섬. 원격 최신 상태는 실제 배포 Task에서 fetch로 확인하며 force push하지 않는다.
- Azure CLI는 `C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd`. 읽기 확인 당시 구독 CR-Project-01은 enabled이고 현재 설정 테넌트와 일치했다. 실행 시 다시 검증한다.
- GitHub connector는 현재 Hyeongdae/edu 읽기만 가능(push/admin false). 이것은 사용자의 CLI 권한 부재를 뜻하지 않으며, 쓰기/Actions secret 권한을 가진 사용자 인증이 배포 때 필요하다. gh는 확인한 PATH/표준 경로에 없어 공식 배포판 준비도 T02에 포함한다.
- 마지막 완료는 title-copy-and-overtime-capture T02 `10e1ac4`, memory sync `2786222`. 기존 untracked .agents/브라우저 프로필/Azurite DB 등은 포함하지 않는다.

## Validation Strategy
- 순수 계약/서버 handler/ETag 동시성은 단위 테스트와 격리 Azurite 실통합 테스트로 검증한다.
- 인증/비동기 UI는 React 테스트, 전체 root suite, lint, TypeScript/build로 검증한다. API는 Node 환경의 별도 suite다.
- GitHub main 배포는 동일 테스트가 성공한 산출물만 업로드한다. PR 검증은 하되 preview 공개 및 fork secret 접근은 만들지 않는다.
- 최종 익명 접근 차단, 실제 회사 로그인, profile/결과/랭킹, 격리된 두 브라우저 저장소의 해금 복원을 확인한다. 도구가 차단한 브라우저 작업은 우회하지 않고 필요한 수동 확인을 분명히 기록한다.

## Adjacent Findings / Scope Decisions
- App.test.tsx의 이전 첫 화면/설정 선택자는 인증 구조 변경을 검증하기 위해 이번 T03/T04에서 현재 타이틀 흐름에 맞게 보정한다. 테스트를 위해 UI를 되돌리지 않는다.
- 기존 bundle 용량 경고에 대한 별도 로딩 성능 개선은 사용자가 2026-10-30 명시적으로 추후 진행을 선택했다. 이번 Task에 추가하지 않는다.
- custom domain, VPN, 그룹별 승인, 과거 로컬 데이터 이전, 중간 플레이 복원, 별도 안티치트 서버는 범위 밖이다.

## References
- [Custom authentication](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom): Standard custom provider 및 tenant issuer/setting references.
- [SWA configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration): route 보호와 산출물 내 config 위치.
- [Managed API](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions), [user information](https://learn.microsoft.com/en-us/azure/static-web-apps/user-information).
- [Azure Tables JavaScript](https://learn.microsoft.com/en-us/javascript/api/overview/azure/data-tables-readme), [Functions v4](https://learn.microsoft.com/en-us/azure/azure-functions/functions-node-upgrade-v4).
- [Build configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration), [GitHub CLI release](https://github.com/cli/cli/releases/tag/v2.103.3).
문서는 계획 근거이며 실제 런타임·권한·리전 지원은 해당 실행 Task에서도 확인한다.

## Progress
- done: 4/7
- Active: P02-T01.
- P01-T01 `e880da2`: shared contracts, 137/137 tests, lint/build/diff checks passed on 2026-10-30. Deployment is not yet performed.
- P01-T02 `be54a6b`: authenticated-principal API and private Table adapter; Node22 unit94/94, actual isolated integration10/10, shared137/137, ci/lint/build/diff checks passed. Actual hosting authentication and cloud release remain pending.
- P01-T03 `f56b4fe`: SWA session bootstrap, mode precedence, minimal game identity and account-owned audio; targeted78/78, lint, normal/hosted builds/diff passed. No live Azure/Entra changes or deployment.
- P01-T04 `42466f6`: cloud bootstrap/FIFO/game integration; full root1269/1269, API95/95, isolated Azurite10/10, lint/API/normal/hosted builds/diff passed. P01 complete4/4. Production resources/login/URL and CI remain P02 work.
