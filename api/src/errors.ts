import type { ApiErrorCode } from "../../shared/companyRecords";

const STATUS: Record<ApiErrorCode, number> = {
  "unauthenticated": 401,
  "invalid-request": 400,
  "stage-locked": 409,
  "conflict": 409,
  "storage-unavailable": 503,
};

const MESSAGES: Record<ApiErrorCode, string> = {
  "unauthenticated": "Company sign-in is required.",
  "invalid-request": "The submitted result is invalid.",
  "stage-locked": "Clear the preceding stage first.",
  "conflict": "The record changed during saving. Please retry.",
  "storage-unavailable": "Company records are temporarily unavailable. Please retry.",
};

/** Only public, fixed messages cross the API boundary; SDK failures never reach response bodies. */
export class RecordServiceError extends Error {
  readonly status: number;

  constructor(readonly code: ApiErrorCode, status = STATUS[code]) {
    super(MESSAGES[code]);
    this.name = "RecordServiceError";
    this.status = status;
  }
}
