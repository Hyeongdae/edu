import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import { applyInput, createGameState, resetGame, startGame, tickGame } from "./gameEngine";
import { ControlButtons } from "./ControlButtons";
import { GameHud } from "./GameHud";
import { StairScene } from "./StairScene";
import type { GameInput } from "./types";
import { LeaderboardPanel } from "../leaderboard/LeaderboardPanel";
import { readLeaderboard, saveBestScore, type LeaderboardEntry } from "../leaderboard/leaderboard";
import { AudioControls } from "../audio/AudioControls";
import type { AudioController } from "../audio/audioController";
import type { AudioPreferences } from "../audio/audioPreferences";
import "./game.css";

interface GameScreenProps {
  account: AccountInfo;
  audioController?: AudioController;
  audioPreferences?: AudioPreferences;
  autoplayBlocked?: boolean;
  onAudioPreferencesChange?: (next: AudioPreferences) => void;
  onEnableAudio?: () => void;
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

export function GameScreen({
  account,
  audioController,
  audioPreferences,
  autoplayBlocked = false,
  onAudioPreferencesChange,
  onEnableAudio,
}: GameScreenProps) {
  const [gameState, setGameState] = useState(() => createGameState());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => readLeaderboard());
  const [saveError, setSaveError] = useState(false);
  const [climbAnimationKey, setClimbAnimationKey] = useState(0);
  const [isClimbing, setIsClimbing] = useState(false);
  const [scoreGain, setScoreGain] = useState<number | null>(null);
  const [scoreAnimationKey, setScoreAnimationKey] = useState(0);
  const scoreSavedRef = useRef(false);
  const previousStepsRef = useRef(gameState.stepsClimbed);
  const climbTimeoutRef = useRef<number | undefined>(undefined);
  const previousScoreRef = useRef(gameState.score);
  const scoreGainTimeoutRef = useRef<number | undefined>(undefined);
  const previousMistakeRef = useRef(gameState.lastMistake);
  const previousEventActiveRef = useRef(gameState.eventEndsAt !== null);

  const handleInput = useCallback((input: GameInput) => {
    const inputTime = Date.now();
    setNowMs(inputTime);
    setGameState((state) => applyInput(state, input, inputTime));
  }, []);

  const handleStart = () => {
    scoreSavedRef.current = false;
    setSaveError(false);
    setNowMs(Date.now());
    setGameState((state) => startGame(state.status === "game-over" ? resetGame() : state));
    void audioController?.startBgm();
  };

  useEffect(() => {
    const climbedSuccessfully = gameState.stepsClimbed > previousStepsRef.current;

    if (climbedSuccessfully) {
      audioController?.playFootstep();
      setClimbAnimationKey((key) => key + 1);
      setIsClimbing(true);

      if (climbTimeoutRef.current !== undefined) {
        window.clearTimeout(climbTimeoutRef.current);
      }
      climbTimeoutRef.current = window.setTimeout(() => {
        setIsClimbing(false);
        climbTimeoutRef.current = undefined;
      }, 300);
    } else if (gameState.stepsClimbed < previousStepsRef.current) {
      if (climbTimeoutRef.current !== undefined) {
        window.clearTimeout(climbTimeoutRef.current);
        climbTimeoutRef.current = undefined;
      }
      setIsClimbing(false);
    }

    if (gameState.lastMistake && climbTimeoutRef.current !== undefined) {
      window.clearTimeout(climbTimeoutRef.current);
      climbTimeoutRef.current = undefined;
      setIsClimbing(false);
    }

    previousStepsRef.current = gameState.stepsClimbed;

    return () => {
      if (climbTimeoutRef.current !== undefined) {
        window.clearTimeout(climbTimeoutRef.current);
      }
    };
  }, [audioController, gameState.lastMistake, gameState.stepsClimbed]);

  useEffect(() => {
    if (gameState.score > previousScoreRef.current) {
      setScoreGain(gameState.score - previousScoreRef.current);
      setScoreAnimationKey((key) => key + 1);

      if (scoreGainTimeoutRef.current !== undefined) {
        window.clearTimeout(scoreGainTimeoutRef.current);
      }
      scoreGainTimeoutRef.current = window.setTimeout(() => {
        setScoreGain(null);
        scoreGainTimeoutRef.current = undefined;
      }, 700);
    } else if (gameState.score < previousScoreRef.current) {
      if (scoreGainTimeoutRef.current !== undefined) {
        window.clearTimeout(scoreGainTimeoutRef.current);
        scoreGainTimeoutRef.current = undefined;
      }
      setScoreGain(null);
    }

    previousScoreRef.current = gameState.score;

    return () => {
      if (scoreGainTimeoutRef.current !== undefined) {
        window.clearTimeout(scoreGainTimeoutRef.current);
        scoreGainTimeoutRef.current = undefined;
      }
    };
  }, [gameState.score]);

  useEffect(() => {
    if (gameState.lastMistake && !previousMistakeRef.current) audioController?.playFall();
    previousMistakeRef.current = gameState.lastMistake;
  }, [audioController, gameState.lastMistake]);

  useEffect(() => {
    const eventActive = gameState.eventEndsAt !== null;
    if (eventActive !== previousEventActiveRef.current) audioController?.setEventActive(eventActive);
    previousEventActiveRef.current = eventActive;
  }, [audioController, gameState.eventEndsAt]);

  useEffect(() => {
    if (gameState.status === "game-over") audioController?.stopBgm();
  }, [audioController, gameState.status]);

  useEffect(() => {
    if (gameState.status !== "game-over" || scoreSavedRef.current) return;
    scoreSavedRef.current = true;

    const result = account.homeAccountId
      ? saveBestScore({
          accountId: account.homeAccountId,
          displayName: account.name || "이름 없음",
          bestScore: gameState.score,
        })
      : { entries: leaderboard, saved: false };
    window.setTimeout(() => {
      setLeaderboard(result.entries);
      setSaveError(!result.saved);
    }, 0);
  }, [account.homeAccountId, account.name, gameState.score, gameState.status, leaderboard]);

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
    <main className="stair-game" data-game-status={gameState.status}>
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

        {audioPreferences && onAudioPreferencesChange && onEnableAudio && (
          <AudioControls
            preferences={audioPreferences}
            onChange={onAudioPreferencesChange}
            autoplayBlocked={autoplayBlocked}
            onEnableAudio={onEnableAudio}
          />
        )}

        <GameHud
          state={gameState}
          eventSecondsLeft={eventSecondsLeft}
          scoreGain={scoreGain}
          scoreAnimationKey={scoreAnimationKey}
        />

        <div className="game-layout" data-game-status={gameState.status}>
          <StairScene
            state={gameState}
            climbAnimationKey={climbAnimationKey}
            isClimbing={isClimbing && !gameState.lastMistake}
          />
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
        ) : gameState.status === "playing" ? (
          <ControlButtons
            onForward={() => handleInput("forward")}
            onTurn={() => handleInput("turn")}
            disabled={controlsDisabled}
          />
        ) : (
          <section className="game-over-panel" aria-labelledby="game-over-title">
            <div className="game-over-result">
              <span className="game-over-icon" aria-hidden="true">🏁</span>
              <p className="game-over-kicker">이번 도전 결과</p>
              <h2 id="game-over-title">{gameState.score}점</h2>
              <p>계단 {gameState.stepsClimbed}개를 올랐어요.</p>
              {saveError && <p className="leaderboard-error" role="status">기록을 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.</p>}
              <button className="start-button restart-button" type="button" onClick={handleStart}>
                <span aria-hidden="true">↻</span> 다시 시작
              </button>
            </div>
            <LeaderboardPanel entries={leaderboard} currentAccountId={account.homeAccountId} />
          </section>
        )}
        <p className="game-footer">방향을 잘 맞춰 계속 올라가세요!</p>
      </div>
    </main>
  );
}
