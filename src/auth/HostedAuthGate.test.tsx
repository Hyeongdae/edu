import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HostedAuthGate } from "./HostedAuthGate";

const principal = { identityProvider: "aad", userId: "user-a", userDetails: "회사원 A", userRoles: ["authenticated"] };
let fetcher: ReturnType<typeof vi.fn>;

function pending() {
  let resolve!: (response: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("hosted identity gate", () => {
  it("does not mount the game while identity is loading", async () => {
    const request = pending();
    fetcher.mockReturnValue(request.promise);
    const child = vi.fn((account) => <p>Game {account.homeAccountId}</p>);
    render(<HostedAuthGate>{child}</HostedAuthGate>);
    expect(screen.getByRole("heading", { name: "회사 계정을 확인하고 있어요" })).toBeVisible();
    expect(child).not.toHaveBeenCalled();
    await act(async () => request.resolve(Response.json({ clientPrincipal: principal })));
    expect(screen.getByText("Game user-a")).toBeVisible();
  });

  it("offers ordinary company login navigation without automatically redirecting or using MSAL", async () => {
    fetcher.mockResolvedValue(Response.json({ clientPrincipal: null }));
    const child = vi.fn(() => <p>Game</p>);
    render(<HostedAuthGate>{child}</HostedAuthGate>);
    const login = await screen.findByRole("link", { name: "회사 계정으로 로그인" });
    expect(login.getAttribute("href")).toBe("/.auth/login/aad?post_login_redirect_uri=%2F");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(child).not.toHaveBeenCalled();
  });

  it("shows a safe retryable error and only mounts after a successful retry", async () => {
    fetcher.mockRejectedValueOnce(new Error("private diagnostic")).mockResolvedValueOnce(Response.json({ clientPrincipal: principal }));
    const child = vi.fn((account) => <p>Game {account.homeAccountId}</p>);
    render(<HostedAuthGate>{child}</HostedAuthGate>);
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    expect(child).not.toHaveBeenCalled();
    expect(screen.queryByText("private diagnostic")).not.toBeInTheDocument();
    const firstSignal = fetcher.mock.calls[0][1].signal as AbortSignal;
    fireEvent.click(retry);
    expect(await screen.findByText("Game user-a")).toBeVisible();
    expect(firstSignal.aborted).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects an unexpected provider instead of falling back to a game account", async () => {
    fetcher.mockResolvedValue(Response.json({ clientPrincipal: { ...principal, identityProvider: "github" } }));
    const child = vi.fn(() => <p>Game</p>);
    render(<HostedAuthGate>{child}</HostedAuthGate>);
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeVisible();
    expect(child).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)("ignores stale StrictMode request %s after the newer identity succeeds", async (outcome) => {
    const stale = pending();
    fetcher.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(Response.json({ clientPrincipal: principal }));
    render(<StrictMode><HostedAuthGate>{(account) => <p>Game {account.homeAccountId}</p>}</HostedAuthGate></StrictMode>);
    expect(await screen.findByText("Game user-a")).toBeVisible();
    expect((fetcher.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    await act(async () => {
      if (outcome === "resolve") stale.resolve(Response.json({ clientPrincipal: { ...principal, userId: "old-user" } }));
      else stale.reject(new Error("old request failed"));
    });
    expect(screen.getByText("Game user-a")).toBeVisible();
    expect(screen.queryByText("Game old-user")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("aborts a pending request on unmount without invoking its child later", async () => {
    const request = pending();
    fetcher.mockReturnValue(request.promise);
    const child = vi.fn(() => <p>Game</p>);
    const { unmount } = render(<HostedAuthGate>{child}</HostedAuthGate>);
    unmount();
    expect((fetcher.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    await act(async () => request.resolve(Response.json({ clientPrincipal: principal })));
    expect(child).not.toHaveBeenCalled();
  });

  it("does not restore a previous account after a fresh gate is mounted for another session", async () => {
    const stale = pending();
    fetcher.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(Response.json({
      clientPrincipal: { ...principal, userId: "user-b", userDetails: "회사원 B" },
    }));
    const view = render(<HostedAuthGate key="session-a">{(account) => <p>Game {account.homeAccountId}</p>}</HostedAuthGate>);
    view.rerender(<HostedAuthGate key="session-b">{(account) => <p>Game {account.homeAccountId}</p>}</HostedAuthGate>);
    expect(await screen.findByText("Game user-b")).toBeVisible();
    await act(async () => stale.resolve(Response.json({ clientPrincipal: principal })));
    await waitFor(() => expect(screen.queryByText("Game user-a")).not.toBeInTheDocument());
  });
});
