import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const localAuthCalls = vi.hoisted(() => ({ useMsal: vi.fn(), gate: vi.fn() }));

vi.mock("@azure/msal-react", () => ({
  useMsal: () => {
    localAuthCalls.useMsal();
    return { accounts: [signedInAccount], instance: { getActiveAccount: () => signedInAccount } };
  },
}));

vi.mock("./auth/AuthGate", () => ({
  AuthGate: ({ children }: { children: ReactNode }) => { localAuthCalls.gate(); return children; },
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
  beforeEach(() => {
    AppAudio.instances = [];
    AppAudio.outcomes = [true];
    signedInAccount.homeAccountId = "audio-test-account";
    signedInAccount.name = "홍길동";
    vi.stubGlobal("Audio", AppAudio);
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function openAudioSettings() {
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "덱스 탈출 넘버원" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    fireEvent.click(screen.getByRole("button", { name: "게임 설정" }));
    expect(screen.getByRole("region", { name: "오디오 설정" })).toBeVisible();
  }

  it("tries the BGM after sign-in and offers a click fallback when autoplay is blocked", async () => {
    AppAudio.instances = [];
    AppAudio.outcomes = [false, false, false, true];
    vi.stubGlobal("Audio", AppAudio);

    render(<StrictMode><App configurationError={null} /></StrictMode>);
    await openAudioSettings();
    expect(await screen.findByRole("button", { name: "음악 켜기" })).toBeVisible();
    expect(AppAudio.instances.at(-1)?.src).toBe("/audio/stair-climb-bgm.mp3");
    fireEvent.click(screen.getByRole("button", { name: "음악 켜기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "음악 켜기" })).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "오디오 설정" })).toBeVisible();
  });

  it("restores the previous channel settings when the signed-in shell mounts", async () => {
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
    await openAudioSettings();
    expect(screen.getByRole("slider", { name: "배경 음악 음량" })).toHaveValue("30");
    expect(screen.getByRole("slider", { name: "효과음 음량" })).toHaveValue("90");
    expect(AppAudio.instances[0].muted).toBe(true);
    expect(AppAudio.instances[0].volume).toBeCloseTo(0.18);
    fireEvent.click(screen.getByRole("button", { name: "배경 음악 켜기" }));
    expect(JSON.parse(window.localStorage.getItem("stair-climb:audio:v1") ?? "{}")).toMatchObject({ bgmMuted: false });
  });

  it("opens the game with the local demo account without showing Entra setup", async () => {
    AppAudio.instances = [];
    AppAudio.outcomes = [true];
    vi.stubGlobal("Audio", AppAudio);

    render(<App configurationError="Entra 설정이 필요합니다." localDemoMode />);

    expect(screen.getByRole("heading", { name: "덱스 탈출 넘버원" })).toBeVisible();
    expect(screen.getByText("계단을 내려가 1층까지 도착해 퇴근하세요!")).toBeVisible();
    await openAudioSettings();
    expect(screen.getByText("로컬 테스트 사용자")).toBeVisible();
    expect(screen.queryByText("Entra 설정이 필요합니다.")).not.toBeInTheDocument();
  });

  it("uses hosted identity before local demo or missing SPA settings, with no MSAL hooks", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ clientPrincipal: {
      identityProvider: "aad", userId: "hosted-a", userDetails: "회사 사용자", userRoles: ["authenticated"],
    } }));
    vi.stubGlobal("fetch", fetcher);
    render(<App configurationError="로컬 SPA 설정 없음" localDemoMode authMode="azure-static-web-apps" />);
    expect(await screen.findByRole("heading", { name: "덱스 탈출 넘버원" })).toBeVisible();
    expect(localAuthCalls.useMsal).not.toHaveBeenCalled();
    expect(localAuthCalls.gate).not.toHaveBeenCalled();
    expect(AppAudio.instances).toHaveLength(1);
    await openAudioSettings();
    expect(screen.getByText("회사 사용자")).toBeVisible();
    expect(screen.queryByText("로컬 테스트 사용자")).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not create audio or a game while hosted identity is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<App configurationError={null} localDemoMode authMode="azure-static-web-apps" />);
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "게임 시작" })).not.toBeInTheDocument();
    expect(AppAudio.instances).toHaveLength(0);
  });

  it("ignores the demo prop in production", () => {
    vi.stubEnv("DEV", false);
    render(<App configurationError="회사 설정 필요" localDemoMode />);
    expect(screen.getByText("회사 설정 필요")).toBeVisible();
    expect(screen.queryByRole("button", { name: "게임 시작" })).not.toBeInTheDocument();
    expect(AppAudio.instances).toHaveLength(0);
  });

  it("keeps one audio owner per account, replacing and disposing it on an actual account change", async () => {
    const view = render(<App configurationError={null} />);
    await waitFor(() => expect(AppAudio.instances[0].play).toHaveBeenCalledTimes(1));
    const first = AppAudio.instances[0];
    view.rerender(<App configurationError={null} />);
    expect(AppAudio.instances).toHaveLength(1);
    expect(first.pause).not.toHaveBeenCalled();
    signedInAccount.homeAccountId = "account-b";
    signedInAccount.name = "다른 사용자";
    view.rerender(<App configurationError={null} />);
    expect(first.pause).toHaveBeenCalledTimes(1);
    expect(AppAudio.instances).toHaveLength(2);
    await openAudioSettings();
    expect(screen.getByText("다른 사용자")).toBeVisible();
    expect(screen.queryByText("홍길동")).not.toBeInTheDocument();
    view.unmount();
    expect(AppAudio.instances[1].pause).toHaveBeenCalledTimes(1);
  });
});
