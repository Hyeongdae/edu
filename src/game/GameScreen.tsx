import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import type { GameAccount } from "../auth/gameAccount";
import { getDefaultCharacterAppearance } from "../../shared/characterAppearance";
import { CharacterCustomizationDialog } from "../character/CharacterCustomizationDialog";
import type { AppearanceBinding, CompanyRecordBinding } from "../company/types";
import { CompanyRecordsNotice } from "../company/CompanyRecordsNotice";
import { applyInput, continueGame, createGameState, getStageSecondsLeft, quitAtCheckpoint, resetGame, resumeGameAfterPause, startGame, tickGame } from "./gameEngine";
import { CheckpointPanel } from "./CheckpointPanel";
import { StageTransitionCountdown } from "./StageTransitionCountdown";
import { StageSelectPanel } from "./StageSelectPanel";
import { getHighestUnlockedStage } from "./stageRules";
import { getPursuerMotionDurationMs, PURSUER_POLL_INTERVAL_MS } from "./pursuitRules";
import { formatRemainingTimeCs } from "./stageResult";
import { useOfficeExitEnding } from "./useOfficeExitEnding";
import { OfficeExitEnding } from "./OfficeExitEnding";
import { useOvertimeCaptureEnding } from "./useOvertimeCaptureEnding";
import { OvertimeCaptureEnding } from "./OvertimeCaptureEnding";
import { ControlButtons } from "./ControlButtons";
import { GameHud } from "./GameHud";
import { GameInstructionsDialog } from "./GameInstructionsDialog";
import { LeaderboardDialog } from "../leaderboard/LeaderboardDialog";
import { StairScene } from "./StairScene";
import { PixelIcon } from "./pixel/PixelIcon";
import { PauseMenuDialog, type PauseMenuConfirmation } from "./PauseMenuDialog";
import type { ClearedStage, GameInput, GameStage } from "./types";
import { LeaderboardPanel } from "../leaderboard/LeaderboardPanel";
import { AudioControls } from "../audio/AudioControls";
import type { AudioController } from "../audio/audioController";
import type { AudioPreferences } from "../audio/audioPreferences";
import { InfiniteModeScreen } from "../infinite/InfiniteModeScreen";
import "./game.css";
import "./pixel-theme.css";

const TITLE_SCENE_TRANSITION_MS = 200;
const STAGE_COUNTDOWN_MS = 3000;
type ActiveGameDialog = "settings" | "instructions" | "leaderboard" | "pause" | "customization" | null;
type OpenGameDialog = Exclude<ActiveGameDialog, null>;
type StageResumeTarget = "playing" | "start" | "continue" | null;

interface GameScreenProps {
  account: GameAccount;
  companyRecords?: CompanyRecordBinding;
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
  companyRecords,
  audioController,
  audioPreferences,
  autoplayBlocked = false,
  onAudioPreferencesChange,
  onEnableAudio,
}: GameScreenProps) {
  const [localAppearance, setLocalAppearance] = useState(getDefaultCharacterAppearance);
  const appearanceBinding: AppearanceBinding = companyRecords?.appearance ?? {
    value: localAppearance, status: "idle", errorMessage: null, update: setLocalAppearance, retry: () => {},
  };
  const appearance = appearanceBinding.value;
  const customizationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const usesCompanyRecords = companyRecords !== undefined;
  const submitCompanyResult = companyRecords?.submitResult;
  const submittedCompanyResults = useRef(new WeakSet<object>());
  const [initialProfile] = useState(() => {
    if (companyRecords) return { entries: companyRecords.entries, knownHighest: companyRecords.profile.highestClearedStage };
    return { entries: [], knownHighest: 0 as ClearedStage };
  });
  const [gameState, setGameState] = useState(() => createGameState(undefined, {
    stage: getHighestUnlockedStage(initialProfile.knownHighest), highestClearedStage: initialProfile.knownHighest,
  }));
  const [isTitleScreen, setIsTitleScreen] = useState(true);
  const [activeMode, setActiveMode] = useState<"title" | "stage" | "infinite">("title");
  const [isTitleLeaving, setIsTitleLeaving] = useState(false);
  const titleTransitionTimeoutRef = useRef<number | undefined>(undefined);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [countdownEndsAt, setCountdownEndsAt] = useState<number | null>(null);
  const countdownEndsAtRef = useRef<number | null>(null);
  const leaderboard = initialProfile.entries;
  const progressUnavailable = false;
  const [climbAnimationKey, setClimbAnimationKey] = useState(0);
  const [isClimbing, setIsClimbing] = useState(false);
  const [scoreGain, setScoreGain] = useState<number | null>(null);
  const [scoreGainIsBonus, setScoreGainIsBonus] = useState(false);
  const [scoreAnimationKey, setScoreAnimationKey] = useState(0);
  const [pursuerAnimationTime, setPursuerAnimationTime] = useState(0);
  const [activeDialog, setActiveDialog] = useState<ActiveGameDialog>(null);
  const isSettingsOpen = activeDialog === "settings";
  const isInstructionsOpen = activeDialog === "instructions";
  const isLeaderboardOpen = activeDialog === "leaderboard";
  const isCustomizationOpen = activeDialog === "customization";
  const isPauseOpen = activeDialog === "pause";
  const [pauseConfirmation, setPauseConfirmation] = useState<PauseMenuConfirmation>(null);
  const [pausedGameTime, setPausedGameTime] = useState<number | null>(null);
  const runStartedRef = useRef(false);
  const pausedDialogOpenedAtRef = useRef<number | null>(null);
  const pauseResumeTargetRef = useRef<StageResumeTarget>(null);
  const activeDialogRef = useRef<ActiveGameDialog>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pauseTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pauseMenuActionRef = useRef<(confirmation?: PauseMenuConfirmation) => void>(() => {});
  const settingsCloseRef = useRef<HTMLButtonElement | null>(null);
  const instructionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const titleStartButtonRef = useRef<HTMLButtonElement | null>(null);
  const leaderboardReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const instructionsCloseRef = useRef<HTMLButtonElement | null>(null);
  const restartButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsDialogRef = useRef<HTMLElement | null>(null);
  const instructionsDialogRef = useRef<HTMLElement | null>(null);
  const leaderboardCloseRef = useRef<HTMLButtonElement | null>(null);
  const leaderboardDialogRef = useRef<HTMLElement | null>(null);
  const previousDialogRef = useRef<ActiveGameDialog>(null);
  const previousStepsRef = useRef(gameState.stepsClimbed);
  const climbTimeoutRef = useRef<number | undefined>(undefined);
  const previousScoreRef = useRef({ stage: gameState.stage, score: gameState.score });
  const scoreGainTimeoutRef = useRef<number | undefined>(undefined);
  const previousRecoveryEndsAtRef = useRef(gameState.recoveryEndsAt);
  const previousPlayerCaptureRef = useRef(gameState.captureCount);
  const pursuerTimeoutRef = useRef<number | undefined>(undefined);
  const previousEventActiveRef = useRef(gameState.eventEndsAt !== null);

  const openGameDialog = useCallback((dialog: OpenGameDialog) => {
    if (activeDialogRef.current !== null) return;
    if (dialog === "customization" && (!isTitleScreen || isTitleLeaving || gameState.status !== "ready")) return;
    if (dialog === "settings" && (countdownEndsAtRef.current !== null ||
      (gameState.status !== "playing" && gameState.status !== "ready" && gameState.status !== "checkpoint"))) return;
    if (dialog === "instructions" && !isTitleScreen) return;
    if (dialog === "leaderboard" && gameState.status !== "ready") return;

    const openedAt = Date.now();
    if (gameState.status === "playing") {
      const reconciled = tickGame(gameState, openedAt);
      setNowMs(openedAt);
      setGameState(reconciled);
      if (reconciled.status !== "playing") return;
      pausedDialogOpenedAtRef.current = openedAt;
    } else {
      pausedDialogOpenedAtRef.current = null;
    }

    activeDialogRef.current = dialog;
    setActiveDialog(dialog);
  }, [gameState, isTitleScreen, isTitleLeaving]);

  const closeGameDialog = useCallback((dialog: OpenGameDialog) => {
    if (activeDialogRef.current !== dialog) return;
    const openedAt = pausedDialogOpenedAtRef.current;
    const closedAt = Date.now();
    pausedDialogOpenedAtRef.current = null;
    activeDialogRef.current = null;
    setActiveDialog(null);
    if (openedAt !== null) {
      setNowMs(closedAt);
      setGameState((state) => resumeGameAfterPause(state, openedAt, closedAt));
    }
  }, []);

  const openSettings = useCallback(() => {
    openGameDialog("settings");
  }, [openGameDialog]);

  const closeSettings = useCallback(() => {
    closeGameDialog("settings");
  }, [closeGameDialog]);

  const openInstructions = useCallback(() => {
    openGameDialog("instructions");
  }, [openGameDialog]);

  const closeInstructions = useCallback(() => {
    closeGameDialog("instructions");
  }, [closeGameDialog]);

  const openLeaderboard = useCallback((trigger: HTMLButtonElement) => {
    leaderboardReturnFocusRef.current = trigger;
    openGameDialog("leaderboard");
  }, [openGameDialog]);

  const closeLeaderboard = useCallback(() => {
    closeGameDialog("leaderboard");
  }, [closeGameDialog]);

  const handleInput = useCallback((input: GameInput) => {
    if (activeDialogRef.current !== null) return;
    const inputTime = Date.now();
    setNowMs(inputTime);
    setGameState((state) => applyInput(state, input, inputTime));
  }, []);

  const readKnownHighest = (): ClearedStage => {
    if (companyRecords) return Math.max(gameState.highestClearedStage, initialProfile.knownHighest,
      companyRecords.profile.highestClearedStage) as ClearedStage;
    return Math.max(gameState.highestClearedStage, initialProfile.knownHighest) as ClearedStage;
  };

  const handleSelectStage = (stage: GameStage) => {
    if (activeDialogRef.current !== null || gameState.status !== "ready" || runStartedRef.current || stage === gameState.stage) return;
    const knownHighest = readKnownHighest();
    if (stage > getHighestUnlockedStage(knownHighest)) return;
    const preview = resetGame(undefined, { stage, highestClearedStage: knownHighest });
    setNowMs(Date.now());
    setGameState(preview);
  };

  const handleShowStageSelection = () => {
    if (activeDialogRef.current !== null || gameState.status !== "game-over" || !runStartedRef.current || isCaughtPresentationPending) return;
    const knownHighest = readKnownHighest();
    const preview = resetGame(undefined, { stage: getHighestUnlockedStage(knownHighest), highestClearedStage: knownHighest });
    runStartedRef.current = false;
    setNowMs(Date.now());
    setGameState(preview);
  };

  const handleReturnToTitle = () => {
    if (activeDialogRef.current !== null || gameState.status !== "game-over" || !runStartedRef.current || isCaughtPresentationPending) return;
    const knownHighest = readKnownHighest();
    const preview = resetGame(undefined, { stage: getHighestUnlockedStage(knownHighest), highestClearedStage: knownHighest });
    runStartedRef.current = false;
    setActiveMode("title");
    setIsTitleLeaving(false);
    setIsTitleScreen(true);
    setNowMs(Date.now());
    setGameState(preview);
  };

  const handleEnterStageSelection = () => {
    if (activeDialogRef.current !== null || gameState.status !== "ready" || isTitleLeaving) return;
    setActiveMode("stage");
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setIsTitleScreen(false);
      return;
    }

    setIsTitleLeaving(true);
    titleTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsTitleScreen(false);
      setIsTitleLeaving(false);
      titleTransitionTimeoutRef.current = undefined;
    }, TITLE_SCENE_TRANSITION_MS);
  };

  const handleReturnToTitleFromStageSelection = () => {
    if (activeDialogRef.current !== null || gameState.status !== "ready" || countdownEndsAtRef.current !== null || isTitleLeaving) return;
    setActiveMode("title");
    setIsTitleLeaving(false);
    setIsTitleScreen(true);
  };

  const handleStart = () => {
    if (activeDialogRef.current !== null || gameState.status !== "ready" || runStartedRef.current || countdownEndsAtRef.current !== null) return;
    const requestedAt = Date.now();
    const endsAt = requestedAt + STAGE_COUNTDOWN_MS;
    runStartedRef.current = true;
    countdownEndsAtRef.current = endsAt;
    setNowMs(requestedAt);
    setCountdownEndsAt(endsAt);
    void audioController?.startBgm();
  };

  const handleContinue = () => {
    if (gameState.status !== "checkpoint" || countdownEndsAtRef.current !== null) return;
    const endsAt = Date.now() + STAGE_COUNTDOWN_MS;
    countdownEndsAtRef.current = endsAt;
    setNowMs(endsAt - STAGE_COUNTDOWN_MS);
    setCountdownEndsAt(endsAt);
  };

  const openPauseMenu = (confirmation: PauseMenuConfirmation = null) => {
    if (activeDialogRef.current !== null) return;
    const pendingCountdown = countdownEndsAtRef.current !== null;
    const isPlaying = gameState.status === "playing";
    if (!pendingCountdown && !isPlaying) return;

    const openedAt = Date.now();
    if (isPlaying) {
      const reconciled = tickGame(gameState, openedAt);
      setNowMs(openedAt);
      setGameState(reconciled);
      if (reconciled.status !== "playing") return;
      pauseResumeTargetRef.current = "playing";
      pausedDialogOpenedAtRef.current = openedAt;
      setPausedGameTime(openedAt);
    } else {
      pauseResumeTargetRef.current = gameState.status === "checkpoint" ? "continue" : "start";
      pausedDialogOpenedAtRef.current = null;
      setPausedGameTime(null);
      countdownEndsAtRef.current = null;
      setCountdownEndsAt(null);
    }

    setPauseConfirmation(confirmation);
    activeDialogRef.current = "pause";
    setActiveDialog("pause");
    audioController?.stopBgm();
  };
  useEffect(() => {
    pauseMenuActionRef.current = openPauseMenu;
  });

  const beginPausedResumeCountdown = () => {
    if (activeDialogRef.current !== "pause" || pauseResumeTargetRef.current === null) return;
    const startedAt = Date.now();
    const endsAt = startedAt + STAGE_COUNTDOWN_MS;
    setPauseConfirmation(null);
    countdownEndsAtRef.current = endsAt;
    setNowMs(startedAt);
    setCountdownEndsAt(endsAt);
    void audioController?.startBgm();
  };

  const confirmPausedRestart = () => {
    if (activeDialogRef.current !== "pause" || pauseConfirmation !== "restart") return;
    const targetStage = gameState.status === "checkpoint" ? (gameState.stage + 1) as GameStage : gameState.stage;
    const knownHighest = readKnownHighest();
    const reset = resetGame(undefined, { stage: targetStage, highestClearedStage: knownHighest });
    const startedAt = Date.now();
    const endsAt = startedAt + STAGE_COUNTDOWN_MS;
    pausedDialogOpenedAtRef.current = null;
    setPausedGameTime(null);
    pauseResumeTargetRef.current = "start";
    activeDialogRef.current = "pause";
    runStartedRef.current = true;
    setPauseConfirmation(null);
    setNowMs(startedAt);
    setGameState(reset);
    countdownEndsAtRef.current = endsAt;
    setCountdownEndsAt(endsAt);
    void audioController?.startBgm();
  };

  const confirmPausedTitleReturn = () => {
    if (activeDialogRef.current !== "pause" || pauseConfirmation !== "title") return;
    const knownHighest = readKnownHighest();
    const preview = resetGame(undefined, { stage: getHighestUnlockedStage(knownHighest), highestClearedStage: knownHighest });
    audioController?.stopBgm();
    pausedDialogOpenedAtRef.current = null;
    setPausedGameTime(null);
    pauseResumeTargetRef.current = null;
    countdownEndsAtRef.current = null;
    activeDialogRef.current = null;
    runStartedRef.current = false;
    setPauseConfirmation(null);
    setCountdownEndsAt(null);
    setActiveDialog(null);
    setActiveMode("title");
    setIsTitleLeaving(false);
    setIsTitleScreen(true);
    setNowMs(Date.now());
    setGameState(preview);
  };
  const clearStageCountdown = () => {
    countdownEndsAtRef.current = null;
    setCountdownEndsAt(null);
  };
  const handleQuit = () => {
    if (countdownEndsAtRef.current !== null) return;
    clearStageCountdown();
    const quitAt = Date.now();
    setNowMs(quitAt);
    setGameState((state) => quitAtCheckpoint(state, quitAt));
  };

  useEffect(() => {
    const isPauseCountdown = activeDialog === "pause" && pauseResumeTargetRef.current !== null;
    if (countdownEndsAt === null || (!isPauseCountdown && gameState.status !== "checkpoint" && gameState.status !== "ready")) return undefined;

    const updateCountdown = () => {
      if (document.visibilityState !== "visible" || countdownEndsAtRef.current !== countdownEndsAt) return;
      const actualNowMs = Date.now();
      setNowMs(actualNowMs);
      if (actualNowMs < countdownEndsAt) return;

      countdownEndsAtRef.current = null;
      setCountdownEndsAt(null);
      if (activeDialogRef.current === "pause") {
        const target = pauseResumeTargetRef.current;
        const pauseOpenedAt = pausedDialogOpenedAtRef.current;
        pauseResumeTargetRef.current = null;
        pausedDialogOpenedAtRef.current = null;
        setPausedGameTime(null);
        activeDialogRef.current = null;
        setPauseConfirmation(null);
        setActiveDialog(null);
        setGameState((state) => target === "playing" && pauseOpenedAt !== null
          ? resumeGameAfterPause(state, pauseOpenedAt, actualNowMs)
          : target === "continue" ? continueGame(state, actualNowMs)
          : target === "start" ? startGame(state, actualNowMs) : state);
      } else {
        setGameState((state) => state.status === "checkpoint"
          ? continueGame(state, actualNowMs)
          : state.status === "ready" ? startGame(state, actualNowMs) : state);
      }
    };

    const intervalId = window.setInterval(updateCountdown, 50);
    document.addEventListener("visibilitychange", updateCountdown);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", updateCountdown);
      if (countdownEndsAtRef.current === countdownEndsAt) countdownEndsAtRef.current = null;
    };
  }, [activeDialog, countdownEndsAt, gameState.status]);

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
    gameState.captureEndsAt === null && activeDialog === null &&
    Math.max(nowMs, pursuerAnimationTime) < pursuerMoveAt + pursuerMotionDuration;

  useEffect(() => {
    if (pursuerMoveAt === null) return;
    const endsAt = pursuerMoveAt + pursuerMotionDuration;
    const suppressed = gameState.status !== "playing" || gameState.captureEndsAt !== null || activeDialog !== null;
    pursuerTimeoutRef.current = window.setTimeout(() => {
      setPursuerAnimationTime(endsAt);
      pursuerTimeoutRef.current = undefined;
    }, suppressed ? 0 : Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(pursuerTimeoutRef.current);
  }, [pursuerMoveAt, pursuerMotionDuration, gameState.status, gameState.captureEndsAt, activeDialog]);

  useEffect(() => () => {
    window.clearTimeout(climbTimeoutRef.current);
    window.clearTimeout(pursuerTimeoutRef.current);
    window.clearTimeout(titleTransitionTimeoutRef.current);
    countdownEndsAtRef.current = null;
    pausedDialogOpenedAtRef.current = null;
    pauseResumeTargetRef.current = null;
    activeDialogRef.current = null;
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
  const overtime = useOvertimeCaptureEnding(stageResult, nowMs);
  const isOvertimeEnding = overtime.phase === "overtime";
  const isCaughtPresentationPending = overtime.phase === "capture" || isOvertimeEnding;
  const isForegroundEnding = isEnding || isOvertimeEnding;
  useEffect(() => {
    if (stageResult === null || !submitCompanyResult || submittedCompanyResults.current.has(stageResult)) return;
    submittedCompanyResults.current.add(stageResult);
    submitCompanyResult(stageResult);
  }, [stageResult, submitCompanyResult]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || activeDialogRef.current !== null || isTextEntryTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const countdownPending = countdownEndsAtRef.current !== null;
      if (key === "escape" || key === "r") {
        if (event.repeat || (gameState.status !== "playing" && !countdownPending)) return;
        event.preventDefault();
        pauseMenuActionRef.current(key === "r" ? "restart" : null);
        return;
      }
      if (gameState.status !== "playing") return;

      const isSpace = event.code === "Space" || event.key === " ";
      if (isSpace) {
        if (event.target instanceof Element && event.target.closest('button, [role="button"]')) return;
        event.preventDefault();
        if (!event.repeat) handleInput("jump");
        return;
      }
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
  }, [handleInput, gameState.status, countdownEndsAt]);

  useEffect(() => {
    if (activeDialog !== null) return undefined;
    const timersActive = gameState.status === "playing" || gameState.recoveryEndsAt !== null || gameState.captureEndsAt !== null;
    if (!timersActive) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (activeDialogRef.current !== null) return;
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
  }, [gameState, activeDialog]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || activeDialogRef.current !== null) {
        return;
      }

      const visibleAt = Date.now();
      setNowMs(visibleAt);
      setGameState((state) => tickGame(state, visibleAt));
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const displayedGameTime = activeDialog === "pause" && pausedGameTime !== null
    ? pausedGameTime
    : nowMs;
  const eventSecondsLeft =
    gameState.eventEndsAt === null
      ? 0
      : Math.max(0, Math.ceil((gameState.eventEndsAt - (gameState.checkpointEnteredAt ?? displayedGameTime)) / 1000));
  const controlsDisabled =
    gameState.status !== "playing" || gameState.recoveryEndsAt !== null || activeDialog !== null;
  const pursuerCatchVisible = gameState.captureEndsAt !== null &&
    (gameState.status === "playing" || gameState.endReason === "caught");

  useEffect(() => {
    if (gameState.status === "game-over" && !isEnding && !isCaughtPresentationPending) restartButtonRef.current?.focus();
  }, [gameState.status, isEnding, isCaughtPresentationPending, stageResult]);

  useEffect(() => {
    if (activeDialog === "settings") {
      if (!settingsDialogRef.current?.contains(document.activeElement)) settingsCloseRef.current?.focus();
    } else if (activeDialog === "instructions") {
      if (!instructionsDialogRef.current?.contains(document.activeElement)) instructionsCloseRef.current?.focus();
    } else if (activeDialog === "leaderboard") {
      if (!leaderboardDialogRef.current?.contains(document.activeElement)) leaderboardCloseRef.current?.focus();
    } else if (activeDialog === "customization") {
      // CharacterCustomizationDialog owns initial focus.
    } else if (activeDialog === "pause") {
      // PauseMenuDialog owns initial focus.
    } else if (previousDialogRef.current === "settings") {
      settingsTriggerRef.current?.focus();
    } else if (previousDialogRef.current === "instructions") {
      instructionsTriggerRef.current?.focus();
    } else if (previousDialogRef.current === "leaderboard") {
      leaderboardReturnFocusRef.current?.focus();
      leaderboardReturnFocusRef.current = null;
    } else if (previousDialogRef.current === "customization") {
      customizationTriggerRef.current?.focus();
    } else if (previousDialogRef.current === "pause") {
      if (isTitleScreen) titleStartButtonRef.current?.focus();
      else pauseTriggerRef.current?.focus();
    }
    previousDialogRef.current = activeDialog;
  }, [activeDialog, autoplayBlocked, isTitleScreen]);

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>, onClose: () => void) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
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

  const onSettingsDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => onDialogKeyDown(event, closeSettings);
  const onInstructionsDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => onDialogKeyDown(event, closeInstructions);
  const onLeaderboardDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => onDialogKeyDown(event, closeLeaderboard);

  if (activeMode === "infinite") {
    return <InfiniteModeScreen appearance={appearance} account={account} companyRecords={companyRecords} audioController={audioController}
      audioPreferences={audioPreferences} autoplayBlocked={autoplayBlocked} onAudioPreferencesChange={onAudioPreferencesChange}
      onEnableAudio={onEnableAudio} onReturnToTitle={() => setActiveMode("title")} />;
  }

  return (
    <main className="stair-game pixel-theme" data-game-status={gameState.status}>
      <div className="game-shell">
        <div
          className="game-frame"
          data-game-status={gameState.status}
          data-stage={gameState.stage}
          data-pursuer-catching={pursuerCatchVisible && overtime.phase !== "complete"}
          data-office-ending={isEnding}
          data-overtime-ending={isOvertimeEnding}
          data-title-transitioning={isTitleLeaving || undefined}
          data-title-screen={isTitleScreen || undefined}
        >
          {isTitleScreen && (
            <section
              className={`game-title-screen${isTitleLeaving ? " is-leaving" : ""}`}
              aria-labelledby="game-title"
              aria-hidden={isTitleLeaving || isCustomizationOpen || undefined}
              inert={isTitleLeaving || isCustomizationOpen || undefined}
            >
              <div className="game-title-copy">
                <p className="game-title-kicker">STAIRWAY CHALLENGE</p>
                <h1 id="game-title">덱스 탈출 넘버원</h1>
                <p className="game-title-tagline">계단을 내려가 1층까지 도착해 퇴근하세요!</p>
              </div>
              <div className="game-title-actions">
                <button ref={titleStartButtonRef} className="game-title-start" type="button" onClick={handleEnterStageSelection}>
                  단계 모드
                </button>
                <button className="game-title-infinite" type="button" onClick={() => { if (activeDialogRef.current === null && !isTitleLeaving) setActiveMode("infinite"); }}>
                  무한 모드
                </button>
                <button ref={settingsTriggerRef} className="game-title-guide" type="button"
                  aria-haspopup="dialog" aria-expanded={isSettingsOpen} aria-controls="game-settings-dialog" onClick={openSettings}>
                  설정
                </button>
                <button
                  ref={instructionsTriggerRef}
                  className="game-title-guide"
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={isInstructionsOpen}
                  aria-controls="game-instructions-dialog"
                  onClick={openInstructions}
                >
                  게임 설명
                </button>
                <button ref={customizationTriggerRef} className="game-title-customization" type="button"
                  aria-haspopup="dialog" aria-expanded={isCustomizationOpen} aria-controls="character-customization-dialog"
                  onClick={() => openGameDialog("customization")}>
                  캐릭터 꾸미기
                </button>
                <button className="game-title-ranking" type="button" aria-haspopup="dialog" aria-expanded={isLeaderboardOpen}
                  aria-controls="leaderboard-dialog" onClick={(event) => openLeaderboard(event.currentTarget)}>
                  랭킹 보기
                </button>
              </div>
            </section>
          )}
          {(!isTitleScreen || isTitleLeaving) && (
            <>
              <button
                ref={settingsTriggerRef}
                className="game-settings-button"
                type="button"
                aria-label="게임 설정"
                aria-expanded={isSettingsOpen}
                aria-controls="game-settings-dialog"
                disabled={countdownEndsAt !== null || (gameState.status !== "ready" && gameState.status !== "checkpoint" && gameState.status !== "playing") || isEnding || isCaughtPresentationPending}
                onClick={openSettings}
              >
                <PixelIcon name="settings" />
              </button>

              {(gameState.status === "playing" || countdownEndsAt !== null) && !isEnding && !isCaughtPresentationPending && (
                <button
                  ref={pauseTriggerRef}
                  className="game-pause-button"
                  type="button"
                  aria-label="일시정지"
                  aria-haspopup="dialog"
                  aria-expanded={isPauseOpen}
                  aria-controls="game-pause-dialog"
                  onClick={() => openPauseMenu()}
                >
                  <PixelIcon name="pause" />
                </button>
              )}

              {countdownEndsAt !== null && (gameState.status === "ready" || gameState.status === "checkpoint") ? null : gameState.status === "ready" && (!isTitleScreen || isTitleLeaving) ? (
                <StageSelectPanel selectedStage={gameState.stage} highestClearedStage={Math.max(
                  gameState.highestClearedStage, companyRecords?.profile.highestClearedStage ?? 0,
                ) as ClearedStage}
                  onSelect={handleSelectStage} onStart={handleStart} onReturnToTitle={handleReturnToTitleFromStageSelection}
                  onOpenLeaderboard={openLeaderboard}
                  disabled={false} progressUnavailable={progressUnavailable} />
              ) : gameState.status === "playing" ? (
                <ControlButtons
                  onForward={() => handleInput("forward")}
                  onTurn={() => handleInput("turn")}
                  onJump={() => handleInput("jump")}
                  disabled={controlsDisabled}
                />
              ) : gameState.status === "checkpoint" && countdownEndsAt === null ? (
                <CheckpointPanel stage={gameState.stage} score={gameState.score}
                  remainingTimeCs={stageResult!.remainingTimeCs}
                  onContinue={handleContinue} onQuit={handleQuit} disabled={false}
                  recordsNotice={companyRecords && <CompanyRecordsNotice records={companyRecords} />} />
              ) : isEnding ? <OfficeExitEnding appearance={appearance.runner} key={stageResult!.endedAtMs} variant="animated" startedAtMs={stageResult!.endedAtMs} />
                : overtime.phase === "capture" ? null
                : isOvertimeEnding ? <OvertimeCaptureEnding appearance={appearance} key={stageResult!.endedAtMs} variant="animated" startedAtMs={overtime.sceneStartedAtMs!} /> : (
                <section
                  className="game-over-panel"
                  aria-labelledby="game-over-title"
                >
                  <div className="game-over-result">
                    {stageResult?.stage === 5 && stageResult.outcome === "cleared" && <OfficeExitEnding appearance={appearance.runner} variant="complete" />}
                    {stageResult?.outcome === "caught" && overtime.prefersReducedMotion && <OvertimeCaptureEnding appearance={appearance} variant="complete" />}
                    <PixelIcon name="flag" className="game-over-icon" size={36} />
                    <p className="game-over-kicker">이번 도전 결과</p>
                    <h2 id="game-over-title">{gameState.score}점</h2>
                    <p className="game-over-stage">기록 단계 {gameState.stage}단계</p>
                    <p className="game-over-time">남은 시간 {formatRemainingTimeCs(stageResult!.remainingTimeCs)}</p>
                    <p className="game-over-reason">{gameState.endReason === "cleared" ? "최종 클리어!" : gameState.endReason === "time-limit" ? "시간 초과" : gameState.endReason === "quit" ? "체크포인트에서 종료했어요" : "추격자에게 잡혔어요"}</p>
                    <p className="game-over-steps">계단 {gameState.stepsClimbed}개를 내려왔어요.</p>
                    {companyRecords && <CompanyRecordsNotice records={companyRecords} />}
                    <div className="game-over-actions">
                      <button ref={restartButtonRef} className="start-button restart-button" type="button" onClick={handleShowStageSelection}>
                        <PixelIcon name="restart" size={20} /> 다시 시작
                      </button>
                      <button className="start-button game-over-title-button" type="button" onClick={handleReturnToTitle}>
                        메인 타이틀로
                      </button>
                    </div>
                  </div>
                  <LeaderboardPanel entries={companyRecords?.entries ?? leaderboard} currentAccountId={account.homeAccountId}
                    scope={usesCompanyRecords ? "company" : "browser"} />
                </section>
              )}
              <p className="game-footer" aria-hidden={isForegroundEnding || undefined} inert={isForegroundEnding || undefined}>
                <span className="desktop-control-hint"><kbd>D</kbd> 한 칸 내려가기 <span>·</span> <kbd>J</kbd> 방향 바꾸며 내려가기 <span>·</span> <kbd>Space</kbd> 장애물 점프</span>
                <span className="mobile-control-hint">내려가기 · 방향 바꾸기 · 장애물은 점프!</span>
              </p>
            </>
          )}
          <div
            className={`game-stage${isTitleScreen ? " is-title-background" : ""}`}
            aria-hidden={isTitleScreen || isForegroundEnding || undefined}
            inert={isTitleScreen || isForegroundEnding || undefined}
          >
            {!isTitleScreen && <GameHud
              state={gameState}
              eventSecondsLeft={eventSecondsLeft}
              scoreGain={scoreGain}
              scoreGainIsBonus={scoreGainIsBonus}
              scoreAnimationKey={scoreAnimationKey}
              stageSecondsLeft={getStageSecondsLeft(gameState, Math.max(0, displayedGameTime))}
            />}
            <div className="game-layout" data-game-status={gameState.status}>
              <StairScene
                appearance={appearance}
                state={gameState}
                climbAnimationKey={climbAnimationKey}
                isClimbing={isClimbing && gameState.status === "playing" && !gameState.lastMistake && !pursuerCatchVisible}
                pursuerAnimationKey={pursuerAnimationKey}
                isPursuerMoving={isPursuerMoving}
                isPursuerCaught={pursuerCatchVisible}
              />
            </div>
          </div>
          {countdownEndsAt !== null && isPauseOpen && (
            <StageTransitionCountdown
              label="게임 재개"
              secondsRemaining={Math.max(1, Math.min(3, Math.ceil((countdownEndsAt - nowMs) / 1000))) as 1 | 2 | 3}
            />
          )}
          {countdownEndsAt !== null && !isPauseOpen && (gameState.status === "checkpoint" || gameState.status === "ready") && (
            <StageTransitionCountdown
              stage={gameState.status === "checkpoint" ? (gameState.stage + 1) as GameStage : gameState.stage}
              secondsRemaining={Math.max(1, Math.min(3, Math.ceil((countdownEndsAt - nowMs) / 1000))) as 1 | 2 | 3}
            />
          )}
          {isPauseOpen && countdownEndsAt === null && (
            <PauseMenuDialog
              modeName="단계 모드"
              confirmation={pauseConfirmation}
              onResume={beginPausedResumeCountdown}
              onRequestRestart={() => setPauseConfirmation("restart")}
              onRequestTitle={() => setPauseConfirmation("title")}
              onConfirm={pauseConfirmation === "restart" ? confirmPausedRestart : confirmPausedTitleReturn}
              onCancelConfirmation={() => setPauseConfirmation(null)}
            />
          )}
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

                </div>
              </section>
            </div>
          )}
          {isCustomizationOpen && (
            <CharacterCustomizationDialog binding={appearanceBinding} storageMode={companyRecords?.appearance ? "account" : "session"}
              onClose={() => closeGameDialog("customization")} />
          )}
          {isInstructionsOpen && (
            <GameInstructionsDialog
              onClose={closeInstructions}
              closeButtonRef={instructionsCloseRef}
              dialogRef={instructionsDialogRef}
              onKeyDown={onInstructionsDialogKeyDown}
            />
          )}
          {isLeaderboardOpen && (
            <LeaderboardDialog
              entries={companyRecords?.entries ?? leaderboard}
              infiniteEntries={companyRecords?.infiniteEntries ?? []}
              currentAccountId={account.homeAccountId}
              scope={usesCompanyRecords ? "company" : "browser"}
              onClose={closeLeaderboard}
              closeButtonRef={leaderboardCloseRef}
              dialogRef={leaderboardDialogRef}
              onKeyDown={onLeaderboardDialogKeyDown}
            />
          )}
        </div>
      </div>
    </main>
  );
}
