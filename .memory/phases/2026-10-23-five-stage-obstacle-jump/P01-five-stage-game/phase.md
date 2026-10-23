# Phase: P01 Five Stage Game

## Tasks

| Task | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| T01 | done ✅ | 새 규칙표/5단계·최종 클리어/HUD/v3 랭킹 | [T01](./T01-five-stages-and-ranking.md) |
| T02 | done ✅ | 긴5~9·짧은1~3 패턴/보관 API/긴 구간 장애물 생성 | [T02](./T02-route-and-obstacle-generation.md) |
| T03 | done ✅ | 시간 기반 독립 추격/경로 보존/잡힘/전진 모션 | [T03](./T03-timed-pursuer.md) |
| T04 | done ✅ | 점프·충돌/Space/3버튼/보이는 상자/2·4점 표시 | [T04](./T04-obstacle-jump-gameplay.md) |
| T05 | done ✅ | 전용 점프 아크/빠른 입력/실제 추격·전체 반응형 검증 | [T05](./T05-jump-motion-and-validation.md) |

## Progress

- done: 5/5 (active: none)
- Status: done
- Revision: 2026-10-23 후속 결정 반영. 기존4개 Task 초안은 구현·커밋되지 않았고 새5개로 교체했다.

## Execution Rule

current.md의 Active Task 한 개만 구현/검증/커밋하고 다음 포인터로 이동한다. 각 Task에는 선행 계약이 들어 있다. 완료 후 phase/current를 동기화하며 마지막에는 계획도 완료한다. 넘어짐 소리 청취 문제는 별도다.

## Last Validation

- T01 완료:12a49d3. 지정7파일192tests/lint/build 통과. 브라우저는 T05에서 검증한다.
- T02 완료:7d1f426. 지정6파일202tests/lint/build 통과,500kB초과 청크 경고는 별도. 브라우저는 T05에서 검증한다.
- T03 완료:42dab25. 지정10파일298tests/lint/build 통과,500kB초과 청크 경고는 별도. 실제 브라우저/reduced-motion 육안 검증은 T05다.

- T04 완료:7a61ed2. 지정12파일335tests/lint/build 통과. 상자/실제 충돌/Space2칸 점프/3버튼/2·4점과 오디오 호출 연결. 실제 seeded 다중승급 회귀 포함. JS542.45kB/gzip151.79kB의500kB 경고는 별도. T04 시점의 일반 오르기 피드백은 T05에서 전용 점프로 완성했다.

- T05 완료:e369a28. 지정14파일352tests/lint/build 통과. 좌우300ms clip밖 점프/단일 전경sprite/모션감소, 모바일 자동높이 controls·footer와 내부스크롤로 확대 겹침 수정. 격리Chrome 네viewport 전체5단계/기록1회/재시작,320px150/200%글자·터치·좌우모션,실제12초무입력3잡힘과실제문서중지복귀,제어시각간격/95초설정/마감·저장오류/보존을 확인했다. 증거와 방식/한계는T05 Validation Results에 있다. JS543.45kB/gzip152.03kB 경고와 별도 소리 청취 문제는 남아 있다.
