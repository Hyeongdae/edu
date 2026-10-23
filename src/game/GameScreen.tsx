import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import { applyInput, createGameState, getStageSecondsLeft, resetGame, resumeGameAfterPause, startGame, tickGame } from "./gameEngine";
import { ControlButtons } from "./ControlButtons";
import { GameHud } from "./GameHud";
import { StairScene } from "./StairScene";
import { PixelIcon } from "./pixel/PixelIcon";
import type { GameInput } from "./types";
import { LeaderboardPanel } from "../leaderboard/LeaderboardPanel";
import { readLeaderboard, saveBestScore, type LeaderboardEntry } from "../leaderboard/leaderboard";
import { AudioControls } from "../audio/AudioControls";
import type { AudioController } from "../audio/audioController";
import type { AudioPreferences } from "../audio/audioPreferences";
import "./game.css";
import "./pixel-theme.css";

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
  const [pursuerAnimationTime, setPursuerAnimationTime] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const scoreSavedRef = useRef(false);
  const settingsOpenedAtRef = useRef<number | null>(null);
  const isSettingsOpenRef = useRef(false);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const settingsCloseRef = useRef<HTMLButtonElement | null>(null);
  const previousStepsRef = useRef(gameState.stepsClimbed);
  const climbTimeoutRef = useRef<number | undefined>(undefined);
  const previousScoreRef = useRef(gameState.score);
  const scoreGainTimeoutRef = useRef<number | undefined>(undefined);
  const previousRecoveryEndsAtRef = useRef(gameState.recoveryEndsAt);
  const previousPlayerCaptureRef = useRef(gameState.captureCount);
  const pursuerTimeoutRef = useRef<number | undefined>(undefined);
  const previousEventActiveRef = useRef(gameState.eventEndsAt !== null);

  const openSettings = useCallback(() => {
    if (settingsOpenedAtRef.current !== null) return;
    const openedAt = Date.now();
    setNowMs(openedAt);
    setGameState((state) => tickGame(state, openedAt));
    settingsOpenedAtRef.current = openedAt;
    isSettingsOpenRef.current = true;
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    const openedAt = settingsOpenedAtRef.current;
    if (openedAt === null) return;
    const closedAt = Date.now();
    settingsOpenedAtRef.current = null;
    isSettingsOpenRef.current = false;
    setIsSettingsOpen(false);
    setNowMs(closedAt);
    setGameState((state) => resumeGameAfterPause(state, openedAt, closedAt));
    settingsTriggerRef.current?.focus();
  }, []);

  const handleInput = useCallback((input: GameInput) => {
    if (isSettingsOpenRef.current) return;
    const inputTime = Date.now();
    setNowMs(inputTime);
    setGameState((state) => applyInput(state, input, inputTime));
  }, []);

  const handleStart = () => {
    const startedAt = Date.now();
    scoreSavedRef.current = false;
    setSaveError(false);
    setNowMs(startedAt);
    const nextState = startGame(gameState.status === "game-over" ? resetGame() : gameState, startedAt);
    setGameState(nextState);
    void audioController?.startBgm();
  };

  useEffect(() => {
    const climbedSuccessfully = gameState.stepsClimbed > previousStepsRef.current;
    const captured = gameState.captureCount !== previousPlayerCaptureRef.current;
    const cancel = () => {
      window.clearTimeout(climbTimeoutRef.current);
      climbTimeoutRef.current = undefined;
      setIsClimbing(false);
    };
    if (climbedSuccessfully) {
      audioController?.playFootstep();
      setClimbAnimationKey((key) => key + 1);
    }
    if (gameState.status !== "playing" || gameState.lastMistake || captured || gameState.stepsClimbed < previousStepsRef.current) {
      cancel();
    } else if (climbedSuccessfully) {
      cancel();
      setIsClimbing(true);
      climbTimeoutRef.current = window.setTimeout(() => {
        setIsClimbing(false);
        climbTimeoutRef.current = undefined;
      }, 300);
    }
    previousStepsRef.current = gameState.stepsClimbed;
    previousPlayerCaptureRef.current = gameState.captureCount;
  }, [audioController, gameState.lastMistake, gameState.stepsClimbed, gameState.status, gameState.captureCount]);

  const pursuerMoveAt = gameState.lastPursuerMove?.atMs ?? null;
  const pursuerAnimationKey = pursuerMoveAt ?? 0;
  const isPursuerMoving = pursuerMoveAt !== null && gameState.status === "playing" &&
    gameState.captureEndsAt === null && !isSettingsOpen &&
    Math.max(nowMs, pursuerAnimationTime) < pursuerMoveAt + 240;

  useEffect(() => {
    if (pursuerMoveAt === null) return;
    const endsAt = pursuerMoveAt + 240;
    const suppressed = gameState.status !== "playing" || gameState.captureEndsAt !== null || isSettingsOpen;
    pursuerTimeoutRef.current = window.setTimeout(() => {
      setPursuerAnimationTime(endsAt);
      pursuerTimeoutRef.current = undefined;
    }, suppressed ? 0 : Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(pursuerTimeoutRef.current);
  }, [pursuerMoveAt, gameState.status, gameState.captureEndsAt, isSettingsOpen]);

  useEffect(() => () => {
    window.clearTimeout(climbTimeoutRef.current);
    window.clearTimeout(pursuerTimeoutRef.current);
  }, []);

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
    const mistakeStarted = gameState.lastMistake && gameState.recoveryEndsAt !== null &&
      gameState.recoveryEndsAt !== previousRecoveryEndsAtRef.current;

    if (mistakeStarted) {
      audioController?.playFall();
    }

    previousRecoveryEndsAtRef.current = gameState.recoveryEndsAt;
  }, [audioController, gameState.lastMistake, gameState.recoveryEndsAt]);

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
          bestStage: gameState.stage,
          bestScore: gameState.score,
        })
      : { entries: leaderboard, saved: false };
    window.setTimeout(() => {
      setLeaderboard(result.entries);
      setSaveError(!result.saved);
    }, 0);
  }, [account.homeAccountId, account.name, gameState.stage, gameState.score, gameState.status, leaderboard]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isSettingsOpenRef.current || isTextEntryTarget(event.target)) {
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
    if (isSettingsOpen) return undefined;
    const timersActive = gameState.status === "playing" || gameState.recoveryEndsAt !== null || gameState.captureEndsAt !== null;
    if (!timersActive) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (isSettingsOpenRef.current) return;
      const tickTime = Date.now();
      setNowMs((previousTime) => {
        const stageChanged = getStageSecondsLeft(gameState, previousTime) !== getStageSecondsLeft(gameState, tickTime);
        const eventChanged = gameState.eventEndsAt !== null &&
          Math.max(0, Math.ceil((gameState.eventEndsAt - previousTime) / 1000)) !==
          Math.max(0, Math.ceil((gameState.eventEndsAt - tickTime) / 1000));
        const pursuerDue = gameState.status === "playing" && gameState.nextPursuerStepAt !== null && tickTime >= gameState.nextPursuerStepAt;
        return stageChanged || eventChanged || pursuerDue ? tickTime : previousTime;
      });
      setGameState((state) => tickGame(state, tickTime));
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [gameState, isSettingsOpen]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || isSettingsOpenRef.current) {
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
    gameState.status !== "playing" || gameState.recoveryEndsAt !== null || isSettingsOpen;
  const pursuerCatchVisible = gameState.captureEndsAt !== null &&
    (gameState.status === "playing" || gameState.endReason === "caught");

  useEffect(() => {
    if (isSettingsOpen) settingsCloseRef.current?.focus();
  }, [isSettingsOpen]);

  const onSettingsDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSettings();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <main className="stair-game pixel-theme" data-game-status={gameState.status}>
      <div className="game-shell">
        <div
          className="game-frame"
          data-game-status={gameState.status}
          data-stage={gameState.stage}
          data-pursuer-catching={pursuerCatchVisible}
        >
          <button
            ref={settingsTriggerRef}
            className="game-settings-button"
            type="button"
            aria-label="게임 설정"
            aria-expanded={isSettingsOpen}
            aria-controls="game-settings-dialog"
            onClick={openSettings}
          >
            <PixelIcon name="settings" />
          </button>

          <div className="game-stage">
            <GameHud
              state={gameState}
              eventSecondsLeft={eventSecondsLeft}
              scoreGain={scoreGain}
              scoreAnimationKey={scoreAnimationKey}
              stageSecondsLeft={getStageSecondsLeft(gameState, nowMs)}
            />

            <div className="game-layout" data-game-status={gameState.status}>
              <StairScene
                state={gameState}
                climbAnimationKey={climbAnimationKey}
                isClimbing={isClimbing && !gameState.lastMistake}
                pursuerAnimationKey={pursuerAnimationKey}
                isPursuerMoving={isPursuerMoving}
                isPursuerCaught={pursuerCatchVisible}
              />
            </div>
          </div>

          {gameState.status === "ready" ? (
            <button className="start-button" type="button" onClick={handleStart}>
              <PixelIcon name="forward" size={20} /> 시작하기
            </button>
          ) : gameState.status === "playing" ? (
            <ControlButtons
              onForward={() => handleInput("forward")}
              onTurn={() => handleInput("turn")}
              disabled={controlsDisabled}
            />
          ) : (
            <section
              className="game-over-panel"
              aria-labelledby="game-over-title"
            >
              <div className="game-over-result">
                <PixelIcon name="flag" className="game-over-icon" size={36} />
                <p className="game-over-kicker">이번 도전 결과</p>
                <h2 id="game-over-title">{gameState.score}점</h2>
                <p className="game-over-stage">도달 단계 {gameState.stage}단계</p>
                <p className="game-over-reason">{gameState.endReason === "cleared" ? "최종 클리어!" : gameState.endReason === "time-limit" ? "시간 초과" : "추격자에게 잡혔어요"}</p>
                <p>계단 {gameState.stepsClimbed}개를 올랐어요.</p>
                {saveError && <p className="leaderboard-error" role="status">기록을 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.</p>}
                <button className="start-button restart-button" type="button" onClick={handleStart}>
                  <PixelIcon name="restart" size={20} /> 다시 시작
                </button>
              </div>
              <LeaderboardPanel entries={leaderboard} currentAccountId={account.homeAccountId} />
            </section>
          )}
          <p className="game-footer">
            <span className="desktop-control-hint"><kbd>D</kbd> 한 칸 오르기 <span>·</span> <kbd>J</kbd> 방향 바꾸며 오르기</span>
            <span className="mobile-control-hint">방향을 잘 맞춰 계속 올라가세요!</span>
          </p>
          {isSettingsOpen && (
            <div
              className="settings-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeSettings();
              }}
            >
              <section
                id="game-settings-dialog"
                className="settings-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="game-settings-title"
                onKeyDown={onSettingsDialogKeyDown}
              >
                <header className="settings-dialog-header">
                  <div className="game-brand">
                    <span className="brand-mark"><PixelIcon name="stair" /></span>
                    <div>
                      <p className="brand-kicker">사내 랭킹 챌린지</p>
                      <h2 id="game-settings-title">게임 설정</h2>
                    </div>
                  </div>
                  <button
                    ref={settingsCloseRef}
                    className="settings-close-button"
                    type="button"
                    aria-label="설정 닫기"
                    onClick={closeSettings}
                  >
                    <PixelIcon name="close" size={20} />
                  </button>
                </header>

                <div className="settings-content">
                  <div className="settings-account account-chip">
                    <span className="account-avatar" aria-hidden="true">
                      {(account.name ?? account.username).slice(0, 1)}
                    </span>
                    <span>{account.name ?? account.username}</span>
                  </div>

                  {audioPreferences && onAudioPreferencesChange && onEnableAudio && (
                    <AudioControls
                      preferences={audioPreferences}
                      onChange={onAudioPreferencesChange}
                      autoplayBlocked={autoplayBlocked}
                      onEnableAudio={onEnableAudio}
                    />
                  )}

                  <div className="settings-help-grid">
                    <section className="instruction-card">
                      <span className="instruction-icon"><PixelIcon name="forward" size={20} /></span>
                      <div>
                        <strong>조작 방법</strong>
                        <p><kbd>D</kbd> 한 칸 오르기 <span>·</span> <kbd>J</kbd> 모퉁이에서 방향 바꾸기</p>
                        <p>모바일에서는 화면의 화살표 버튼을 사용하세요.</p>
                      </div>
                    </section>
                    <section className="chase-card">
                      <span className="chase-icon"><PixelIcon name="flag" size={20} /></span>
                      <div>
                        <strong>뒤쫓아오는 추격자</strong>
                        <p>추격자는 일정 시간마다 한 칸씩 올라와요. 잘못 입력하면 0.5초 동안 멈춰요. 잡히면 기회를 잃고, 세 번 잡히면 게임이 끝납니다.</p>
                      </div>
                    </section>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
