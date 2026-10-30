import type { AuthenticatedActor } from "../../shared/companyRecords";

/** The hosted SWA boundary must inject this header; the API must not be exposed directly. */
export function readAuthenticatedActor(header: string | null): AuthenticatedActor | null {
  if (!header || header.length > 16 * 1024 || header.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(header)) return null;
  try {
    const bytes = Buffer.from(header, "base64");
    if (bytes.toString("base64") !== header) return null;
    const principal: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (typeof principal !== "object" || principal === null || Array.isArray(principal)) return null;
    const value = principal as Record<string, unknown>;
    if (value.identityProvider !== "aad" || typeof value.userId !== "string" ||
      !value.userId.trim() || value.userId.length > 1024 ||
      typeof value.userDetails !== "string" || !value.userDetails.trim() ||
      !Array.isArray(value.userRoles) || !value.userRoles.every((role) => typeof role === "string") ||
      !value.userRoles.includes("authenticated")) return null;
    return { accountId: value.userId, displayName: value.userDetails.trim().slice(0, 200) };
  } catch {
    return null;
  }
}
