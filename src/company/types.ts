import type { InfiniteScoreInput, ResultInput, SharedBest, SharedInfiniteBest, SharedProfile } from "../../shared/companyRecords";
import type { StageResult } from "../game/types";
import type { CharacterAppearance } from "../../shared/characterAppearance";

export type SyncStatus = "idle" | "saving" | "error" | "auth-required";

export type AppearanceSyncStatus = "idle" | "pending" | "saving" | "saved" | "error" | "auth-required";

export interface AppearanceBinding {
  value: CharacterAppearance;
  status: AppearanceSyncStatus;
  errorMessage: string | null;
  update(next: CharacterAppearance): void;
  retry(): void;
}

export interface CompanyRecordBinding {
  profile: SharedProfile;
  entries: SharedBest[];
  infiniteEntries: SharedInfiniteBest[];
  infiniteV2Entries: SharedInfiniteBest[];
  syncStatus: SyncStatus;
  pendingCount: number;
  errorMessage: string | null;
  appearance?: AppearanceBinding;
  submitResult(result: StageResult): void;
  submitInfiniteV2Score(result: InfiniteScoreInput): void;
  retry(): void;
  refresh(): void;
}

export interface PendingStageResult {
  mode: "stage";
  submissionId: string;
  createdAt: string;
  result: ResultInput;
}

export interface PendingInfiniteResult {
  mode: "infinite-v1" | "infinite-v2";
  submissionId: string;
  createdAt: string;
  result: InfiniteScoreInput;
}

export type PendingResult = PendingStageResult | PendingInfiniteResult;

export type CompanyStoreSnapshot = { status: "loading" }
  | { status: "error"; message: string; authRequired: boolean }
  | { status: "ready"; binding: CompanyRecordBinding };
