import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import { applyInput, continueGame, createGameState, getStageSecondsLeft, quitAtCheckpoint, resetGame, resumeGameAfterPause, startGame, tickGame } from "./gameEngine";
import { CheckpointPanel } from "./CheckpointPanel";
import { StageSelectPanel } from "./StageSelectPanel";
import { readStageProgress, saveStageProgress } from "./stageProgress";
import { getHighestUnlockedStage } from "./stageRules";
import { getPursuerMotionDurationMs, PURSUER_POLL_INTERVAL_MS } from "./pursuitRules";
import { formatRemainingTimeCs } from "./stageResult";
import { useOfficeExitEnding } from "./useOfficeExitEnding";
import { OfficeExitEnding } from "./OfficeExitEnding";
import { ControlButtons } from "./ControlButtons";
import { GameHud } from "./GameHud";
import { StairScene } from "./StairScene";
import { PixelIcon } from "./pixel/PixelIcon";
import type { ClearedStage, GameInput, GameStage } from "./types";
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
  const [initialProfile] = useState(() => {
    const entries = readLeaderboard(undefined, "descent");
    const progress = readStageProgress(account.homeAccountId, undefined, "descent");
    const knownHighest = progress.highestClearedStage;
    return { entries, knownHighest, progressAvailable: progress.available };
  });
  const [gameState, setGameState] = useState(() => createGameState(undefined, {
    stage: getHighestUnlockedStage(initialProfile.knownHighest), highestClearedStage: initialProfile.knownHighest,
  }));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialProfile.entries);
  const [progressError, setProgressError] = useState(!initialProfile.progressAvailable);
  const [progressUnavailable, setProgressUnavailable] = useState(!initialProfile.progressAvailable);
  const progressSavedRef = useRef({ accountId: account.homeAccountId, clearedStage: 0 });
  const [saveError, setSaveError] = useState(false);
  const [climbAnimationKey, setClimbAnimationKey] = useState(0);
  const [isClimbing, setIsClimbing] = useState(false);
  const [scoreGain, setScoreGain] = useState<number | null>(null);
  const [scoreGainIsBonus, setScoreGainIsBonus] = useState(false);
  const [scoreAnimationKey, setScoreAnimationKey] = useState(0);
  const [pursuerAnimationTime, setPursuerAnimationTime] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const runStartedRef = useRef(false);
  const settingsOpenedAtRef = useRef<number | null>(null);
  const isSettingsOpenRef = useRef(false);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const settingsCloseRef = useRef<HTMLButtonElement | null>(null);
  const restartButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsDialogRef = useRef<HTMLElement | null>(null);
  const previousSettingsOpenRef = useRef(false);
  const previousStepsRef = useRef(gameState.stepsClimbed);
  const climbTimeoutRef = useRef<number | undefined>(undefined);
  const previousScoreRef = useRef({ stage: gameState.stage, score: gameState.score });
  const scoreGainTimeoutRef = useRef<number | undefined>(undefined);
  const previousRecoveryEndsAtRef = useRef(gameState.recoveryEndsAt);
  const previousPlayerCaptureRef = useRef(gameState.captureCount);
  const pursuerTimeoutRef = useRef<number | undefined>(undefined);
  const previousEventActiveRef = useRef(gameState.eventEndsAt !== null);

  const openSettings = useCallback(() => {
    if (settingsOpenedAtRef.current !== null || gameState.status !== "playing") return;
    const openedAt = Date.now();
    const reconciled = tickGame(gameState, openedAt);
    setNowMs(openedAt);
    setGameState(reconciled);
    if (reconciled.status !== "playing") return;
    settingsOpenedAtRef.current = openedAt;
    isSettingsOpenRef.current = true;
    setIsSettingsOpen(true);
  }, [gameState]);

  const closeSettings = useCallback(() => {
    const openedAt = settingsOpenedAtRef.current;
    if (openedAt === null) return;
    const closedAt = Date.now();
    settingsOpenedAtRef.current = null;
    isSettingsOpenRef.current = false;
    setIsSettingsOpen(false);
    setNowMs(closedAt);
    setGameState((state) => resumeGameAfterPause(state, openedAt, closedAt));
  }, []);

  const handleInput = useCallback((input: GameInput) => {
    if (isSettingsOpenRef.current) return;
    const inputTime = Date.now();
    setNowMs(inputTime);
    setGameState((state) => applyInput(state, input, inputTime));
  }, []);

  const readKnownHighest = (): ClearedStage => {
    const progress = readStageProgress(account.homeAccountId, undefined, "descent");
    setProgressUnavailable(!progress.available);
    return Math.max(gameState.highestClearedStage, initialProfile.knownHighest, progress.highestClearedStage) as ClearedStage;
  };

  const handleSelectStage = (stage: GameStage) => {
    if (isSettingsOpenRef.current || gameState.status !== "ready" || runStartedRef.current || stage === gameState.stage) return;
    const knownHighest = readKnownHighest();
    if (stage > getHighestUnlockedStage(knownHighest)) return;
    const preview = resetGame(undefined, { stage, highestClearedStage: knownHighest });
    setNowMs(Date.now());
    setGameState(preview);
  };

  const handleShowStageSelection = () => {
    if (isSettingsOpenRef.current || gameState.status !== "game-over" || !runStartedRef.current) return;
    const knownHighest = readKnownHighest();
    const preview = resetGame(undefined, { stage: getHighestUnlockedStage(knownHighest), highestClearedStage: knownHighest });
    runStartedRef.current = false;
    setNowMs(Date.now());
    setGameState(preview);
  };

  const handleStart = () => {
    if (isSettingsOpenRef.current || gameState.status !== "ready" || runStartedRef.current) return;
    const startedAt = Date.now();
    const nextState = startGame(gameState, startedAt);
    runStartedRef.current = true;
    progressSavedRef.current = { accountId: account.homeAccountId, clearedStage: 0 };
    setSaveError(false);
    setNowMs(startedAt);
    setGameState(nextState);
    void audioController?.startBgm();
  };

  const handleContinue = () => {
    const continuedAt = Date.now();
    setNowMs(continuedAt);
    setGameState((state) => continueGame(state, continuedAt));
  };
  const handleQuit = () => {
    const quitAt = Date.now();
    setNowMs(quitAt);
    setGameState((state) => quitAtCheckpoint(state, quitAt));
  };

  useEffect(() => {
    const clearedStage = gameState.clearedStageThisRun;
    const previous = progressSavedRef.current;
    if (clearedStage === 0 || (previous.accountId === account.homeAccountId && previous.clearedStage >= clearedStage)) return;
    progressSavedRef.current = { accountId: account.homeAccountId, clearedStage };
    const result = saveStageProgress(account.homeAccountId, gameState.highestClearedStage, undefined, "descent");
    window.setTimeout(() => setProgressError(!result.saved), 0);
  }, [account.homeAccountId, gameState.clearedStageThisRun, gameState.highestClearedStage]);

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
  const pursuerMotionDuration = getPursuerMotionDurationMs(gameState);
  const pursuerAnimationKey = pursuerMoveAt ?? 0;
  const isPursuerMoving = pursuerMoveAt !== null && gameState.status === "playing" &&
    gameState.captureEndsAt === null && !isSettingsOpen &&
    Math.max(nowMs, pursuerAnimationTime) < pursuerMoveAt + pursuerMotionDuration;

  useEffect(() => {
    if (pursuerMoveAt === null) return;
    const endsAt = pursuerMoveAt + pursuerMotionDuration;
    const suppressed = gameState.status !== "playing" || gameState.captureEndsAt !== null || isSettingsOpen;
    pursuerTimeoutRef.current = window.setTimeout(() => {
      setPursuerAnimationTime(endsAt);
      pursuerTimeoutRef.current = undefined;
    }, suppressed ? 0 : Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(pursuerTimeoutRef.current);
  }, [pursuerMoveAt, pursuerMotionDuration, gameState.status, gameState.captureEndsAt, isSettingsOpen]);

  useEffect(() => () => {
    window.clearTimeout(climbTimeoutRef.current);
    window.clearTimeout(pursuerTimeoutRef.current);
  }, []);

  const lastMoveIsBonus = gameState.lastMove?.isBonus === true;
  useEffect(() => {
    const previousScore = previousScoreRef.current.stage === gameState.stage ? previousScoreRef.current.score : 0;
    if (gameState.score > previousScore) {
      setScoreGain(gameState.score - previousScore);
      setScoreGainIsBonus(lastMoveIsBonus);
      setScoreAnimationKey((key) => key + 1);

      if (scoreGainTimeoutRef.current !== undefined) {
        window.clearTimeout(scoreGainTimeoutRef.current);
      }
      scoreGainTimeoutRef.current = window.setTimeout(() => {
        setScoreGain(null);
        scoreGainTimeoutRef.current = undefined;
      }, 700);
    } else {
      if (scoreGainTimeoutRef.current !== undefined) {
        window.clearTimeout(scoreGainTimeoutRef.current);
        scoreGainTimeoutRef.current = undefined;
      }
      setScoreGain(null);
    }

    previousScoreRef.current = { stage: gameState.stage, score: gameState.score };

    return () => {
      if (scoreGainTimeoutRef.current !== undefined) {
        window.clearTimeout(scoreGainTimeoutRef.current);
        scoreGainTimeoutRef.current = undefined;
      }
    };
  }, [gameState.stage, gameState.score, lastMoveIsBonus, gameState.lastMistake, gameState.captureCount, gameState.status]);

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

  const stageResult = gameState.stageResult;
  const { isEnding } = useOfficeExitEnding(stageResult);
  useEffect(() => {
    if (stageResult === null) return;

    const result = account.homeAccountId
      ? saveBestScore({
          accountId: account.homeAccountId,
          displayName: account.name || "이름 없음",
          bestStage: stageResult.stage,
          bestScore: stageResult.score,
          remainingTimeCs: stageResult.remainingTimeCs,
        }, undefined, undefined, "descent")
      : null;
    const update = window.setTimeout(() => {
      if (result !== null) setLeaderboard(result.entries);
      setSaveError(result === null || !result.saved);
    }, 0);
    return () => window.clearTimeout(update);
  }, [account.homeAccountId, account.name, stageResult]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (gameState.status !== "playing" || event.defaultPrevented || isSettingsOpenRef.current || isTextEntryTarget(event.target)) {
        return;
      }

      const isSpace = event.code === "Space" || event.key === " ";
      if (isSpace) {
        if (event.target instanceof Element && event.target.closest('button, [role="button"]')) return;
        event.preventDefault();
        if (!event.repeat) handleInput("jump");
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
  }, [handleInput, gameState.status]);

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
    }, PURSUER_POLL_INTERVAL_MS);

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
      : Math.max(0, Math.ceil((gameState.eventEndsAt - (gameState.checkpointEnteredAt ?? nowMs)) / 1000));
  const controlsDisabled =
    gameState.status !== "playing" || gameState.recoveryEndsAt !== null || isSettingsOpen;
  const pursuerCatchVisible = gameState.captureEndsAt !== null &&
    (gameState.status === "playing" || gameState.endReason === "caught");

  useEffect(() => {
    if (gameState.status === "game-over" && !isEnding && !pursuerCatchVisible) restartButtonRef.current?.focus();
  }, [gameState.status, isEnding, pursuerCatchVisible, stageResult]);

  useEffect(() => {
    if (isSettingsOpen) {
      if (!settingsDialogRef.current?.contains(document.activeElement)) settingsCloseRef.current?.focus();
    } else if (previousSettingsOpenRef.current) {
      settingsTriggerRef.current?.focus();
    }
    previousSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen, autoplayBlocked]);

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
          data-office-ending={isEnding}
        >
          <button
            ref={settingsTriggerRef}
            className="game-settings-button"
            type="button"
            aria-label="게임 설정"
            aria-expanded={isSettingsOpen}
            aria-controls="game-settings-dialog"
            disabled={gameState.status === "ready" || gameState.status === "checkpoint" || isEnding}
            onClick={openSettings}
          >
            <PixelIcon name="settings" />
          </button>

          <div className="game-stage" aria-hidden={isEnding || undefined} inert={isEnding || undefined}>
            <GameHud
              state={gameState}
              eventSecondsLeft={eventSecondsLeft}
              scoreGain={scoreGain}
              scoreGainIsBonus={scoreGainIsBonus}
              scoreAnimationKey={scoreAnimationKey}
              stageSecondsLeft={getStageSecondsLeft(gameState, nowMs)}
            />

            <div className="game-layout" data-game-status={gameState.status}>
              <StairScene
                state={gameState}
                climbAnimationKey={climbAnimationKey}
                isClimbing={isClimbing && gameState.status === "playing" && !gameState.lastMistake && !pursuerCatchVisible}
                pursuerAnimationKey={pursuerAnimationKey}
                isPursuerMoving={isPursuerMoving}
                isPursuerCaught={pursuerCatchVisible}
              />
            </div>
          </div>

          {gameState.status === "ready" ? (
            <StageSelectPanel selectedStage={gameState.stage} highestClearedStage={gameState.highestClearedStage}
              onSelect={handleSelectStage} onStart={handleStart} disabled={false} progressUnavailable={progressUnavailable} />
          ) : gameState.status === "playing" ? (
            <ControlButtons
              onForward={() => handleInput("forward")}
              onTurn={() => handleInput("turn")}
              onJump={() => handleInput("jump")}
              disabled={controlsDisabled}
            />
          ) : gameState.status === "checkpoint" ? (
            <CheckpointPanel stage={gameState.stage} score={gameState.score}
              remainingTimeCs={stageResult!.remainingTimeCs}
              onContinue={handleContinue} onQuit={handleQuit} disabled={false} progressError={progressError} rankingError={saveError} />
          ) : isEnding ? <OfficeExitEnding key={stageResult!.endedAtMs} variant="animated" startedAtMs={stageResult!.endedAtMs} /> : (
            <section
              className="game-over-panel"
              aria-labelledby="game-over-title"
            >
              <div className="game-over-result">
                {stageResult?.stage === 5 && stageResult.outcome === "cleared" && <OfficeExitEnding variant="complete" />}
                <PixelIcon name="flag" className="game-over-icon" size={36} />
                <p className="game-over-kicker">이번 도전 결과</p>
                <h2 id="game-over-title">{gameState.score}점</h2>
                <p className="game-over-stage">기록 단계 {gameState.stage}단계</p>
                <p className="game-over-time">남은 시간 {formatRemainingTimeCs(stageResult!.remainingTimeCs)}</p>
                <p className="game-over-reason">{gameState.endReason === "cleared" ? "최종 클리어!" : gameState.endReason === "time-limit" ? "시간 초과" : gameState.endReason === "quit" ? "체크포인트에서 종료했어요" : "추격자에게 잡혔어요"}</p>
                <p>계단 {gameState.stepsClimbed}개를 내려왔어요.</p>
                {saveError && <p className="leaderboard-error" role="status">기록을 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.</p>}
                {progressError && <p role="status">진행도를 저장하지 못했습니다. 이 브라우저의 저장 공간을 확인해 주세요.</p>}
                <button ref={restartButtonRef} className="start-button restart-button" type="button" onClick={handleShowStageSelection}>
                  <PixelIcon name="restart" size={20} /> 다시 시작
                </button>
              </div>
              <LeaderboardPanel entries={leaderboard} currentAccountId={account.homeAccountId} />
            </section>
          )}
          <p className="game-footer" aria-hidden={isEnding || undefined} inert={isEnding || undefined}>
            <span className="desktop-control-hint"><kbd>D</kbd> 한 칸 내려가기 <span>·</span> <kbd>J</kbd> 방향 바꾸며 내려가기 <span>·</span> <kbd>Space</kbd> 장애물 점프</span>
            <span className="mobile-control-hint">내려가기 · 방향 바꾸기 · 장애물은 점프!</span>
          </p>
          {isSettingsOpen && (
            <div
              className="settings-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeSettings();
              }}
            >
              <section
                ref={settingsDialogRef}
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
                        <p><kbd>D</kbd> 한 칸 내려가기 <span>·</span> <kbd>J</kbd> 모퉁이에서 방향을 바꾸며 내려가기 <span>·</span> <kbd>Space</kbd> 장애물을 넘어 두 칸 이동</p>
                        <p>모바일에서는 내려가기 · 방향 바꾸기 · 점프 버튼을 사용하세요. 장애물이 없을 때 점프하거나 상자에 부딪히면 0.5초 동안 멈춰요.</p>
                      </div>
                    </section>
                    <section className="chase-card">
                      <span className="chase-icon"><PixelIcon name="flag" size={20} /></span>
                      <div>
                        <strong>뒤쫓아오는 추격자</strong>
                        <p>추격자는 위에서 한 칸씩 따라 내려와요. 단계별 간격은 0.5/0.4/0.35/0.3/0.28초예요. 15칸 이상 멀어지면 0.1초마다 추격하고, 6칸까지 좁혀지면 원래 속도로 돌아와요. 잘못 입력하면 0.5초 동안 멈춰요. 넘어진 동안 추격 간격은 0.25초지만, 가속 추격 중에는 0.1초를 유지해요. 한 번 잡히면 게임이 끝납니다. 각 단계는 0점부터 시작하고 목표는 150/200/250/300/350점이에요. 클리어하면 계속할지 선택할 수 있어요.</p>
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
