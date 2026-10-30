import { describe, expect, it } from "vitest";
import { getAuthConfigurationError, getAuthMode } from "./authConfig";

describe("getAuthConfigurationError", () => {
  it("lists missing Entra environment variables without exposing values", () => {
    expect(getAuthConfigurationError({ VITE_ENTRA_CLIENT_ID: "client-id" })).toContain(
      "VITE_ENTRA_TENANT_ID, VITE_ENTRA_REDIRECT_URI",
    );
  });

  it("returns no error when all required values are present", () => {
    expect(
      getAuthConfigurationError({
        VITE_ENTRA_CLIENT_ID: "client-id",
        VITE_ENTRA_TENANT_ID: "tenant-id",
        VITE_ENTRA_REDIRECT_URI: "http://localhost:5173",
      }),
    ).toBeNull();
  });

  it("treats whitespace-only values as missing", () => {
    expect(getAuthConfigurationError({ VITE_ENTRA_CLIENT_ID: "  " })).toContain(
      "VITE_ENTRA_CLIENT_ID",
    );
  });
});

describe("hosted auth mode", () => {
  it.each([undefined, "", "  ", "entra-spa"])("preserves local SPA mode for %s", (VITE_AUTH_MODE) => {
    expect(getAuthMode({ VITE_AUTH_MODE })).toBe("entra-spa");
  });

  it("recognizes hosted mode without requiring local SPA registration values", () => {
    expect(getAuthMode({ VITE_AUTH_MODE: " azure-static-web-apps " })).toBe("azure-static-web-apps");
    expect(getAuthConfigurationError({ VITE_AUTH_MODE: "azure-static-web-apps" })).toBeNull();
  });

  it.each(["invalid", "Azure-Static-Web-Apps", "demo"])("fails closed for unsupported mode %s", (VITE_AUTH_MODE) => {
    expect(() => getAuthMode({ VITE_AUTH_MODE })).toThrow("VITE_AUTH_MODE");
    expect(getAuthConfigurationError({ VITE_AUTH_MODE })).toContain("VITE_AUTH_MODE");
  });
});
