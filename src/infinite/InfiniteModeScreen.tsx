import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { GameAccount } from "../auth/gameAccount";
import type { CompanyRecordBinding } from "../company/types";
import { CompanyRecordsNotice } from "../company/CompanyRecordsNotice";
import { AudioControls } from "../audio/AudioControls";
import type { AudioController } from "../audio/audioController";
import type { AudioPreferences } from "../audio/audioPreferences";
import { StageTransitionCountdown } from "../game/StageTransitionCountdown";
import { PixelIcon } from "../game/pixel/PixelIcon";
import { ControlButtons } from "../game/ControlButtons";
import { LeaderboardDialog } from "../leaderboard/LeaderboardDialog";
import { applyInfiniteInput, createInfiniteGameState, startInfiniteGame, tickInfiniteGame } from "./infiniteEngine";
import type { InfiniteGameState, InfiniteInput } from "./types";
import { InfiniteHud } from "./InfiniteHud";
import { InfiniteStairScene } from "./InfiniteStairScene";
import "./infinite-mode.css";

const COUNTDOWN_MS = 3000;
const TICK_MS = 50;

interface InfiniteModeScreenProps {
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

export function InfiniteModeScreen({
  account, companyRecords, audioController, audioPreferences, autoplayBlocked = false,
  onAudioPreferencesChange, onEnableAudio, onReturnToTitle,
}: InfiniteModeScreenProps) {
  const [gameState, setGameState] = useState<InfiniteGameState>(() => createInfiniteGameState());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const pausedAtRef = useRef<number | null>(null);
  const leaderboardTriggerRef = useRef<HTMLButtonElement | null>(null);
  const leaderboardCloseRef = useRef<HTMLButtonElement | null>(null);
  const leaderboardDialogRef = useRef<HTMLElement | null>(null);
  const previousStepsRef = useRef(0);
  const previousEventRef = useRef(false);
  const terminalHandledRef = useRef(false);

  const startCountdown = useCallback(() => {
    const startAt = Date.now();
    setGameState(createInfiniteGameState());
    previousStepsRef.current = 0;
    previousEventRef.current = false;
    terminalHandledRef.current = false;
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
      setGameState((state) => startInfiniteGame(state, now));
      setCountdownEndsAt(null);
    };
    const interval = window.setInterval(updateCountdown, TICK_MS);
    document.addEventListener("visibilitychange", updateCountdown);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateCountdown);
    };
  }, [countdownEndsAt]);

  useEffect(() => {
    const presentationPending = gameState.fallEndsAt !== null || gameState.captureEndsAt !== null;
    if ((!settingsOpen && gameState.status !== "playing" && !presentationPending) || settingsOpen) return undefined;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setGameState((state) => tickInfiniteGame(state, now));
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [gameState.status, gameState.fallEndsAt, gameState.captureEndsAt, settingsOpen]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible" || settingsOpen) return;
      const now = Date.now();
      setNowMs(now);
      setGameState((state) => tickInfiniteGame(state, now));
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [settingsOpen]);

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

  const handleInput = useCallback((input: InfiniteInput) => {
    if (settingsOpen || countdownEndsAt !== null || gameState.status !== "playing") return;
    const now = Date.now();
    setNowMs(now);
    setGameState((state) => applyInfiniteInput(state, input, now));
  }, [countdownEndsAt, gameState.status, settingsOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || settingsOpen || countdownEndsAt !== null || gameState.status !== "playing") return;
      const key = event.key.toLowerCase();
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
  }, [countdownEndsAt, gameState.status, handleInput, settingsOpen]);

  const openSettings = () => {
    const now = Date.now();
    setGameState((state) => tickInfiniteGame(state, now));
    pausedAtRef.current = now;
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

  const terminalAnimationPending = gameState.fallEndsAt !== null || gameState.captureEndsAt !== null;
  const secondsRemaining = countdownEndsAt === null ? null : Math.max(1, Math.min(3, Math.ceil((countdownEndsAt - nowMs) / 1000))) as 1 | 2 | 3;
  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") closeSettings();
  };
  const closeLeaderboard = () => setLeaderboardOpen(false);
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
    else leaderboardTriggerRef.current?.focus();
  }, [leaderboardOpen]);

  return (
    <main className="stair-game pixel-theme infinite-mode-screen" data-game-status={gameState.status}>
      <div className="game-shell"><div className="game-frame infinite-mode-frame" data-game-status={gameState.status} data-infinite-mode="true">
        <header className="infinite-mode-header">
          <div><p className="game-title-kicker">STAIRWAY CHALLENGE</p><h1>무한 모드</h1><span className="infinite-account-name">{account.name ?? account.username}</span></div>
          <button className="game-settings-button" type="button" aria-label="게임 설정" onClick={openSettings} disabled={gameState.status !== "playing"}>
            <PixelIcon name="settings" />
          </button>
        </header>
        <InfiniteHud state={gameState} nowMs={nowMs} />
        <div className="infinite-mode-scene-wrap">
          <InfiniteStairScene state={gameState} isMoving={gameState.lastPursuerMove !== null && nowMs < gameState.lastPursuerMove.atMs + 240} />
        </div>
        {gameState.status === "ready" && countdownEndsAt === null && <section className="infinite-start-panel" aria-labelledby="infinite-start-title">
          <div className="infinite-start-copy">
            <p className="game-title-kicker">ENDLESS CHALLENGE</p>
            <h2 id="infinite-start-title">무한 모드 준비 완료</h2>
            <p>D로 올라가고, 계단이 꺾이면 J를 누르세요. 오래 살아남아 최고 점수에 도전하세요!</p>
          </div>
          <div className="infinite-start-actions">
            <button className="start-button" type="button" onClick={startCountdown}>게임 시작</button>
            <button ref={leaderboardTriggerRef} className="game-title-ranking" type="button" aria-haspopup="dialog"
              aria-expanded={leaderboardOpen} aria-controls="leaderboard-dialog" onClick={() => setLeaderboardOpen(true)}>랭킹 보기</button>
            <button className="game-title-guide" type="button" onClick={onReturnToTitle}>타이틀로</button>
          </div>
        </section>}
        {gameState.status === "playing" && <ControlButtons onForward={() => handleInput("forward")} onTurn={() => handleInput("turn")}
          onJump={() => undefined} showJump={false} direction="up" disabled={settingsOpen || countdownEndsAt !== null} />}
        {secondsRemaining !== null && <StageTransitionCountdown label="무한 모드 시작" secondsRemaining={secondsRemaining} />}
        {gameState.status === "game-over" && !terminalAnimationPending && <section className="infinite-result-panel" aria-labelledby="infinite-result-title">
          <p className="game-title-kicker">무한 모드 결과</p><h2 id="infinite-result-title">{gameState.endReason === "caught" ? "추격자에게 잡혔어요" : "계단에서 넘어졌어요"}</h2>
          <strong className="infinite-result-score">{gameState.score}점</strong>
          <p>{gameState.stepsClimbed}칸 올라왔어요. 최고 기록을 갱신해 보세요!</p>
          {companyRecords && <CompanyRecordsNotice records={companyRecords} />}
          <div className="infinite-result-actions">
            <button className="start-button" type="button" onClick={startCountdown}>다시하기</button>
            <button className="game-title-guide" type="button" onClick={onReturnToTitle}>메인 타이틀로</button>
          </div>
        </section>}
        {settingsOpen && <div className="settings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSettings(); }}>
          <section className="settings-dialog infinite-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="infinite-settings-title" onKeyDown={onDialogKeyDown}>
            <header className="settings-dialog-header"><div><p className="game-title-kicker">GAME AUDIO</p><h2 id="infinite-settings-title">무한 모드 설정</h2></div>
              <button className="settings-close-button" type="button" aria-label="설정 닫기" onClick={closeSettings}><PixelIcon name="close" size={20} /></button>
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
