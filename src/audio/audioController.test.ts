import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioController } from "./audioController";
import { DEFAULT_AUDIO_PREFERENCES } from "./audioPreferences";

class FakeAudio {
  static instances: FakeAudio[] = [];
  static playResult: () => Promise<void> = () => Promise.resolve();
  loop = false;
  volume = 1;
  muted = false;
  playbackRate = 1;
  currentTime = 0;
  paused = true;
  readonly listeners = new Map<string, () => void>();

  constructor(readonly src: string) { FakeAudio.instances.push(this); }
  play = vi.fn(() => { this.paused = false; return FakeAudio.playResult(); });
  pause = vi.fn(() => { this.paused = true; });
  addEventListener = (type: string, listener: () => void) => { this.listeners.set(type, listener); };
}

describe("audio controller", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    FakeAudio.playResult = () => Promise.resolve();
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("loops the BGM and stops it at the beginning", async () => {
    const controller = createAudioController();
    await expect(controller.startBgm()).resolves.toBe(true);
    const bgm = FakeAudio.instances[0];
    expect(bgm.src).toBe("/audio/stair-climb-bgm.mp3");
    expect(bgm.loop).toBe(true);
    expect(bgm.volume).toBeCloseTo(0.18);
    bgm.currentTime = 6;
    controller.stopBgm();
    expect(bgm.pause).toHaveBeenCalledOnce();
    expect(bgm.currentTime).toBe(0);
  });

  it("changes speed for the event even when BGM is muted", async () => {
    const controller = createAudioController();
    await controller.startBgm();
    const bgm = FakeAudio.instances[0];
    expect(bgm.volume).toBeCloseTo(0.18);
    controller.setPreferences({ ...DEFAULT_AUDIO_PREFERENCES, bgmMuted: true, bgmVolume: 0.2 });
    expect(bgm.muted).toBe(true);
    expect(bgm.volume).toBe(0.12);
    controller.setEventActive(true);
    expect(bgm.playbackRate).toBe(1.25);
    controller.setEventActive(false);
    expect(bgm.playbackRate).toBe(1);
  });

  it("boosts footsteps while preserving fall volume and independent mute", async () => {
    const controller = createAudioController();
    await controller.startBgm();
    controller.setPreferences({ ...DEFAULT_AUDIO_PREFERENCES, effectsVolume: 0.5 });
    controller.playFootstep();
    controller.playFall();
    expect(FakeAudio.instances.map((audio) => audio.src)).toEqual([
      "/audio/stair-climb-bgm.mp3",
      "/audio/stone-step.ogg",
      "/audio/fall-thud.mp3",
    ]);
    expect(FakeAudio.instances[1].volume).toBe(0.75);
    expect(FakeAudio.instances[2].volume).toBe(0.5);

    controller.setPreferences({ ...DEFAULT_AUDIO_PREFERENCES, effectsVolume: 0.2 });
    controller.playFootstep();
    controller.playFall();
    expect(FakeAudio.instances[3].volume).toBeCloseTo(0.3);
    expect(FakeAudio.instances[4].volume).toBe(0.2);

    controller.setPreferences({ ...DEFAULT_AUDIO_PREFERENCES, effectsVolume: 1 });
    controller.playFootstep();
    controller.playFall();
    expect(FakeAudio.instances[5].volume).toBe(1);
    expect(FakeAudio.instances[6].volume).toBe(1);

    controller.setPreferences({ ...DEFAULT_AUDIO_PREFERENCES, effectsMuted: true });
    controller.playFootstep();
    expect(FakeAudio.instances).toHaveLength(7);
    await Promise.resolve();
  });

  it("keeps zero volume at zero for both playback channels", async () => {
    const controller = createAudioController();
    controller.setPreferences({ ...DEFAULT_AUDIO_PREFERENCES, bgmVolume: 0, effectsVolume: 0 });
    await controller.startBgm();
    controller.playFootstep();
    controller.playFall();

    expect(FakeAudio.instances.map((audio) => audio.volume)).toEqual([0, 0, 0]);
  });

  it("reports autoplay rejection without throwing", async () => {
    FakeAudio.playResult = () => Promise.reject(new DOMException("blocked", "NotAllowedError"));
    const controller = createAudioController();
    await expect(controller.startBgm()).resolves.toBe(false);
  });

  it("ignores an old play result after disposal and can start again", async () => {
    let finishOldPlay: (() => void) | undefined;
    FakeAudio.playResult = () => new Promise<void>((resolve) => { finishOldPlay = resolve; });
    const controller = createAudioController();
    const oldAttempt = controller.startBgm();
    controller.dispose();

    FakeAudio.playResult = () => Promise.resolve();
    await expect(controller.startBgm()).resolves.toBe(true);
    finishOldPlay?.();
    await expect(oldAttempt).resolves.toBe(false);
  });
});
