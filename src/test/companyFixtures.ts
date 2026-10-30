import type { SharedProfile, SubmitResultRequest, SubmitResultResponse } from "../../shared/companyRecords";
import type { StageResult } from "../game/types";

export function companyProfile(overrides: Partial<SharedProfile> = {}): SharedProfile {
  return { accountId: "employee-a", displayName: "회사원 A", highestClearedStage: 0, best: null, ...overrides };
}

export function companyResult(overrides: Partial<StageResult> = {}): StageResult {
  return Object.freeze({ stage: 1, score: 100, remainingTimeCs: 6000, outcome: "caught", endedAtMs: 100, ...overrides });
}

export function companySubmission(): SubmitResultRequest {
  const { stage, score, remainingTimeCs, outcome } = companyResult();
  return { submissionId: "0b220b82-bccc-4b85-b763-d824001bc73b", result: { stage, score, remainingTimeCs, outcome } };
}

export function companyAck(input: SubmitResultRequest, profile = companyProfile()): SubmitResultResponse {
  return { submissionId: input.submissionId, profile, entries: profile.best ? [profile.best] : [] };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}
