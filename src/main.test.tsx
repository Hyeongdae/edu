import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const entry = vi.hoisted(() => ({ createRoot: vi.fn(), render: vi.fn(), constructMsal: vi.fn() }));

vi.mock("react-dom/client", () => ({ createRoot: entry.createRoot }));
vi.mock("@azure/msal-react", () => ({ MsalProvider: "mock-msal-provider" }));
vi.mock("@azure/msal-browser", () => ({
  PublicClientApplication: class {
    constructor(config: unknown) { entry.constructMsal(config); }
  },
}));
vi.mock("./App", () => ({ default: "mock-app" }));

beforeEach(() => {
  vi.resetModules();
  entry.createRoot.mockReturnValue({ render: entry.render });
  document.body.innerHTML = '<div id="root"></div>';
  vi.stubEnv("DEV", true);
  for (const name of ["VITE_AUTH_MODE", "VITE_LOCAL_DEMO_MODE", "VITE_ENTRA_CLIENT_ID", "VITE_ENTRA_TENANT_ID", "VITE_ENTRA_REDIRECT_URI"]) {
    vi.stubEnv(name, "");
  }
});
afterEach(() => { vi.unstubAllEnvs(); document.body.innerHTML = ""; });

function renderedChild(): ReactElement<Record<string, unknown>> {
  const strict = entry.render.mock.calls[0][0] as ReactElement<{ children: ReactElement<Record<string, unknown>> }>;
  return strict.props.children;
}

describe("application authentication entry", () => {
  it.each([true, false])("creates no MSAL provider or client for hosted mode, DEV=%s", async (dev) => {
    vi.stubEnv("DEV", dev);
    vi.stubEnv("VITE_AUTH_MODE", "azure-static-web-apps");
    vi.stubEnv("VITE_LOCAL_DEMO_MODE", "true");
    await import("./main");
    expect(entry.constructMsal).not.toHaveBeenCalled();
    expect(renderedChild()).toMatchObject({ type: "mock-app", props: { configurationError: null, authMode: "azure-static-web-apps" } });
    expect(renderedChild().props.localDemoMode).not.toBe(true);
  });

  it("preserves the DEV-only local demo without requiring local registration IDs", async () => {
    vi.stubEnv("VITE_LOCAL_DEMO_MODE", "true");
    await import("./main");
    expect(entry.constructMsal).not.toHaveBeenCalled();
    expect(renderedChild().props).toMatchObject({ configurationError: null, localDemoMode: true });
  });

  it("does not enable a production demo from its environment flag", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_LOCAL_DEMO_MODE", "true");
    await import("./main");
    expect(entry.constructMsal).not.toHaveBeenCalled();
    expect(renderedChild().props.configurationError).toContain("VITE_ENTRA_CLIENT_ID");
    expect(renderedChild().props.localDemoMode).not.toBe(true);
  });

  it("constructs the existing local MSAL client/provider only when SPA settings are present", async () => {
    vi.stubEnv("VITE_ENTRA_CLIENT_ID", "fixture-client");
    vi.stubEnv("VITE_ENTRA_TENANT_ID", "fixture-tenant");
    vi.stubEnv("VITE_ENTRA_REDIRECT_URI", "http://localhost:5173");
    await import("./main");
    expect(entry.constructMsal).toHaveBeenCalledTimes(1);
    expect(renderedChild().type).toBe("mock-msal-provider");
  });

  it("fails closed for an unknown mode even when the DEV demo flag is enabled", async () => {
    vi.stubEnv("VITE_AUTH_MODE", "unknown-mode");
    vi.stubEnv("VITE_LOCAL_DEMO_MODE", "true");
    await import("./main");
    expect(entry.constructMsal).not.toHaveBeenCalled();
    expect(renderedChild().props.configurationError).toContain("VITE_AUTH_MODE");
    expect(renderedChild().props.localDemoMode).not.toBe(true);
  });
});
