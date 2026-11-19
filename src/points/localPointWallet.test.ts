import { describe, expect, it, vi } from "vitest";
import { LocalPointWalletStore, LOCAL_POINT_STARTING_BALANCE, LOCAL_POINT_WALLET_KEY } from "./localPointWallet";

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
}

describe("local test point wallet", () => {
  it("seeds 1,000 points once and restores saved balance and items", async () => {
    const backing = storage();
    const wallet = new LocalPointWalletStore(backing);
    expect(wallet.getSnapshot().wallet.balance).toBe(LOCAL_POINT_STARTING_BALANCE);
    wallet.collectCoin();
    await wallet.purchaseEffect("fire");
    await wallet.equipEffect(null);
    const restored = new LocalPointWalletStore(backing);
    expect(restored.getSnapshot().wallet).toEqual({ balance: 501, ownedEffects: ["fire"], equippedEffect: null });
    expect(backing.setItem).toHaveBeenCalledWith(LOCAL_POINT_WALLET_KEY, expect.any(String));
  });

  it("does not spend on an unaffordable item and recovers only its own malformed key", async () => {
    const backing = storage({ "other-key": "leave-me", [LOCAL_POINT_WALLET_KEY]: "{bad" });
    const wallet = new LocalPointWalletStore(backing);
    expect(wallet.getSnapshot().wallet.balance).toBe(LOCAL_POINT_STARTING_BALANCE);
    expect(backing.values.get("other-key")).toBe("leave-me");
    const small = storage({ [LOCAL_POINT_WALLET_KEY]: JSON.stringify({ balance: 10, ownedEffects: [], equippedEffect: null }) });
    const low = new LocalPointWalletStore(small);
    await expect(low.purchaseEffect("fire")).rejects.toThrow();
    expect(low.getSnapshot().wallet.balance).toBe(10);
  });

  it("persists each coin immediately and never overflows a safe integer", () => {
    const backing = storage({ [LOCAL_POINT_WALLET_KEY]: JSON.stringify({ balance: Number.MAX_SAFE_INTEGER, ownedEffects: [], equippedEffect: null }) });
    const wallet = new LocalPointWalletStore(backing);
    wallet.collectCoin();
    expect(wallet.getSnapshot().wallet.balance).toBe(Number.MAX_SAFE_INTEGER);
    expect(backing.setItem).not.toHaveBeenCalled();
  });
});
