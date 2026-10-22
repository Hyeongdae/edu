# Current Context

## Active Plan
[Pixel Stair Game Redesign](./plans/2026-10-22-pixel-stair-game-redesign.md)

## Active Phase
[P01 Pixel Stair Game](./phases/2026-10-22-pixel-stair-game-redesign/P01-pixel-stair-game/phase.md)

## Active Task
[T02 Route Scene and Pursuit](./phases/2026-10-22-pixel-stair-game-redesign/P01-pixel-stair-game/T02-route-scene-and-pursuit.md)

## Status
- T01 완료. 직전 길이를 반복하지 않는 4~6칸 공유 경로를 구현했고 지정 테스트 61개, lint, build를 통과했다.
- P01 진행률 1/4. 다음 활성 작업은 T02이며 실제 경로 기반의 장면과 추격 동작을 연결한다.

## Next Step (IMPORTANT)
T02 청사진만 읽고 `src/game/stairSceneModel.ts`, `src/game/StairScene.tsx`, `src/game/GameScreen.tsx`, `src/game/game.css`와 명시된 검증 파일을 구현한다. T01의 route를 공유하여 중앙 플레이어·지나온 4칸·앞 6칸·경로 추격 및 잡힘을 표시하고, 검증·커밋 후 T03으로 이동한다.
