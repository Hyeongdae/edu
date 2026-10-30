import { compareSharedPerformance, getSharedTopScores, isSubmitResultRequest, validateResultForProfile } from "../../shared/companyRecords";
import type { SharedBest, SharedProfile } from "../../shared/companyRecords";
import type { StageResult } from "../game/types";
import { companyRecordApi, isSharedProfile, RecordApiError, type CompanyRecordApi } from "./recordApi";
import type { CompanyStoreSnapshot, PendingResult, SyncStatus } from "./types";

export function companyPendingKey(accountId: string): string {
  return "stair-descent:company:production:pending:v1:" + encodeURIComponent(accountId);
}

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
  private readonly api: CompanyRecordApi;
  private profile: SharedProfile | null = null;
  private entries: SharedBest[] = [];
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
    window.addEventListener("online", this.onOnline);
    this.publish();
    this.kick();
  };

  stop = (): void => {
    this.active = false;
    this.epoch++;
    this.running = false;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.controller?.abort();
    this.controller = null;
    window.removeEventListener("online", this.onOnline);
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
    this.pending.push(Object.freeze({ submissionId, createdAt: (this.options.now?.() ?? new Date()).toISOString(), result: input }));
    this.persist(); // A navigation or lost response must not erase an unacknowledged result.
    this.publish();
    this.kick();
  };

  retry = (): void => {
    if (!this.active) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.backoff = 0;
    this.paused = false;
    this.permanent = false;
    this.errorMessage = null;
    this.needsRefresh = true;
    this.publish();
    this.kick();
  };

  refresh = (): void => {
    if (!this.active) return;
    this.needsRefresh = true;
    this.kick();
  };

  private onOnline = (): void => {
    if (!this.permanent && this.syncStatus !== "auth-required") this.retry();
  };

  private storage(): Pick<Storage, "getItem" | "setItem"> {
    return this.options.storage?.() ?? window.localStorage;
  }

  private loadQueue(): void {
    try {
      const raw = this.storage().getItem(companyPendingKey(this.accountId));
      if (raw === null) return;
      const value = JSON.parse(raw) as { version?: unknown; accountId?: unknown; pending?: unknown };
      if (!value || value.version !== 1 || value.accountId !== this.accountId || !Array.isArray(value.pending)) throw new Error();
      const ids = new Set<string>();
      for (const item of value.pending) {
        if (typeof item !== "object" || item === null ||
          !isSubmitResultRequest({ submissionId: item.submissionId, result: item.result }) ||
          !validateResultForProfile(item.result, 5).ok || typeof item.createdAt !== "string" ||
          !Number.isFinite(Date.parse(item.createdAt)) || new Date(item.createdAt).toISOString() !== item.createdAt ||
          ids.has(item.submissionId)) throw new Error();
        ids.add(item.submissionId);
      }
      this.pending = value.pending as PendingResult[];
    } catch {
      // Ignore a corrupt/unavailable queue without uploading it or clearing any legacy/account data.
      this.persistenceWarning = "이 브라우저의 대기 기록을 읽지 못했습니다. 새 대기 기록은 새로고침 시 유지되지 않을 수 있어요.";
    }
  }

  private persist(): void {
    try {
      this.storage().setItem(companyPendingKey(this.accountId), JSON.stringify({ version: 1, accountId: this.accountId, pending: this.pending }));
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
    this.profile = { ...incoming, best,
      highestClearedStage: Math.max(previous?.highestClearedStage ?? 0, incoming.highestClearedStage) as SharedProfile["highestClearedStage"] };
  }

  private publish(failure?: RecordApiError): void {
    if (!this.profile) {
      this.snapshot = failure ? { status: "error", message: failure.message, authRequired: failure.code === "unauthenticated" }
        : { status: "loading" };
    } else {
      this.snapshot = { status: "ready", binding: {
        profile: this.profile, entries: this.entries, syncStatus: this.syncStatus,
        pendingCount: this.pending.length, errorMessage: [this.errorMessage, this.persistenceWarning].filter(Boolean).join(" ") || null,
        submitResult: this.submitResult, retry: this.retry, refresh: this.refresh,
      } };
    }
    for (const listener of this.listeners) listener();
  }

  private kick(): void {
    if (this.active && !this.running && !this.paused) void this.run(this.epoch);
  }

  private async run(epoch: number): Promise<void> {
    this.running = true;
    this.syncStatus = "saving";
    this.errorMessage = null;
    this.publish();
    const controller = new AbortController();
    this.controller = controller;
    const current = () => this.active && epoch === this.epoch && !controller.signal.aborted;
    try {
      while (current()) {
        if (!this.profile || this.needsRefresh) {
          this.needsRefresh = false;
          const [profile, entries] = await Promise.all([
            this.api.fetchProfile(this.accountId, controller.signal), this.api.fetchLeaderboard(controller.signal),
          ]);
          if (!current()) return;
          this.acceptProfile(profile);
          this.entries = getSharedTopScores([...entries, ...(this.profile!.best ? [this.profile!.best] : [])]);
          this.publish();
        } else if (this.pending.length) {
          const next = this.pending[0];
          const response = await this.api.postResult(this.accountId, { submissionId: next.submissionId, result: next.result }, controller.signal);
          if (!current()) return;
          if (response.submissionId !== next.submissionId) throw new RecordApiError("invalid-response");
          this.acceptProfile(response.profile);
          this.entries = getSharedTopScores([...response.entries, ...(this.profile!.best ? [this.profile!.best] : [])]);
          this.pending = this.pending.filter((item) => item.submissionId !== response.submissionId);
          this.persist();
          this.backoff = 0;
          this.publish();
        } else break;
      }
      if (current()) { this.syncStatus = "idle"; this.publish(); }
    } catch (failure) {
      if (!current()) return;
      const error = failure instanceof RecordApiError ? failure : new RecordApiError("network");
      this.syncStatus = error.code === "unauthenticated" ? "auth-required" : "error";
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
      if (epoch === this.epoch) { this.running = false; this.controller = null; }
    }
  }
}
