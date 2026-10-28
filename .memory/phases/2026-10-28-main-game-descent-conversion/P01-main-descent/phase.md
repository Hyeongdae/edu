# Phase: P01 Main Descent

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | done ✅ | 새 기록 scope/한정 구키 정리 지원; main 연결 전 | [T01](./T01-descent-record-storage.md) |
| T02 | done ✅ |5단계 메인 하강/새 scope/오디오 재시도 focus 복구 | [T02](./T02-main-descent-integration.md) |
| T03 | done ✅ | 실제5단계/새 기록/모바일·시간·설정 focus 검증 | [T03](./T03-main-descent-browser-validation.md) |

## Progress

- done: 3/3 (active: none)
- Status: completed
- 2026-10-28 T01 완료: `9b6ba54`. 지정 6파일 242/242 tests(32.11초/workers2), lint/build/diff check 통과. 기존 main/실험/auth/audio/config 경로 diff 없음. 실제 브라우저 저장소는 접근하지 않았다.
- T02 완료: `5217dfa`. 지정27파일727/727tests(54.39초/workers2/skip0), lint/build/diff check 통과. main5단계 하강 투영/모션·문구·새 기록scope와 D11 오디오 재시도 focus 복구를 연결했다. core/규칙/기본 상승 모델/실험/App/authConfig/audio/public/config/package diff 없음.
- JS553.68kB(gzip154.76kB)/CSS57.30kB(gzip10.95kB), 기존500kB 초과 번들 크기 유지(이번 로그 경고 재출력 없음). 로그: `%TEMP%\main-descent-t02-2026-10-28\`.
- T03 완료: `8da80d6`. 소유 브라우저9 driver/네 화면의 실제5단계·새 기록 보존·native 오디오 재시도 focus·모션/실제 시간/큰 글자·인증/실험 경계 통과. 지정27파일727/727tests(56.60초/workers2/skip0), lint/build/diff check 통과. 제품 source 추가 수정 없음. `%TEMP%\main-game-descent-conversion-2026-10-28\evidence-index.json`에145artifact/PNG82·필수14사진을 연결했다.
- 최종 build JS553.68kB/CSS57.30kB이며 기존500kB chunk 경고 출력. 전체 진행은 제어 시계 UI, 실제 추격/lifecycle·함수 fixture/공개 계정 fixture를 구분했다. 실제 Entra tenant 로그인·스피커 청취는 미검증이다. 소유 helpers만 종료하고 기존 demo PID21048/`http://127.0.0.1:5175/` HTTP200·DEV demo 진입을 유지했다. 사용자 profile/실제 기록에는 직접 접근하지 않았다. 신규 범위 밖 결함: 특이사항 없음.

## Execution Rule

current.md의 Active Task 한 개만 구현·검증·커밋한다. 성공 시 Task done/지정 commit→phase 진행률→plan/current 포인터를 별도 metadata commit으로 동기화한다. T01은 main 연결 금지, T02에서 처음 하강·descent 저장을 함께 활성화한다. T03 실제 브라우저 검증 전에는 전체 계획을 completed로 표시하지 않는다.

## Sources and Baseline

- [Decision](../../../decisions/2026-10-28-main-game-descent-conversion.md)
- [Plan](../../../plans/2026-10-28-main-game-descent-conversion.md)
- Baseline `bdf18d5`; previous local-descent completed3/3/T03 `04fdeea`. 이전 계획과 결정문은 수정하지 않는다.
