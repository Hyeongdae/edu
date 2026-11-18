import { compareSharedInfiniteScore, compareSharedPerformance, getSharedTopInfiniteScores, getSharedTopScores, isSubmitInfiniteScoreRequest, isSubmitResultRequest, validateResultForProfile } from "../../shared/companyRecords";
import type { InfiniteScoreInput, PointEffectId, SharedBest, SharedInfiniteBest, SharedProfile } from "../../shared/companyRecords";
import type { PointWalletSnapshot, PendingPointCoinClaim } from "./types";
import { areCharacterAppearancesEqual, cloneCharacterAppearance, isCharacterAppearance, resolveCharacterAppearance } from "../../shared/characterAppearance";
import type { CharacterAppearance } from "../../shared/characterAppearance";
import type { StageResult } from "../game/types";
import { companyRecordApi, isSharedProfile, RecordApiError, type CompanyRecordApi } from "./recordApi";
import type { AppearanceSyncStatus, CompanyStoreSnapshot, PendingResult, SyncStatus } from "./types";

const APPEARANCE_DEBOUNCE_MS = 400;
const APPEARANCE_SAVE_ERROR = "외형을 저장하지 못했어요. 선택한 모습은 유지돼요. 다시 시도해 주세요.";
const APPEARANCE_AUTH_ERROR = "외형을 저장하려면 회사 계정으로 다시 로그인해 주세요.";

export function companyPendingKey(accountId: string): string {
  return "stair-descent:company:production:pending:v1:" + encodeURIComponent(accountId);
}

export function companyPointClaimsKey(accountId: string): string {
  return "stair-descent:company:production:coin-claims:v1:" + encodeURIComponent(accountId);
}

const POINT_SAVE_ERROR = "포인트를 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.";
const POINT_AUTH_ERROR = "회사 계정 인증이 필요합니다. 다시 로그인한 뒤 다시 시도해 주세요.";

interface StoreOptions {
  api?: CompanyRecordApi;
  storage?: () => Pick<Storage, "getItem" | "setItem">;
  now?: () => Date;
  uuid?: () => string;
}

/** Construction is pure. Network, storage and listeners belong only to start()/stop(). */
export class CompanyRecordStore {
  private snapshot: CompanyStoreSnapshot = { status: "loading" };
  private readonly listeners = new Set<() => void>();
  private readonly submitted = new WeakMap<StageResult, string>();
  private readonly submittedInfinite = new WeakMap<InfiniteScoreInput, string>();
  private readonly api: CompanyRecordApi;
  private profile: SharedProfile | null = null;
  private entries: SharedBest[] = [];
  private infiniteEntries: SharedInfiniteBest[] = [];
  private infiniteV2Entries: SharedInfiniteBest[] = [];
  private pending: PendingResult[] = [];
  private loadedQueue = false;
  private active = false;
  private epoch = 0;
  private running = false;
  private paused = false;
  private permanent = false;
  private needsRefresh = true;
  private backoff = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller: AbortController | null = null;
  private syncStatus: SyncStatus = "idle";
  private errorMessage: string | null = null;
  private persistenceWarning: string | null = null;
  private appearanceDraft: CharacterAppearance | null = null;
  private appearanceRevision = 0;
  private appearanceDueAt: number | null = null;
  private appearanceStatus: AppearanceSyncStatus = "idle";
  private appearanceErrorMessage: string | null = null;
  private appearanceTimer: ReturnType<typeof setTimeout> | undefined;
  private pointClaims: PendingPointCoinClaim[] = [];
  private loadedPointClaims = false;
  private pointStatus: PointWalletSnapshot["status"] = "idle";
  private pointError: string | null = null;
  private coinGainRevision = 0;
  private lastCoinGainAt: number | null = null;
  private pointRunning = false;
  private pointBackoff = 0;
  private pointTimer: ReturnType<typeof setTimeout> | undefined;
  private pointWriteTail: Promise<void> = Promise.resolve();
  private pointController: AbortController | null = null;

  constructor(private readonly accountId: string, private readonly options: StoreOptions = {}) {
    if (!accountId.trim()) throw new Error("A hosted account is required.");
    this.api = options.api ?? companyRecordApi;
  }

  getSnapshot = (): CompanyStoreSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  start = (): void => {
    if (this.active) return;
    this.active = true;
    this.epoch++;
    this.paused = false;
    this.permanent = false;
    this.errorMessage = null;
    this.needsRefresh = true;
    if (!this.loadedQueue) { this.loadedQueue = true; this.loadQueue(); }
    if (!this.loadedPointClaims) { this.loadedPointClaims = true; this.loadPointClaims(); }
    if (this.pointStatus === "auth-required") this.pointStatus = this.pointClaims.length ? "saving" : "idle";
    window.addEventListener("online", this.onOnline);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.publish();
    this.kick();
  };

  stop = (): void => {
    this.active = false;
    this.epoch++;
    this.running = false;
    clearTimeout(this.timer);
    this.timer = undefined;
    clearTimeout(this.appearanceTimer);
    this.appearanceTimer = undefined;
    if (this.appearanceDraft && this.appearanceStatus === "saving") {
      this.appearanceStatus = "pending";
      this.appearanceDueAt = Date.now();
    }
    this.controller?.abort();
    this.controller = null;
    clearTimeout(this.pointTimer);
    this.pointTimer = undefined;
    this.pointController?.abort();
    this.pointController = null;
    window.removeEventListener("online", this.onOnline);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  };

  submitResult = (result: StageResult): void => {
    if (!this.active || !this.profile || this.submitted.has(result)) return;
    const input = Object.freeze({ stage: result.stage, score: result.score,
      remainingTimeCs: result.remainingTimeCs, outcome: result.outcome });
    if (!validateResultForProfile(input, 5).ok) {
      this.syncStatus = "error";
      this.errorMessage = "저장할 게임 결과를 확인하지 못했습니다.";
      this.publish();
      return;
    }
    const submissionId = (this.options.uuid ?? (() => crypto.randomUUID()))();
    this.submitted.set(result, submissionId);
    this.pending.push(Object.freeze({ mode: "stage", submissionId, createdAt: (this.options.now?.() ?? new Date()).toISOString(), result: input }));
    this.persist(); // A navigation or lost response must not erase an unacknowledged result.
    this.publish();
    this.kick();
  };

  submitInfiniteV2Score = (result: InfiniteScoreInput): void => {
    if (!this.active || !this.profile || this.submittedInfinite.has(result)) return;
    const input = Object.freeze({ score: result.score });
    const submissionId = (this.options.uuid ?? (() => crypto.randomUUID()))();
    const request = { submissionId, result: input };
    if (!isSubmitInfiniteScoreRequest(request)) {
      this.syncStatus = "error";
      this.errorMessage = "무한 모드 점수를 확인하지 못했습니다.";
      this.publish();
      return;
    }
    this.submittedInfinite.set(result, submissionId);
    this.pending.push(Object.freeze({ mode: "infinite-v2", submissionId,
      createdAt: (this.options.now?.() ?? new Date()).toISOString(), result: input }));
    this.persist();
    this.publish();
    this.kick();
  };

  updateAppearance = (next: CharacterAppearance): void => {
    if (!this.active || !this.profile || !isCharacterAppearance(next)) return;
    const displayed = this.appearanceDraft ?? resolveCharacterAppearance(this.profile.appearance);
    if (areCharacterAppearancesEqual(displayed, next)) return;
    this.appearanceDraft = cloneCharacterAppearance(next);
    this.appearanceRevision++;
    const requiresAuth = this.appearanceStatus === "auth-required" || this.syncStatus === "auth-required";
    this.appearanceStatus = requiresAuth ? "auth-required" : "pending";
    this.appearanceErrorMessage = requiresAuth ? APPEARANCE_AUTH_ERROR : null;
    this.appearanceDueAt = requiresAuth ? null : Date.now() + APPEARANCE_DEBOUNCE_MS;
    this.publish();
    this.scheduleAppearance();
  };

  retryAppearance = (): void => {
    if (!this.active || !this.profile || !this.appearanceDraft) return;
    if (this.appearanceStatus === "auth-required" || this.syncStatus === "auth-required") {
      this.retry(); // Verify the account again before sending the retained appearance.
      return;
    }
    this.appearanceStatus = "pending";
    this.appearanceErrorMessage = null;
    this.appearanceDueAt = Date.now();
    this.publish();
    this.scheduleAppearance();
  };

  retry = (): void => {
    if (!this.active) return;
    const pointNeedsAuthentication = this.pointStatus === "auth-required";
    clearTimeout(this.timer);
    this.timer = undefined;
    this.backoff = 0;
    this.paused = false;
    this.permanent = false;
    this.errorMessage = null;
    this.needsRefresh = true;
    if (!pointNeedsAuthentication) {
      this.pointStatus = this.pointClaims.length ? "saving" : this.pointStatus;
      this.pointError = null;
    }
    this.publish();
    this.kick();
    if (!pointNeedsAuthentication) this.kickPointQueue();
  };

  refresh = (): void => {
    if (!this.active) return;
    this.needsRefresh = true;
    this.kick();
  };

  private onOnline = (): void => {
    if (!this.permanent && this.syncStatus !== "auth-required") {
      this.retry();
      if (this.appearanceStatus === "error") this.retryAppearance();
    }
  };

  private onVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      if (this.pointStatus === "auth-required") this.retry();
      else this.kickPointQueue();
    }
  };

  collectCoin = (): void => {
    if (!this.active || !this.profile || !this.api.postPointCoin) return;
    const claimId = (this.options.uuid ?? (() => crypto.randomUUID()))();
    if (this.pointClaims.some((claim) => claim.claimId === claimId)) return;
    const claim = { claimId, createdAt: (this.options.now?.() ?? new Date()).toISOString() };
    this.pointClaims = [...this.pointClaims, claim];
    if (!this.persistPointClaims()) {
      this.pointStatus = "error";
      this.pointError = "포인트 획득을 브라우저에 안전하게 보관하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.";
      this.publish();
      return;
    }
    this.pointStatus = "saving";
    this.pointError = null;
    this.publish();
    this.kickPointQueue();
  };

  purchaseEffect = (effectId: PointEffectId): Promise<void> => this.serializePointWrite(async () => {
    await this.drainPointClaims();
    if (!this.active || !this.profile) throw new Error(POINT_AUTH_ERROR);
    this.pointStatus = "saving"; this.pointError = null; this.publish();
    try {
      const response = await this.api.postPointPurchase(this.accountId, { effectId }, this.newPointSignal());
      this.acceptProfile(response.profile); this.pointStatus = "idle"; this.pointError = null; this.publish();
    } catch (failure) { this.handlePointError(failure); throw failure; }
  });

  equipEffect = (effectId: PointEffectId | null): Promise<void> => this.serializePointWrite(async () => {
    if (!this.active || !this.profile) throw new Error(POINT_AUTH_ERROR);
    this.pointStatus = "saving"; this.pointError = null; this.publish();
    try {
      const response = await this.api.postPointEquip(this.accountId, { effectId }, this.newPointSignal());
      this.acceptProfile(response.profile); this.pointStatus = "idle"; this.pointError = null; this.publish();
    } catch (failure) { this.handlePointError(failure); throw failure; }
  });

  private serializePointWrite(action: () => Promise<void>): Promise<void> {
    const result = this.pointWriteTail.then(action, action);
    this.pointWriteTail = result.catch(() => {});
    return result;
  }

  private newPointSignal(): AbortSignal {
    this.pointController?.abort();
    this.pointController = new AbortController();
    return this.pointController.signal;
  }

  private loadPointClaims(): void {
    try {
      const raw = this.storage().getItem(companyPointClaimsKey(this.accountId));
      if (raw === null) return;
      const value = JSON.parse(raw) as { version?: unknown; accountId?: unknown; pending?: unknown };
      if (!value || value.version !== 1 || value.accountId !== this.accountId || !Array.isArray(value.pending)) throw new Error();
      const ids = new Set<string>();
      const claims: PendingPointCoinClaim[] = [];
      for (const item of value.pending) {
        if (!item || typeof item !== "object" || typeof item.claimId !== "string" || !item.claimId.trim() ||
          new TextEncoder().encode(item.claimId).length > 128 || typeof item.createdAt !== "string" ||
          !Number.isFinite(Date.parse(item.createdAt)) || new Date(item.createdAt).toISOString() !== item.createdAt || ids.has(item.claimId)) throw new Error();
        ids.add(item.claimId); claims.push({ claimId: item.claimId, createdAt: item.createdAt });
      }
      this.pointClaims = claims;
    } catch {
      this.pointError = "저장된 코인 요청을 읽지 못했습니다. 브라우저 저장 공간을 확인해 주세요.";
      this.pointStatus = "error";
    }
  }

  private persistPointClaims(): boolean {
    try {
      this.storage().setItem(companyPointClaimsKey(this.accountId), JSON.stringify({ version: 1, accountId: this.accountId, pending: this.pointClaims }));
      return true;
    } catch { return false; }
  }

  private kickPointQueue(): void {
    if (!this.active || !this.profile || !this.pointClaims.length || this.pointRunning || this.pointStatus === "auth-required") return;
    clearTimeout(this.pointTimer); this.pointTimer = undefined;
    void this.serializePointWrite(() => this.drainPointClaims()).catch(() => {});
  }

  private retryPointWrites = (): void => {
    if (!this.active) return;
    this.pointBackoff = 0; this.pointError = null;
    if (this.pointStatus === "auth-required") this.retry();
    else { this.pointStatus = this.pointClaims.length ? "saving" : "idle"; this.publish(); this.kickPointQueue(); }
  };

  private async drainPointClaims(): Promise<void> {
    if (this.pointRunning || !this.active || !this.profile || !this.api.postPointCoin) return;
    this.pointRunning = true;
    try {
      while (this.active && this.profile && this.pointClaims.length) {
        const claim = this.pointClaims[0];
        if (!this.persistPointClaims()) throw new RecordApiError("storage-unavailable");
        this.pointStatus = "saving"; this.pointError = null; this.publish();
        const response = await this.api.postPointCoin(this.accountId, { claimId: claim.claimId }, this.newPointSignal());
        if (!this.active) return;
        this.acceptProfile(response.profile);
        const previousClaims = this.pointClaims;
        this.pointClaims = this.pointClaims.filter((item) => item.claimId !== claim.claimId);
        if (!this.persistPointClaims()) {
          this.pointClaims = previousClaims;
          throw new RecordApiError("storage-unavailable");
        }
        this.coinGainRevision += 1; this.lastCoinGainAt = (this.options.now?.() ?? new Date()).getTime();
        this.pointBackoff = 0; this.pointStatus = "idle"; this.pointError = null; this.publish();
      }
    } catch (failure) {
      if (!this.active) return;
      const error = failure instanceof RecordApiError ? failure : new RecordApiError("network");
      this.handlePointError(error);
      if (!["unauthenticated", "invalid-request", "invalid-response"].includes(error.code)) {
        const delays = [1000, 2000, 5000, 10000, 30000];
        this.pointTimer = setTimeout(() => { this.pointTimer = undefined; this.kickPointQueue(); }, delays[Math.min(this.pointBackoff++, delays.length - 1)]);
      }
      throw error;
    } finally { this.pointRunning = false; }
  }

  private handlePointError(failure: unknown): void {
    const error = failure instanceof RecordApiError ? failure : new RecordApiError("network");
    this.pointStatus = error.code === "unauthenticated" ? "auth-required" : "error";
    this.pointError = error.code === "unauthenticated" ? POINT_AUTH_ERROR : POINT_SAVE_ERROR;
    this.publish();
  }

  private appearanceIsDue(): boolean {
    return this.appearanceDraft !== null && this.appearanceStatus === "pending" &&
      this.appearanceDueAt !== null && this.appearanceDueAt <= Date.now();
  }

  private scheduleAppearance(): void {
    clearTimeout(this.appearanceTimer);
    this.appearanceTimer = undefined;
    if (!this.active || this.paused || !this.appearanceDraft || this.appearanceStatus !== "pending" || this.appearanceDueAt === null) return;
    if (this.appearanceIsDue()) {
      this.kick();
      return;
    }
    const epoch = this.epoch;
    this.appearanceTimer = setTimeout(() => {
      this.appearanceTimer = undefined;
      if (this.active && epoch === this.epoch) this.kick();
    }, this.appearanceDueAt - Date.now());
  }

  private storage(): Pick<Storage, "getItem" | "setItem"> {
    return this.options.storage?.() ?? window.localStorage;
  }

  private loadQueue(): void {
    try {
      const raw = this.storage().getItem(companyPendingKey(this.accountId));
      if (raw === null) return;
      const value = JSON.parse(raw) as { version?: unknown; accountId?: unknown; pending?: unknown };
      if (!value || (value.version !== 1 && value.version !== 2) || value.accountId !== this.accountId || !Array.isArray(value.pending)) throw new Error();
      const ids = new Set<string>();
      const pending: PendingResult[] = [];
      for (const item of value.pending) {
        if (typeof item !== "object" || item === null || typeof item.submissionId !== "string" ||
          typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) ||
          new Date(item.createdAt).toISOString() !== item.createdAt || ids.has(item.submissionId)) throw new Error();
        const mode = value.version === 1 && item.mode === undefined ? "stage" : item.mode;
        if (mode === "stage") {
          if (!isSubmitResultRequest({ submissionId: item.submissionId, result: item.result }) || !validateResultForProfile(item.result, 5).ok) throw new Error();
          pending.push({ mode, submissionId: item.submissionId, createdAt: item.createdAt, result: item.result });
        } else if (mode === "infinite" || mode === "infinite-v1") {
          if (!isSubmitInfiniteScoreRequest({ submissionId: item.submissionId, result: item.result })) throw new Error();
          pending.push({ mode: "infinite-v1", submissionId: item.submissionId, createdAt: item.createdAt, result: item.result });
        } else if (mode === "infinite-v2") {
          if (!isSubmitInfiniteScoreRequest({ submissionId: item.submissionId, result: item.result })) throw new Error();
          pending.push({ mode, submissionId: item.submissionId, createdAt: item.createdAt, result: item.result });
        } else throw new Error();
        ids.add(item.submissionId);
      }
      this.pending = pending;
      if (pending.length) this.persist(); // Upgrade legacy mode labels before any retry can be interrupted.
    } catch {
      // Ignore a corrupt/unavailable queue without uploading it or clearing any legacy/account data.
      this.persistenceWarning = "이 브라우저의 대기 기록을 읽지 못했습니다. 새 대기 기록은 새로고침 시 유지되지 않을 수 있어요.";
    }
  }

  private persist(): void {
    try {
      this.storage().setItem(companyPendingKey(this.accountId), JSON.stringify({ version: 2, accountId: this.accountId, pending: this.pending }));
      this.persistenceWarning = null;
    } catch {
      this.persistenceWarning = "대기 기록을 브라우저에 보관하지 못했습니다. 저장이 끝나기 전에 새로고침하면 기록이 사라질 수 있어요.";
    }
  }

  private acceptProfile(incoming: SharedProfile): void {
    if (!isSharedProfile(incoming, this.accountId)) throw new RecordApiError("invalid-response");
    const previous = this.profile;
    let best = incoming.best;
    if (previous?.best && (!best || compareSharedPerformance(previous.best, best) <= 0)) {
      best = { ...previous.best, displayName: incoming.displayName };
    }
    let infiniteBest = incoming.infiniteBest;
    if (previous?.infiniteBest && (!infiniteBest || compareSharedInfiniteScore(previous.infiniteBest, infiniteBest) <= 0)) {
      infiniteBest = { ...previous.infiniteBest, displayName: incoming.displayName };
    }
    let infiniteV2Best = incoming.infiniteV2Best;
    if (previous?.infiniteV2Best && (!infiniteV2Best || compareSharedInfiniteScore(previous.infiniteV2Best, infiniteV2Best) <= 0)) {
      infiniteV2Best = { ...previous.infiniteV2Best, displayName: incoming.displayName };
    }
    this.profile = { ...incoming, best, infiniteBest, infiniteV2Best,
      ...(incoming.appearance ? { appearance: cloneCharacterAppearance(incoming.appearance) } : {}),
      highestClearedStage: Math.max(previous?.highestClearedStage ?? 0, incoming.highestClearedStage) as SharedProfile["highestClearedStage"] };
    if (this.pointStatus === "auth-required") {
      this.pointStatus = this.pointClaims.length ? "saving" : "idle";
      this.pointError = null;
    }
    if (this.appearanceDraft && this.appearanceStatus === "auth-required") {
      this.appearanceStatus = "pending";
      this.appearanceErrorMessage = null;
      this.appearanceDueAt = Date.now();
    }
  }

  private publish(failure?: RecordApiError): void {
    if (!this.profile) {
      this.snapshot = failure ? { status: "error", message: failure.message, authRequired: failure.code === "unauthenticated" }
        : { status: "loading" };
    } else {
      this.snapshot = { status: "ready", binding: {
        profile: this.profile, entries: this.entries, infiniteEntries: this.infiniteEntries, infiniteV2Entries: this.infiniteV2Entries, syncStatus: this.syncStatus,
        pendingCount: this.pending.length, errorMessage: [this.errorMessage, this.persistenceWarning].filter(Boolean).join(" ") || null,
        submitResult: this.submitResult, submitInfiniteV2Score: this.submitInfiniteV2Score, retry: this.retry, refresh: this.refresh,
        pointWallet: { wallet: this.profile.wallet, status: this.pointStatus, errorMessage: this.pointError,
          coinGainRevision: this.coinGainRevision, lastCoinGainAt: this.lastCoinGainAt,
          collectCoin: this.collectCoin, purchaseEffect: this.purchaseEffect, equipEffect: this.equipEffect, retry: this.retryPointWrites },
        appearance: {
          value: this.appearanceDraft ? cloneCharacterAppearance(this.appearanceDraft) : resolveCharacterAppearance(this.profile.appearance),
          status: this.appearanceStatus, errorMessage: this.appearanceErrorMessage,
          update: this.updateAppearance, retry: this.retryAppearance,
        },
      } };
    }
    for (const listener of this.listeners) listener();
  }

  private kick(): void {
    if (this.active && !this.running && !this.paused) void this.run(this.epoch);
  }

  private async savePendingAppearance(signal: AbortSignal, current: () => boolean): Promise<void> {
    const appearance = cloneCharacterAppearance(this.appearanceDraft!);
    const revision = this.appearanceRevision;
    this.appearanceStatus = "saving";
    this.appearanceErrorMessage = null;
    this.publish();
    try {
      if (!current()) return;
      if (!this.api.postAppearance) throw new RecordApiError("invalid-response");
      const response = await this.api.postAppearance(this.accountId, { appearance }, signal);
      if (!current()) return;
      if (!isSharedProfile(response.profile, this.accountId) || !response.profile.appearance ||
        !areCharacterAppearancesEqual(response.profile.appearance, appearance)) throw new RecordApiError("invalid-response");
      this.acceptProfile(response.profile);
      if (revision === this.appearanceRevision) {
        this.appearanceDraft = null;
        this.appearanceDueAt = null;
        this.appearanceStatus = "saved";
      } else this.appearanceStatus = "pending";
      this.appearanceErrorMessage = null;
      this.publish();
    } catch (failure) {
      if (!current()) return;
      const error = failure instanceof RecordApiError ? failure : new RecordApiError("network");
      if (error.code === "unauthenticated") {
        this.appearanceStatus = "auth-required";
        this.appearanceErrorMessage = APPEARANCE_AUTH_ERROR;
        this.appearanceDueAt = null;
        throw error;
      }
      if (revision === this.appearanceRevision) {
        this.appearanceStatus = "error";
        this.appearanceErrorMessage = APPEARANCE_SAVE_ERROR;
        this.appearanceDueAt = null;
      } else {
        this.appearanceStatus = "pending";
        this.appearanceErrorMessage = null;
      }
      this.publish();
    }
  }

  private async run(epoch: number): Promise<void> {
    this.running = true;
    const controller = new AbortController();
    this.controller = controller;
    const current = () => this.active && epoch === this.epoch && !controller.signal.aborted;
    this.syncStatus = "saving";
    this.errorMessage = null;
    this.publish();
    try {
      while (current()) {
        if (!this.profile || this.needsRefresh) {
          this.needsRefresh = false;
          const [profile, entries, infiniteEntries, infiniteV2Entries] = await Promise.all([
            this.api.fetchProfile(this.accountId, controller.signal), this.api.fetchLeaderboard(controller.signal),
            this.api.fetchInfiniteLeaderboard(controller.signal), this.api.fetchInfiniteV2Leaderboard(controller.signal),
          ]);
          if (!current()) return;
          this.acceptProfile(profile);
          this.entries = getSharedTopScores([...entries, ...(this.profile!.best ? [this.profile!.best] : [])]);
          this.infiniteEntries = getSharedTopInfiniteScores([...infiniteEntries, ...(this.profile!.infiniteBest ? [this.profile!.infiniteBest] : [])]);
          this.infiniteV2Entries = getSharedTopInfiniteScores([...infiniteV2Entries, ...(this.profile!.infiniteV2Best ? [this.profile!.infiniteV2Best] : [])]);
          this.publish();
        } else if (this.pending.length) {
          const next = this.pending[0];
          const response = next.mode === "stage"
            ? await this.api.postResult(this.accountId, { submissionId: next.submissionId, result: next.result }, controller.signal)
            : next.mode === "infinite-v1"
              ? await this.api.postInfiniteResult(this.accountId, { submissionId: next.submissionId, result: next.result }, controller.signal)
              : await this.api.postInfiniteV2Result(this.accountId, { submissionId: next.submissionId, result: next.result }, controller.signal);
          if (!current()) return;
          if (response.submissionId !== next.submissionId) throw new RecordApiError("invalid-response");
          this.acceptProfile(response.profile);
          if (next.mode === "stage") {
            this.entries = getSharedTopScores([...response.entries as SharedBest[], ...(this.profile!.best ? [this.profile!.best] : [])]);
          } else if (next.mode === "infinite-v1") {
            this.infiniteEntries = getSharedTopInfiniteScores([...response.entries as SharedInfiniteBest[], ...(this.profile!.infiniteBest ? [this.profile!.infiniteBest] : [])]);
          } else {
            this.infiniteV2Entries = getSharedTopInfiniteScores([...response.entries as SharedInfiniteBest[], ...(this.profile!.infiniteV2Best ? [this.profile!.infiniteV2Best] : [])]);
          }
          this.pending = this.pending.filter((item) => item.submissionId !== response.submissionId);
          this.persist();
          this.backoff = 0;
          this.publish();
        } else if (this.appearanceIsDue()) {
          await this.savePendingAppearance(controller.signal, current);
        } else break;
      }
      if (current()) { this.syncStatus = "idle"; this.publish(); }
    } catch (failure) {
      if (!current()) return;
      const error = failure instanceof RecordApiError ? failure : new RecordApiError("network");
      this.syncStatus = error.code === "unauthenticated" ? "auth-required" : "error";
      if (error.code === "unauthenticated" && this.appearanceDraft) {
        this.appearanceStatus = "auth-required";
        this.appearanceErrorMessage = APPEARANCE_AUTH_ERROR;
        this.appearanceDueAt = null;
      }
      this.errorMessage = error.message;
      this.paused = true;
      this.permanent = ["unauthenticated", "invalid-request", "stage-locked", "invalid-response"].includes(error.code);
      this.publish(error);
      if (!this.permanent) {
        const delays = [1000, 2000, 5000, 10000, 30000];
        this.timer = setTimeout(() => {
          this.timer = undefined;
          if (!this.active || epoch !== this.epoch) return;
          this.paused = false;
          this.kick();
        }, delays[Math.min(this.backoff++, delays.length - 1)]);
      }
    } finally {
      if (epoch === this.epoch) {
        this.running = false;
        this.controller = null;
        if (this.active && !this.paused && (!this.profile || this.needsRefresh || this.pending.length)) this.kick();
        else this.scheduleAppearance();
        if (this.active && this.profile && this.pointClaims.length) this.kickPointQueue();
      }
    }
  }
}
