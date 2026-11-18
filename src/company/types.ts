import type { InfiniteScoreInput, PointEffectId, PointWallet, ResultInput, SharedBest, SharedInfiniteBest, SharedProfile } from "../../shared/companyRecords";
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

export interface PointWalletSnapshot {
  wallet: PointWallet;
  status: "idle" | "saving" | "error" | "auth-required";
  errorMessage: string | null;
  coinGainRevision: number;
  lastCoinGainAt: number | null;
}

export interface PointWalletBinding extends PointWalletSnapshot {
  collectCoin(): void;
  purchaseEffect(effectId: PointEffectId): Promise<void>;
  equipEffect(effectId: PointEffectId | null): Promise<void>;
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
  pointWallet: PointWalletBinding;
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

export interface PendingPointCoinClaim { claimId: string; createdAt: string }

export type PendingResult = PendingStageResult | PendingInfiniteResult;

export type CompanyStoreSnapshot = { status: "loading" }
  | { status: "error"; message: string; authRequired: boolean }
  | { status: "ready"; binding: CompanyRecordBinding };
