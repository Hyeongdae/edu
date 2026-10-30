import type { ResultInput, SharedBest, SharedProfile } from "../../shared/companyRecords";
import type { StageResult } from "../game/types";

export type SyncStatus = "idle" | "saving" | "error" | "auth-required";

export interface CompanyRecordBinding {
  profile: SharedProfile;
  entries: SharedBest[];
  syncStatus: SyncStatus;
  pendingCount: number;
  errorMessage: string | null;
  submitResult(result: StageResult): void;
  retry(): void;
  refresh(): void;
}

export interface PendingResult {
  submissionId: string;
  createdAt: string;
  result: ResultInput;
}

export type CompanyStoreSnapshot = { status: "loading" }
  | { status: "error"; message: string; authRequired: boolean }
  | { status: "ready"; binding: CompanyRecordBinding };
