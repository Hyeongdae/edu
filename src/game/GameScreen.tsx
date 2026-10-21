import { useCallback, useEffect, useState } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import { applyInput, createGameState, startGame, tickGame } from "./gameEngine";
import { ControlButtons } from "./ControlButtons";
import { GameHud } from "./GameHud";
import { StairScene } from "./StairScene";
import type { GameInput } from "./types";
import "./game.css";

interface GameScreenProps {
  account: AccountInfo;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

export function GameScreen({ account }: GameScreenProps) {
  const [gameState, setGameState] = useState(() => createGameState());
  const [nowMs, setNowMs] = useState(() => Date.now());

  const handleInput = useCallback((input: GameInput) => {
    const inputTime = Date.now();
    setNowMs(inputTime);
    setGameState((state) => applyInput(state, input, inputTime));
  }, []);

  const handleStart = () => {
    setNowMs(Date.now());
    setGameState((state) => startGame(state));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "d") {
        event.preventDefault();
        handleInput("forward");
      } else if (key === "j") {
        event.preventDefault();
        handleInput("turn");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleInput]);

  useEffect(() => {
    const timersActive = gameState.eventEndsAt !== null || gameState.recoveryEndsAt !== null;
    if (!timersActive) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const tickTime = Date.now();
      setNowMs(tickTime);
      setGameState((state) => tickGame(state, tickTime));
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [gameState.eventEndsAt, gameState.recoveryEndsAt]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const visibleAt = Date.now();
      setNowMs(visibleAt);
      setGameState((state) => tickGame(state, visibleAt));
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const eventSecondsLeft =
    gameState.eventEndsAt === null
      ? 0
      : Math.max(0, Math.ceil((gameState.eventEndsAt - nowMs) / 1000));
  const controlsDisabled =
    gameState.status !== "playing" || gameState.recoveryEndsAt !== null;

  return (
    <main className="stair-game">
      <div className="game-shell">
        <header className="game-header">
          <div className="game-brand">
            <span className="brand-mark" aria-hidden="true">↗</span>
            <div>
              <p className="brand-kicker">사내 랭킹 챌린지</p>
              <h1>계단 오르기</h1>
            </div>
          </div>
          <div className="account-chip">
            <span className="account-avatar" aria-hidden="true">
              {(account.name ?? account.username).slice(0, 1)}
            </span>
            <span>{account.name ?? account.username}</span>
          </div>
        </header>

        <GameHud state={gameState} eventSecondsLeft={eventSecondsLeft} />

        <div className="game-layout">
          <StairScene state={gameState} />
          <aside className="game-side-panel" aria-label="조작 방법">
            <div className="instruction-card">
              <span className="instruction-icon" aria-hidden="true">⌨</span>
              <div>
                <strong>키보드 조작</strong>
                <p><kbd>D</kbd> 앞으로 한 칸 <span>·</span> <kbd>J</kbd> 방향 바꾸기</p>
              </div>
            </div>
            <div className="chase-card">
              <span className="chase-icon" aria-hidden="true">!</span>
              <div>
                <strong>뒤에서 누가 쫓아와요!</strong>
                <p>잘못 누르면 추격자가 가까워집니다.</p>
              </div>
            </div>
          </aside>
        </div>

        {gameState.status === "ready" ? (
          <button className="start-button" type="button" onClick={handleStart}>
            <span aria-hidden="true">▶</span> 시작하기
          </button>
        ) : (
          <ControlButtons
            onForward={() => handleInput("forward")}
            onTurn={() => handleInput("turn")}
            disabled={controlsDisabled}
          />
        )}
        <p className="game-footer">방향을 잘 맞춰 계속 올라가세요!</p>
      </div>
    </main>
  );
}
