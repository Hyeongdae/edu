# 덱스 탈출 넘버원 — Azure 배포

- 게임: https://ashy-cliff-0e5e4b600.1.azurestaticapps.net/
- 호스팅: Azure Static Web Apps Standard, East Asia
- 소스 저장소: `Hyeongdae/edu` `main`
- 배포 소스 SHA: `8c01fed3e00d90ed4d8f1df1d485098506306460`
- GitHub Actions: https://github.com/Hyeongdae/edu/actions/runs/40998761290
- API 기록 저장소: 비공개 Azure Table Storage `DexEscapePlayers`

## 확인한 내용

- GitHub Actions의 lint, 프런트엔드 1,269개 테스트, API 95개 테스트, API 통합 10개 테스트, 배포 테스트 25개, API/프런트엔드 운영 빌드와 아티팩트 검증이 통과했습니다.
- 배포 작업은 검증한 동일 SHA의 아티팩트를 게시했습니다.
- 로그인하지 않은 요청의 게임 화면, `/api/profile`, `/api/leaderboard` 요청은 모두 Entra 로그인으로 이동합니다. 가짜 `x-ms-client-principal` 헤더를 추가한 프로필 요청도 로그인 화면으로 이동하는 것을 확인했습니다.
- 회사 계정으로 실제 로그인한 뒤의 게임 플레이, 점수 저장, 별도 브라우저/기기에서 단계 해금 복원은 배포 환경에 사용자 로그인 세션이 없어 아직 확인하지 않았습니다. 브라우저에서 로그인 후 직접 확인해야 합니다.

## Entra 자격 증명 갱신

Entra 앱 등록 관리자 담당입니다. 현재 등록된 앱 자격 증명은 2027-04-28에 만료됩니다. 만료 전에 앱 등록에서 새 자격 증명을 추가하고 Azure Static Web Apps의 `GAME_ENTRA_CLIENT_SECRET` 애플리케이션 설정을 갱신한 다음 로그인/API를 확인하세요. 확인이 끝난 후 이전 자격 증명을 제거합니다. 비밀값은 이 문서나 저장소에 기록하지 않습니다.