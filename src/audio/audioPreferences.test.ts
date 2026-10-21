import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AUDIO_PREFERENCES,
  loadAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences,
} from "./audioPreferences";

const key = "stair-climb:audio:v1";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (item) => values.get(item) ?? null,
    setItem: (item, value) => { values.set(item, value); },
    removeItem: (item) => { values.delete(item); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

describe("audio preferences", () => {
  let storage: Storage;

  beforeEach(() => { storage = createStorage(); });

  it("loads the documented defaults when no preference exists", () => {
    expect(loadAudioPreferences(storage)).toEqual(DEFAULT_AUDIO_PREFERENCES);
  });

  it("saves and reloads separate channel volume and mute values", () => {
    const preferences: AudioPreferences = {
      bgmVolume: 0.25,
      bgmMuted: true,
      effectsVolume: 0.8,
      effectsMuted: false,
    };
    expect(saveAudioPreferences(preferences, storage)).toBe(true);
    expect(storage.getItem(key)).toBe(JSON.stringify(preferences));
    expect(loadAudioPreferences(storage)).toEqual(preferences);
  });

  it("replaces invalid fields with that field's default and handles bad JSON", () => {
    storage.setItem(key, JSON.stringify({ bgmVolume: 3, bgmMuted: true, effectsVolume: 0.2, effectsMuted: "no" }));
    expect(loadAudioPreferences(storage)).toEqual({
      ...DEFAULT_AUDIO_PREFERENCES,
      bgmMuted: true,
      effectsVolume: 0.2,
    });
    storage.setItem(key, "{bad json");
    expect(loadAudioPreferences(storage)).toEqual(DEFAULT_AUDIO_PREFERENCES);
  });

  it("does not throw when storage is unavailable and rejects invalid saves", () => {
    const blocked = createStorage();
    vi.spyOn(blocked, "getItem").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
    vi.spyOn(blocked, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    expect(loadAudioPreferences(blocked)).toEqual(DEFAULT_AUDIO_PREFERENCES);
    expect(saveAudioPreferences(DEFAULT_AUDIO_PREFERENCES, blocked)).toBe(false);
    expect(saveAudioPreferences({ ...DEFAULT_AUDIO_PREFERENCES, effectsVolume: 2 }, storage)).toBe(false);
  });
});
