import type { Configuration, RedirectRequest } from "@azure/msal-browser";

export interface AuthEnvironment {
  VITE_ENTRA_CLIENT_ID?: string;
  VITE_ENTRA_TENANT_ID?: string;
  VITE_ENTRA_REDIRECT_URI?: string;
}

const requiredEnvironmentNames = [
  "VITE_ENTRA_CLIENT_ID",
  "VITE_ENTRA_TENANT_ID",
  "VITE_ENTRA_REDIRECT_URI",
] as const;

export function getAuthConfigurationError(
  environment: AuthEnvironment,
): string | null {
  const missing = requiredEnvironmentNames.filter((name) => !environment[name]?.trim());

  if (missing.length === 0) {
    return null;
  }

  return `Entra ID 설정이 필요합니다. .env.local에 다음 값을 설정하세요: ${missing.join(", ")}`;
}

const environment = import.meta.env;
const tenantId = environment.VITE_ENTRA_TENANT_ID?.trim() ?? "";

export const isLocalDemoMode =
  environment.DEV && environment.VITE_LOCAL_DEMO_MODE?.trim() === "true";

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
