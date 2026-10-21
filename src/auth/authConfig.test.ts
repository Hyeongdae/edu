import { describe, expect, it } from "vitest";
import { getAuthConfigurationError } from "./authConfig";

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
