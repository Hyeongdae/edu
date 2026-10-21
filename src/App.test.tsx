import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { StrictMode } from "react";
import App from "./App";

const signedInAccount = vi.hoisted(() => ({
  homeAccountId: "audio-test-account",
  environment: "login.microsoftonline.com",
  tenantId: "tenant-id",
  username: "player@example.com",
  localAccountId: "player",
  name: "홍길동",
}));

vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    accounts: [signedInAccount],
    instance: { getActiveAccount: () => signedInAccount },
  }),
}));

vi.mock("./auth/AuthGate", () => ({
  AuthGate: ({ children }: { children: ReactNode }) => children,
}));

class AppAudio {
  static instances: AppAudio[] = [];
  static outcomes: boolean[] = [];
  loop = false;
  volume = 1;
  muted = false;
  playbackRate = 1;
  currentTime = 0;
  constructor(readonly src: string) { AppAudio.instances.push(this); }
  play = vi.fn(() => {
    const result = AppAudio.outcomes.shift() ?? true;
    return result ? Promise.resolve() : Promise.reject(new DOMException("blocked", "NotAllowedError"));
  });
  pause = vi.fn();
  addEventListener = vi.fn();
}

describe("authenticated audio setup", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("tries the BGM after sign-in and offers a click fallback when autoplay is blocked", async () => {
    AppAudio.instances = [];
    AppAudio.outcomes = [false, false, true];
    vi.stubGlobal("Audio", AppAudio);

    render(<StrictMode><App configurationError={null} /></StrictMode>);
    expect(await screen.findByRole("button", { name: "음악 켜기" })).toBeVisible();
    expect(AppAudio.instances.at(-1)?.src).toBe("/audio/stair-climb-bgm.mp3");
    fireEvent.click(screen.getByRole("button", { name: "음악 켜기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "음악 켜기" })).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "오디오 설정" })).toBeVisible();
  });

  it("restores the previous channel settings when the signed-in shell mounts", () => {
    AppAudio.instances = [];
    AppAudio.outcomes = [true];
    vi.stubGlobal("Audio", AppAudio);
    window.localStorage.setItem("stair-climb:audio:v1", JSON.stringify({
      bgmVolume: 0.3,
      bgmMuted: true,
      effectsVolume: 0.9,
      effectsMuted: false,
    }));

    render(<App configurationError={null} />);
    expect(screen.getByRole("slider", { name: "배경 음악 음량" })).toHaveValue("30");
    expect(screen.getByRole("slider", { name: "효과음 음량" })).toHaveValue("90");
    expect(AppAudio.instances[0].muted).toBe(true);
    expect(AppAudio.instances[0].volume).toBe(0.3);
    fireEvent.click(screen.getByRole("button", { name: "배경 음악 켜기" }));
    expect(JSON.parse(window.localStorage.getItem("stair-climb:audio:v1") ?? "{}")).toMatchObject({ bgmMuted: false });
  });
});
