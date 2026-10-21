export interface AudioPreferences {
  bgmVolume: number;
  bgmMuted: boolean;
  effectsVolume: number;
  effectsMuted: boolean;
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  bgmVolume: 0.5,
  bgmMuted: false,
  effectsVolume: 0.5,
  effectsMuted: false,
};

const STORAGE_KEY = "stair-climb:audio:v1";

function getStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function validVolume(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function loadAudioPreferences(storage?: Storage): AudioPreferences {
  const target = getStorage(storage);
  if (!target) return { ...DEFAULT_AUDIO_PREFERENCES };

  try {
    const serialized = target.getItem(STORAGE_KEY);
    if (!serialized) return { ...DEFAULT_AUDIO_PREFERENCES };
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULT_AUDIO_PREFERENCES };
    }
    const values = parsed as Record<string, unknown>;
    return {
      bgmVolume: validVolume(values.bgmVolume) ? values.bgmVolume : DEFAULT_AUDIO_PREFERENCES.bgmVolume,
      bgmMuted: typeof values.bgmMuted === "boolean" ? values.bgmMuted : DEFAULT_AUDIO_PREFERENCES.bgmMuted,
      effectsVolume: validVolume(values.effectsVolume) ? values.effectsVolume : DEFAULT_AUDIO_PREFERENCES.effectsVolume,
      effectsMuted: typeof values.effectsMuted === "boolean" ? values.effectsMuted : DEFAULT_AUDIO_PREFERENCES.effectsMuted,
    };
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }
}

export function saveAudioPreferences(preferences: AudioPreferences, storage?: Storage): boolean {
  if (
    !validVolume(preferences.bgmVolume) ||
    !validVolume(preferences.effectsVolume) ||
    typeof preferences.bgmMuted !== "boolean" ||
    typeof preferences.effectsMuted !== "boolean"
  ) return false;

  const target = getStorage(storage);
  if (!target) return false;
  try {
    target.setItem(STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}
