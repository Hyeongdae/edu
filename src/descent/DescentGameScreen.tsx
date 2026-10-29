import { useCallback, useEffect, useReducer, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from "react";
import { AudioControls } from "../audio/AudioControls";
import type { AudioController } from "../audio/audioController";
import type { AudioPreferences } from "../audio/audioPreferences";
import { getStageSecondsLeft, STAGE_ONE_TARGET_SCORE } from "../game/gameEngine";
import { getPursuerMotionDurationMs, PURSUER_POLL_INTERVAL_MS } from "../game/pursuitRules";
import type { GameInput } from "../game/types";
import { PixelIcon } from "../game/pixel/PixelIcon";
import { createDescentState, resetDescent } from "./descentEngine";
import { createDescentViewState, descentViewReducer } from "./descentViewState";
import { DescentScene } from "./DescentScene";
import "./descent.css";

interface DescentGameScreenProps {
  audioController: AudioController;
  audioPreferences: AudioPreferences;
  autoplayBlocked: boolean;
  onAudioPreferencesChange: (next: AudioPreferences) => void;
  onEnableAudio: () => void;
}

export function DescentGameScreen({ audioController, audioPreferences, autoplayBlocked, onAudioPreferencesChange, onEnableAudio }: DescentGameScreenProps): ReactElement {
  const [view, dispatch] = useReducer(descentViewReducer, undefined, () => createDescentViewState(createDescentState(), Date.now()));
  const { game, nowMs } = view;
  const pursuerMotionDuration = getPursuerMotionDurationMs(game);
  const settingsOpen = view.settingsOpenedAt !== null;
  const started = useRef(false);
  const gear = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const settingsDialog = useRef<HTMLElement>(null);
  const resultButton = useRef<HTMLButtonElement>(null);
  const previousSounds = useRef({ success: 0, mistake: 0 });
  const previousEvent = useRef(false);
  const previousStatus = useRef(game.status);
  const previousSettingsOpen = useRef(false);
  const handleInput = useCallback((input: GameInput) => dispatch({ type: "input", input, nowMs: Date.now() }), []);

  useEffect(() => {
    const previous = previousSounds.current;
    previousSounds.current = { success: view.successfulActionCount, mistake: view.mistakeCount };
    for (let count = previous.success; count < view.successfulActionCount; count++) audioController.playFootstep();
    for (let count = previous.mistake; count < view.mistakeCount; count++) audioController.playFall();
  }, [audioController, view.successfulActionCount, view.mistakeCount]);

  useEffect(() => {
    const active = game.eventEndsAt !== null;
    if (active !== previousEvent.current) audioController.setEventActive(active);
    previousEvent.current = active;
  }, [audioController, game.eventEndsAt]);

  useEffect(() => {
    if (game.status === "game-over" && previousStatus.current !== "game-over") audioController.stopBgm();
    previousStatus.current = game.status;
  }, [audioController, game.status]);

  useEffect(() => {
    if (settingsOpen) {
      if (!settingsDialog.current?.contains(document.activeElement)) closeButton.current?.focus();
    }
    else if (previousSettingsOpen.current) gear.current?.focus();
    previousSettingsOpen.current = settingsOpen;
  }, [settingsOpen, autoplayBlocked]);
  useEffect(() => {
    if (game.status === "game-over") resultButton.current?.focus();
  }, [game.status, game.captureEndsAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (game.status !== "playing" || settingsOpen || event.defaultPrevented) return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable ||
        event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))) return;
      if (event.code === "Space" || event.key === " ") {
        if (event.target instanceof Element && event.target.closest('button,[role="button"]')) return;
        event.preventDefault();
        if (!event.repeat) handleInput("jump");
      } else if (event.key.toLowerCase() === "d" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        handleInput(event.key.toLowerCase() === "d" ? "forward" : "turn");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game.status, settingsOpen, handleInput]);

  useEffect(() => {
    if (settingsOpen) return;
    const active = game.status === "playing" || game.recoveryEndsAt !== null || game.captureEndsAt !== null ||
      view.playerMoveAt !== null || view.scoreGainUntil !== null;
    if (!active) return;
    const tick = () => dispatch({ type: "tick", nowMs: Date.now() });
    const interval = window.setInterval(tick, PURSUER_POLL_INTERVAL_MS);
    const ends = [view.playerMoveAt === null ? null : view.playerMoveAt + 300,
      game.lastPursuerMove === null ? null : game.lastPursuerMove.atMs + pursuerMotionDuration, view.scoreGainUntil,
      game.captureEndsAt, game.recoveryEndsAt].filter((end): end is number => end !== null && end > nowMs);
    const cosmetic = ends.length ? window.setTimeout(tick, Math.max(1, Math.min(...ends) - Date.now())) : undefined;
    return () => { window.clearInterval(interval); window.clearTimeout(cosmetic); };
  }, [game, nowMs, settingsOpen, view.playerMoveAt, view.scoreGainUntil, pursuerMotionDuration]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && !settingsOpen) dispatch({ type: "tick", nowMs: Date.now() });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [settingsOpen]);

  const closeSettings = () => {
    dispatch({ type: "close-settings", nowMs: Date.now() });
  };
  const dialogKeys = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); closeSettings(); return; }
    if (event.key !== "Tab") return;
    const nodes = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[href],[tabindex="0"]');
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const start = () => {
    if (game.status !== "ready" || settingsOpen || started.current) return;
    started.current = true;
    dispatch({ type: "start", nowMs: Date.now() });
    onEnableAudio();
  };
  const restart = () => {
    if (game.status !== "game-over" || settingsOpen || !started.current) return;
    const readyState = resetDescent();
    started.current = false;
    dispatch({ type: "restart", readyState, nowMs: Date.now() });
  };
  const disabled = game.status !== "playing" || game.recoveryEndsAt !== null || settingsOpen;
  const control = (input: GameInput, label: string, text: string, icon: "forward" | "turn" | "jump") => (
    <button type="button" className={`descent-control descent-${input}-control`} aria-label={label} disabled={disabled}
      onPointerDown={event => {
        if (disabled || !event.isPrimary || event.button !== 0) return;
        event.preventDefault(); handleInput(input);
      }} onClick={event => { if (!disabled && event.detail === 0) handleInput(input); }}>
      <PixelIcon name={icon} className={input === "forward" ? "descent-down-icon" : undefined} /><span>{text}</span>
    </button>
  );
  const seconds = getStageSecondsLeft(game, nowMs);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const bonus = game.eventEndsAt !== null;
  const bonusSeconds = bonus ? Math.max(0, Math.ceil((game.eventEndsAt! - nowMs) / 1000)) : 0;
  const caught = game.captureEndsAt !== null;
  return (
    <main className="descent-game" data-status={game.status} data-capture={caught}>
      <header className="descent-topbar"><h1>내려오기 <span>· 로컬 테스트</span></h1>
        <button ref={gear} className="descent-gear" type="button" aria-label="게임 설정" aria-haspopup="dialog"
          aria-expanded={settingsOpen} disabled={game.status !== "playing" || settingsOpen}
          onClick={() => dispatch({ type: "open-settings", nowMs: Date.now() })}><PixelIcon name="settings" /></button>
        <section className="descent-hud" aria-label="게임 현황">
          <div className="descent-score-card"><div><span className="descent-label">현재 점수</span>
            <div className="descent-score-line"><strong data-testid="descent-score">{game.score}</strong>
              {view.scoreGain !== null && <span key={view.playerMotionKey} className={`descent-gain${view.scoreGainIsBonus ? " is-bonus" : ""}`}
                data-testid="descent-score-gain" aria-live="polite">+{view.scoreGain}</span>}</div>
            <span className="descent-caption">내려온 계단 {game.stepsClimbed}칸</span></div>
            <div className="descent-clock" role="timer" aria-label="남은 시간"><span className="descent-label">1단계 · 남은 시간</span>
              <strong data-testid="descent-time">{game.endReason === "cleared" ? "클리어" : time}</strong>
              <span className="descent-caption">목표 {STAGE_ONE_TARGET_SCORE}점</span></div></div>
          <div className={`descent-event-card${bonus ? " is-active" : ""}`}><div className="descent-event-heading">
            <span className="descent-label">계단 이벤트</span><strong data-testid="descent-event">{bonus ? `2배 점수 · ${bonusSeconds}초` : `${game.eventSteps}/30칸`}</strong></div>
            <div className="descent-progress" role="progressbar" aria-label="이벤트 게이지" aria-valuemin={0} aria-valuemax={30}
              aria-valuenow={bonus ? 30 : game.eventSteps}><span style={{ width: `${bonus ? 100 : game.eventSteps / 30 * 100}%` }} /></div>
            <span className="descent-caption">30칸을 내려오면 30초 보너스</span></div>
        </section>
      </header>
      <DescentScene state={game} playerMotionKey={view.playerMotionKey}
        isPlayerMoving={!settingsOpen && view.playerMoveAt !== null && nowMs < view.playerMoveAt + 300}
        isPursuerMoving={!settingsOpen && game.lastPursuerMove !== null && nowMs < game.lastPursuerMove.atMs + pursuerMotionDuration} isCaught={caught} />
      {game.status === "playing" && <section className="descent-controls" aria-label="게임 조작">
        {control("forward", "한 칸 내려가기", "내려가기", "forward")}
        <div className="descent-control-actions">{control("turn", "방향을 바꾸며 내려가기", "방향 전환", "turn")}
          {control("jump", "장애물 점프", "점프", "jump")}</div></section>}
      <p className="descent-footer"><span className="descent-desktop-hint">D 내려가기 · J 방향 전환 · Space 점프</span>
        <span className="descent-mobile-hint">내려가기 · 방향 전환 · 장애물은 점프!</span></p>
      {game.status === "ready" && <div className="descent-panel-backdrop"><section className="descent-panel" aria-labelledby="descent-ready-title">
        <span className="descent-kicker">STAIR DESCENT</span><h2 id="descent-ready-title">계단을 내려가 볼까요?</h2>
        <p>위에서 따라오는 추격자를 피해 내려가세요.</p><p>1단계 · 목표 150점 · 제한시간 90초</p>
        <p>D 한 칸 · J 방향 전환 · Space 장애물 점프</p><p className="descent-muted">기록은 저장하지 않아요.</p>
        <button className="descent-start" type="button" onClick={start}>시작하기</button>
      </section></div>}
      {game.status === "game-over" && <div className="descent-panel-backdrop descent-result-backdrop"><section className="descent-panel descent-result" aria-labelledby="descent-result-title">
        <PixelIcon name="flag" size={36} /><h2 id="descent-result-title">{game.endReason === "cleared" ? "1단계 클리어!" : game.endReason === "time-limit" ? "시간 초과" : "추격자에게 잡혔어요"}</h2>
        <strong className="descent-result-score">{game.score}점</strong><p>계단 {game.stepsClimbed}칸을 내려왔어요.</p>
        <p className="descent-muted">기록은 저장하지 않아요.</p><button ref={resultButton} className="descent-restart" type="button" onClick={restart}>다시 시작</button>
      </section></div>}
      {settingsOpen && <div className="descent-settings-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeSettings(); }}>
        <section ref={settingsDialog} className="descent-settings" role="dialog" aria-modal="true" aria-labelledby="descent-settings-title" onKeyDown={dialogKeys}>
          <header><h2 id="descent-settings-title">게임 설정</h2><button ref={closeButton} type="button" aria-label="설정 닫기" onClick={closeSettings}><PixelIcon name="close" /></button></header>
          <AudioControls preferences={audioPreferences} onChange={onAudioPreferencesChange} autoplayBlocked={autoplayBlocked} onEnableAudio={onEnableAudio} />
          <section className="descent-help"><h3>내려오는 방법</h3><p>D로 한 칸, J로 방향을 바꾸며 한 칸 내려가세요. Space로 상자를 넘어 두 칸 이동해요.</p>
            <p>추격자는 0.5초마다 내려와요. 15칸 이상 멀어지면 0.1초마다 추격하고, 6칸까지 좁혀지면 원래 속도로 돌아와요. 잘못 입력하면 0.5초 동안 멈춰요. 그 동안 추격 간격은 0.25초지만, 가속 추격 중에는 0.1초를 유지해요. 한 번 잡히면 도전이 끝납니다.</p>
            <p>긴 계단 구간마다 10% 확률로 상자가 나와요. 30칸을 내려오면 30초 동안 2배 점수예요.</p>
            <p>설정을 보는 동안 게임은 멈춰 있어요. 오디오 설정과 게임 기록은 저장하지 않아요.</p></section>
        </section>
      </div>}
    </main>
  );
}
