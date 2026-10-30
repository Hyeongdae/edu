import type { Configuration, RedirectRequest } from "@azure/msal-browser";

export interface AuthEnvironment {
  VITE_AUTH_MODE?: string;
  VITE_ENTRA_CLIENT_ID?: string;
  VITE_ENTRA_TENANT_ID?: string;
  VITE_ENTRA_REDIRECT_URI?: string;
}

export type AuthMode = "entra-spa" | "azure-static-web-apps";

const invalidModeMessage = "로그인 방식 설정이 올바르지 않습니다. VITE_AUTH_MODE를 확인해 주세요.";

export function getAuthMode(environment: { VITE_AUTH_MODE?: string }): AuthMode {
  const mode = environment.VITE_AUTH_MODE?.trim() || "entra-spa";
  if (mode !== "entra-spa" && mode !== "azure-static-web-apps") throw new Error(invalidModeMessage);
  return mode;
}

const requiredEnvironmentNames = [
  "VITE_ENTRA_CLIENT_ID",
  "VITE_ENTRA_TENANT_ID",
  "VITE_ENTRA_REDIRECT_URI",
] as const;

export function getAuthConfigurationError(
  environment: AuthEnvironment,
): string | null {
  try {
    if (getAuthMode(environment) === "azure-static-web-apps") return null;
  } catch {
    return invalidModeMessage;
  }
  const missing = requiredEnvironmentNames.filter((name) => !environment[name]?.trim());

  if (missing.length === 0) {
    return null;
  }

  return `Entra ID 설정이 필요합니다. .env.local에 다음 값을 설정하세요: ${missing.join(", ")}`;
}

const environment = import.meta.env;
const tenantId = environment.VITE_ENTRA_TENANT_ID?.trim() ?? "";

function configuredMode(): AuthMode | null {
  try {
    return getAuthMode(environment);
  } catch {
    return null;
  }
}

export const authMode = configuredMode();

export const isLocalDemoMode =
  environment.DEV && authMode === "entra-spa" && environment.VITE_LOCAL_DEMO_MODE?.trim() === "true";

export const authConfigurationError = getAuthConfigurationError(environment);

export const msalConfig: Configuration = {
  auth: {
    clientId: environment.VITE_ENTRA_CLIENT_ID?.trim() ?? "",
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: environment.VITE_ENTRA_REDIRECT_URI?.trim() ?? "",
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest: RedirectRequest = {
  scopes: ["openid", "profile"],
};
