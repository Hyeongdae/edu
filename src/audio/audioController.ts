import type { AudioPreferences } from "./audioPreferences";

export interface AudioController {
  startBgm(): Promise<boolean>;
  stopBgm(): void;
  setEventActive(active: boolean): void;
  setPreferences(preferences: AudioPreferences): void;
  playFootstep(): void;
  playFall(): void;
  dispose(): void;
}

const BGM_SOURCE = "/audio/stair-climb-bgm.mp3";
const FOOTSTEP_SOURCE = "/audio/stone-step.ogg";
const FALL_SOURCE = "/audio/fall-thud.mp3";

export function createAudioController(): AudioController {
  let bgm: HTMLAudioElement | null = null;
  let preferences: AudioPreferences = {
    bgmVolume: 0.5,
    bgmMuted: false,
    effectsVolume: 0.5,
    effectsMuted: false,
  };
  let eventActive = false;
  let disposed = false;
  let startPromise: Promise<boolean> | null = null;
  let playAttempt = 0;
  const activeEffects = new Set<HTMLAudioElement>();

  const getBgm = () => {
    if (!bgm) {
      bgm = new Audio(BGM_SOURCE);
      bgm.loop = true;
      bgm.playbackRate = eventActive ? 1.25 : 1;
      bgm.volume = preferences.bgmVolume;
      bgm.muted = preferences.bgmMuted;
    }
    return bgm;
  };

  const playEffect = (source: string) => {
    if (preferences.effectsMuted) return;
    try {
      const effect = new Audio(source);
      effect.volume = preferences.effectsVolume;
      activeEffects.add(effect);
      effect.addEventListener("ended", () => activeEffects.delete(effect), { once: true });
      void effect.play().catch(() => activeEffects.delete(effect));
    } catch {
      // Missing or unsupported audio must not affect game input.
    }
  };

  return {
    async startBgm() {
      disposed = false;
      if (startPromise) return startPromise;
      let pending: Promise<boolean> | null = null;
      try {
        const attempt = ++playAttempt;
        pending = getBgm().play().then(() => !disposed && attempt === playAttempt).catch(() => false);
        startPromise = pending;
        return await pending;
      } catch {
        return false;
      } finally {
        if (startPromise === pending) startPromise = null;
      }
    },
    stopBgm() {
      if (!bgm) return;
      try {
        bgm.pause();
        bgm.currentTime = 0;
      } catch {
        // Some browsers reject seeking until metadata is available.
      }
    },
    setEventActive(active) {
      eventActive = active;
      if (bgm) bgm.playbackRate = eventActive ? 1.25 : 1;
    },
    setPreferences(next) {
      preferences = { ...next };
      if (bgm) {
        bgm.volume = preferences.bgmVolume;
        bgm.muted = preferences.bgmMuted;
      }
    },
    playFootstep() {
      playEffect(FOOTSTEP_SOURCE);
    },
    playFall() {
      playEffect(FALL_SOURCE);
    },
    dispose() {
      disposed = true;
      playAttempt += 1;
      startPromise = null;
      this.stopBgm();
      bgm = null;
      for (const effect of activeEffects) {
        effect.pause();
        effect.currentTime = 0;
      }
      activeEffects.clear();
    },
  };
}
