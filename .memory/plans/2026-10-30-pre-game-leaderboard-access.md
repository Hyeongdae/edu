# Plan: Pre-game Leaderboard Access

## Goal
타이틀 화면과 단계 선택 화면에서 기존 TOP 10 랭킹을 모달로 열 수 있게 한다. 모달을 닫으면 열기 전 화면과 선택한 단계로 돌아가고, 랭킹 저장·정렬·로그인 동작은 유지한다.

## Status
`done` — P01-T01 완료. `.memory/current.md`는 이전에 보류한 Azure release 검증으로 돌아간다.

## Phases
| Phase | Status | Summary | Blueprint |
| :--- | :--- | :--- | :--- |
| P01 | `done ✅` | 기존 랭킹 패널을 재사용해 타이틀/단계 선택 진입점과 접근 가능한 모달 구현 | [P01](../phases/2026-10-30-pre-game-leaderboard-access/P01-title-stage-leaderboard/phase.md) |

## Scope
- 타이틀 화면에 `랭킹 보기` 버튼을 추가한다.
- 단계 선택 화면에 `랭킹 보기` 버튼을 추가한다.
- 두 버튼은 같은 전체 단계 TOP 10을 게임 배경 위 모달로 연다.
- 운영 Entra 앱은 기존 회사 공용 서버 랭킹을 사용하고, 로컬 데모는 기존 브라우저 랭킹을 사용한다.
- 기존 게임 종료 화면의 랭킹과 정렬, 점수 저장, 진행도 저장, API/auth 계약은 변경하지 않는다.
