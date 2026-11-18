import { createEmptyPointWallet, equipPointEffect, isPointWallet, purchasePointEffect } from "../../shared/companyRecords";
import type { PointEffectId, PointWallet } from "../../shared/companyRecords";
import type { PointWalletSnapshot } from "../company/types";

export const LOCAL_POINT_WALLET_KEY = "stair-descent:local:point-wallet:v1";
export const LOCAL_POINT_STARTING_BALANCE = 1000;

const STORAGE_ERROR = "로컬 테스트 포인트를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.";
const EMPTY_SNAPSHOT: PointWalletSnapshot = {
  wallet: createEmptyPointWallet(), status: "idle", errorMessage: null, coinGainRevision: 0, lastCoinGainAt: null,
};

export class LocalPointWalletStore {
  private readonly listeners = new Set<() => void>();
  private snapshot: PointWalletSnapshot = EMPTY_SNAPSHOT;

  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem">) {
    let wallet: PointWallet = { balance: LOCAL_POINT_STARTING_BALANCE, ownedEffects: [], equippedEffect: null };
    let message: string | null = null;
    let shouldSaveSeed = false;
    try {
      const raw = storage.getItem(LOCAL_POINT_WALLET_KEY);
      if (raw === null) {
        shouldSaveSeed = true;
      } else {
        const parsed: unknown = JSON.parse(raw);
        if (!isPointWallet(parsed)) throw new Error("invalid wallet");
        wallet = { balance: parsed.balance, ownedEffects: [...parsed.ownedEffects], equippedEffect: parsed.equippedEffect };
      }
    } catch {
      message = STORAGE_ERROR;
      shouldSaveSeed = true;
    }
    if (shouldSaveSeed) try { storage.setItem(LOCAL_POINT_WALLET_KEY, JSON.stringify(wallet)); }
    catch { message = STORAGE_ERROR; }
    this.snapshot = { ...EMPTY_SNAPSHOT, wallet, status: message ? "error" : "idle", errorMessage: message };
  }

  getSnapshot = (): PointWalletSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  collectCoin = (): void => {
    if (this.snapshot.wallet.balance >= Number.MAX_SAFE_INTEGER) return;
    this.commit({ ...this.snapshot.wallet, balance: this.snapshot.wallet.balance + 1 }, true);
  };

  purchaseEffect = async (effectId: PointEffectId): Promise<void> => {
    const result = purchasePointEffect(this.snapshot.wallet, effectId);
    if (!result.ok) throw new Error("포인트가 부족합니다.");
    if (result.changed) this.commit(result.wallet, false);
  };

  equipEffect = async (effectId: PointEffectId | null): Promise<void> => {
    const result = equipPointEffect(this.snapshot.wallet, effectId);
    if (!result.ok) throw new Error("보유하지 않은 이펙트입니다.");
    if (result.changed) this.commit(result.wallet, false);
  };

  private commit(wallet: PointWallet, coin: boolean): void {
    try {
      this.storage.setItem(LOCAL_POINT_WALLET_KEY, JSON.stringify(wallet));
    } catch {
      this.snapshot = { ...this.snapshot, status: "error", errorMessage: STORAGE_ERROR };
      this.emit();
      return;
    }
    this.snapshot = { ...this.snapshot, wallet, status: "idle", errorMessage: null,
      coinGainRevision: this.snapshot.coinGainRevision + (coin ? 1 : 0),
      lastCoinGainAt: coin ? Date.now() : this.snapshot.lastCoinGainAt };
    this.emit();
  }

  private emit(): void { for (const listener of this.listeners) listener(); }
}
