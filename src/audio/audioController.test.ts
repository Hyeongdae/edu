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
    bgm.currentTime = 6;
    controller.stopBgm();
    expect(bgm.pause).toHaveBeenCalledOnce();
    expect(bgm.currentTime).toBe(0);
  });

  it("changes speed for the event even when BGM is muted", async () => {
    const controller = createAudioController();
    await controller.startBgm();
    const bgm = FakeAudio.instances[0];
    controller.setPreferences({ ...DEFAULT_AUDIO_PREFERENCES, bgmMuted: true, bgmVolume: 0.2 });
    expect(bgm.muted).toBe(true);
    expect(bgm.volume).toBe(0.2);
    controller.setEventActive(true);
    expect(bgm.playbackRate).toBe(1.25);
    controller.setEventActive(false);
    expect(bgm.playbackRate).toBe(1);
  });

  it("plays overlapping effects with independent mute and volume", async () => {
    const controller = createAudioController();
    await controller.startBgm();
    controller.setPreferences({ ...DEFAULT_AUDIO_PREFERENCES, effectsVolume: 0.3 });
    controller.playFootstep();
    controller.playFall();
    expect(FakeAudio.instances.map((audio) => audio.src)).toEqual([
      "/audio/stair-climb-bgm.mp3",
      "/audio/stone-step.ogg",
      "/audio/fall-thud.mp3",
    ]);
    expect(FakeAudio.instances[1].volume).toBe(0.3);

    controller.setPreferences({ ...DEFAULT_AUDIO_PREFERENCES, effectsMuted: true });
    controller.playFootstep();
    expect(FakeAudio.instances).toHaveLength(3);
    await Promise.resolve();
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
