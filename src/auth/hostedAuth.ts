import type { GameAccount } from "./gameAccount";

export interface HostedPrincipal {
  identityProvider: "aad";
  userId: string;
  userDetails: string;
  userRoles: string[];
}

export type HostedIdentity = { status: "authenticated"; account: GameAccount } | { status: "signed-out" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHostedPrincipal(value: unknown): value is HostedPrincipal {
  return isRecord(value) && value.identityProvider === "aad" &&
    typeof value.userId === "string" && !!value.userId.trim() && value.userId.length <= 1024 &&
    typeof value.userDetails === "string" && !!value.userDetails.trim() &&
    Array.isArray(value.userRoles) && value.userRoles.every((role) => typeof role === "string") &&
    value.userRoles.includes("authenticated");
}

export function parseHostedIdentity(value: unknown): HostedIdentity {
  if (!isRecord(value) || !Object.hasOwn(value, "clientPrincipal")) throw new Error("Invalid hosted identity.");
  const principal = value.clientPrincipal;
  if (principal === null) return { status: "signed-out" };
  if (!isHostedPrincipal(principal)) throw new Error("Invalid hosted identity.");
  return {
    status: "authenticated",
    account: {
      homeAccountId: principal.userId,
      username: principal.userDetails.trim(),
      name: principal.userDetails.trim().slice(0, 200),
    },
  };
}

export async function fetchHostedAccount(signal: AbortSignal): Promise<HostedIdentity> {
  const response = await fetch("/.auth/me", {
    method: "GET", credentials: "include", cache: "no-store", mode: "same-origin", redirect: "error",
    headers: { Accept: "application/json" }, signal,
  });
  if (!response.ok || response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new Error("Unable to read hosted identity.");
  }
  return parseHostedIdentity(await response.json());
}

function isSafeReturnPath(path: string): boolean {
  // Validate decoded layers as well: the provider must never interpret an encoded external URL.
  for (let layer = 0; layer < 5; layer++) {
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") ||
      [...path].some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return false;
    try {
      const decoded = decodeURIComponent(path);
      if (decoded === path) return true;
      path = decoded;
    } catch {
      return false;
    }
  }
  return false;
}

export function getHostedLoginUrl(returnPath = "/"): string {
  const safePath = isSafeReturnPath(returnPath) ? returnPath : "/";
  return "/.auth/login/aad?" + new URLSearchParams({ post_login_redirect_uri: safePath }).toString();
}
