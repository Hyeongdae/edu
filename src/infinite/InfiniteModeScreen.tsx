import type { CharacterAppearance } from "../../shared/characterAppearance";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { GameAccount } from "../auth/gameAccount";
import type { CompanyRecordBinding } from "../company/types";
import { CompanyRecordsNotice } from "../company/CompanyRecordsNotice";
import { AudioControls } from "../audio/AudioControls";
import type { AudioController } from "../audio/audioController";
import type { AudioPreferences } from "../audio/audioPreferences";
import { StageTransitionCountdown } from "../game/StageTransitionCountdown";
import { PixelIcon } from "../game/pixel/PixelIcon";
import { PauseMenuDialog, type PauseMenuConfirmation } from "../game/PauseMenuDialog";
import { ControlButtons } from "../game/ControlButtons";
import { handleDirectionalMenuNavigation } from "../game/directionalMenuNavigation";
import { LeaderboardDialog } from "../leaderboard/LeaderboardDialog";
import { applyInfiniteInput, createInfiniteGameState, getInfinitePursuerMotionDurationMs, startInfiniteGame, tickInfiniteGame } from "./infiniteEngine";
import type { InfiniteGameState, InfiniteInput } from "./types";
import { InfiniteHud } from "./InfiniteHud";
import { InfiniteStairScene } from "./InfiniteStairScene";
import "./infinite-mode.css";

const COUNTDOWN_MS = 3000;
const TICK_MS = 50;
type InfiniteResumeTarget = "playing" | "start" | null;

interface InfiniteModeScreenProps {
  appearance?: CharacterAppearance;
  account: GameAccount;
  companyRecords?: CompanyRecordBinding;
  audioController?: AudioController;
  audioPreferences?: AudioPreferences;
  autoplayBlocked?: boolean;
  onAudioPreferencesChange?: (next: AudioPreferences) => void;
  onEnableAudio?: () => void;
  onReturnToTitle: () => void;
}

function shiftDeadline(deadline: number | null, duration: number): number | null {
  return deadline === null ? null : deadline + duration;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']") !== null);
}

export function InfiniteModeScreen({
  account, companyRecords, audioController, audioPreferences, autoplayBlocked = false,
  onAudioPreferencesChange, onEnableAudio, onReturnToTitle, appearance,
}: InfiniteModeScreenProps) {
  const [gameState, setGameState] = useState<InfiniteGameState>(() => createInfiniteGameState());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseConfirmation, setPauseConfirmation] = useState<PauseMenuConfirmation>(null);
  const [pausedGameTime, setPausedGameTime] = useState<number | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const pausedAtRef = useRef<number | null>(null);
  const pauseResumeTargetRef = useRef<InfiniteResumeTarget>(null);
  const pauseButtonRef = useRef<HTMLButtonElement | null>(null);
  const startButtonRef = useRef<HTMLButtonElement | null>(null);
  const retryButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsCloseRef = useRef<HTMLButtonElement | null>(null);
  const pauseMenuActionRef = useRef<(confirmation?: PauseMenuConfirmation) => void>(() => {});
  const leaderboardTriggerRef = useRef<HTMLButtonElement | null>(null);
  const leaderboardCloseRef = useRef<HTMLButtonElement | null>(null);
  const leaderboardDialogRef = useRef<HTMLElement | null>(null);
  const previousStepsRef = useRef(0);
  const previousEventRef = useRef(false);
  const terminalHandledRef = useRef(false);
  const wasPauseOpenRef = useRef(false);
  const wasLeaderboardOpenRef = useRef(false);

  const startCountdown = useCallback(() => {
    const startAt = Date.now();
    setGameState(createInfiniteGameState());
    previousStepsRef.current = 0;
    previousEventRef.current = false;
    terminalHandledRef.current = false;
    pauseResumeTargetRef.current = null;
    pausedAtRef.current = null;
    setPauseOpen(false);
    setPauseConfirmation(null);
    setPausedGameTime(null);
    setNowMs(startAt);
    setCountdownEndsAt(startAt + COUNTDOWN_MS);
    void audioController?.startBgm();
  }, [audioController]);

  useEffect(() => {
    if (countdownEndsAt === null) return undefined;
    const updateCountdown = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      setNowMs(now);
      if (now < countdownEndsAt) return;
      if (pauseOpen) {
        const target = pauseResumeTargetRef.current;
        const pausedAt = pausedAtRef.current;
        if (target === "playing" && pausedAt !== null) {
          const duration = Math.max(0, now - pausedAt);
          setGameState((state) => tickInfiniteGame({
            ...state,
            nextPursuerStepAt: shiftDeadline(state.nextPursuerStepAt, duration),
            eventEndsAt: shiftDeadline(state.eventEndsAt, duration),
            fallEndsAt: shiftDeadline(state.fallEndsAt, duration),
            captureEndsAt: shiftDeadline(state.captureEndsAt, duration),
          }, now));
        } else if (target === "start") {
          setGameState((state) => startInfiniteGame(state, now));
        }
        pauseResumeTargetRef.current = null;
        pausedAtRef.current = null;
        setPausedGameTime(null);
        setPauseConfirmation(null);
        setPauseOpen(false);
      } else {
        setGameState((state) => startInfiniteGame(state, now));
      }
      setCountdownEndsAt(null);
    };
    const interval = window.setInterval(updateCountdown, TICK_MS);
    document.addEventListener("visibilitychange", updateCountdown);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateCountdown);
    };
  }, [countdownEndsAt, pauseOpen]);

  useEffect(() => {
    const presentationPending = gameState.fallEndsAt !== null || gameState.captureEndsAt !== null;
    if (pauseOpen || (!settingsOpen && gameState.status !== "playing" && !presentationPending) || settingsOpen) return undefined;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setGameState((state) => tickInfiniteGame(state, now));
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [gameState.status, gameState.fallEndsAt, gameState.captureEndsAt, settingsOpen, pauseOpen]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible" || settingsOpen || pauseOpen) return;
      const now = Date.now();
      setNowMs(now);
      setGameState((state) => tickInfiniteGame(state, now));
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [settingsOpen, pauseOpen]);

  useEffect(() => {
    if (gameState.stepsClimbed > previousStepsRef.current) audioController?.playFootstep();
    previousStepsRef.current = gameState.stepsClimbed;
  }, [audioController, gameState.stepsClimbed]);

  useEffect(() => {
    const active = gameState.eventEndsAt !== null;
    if (active !== previousEventRef.current) audioController?.setEventActive(active);
    previousEventRef.current = active;
  }, [audioController, gameState.eventEndsAt]);

  useEffect(() => {
    if (gameState.status !== "game-over" || terminalHandledRef.current) return;
    terminalHandledRef.current = true;
    audioController?.setEventActive(false);
    audioController?.playFall();
    audioController?.stopBgm();
    companyRecords?.submitInfiniteScore({ score: gameState.score });
  }, [audioController, companyRecords, gameState.status, gameState.score]);

  useEffect(() => () => audioController?.setEventActive(false), [audioController]);
  useEffect(() => () => {
    pausedAtRef.current = null;
    pauseResumeTargetRef.current = null;
  }, []);

  const handleInput = useCallback((input: InfiniteInput) => {
    if (settingsOpen || pauseOpen || countdownEndsAt !== null || gameState.status !== "playing") return;
    const now = Date.now();
    setNowMs(now);
    setGameState((state) => applyInfiniteInput(state, input, now));
  }, [countdownEndsAt, gameState.status, settingsOpen, pauseOpen]);

  useEffect(() => {
  const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || settingsOpen || pauseOpen || leaderboardOpen || isTextEntryTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "escape" || key === "r") {
        if (event.repeat || (gameState.status !== "playing" && countdownEndsAt === null)) return;
        event.preventDefault();
        pauseMenuActionRef.current(key === "r" ? "restart" : null);
        return;
      }
      if (countdownEndsAt !== null || gameState.status !== "playing") return;
      if (key === "d") {
        event.preventDefault();
        if (!event.repeat) handleInput("forward");
      } else if (key === "j") {
        event.preventDefault();
        if (!event.repeat) handleInput("turn");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [countdownEndsAt, gameState.status, handleInput, settingsOpen, pauseOpen, leaderboardOpen]);

  const openSettings = () => {
    if (pauseOpen || leaderboardOpen || countdownEndsAt !== null || settingsOpen ||
      (gameState.status !== "playing" && gameState.status !== "ready")) return;
    if (gameState.status === "playing") {
      const now = Date.now();
      const reconciled = tickInfiniteGame(gameState, now);
      if (reconciled.status !== "playing") {
        setGameState(reconciled);
        setNowMs(now);
        return;
      }
      setGameState(reconciled);
      pausedAtRef.current = now;
    } else {
      pausedAtRef.current = null;
    }
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    const openedAt = pausedAtRef.current;
    const now = Date.now();
    pausedAtRef.current = null;
    if (openedAt !== null) {
      const pauseDuration = now - openedAt;
      setGameState((state) => ({ ...state,
        nextPursuerStepAt: shiftDeadline(state.nextPursuerStepAt, pauseDuration),
        eventEndsAt: shiftDeadline(state.eventEndsAt, pauseDuration),
        fallEndsAt: shiftDeadline(state.fallEndsAt, pauseDuration),
        captureEndsAt: shiftDeadline(state.captureEndsAt, pauseDuration),
      }));
      setNowMs(now);
    }
    setSettingsOpen(false);
  };

  const openPauseMenu = (confirmation: PauseMenuConfirmation = null) => {
    if (settingsOpen || pauseOpen || leaderboardOpen) return;
    const hasCountdown = countdownEndsAt !== null;
    const isPlaying = gameState.status === "playing";
    if (!hasCountdown && !isPlaying) return;
    const now = Date.now();
    if (isPlaying) {
      const reconciled = tickInfiniteGame(gameState, now);
      setGameState(reconciled);
      setNowMs(now);
      if (reconciled.status !== "playing") return;
      pausedAtRef.current = now;
      pauseResumeTargetRef.current = "playing";
      setPausedGameTime(now);
    } else {
      pauseResumeTargetRef.current = "start";
      pausedAtRef.current = null;
      setPausedGameTime(null);
      setCountdownEndsAt(null);
    }
    setPauseConfirmation(confirmation);
    setPauseOpen(true);
    audioController?.stopBgm();
  };
  useEffect(() => {
    pauseMenuActionRef.current = openPauseMenu;
  });

  const beginPausedResumeCountdown = () => {
    if (!pauseOpen || pauseResumeTargetRef.current === null) return;
    const startedAt = Date.now();
    setNowMs(startedAt);
    setCountdownEndsAt(startedAt + COUNTDOWN_MS);
    setPauseConfirmation(null);
    void audioController?.startBgm();
  };

  const confirmInfiniteRestart = () => {
    if (!pauseOpen || pauseConfirmation !== "restart") return;
    const startedAt = Date.now();
    setGameState(createInfiniteGameState());
    previousStepsRef.current = 0;
    previousEventRef.current = false;
    terminalHandledRef.current = false;
    pausedAtRef.current = null;
    pauseResumeTargetRef.current = "start";
    setPausedGameTime(null);
    setPauseConfirmation(null);
    setNowMs(startedAt);
    setCountdownEndsAt(startedAt + COUNTDOWN_MS);
    void audioController?.startBgm();
  };

  const confirmInfiniteTitleReturn = () => {
    if (!pauseOpen || pauseConfirmation !== "title") return;
    pausedAtRef.current = null;
    pauseResumeTargetRef.current = null;
    setPausedGameTime(null);
    setCountdownEndsAt(null);
    setPauseConfirmation(null);
    setPauseOpen(false);
    audioController?.stopBgm();
    onReturnToTitle();
  };

  const terminalAnimationPending = gameState.fallEndsAt !== null || gameState.captureEndsAt !== null;
  const pursuerMotionDurationMs = getInfinitePursuerMotionDurationMs(gameState);
  const secondsRemaining = countdownEndsAt === null ? null : Math.max(1, Math.min(3, Math.ceil((countdownEndsAt - nowMs) / 1000))) as 1 | 2 | 3;
  const gameplayNowMs = pauseOpen && pausedGameTime !== null ? pausedGameTime : nowMs;

  useEffect(() => {
    if (pauseOpen || settingsOpen || leaderboardOpen) return;
    if (gameState.status === "ready" && countdownEndsAt === null) startButtonRef.current?.focus();
    else if (gameState.status === "game-over" && !terminalAnimationPending) retryButtonRef.current?.focus();
  }, [countdownEndsAt, gameState.status, leaderboardOpen, pauseOpen, settingsOpen, terminalAnimationPending]);
  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); closeSettings(); return; }
    if (event.key !== "Tab") return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const closeLeaderboard = () => setLeaderboardOpen(false);
  const openLeaderboard = (trigger: HTMLButtonElement) => {
    leaderboardTriggerRef.current = trigger;
    setLeaderboardOpen(true);
  };
  const onLeaderboardKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLeaderboard();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  useEffect(() => {
    if (leaderboardOpen) leaderboardCloseRef.current?.focus();
    else if (wasLeaderboardOpenRef.current) leaderboardTriggerRef.current?.focus();
    wasLeaderboardOpenRef.current = leaderboardOpen;
  }, [leaderboardOpen]);

  useEffect(() => {
    if (settingsOpen) settingsCloseRef.current?.focus();
  }, [settingsOpen]);

  useEffect(() => {
    if (wasPauseOpenRef.current && !pauseOpen) pauseButtonRef.current?.focus();
    wasPauseOpenRef.current = pauseOpen;
  }, [pauseOpen]);

  return (
    <main className="stair-game pixel-theme infinite-mode-screen" data-game-status={gameState.status} onKeyDown={handleDirectionalMenuNavigation}>
      <div className="game-shell"><div className="game-frame" data-game-status={gameState.status} data-infinite-mode="true">
        <div className="game-utility-actions" data-keyboard-menu>
        <button className="game-settings-button" type="button" aria-label="게임 설정" aria-expanded={settingsOpen}
          onClick={openSettings} disabled={countdownEndsAt !== null || (gameState.status !== "playing" && gameState.status !== "ready") || pauseOpen || leaderboardOpen}>
          <PixelIcon name="settings" />
        </button>
        {(gameState.status === "playing" || countdownEndsAt !== null) && <button ref={pauseButtonRef} className="game-pause-button"
          type="button" aria-label="일시정지" aria-haspopup="dialog" aria-expanded={pauseOpen} aria-controls="game-pause-dialog"
          onClick={() => openPauseMenu()}><PixelIcon name="pause" /></button>}
        </div>
        <div className="game-stage">
          <h1 className="infinite-mode-accessible-title">무한 모드</h1>
          <InfiniteHud state={gameState} nowMs={gameplayNowMs} />
          <div className="game-layout" data-game-status={gameState.status}>
            <InfiniteStairScene appearance={appearance} state={gameState} motionDurationMs={pursuerMotionDurationMs}
              isMoving={gameState.lastPursuerMove !== null && nowMs < gameState.lastPursuerMove.atMs + pursuerMotionDurationMs} />
          </div>
        </div>
        {gameState.status === "ready" && countdownEndsAt === null && <section className="stage-select-panel infinite-start-panel" aria-labelledby="infinite-start-title" data-keyboard-menu>
          <p className="game-title-kicker">ENDLESS CHALLENGE</p>
          <h2 id="infinite-start-title">무한 모드 준비 완료</h2>
          <p>D로 올라가고, 계단이 꺾이면 J를 누르세요. 오래 살아남아 최고 점수에 도전하세요!</p>
          <div className="infinite-start-actions">
            <button ref={startButtonRef} className="stage-select-start" type="button" onClick={startCountdown}>게임 시작</button>
            <button ref={leaderboardTriggerRef} className="stage-select-leaderboard" type="button" aria-haspopup="dialog"
              aria-expanded={leaderboardOpen} aria-controls="leaderboard-dialog" onClick={(event) => openLeaderboard(event.currentTarget)}>랭킹 보기</button>
            <button className="game-title-guide" type="button" onClick={onReturnToTitle}>타이틀로</button>
          </div>
        </section>}
        {gameState.status === "playing" && <ControlButtons onForward={() => handleInput("forward")} onTurn={() => handleInput("turn")}
          onJump={() => undefined} showJump={false} direction="up" disabled={settingsOpen || countdownEndsAt !== null} />}
        {secondsRemaining !== null && <StageTransitionCountdown label={pauseOpen ? "게임 재개" : "무한 모드 시작"} secondsRemaining={secondsRemaining} />}
        {pauseOpen && countdownEndsAt === null && <PauseMenuDialog modeName="무한 모드" confirmation={pauseConfirmation}
          onResume={beginPausedResumeCountdown} onRequestRestart={() => setPauseConfirmation("restart")}
          onRequestTitle={() => setPauseConfirmation("title")}
          onConfirm={pauseConfirmation === "restart" ? confirmInfiniteRestart : confirmInfiniteTitleReturn}
          onCancelConfirmation={() => setPauseConfirmation(null)} />}
        {gameState.status === "game-over" && !terminalAnimationPending && <section className="infinite-result-panel" aria-labelledby="infinite-result-title">
          <p className="game-title-kicker">무한 모드 결과</p><h2 id="infinite-result-title">{gameState.endReason === "caught" ? "추격자에게 잡혔어요" : "계단에서 넘어졌어요"}</h2>
          <strong className="infinite-result-score">{gameState.score}점</strong>
          <p>{gameState.stepsClimbed}칸 올라왔어요. 최고 기록을 갱신해 보세요!</p>
          {companyRecords && <CompanyRecordsNotice records={companyRecords} />}
          <div className="infinite-result-actions" data-keyboard-menu>
            <button ref={retryButtonRef} className="start-button" type="button" onClick={startCountdown}>다시하기</button>
            <button ref={leaderboardTriggerRef} className="stage-select-leaderboard" type="button" aria-haspopup="dialog"
              aria-expanded={leaderboardOpen} aria-controls="leaderboard-dialog"
              onClick={(event) => openLeaderboard(event.currentTarget)}>랭킹 보기</button>
            <button className="game-title-guide" type="button" onClick={onReturnToTitle}>메인 타이틀로</button>
          </div>
        </section>}
        <p className="game-footer" aria-hidden={gameState.status !== "playing" || undefined}>
          <span className="desktop-control-hint"><kbd>D</kbd> 한 칸 올라가기 <span>·</span> <kbd>J</kbd> 방향 바꾸며 올라가기 <span>·</span> <kbd>R</kbd> 재시작</span>
          <span className="mobile-control-hint">올라가기 · 방향 바꾸기</span>
        </p>
        {settingsOpen && <div className="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSettings(); }}>
          <section className="settings-dialog infinite-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="infinite-settings-title" data-keyboard-menu onKeyDown={onDialogKeyDown}>
            <header className="settings-dialog-header"><div><p className="game-title-kicker">GAME AUDIO</p><h2 id="infinite-settings-title">무한 모드 설정</h2></div>
              <button ref={settingsCloseRef} className="settings-close-button" type="button" aria-label="설정 닫기" onClick={closeSettings}><PixelIcon name="close" size={20} /></button>
            </header>
            {audioPreferences && onAudioPreferencesChange && onEnableAudio && <AudioControls preferences={audioPreferences}
              onChange={onAudioPreferencesChange} autoplayBlocked={autoplayBlocked} onEnableAudio={onEnableAudio} />}
            <button className="start-button" type="button" onClick={closeSettings}>계속하기</button>
          </section>
        </div>}
        {leaderboardOpen && <LeaderboardDialog entries={companyRecords?.entries ?? []} infiniteEntries={companyRecords?.infiniteEntries ?? []}
          currentAccountId={account.homeAccountId} scope={companyRecords ? "company" : "browser"} onClose={closeLeaderboard}
          closeButtonRef={leaderboardCloseRef} dialogRef={leaderboardDialogRef} onKeyDown={onLeaderboardKeyDown} />}
      </div></div>
    </main>
  );
}
