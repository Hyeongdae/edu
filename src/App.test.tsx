import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { loginRequest } from "./auth/authConfig";

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  inProgress: "none",
  accounts: [] as Array<{ name?: string }>,
  activeAccount: null as { name?: string } | null,
  loginRedirect: vi.fn<() => Promise<void>>(),
  setActiveAccount: vi.fn(),
}));

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => authState.isAuthenticated,
  useMsal: () => ({
    accounts: authState.accounts,
    inProgress: authState.inProgress,
    instance: {
      getActiveAccount: () => authState.activeAccount,
      setActiveAccount: authState.setActiveAccount,
      loginRedirect: authState.loginRedirect,
    },
  }),
}));

describe("App authentication gate", () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.inProgress = "none";
    authState.accounts = [];
    authState.activeAccount = null;
    authState.loginRedirect.mockResolvedValue(undefined);
    authState.setActiveAccount.mockClear();
  });

  afterEach(() => cleanup());

  it("shows configuration guidance instead of bypassing sign-in", () => {
    render(<App configurationError="VITE_ENTRA_CLIENT_ID를 설정하세요." />);

    expect(screen.getByRole("heading", { name: "Entra ID를 연결해 주세요" })).toBeVisible();
    expect(screen.getByText(/\.env\.local/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "회사 계정으로 로그인" })).not.toBeInTheDocument();
  });

  it("offers company sign-in and starts a redirect with the minimal scopes", () => {
    render(<App configurationError={null} />);

    fireEvent.click(screen.getByRole("button", { name: "회사 계정으로 로그인" }));

    expect(authState.loginRedirect).toHaveBeenCalledWith(loginRequest);
  });

  it("shows an in-progress message while MSAL is handling authentication", () => {
    authState.inProgress = "login";
    render(<App configurationError={null} />);

    expect(screen.getByRole("heading", { name: "로그인 중입니다" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "회사 계정으로 로그인" })).not.toBeInTheDocument();
  });

  it("renders the protected game for a signed-in account", () => {
    authState.isAuthenticated = true;
    authState.accounts = [{ name: "홍길동" }];
    render(<App configurationError={null} />);

    expect(screen.getByText("홍길동")).toBeVisible();
    expect(screen.getByRole("button", { name: /시작하기/ })).toBeVisible();
    expect(authState.setActiveAccount).toHaveBeenCalledWith(authState.accounts[0]);
  });

  it("shows a recoverable message when redirect cannot start", async () => {
    authState.loginRedirect.mockRejectedValueOnce(new Error("MSAL unavailable"));
    render(<App configurationError={null} />);

    fireEvent.click(screen.getByRole("button", { name: "회사 계정으로 로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("로그인을 시작하지 못했습니다");
  });
});
