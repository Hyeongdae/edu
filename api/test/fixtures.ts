import type { AuthenticatedActor, ResultInput, SubmitResultRequest } from "../../shared/companyRecords";

export const NOW = "2026-10-30T03:00:00.000Z";
export const ACTOR: AuthenticatedActor = { accountId: "employee-a", displayName: "회사원 A" };

export function principal(overrides: Record<string, unknown> = {}): string {
  return Buffer.from(JSON.stringify({
    identityProvider: "aad", userId: ACTOR.accountId, userDetails: ACTOR.displayName,
    userRoles: ["anonymous", "authenticated"], ...overrides,
  })).toString("base64");
}

export function submission(overrides: Partial<ResultInput> = {}): SubmitResultRequest {
  return {
    submissionId: "c0acac70-767e-41c9-a4b0-f0168962c733",
    result: { stage: 1, score: 100, remainingTimeCs: 6000, outcome: "caught", ...overrides },
  };
}
