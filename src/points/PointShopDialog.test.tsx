import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PointWalletBinding } from "../company/types";
import { PointShopDialog } from "./PointShopDialog";

afterEach(cleanup);

function wallet(overrides: Partial<PointWalletBinding> = {}): PointWalletBinding {
  return { wallet: { balance: 1000, ownedEffects: [], equippedEffect: null }, status: "idle", errorMessage: null,
    coinGainRevision: 0, lastCoinGainAt: null, collectCoin: vi.fn(), purchaseEffect: vi.fn().mockResolvedValue(undefined),
    equipEffect: vi.fn().mockResolvedValue(undefined), retry: vi.fn(), ...overrides };
}

describe("title point shop", () => {
  it("lists the four effects in order with their prices and accessible pixel previews", () => {
    render(<PointShopDialog wallet={wallet()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "포인트 상점" })).toBeVisible();
    expect(screen.getByText("1000 포인트")).toBeVisible();
    expect(screen.getByText("불꽃 발자국")).toBeVisible();
    expect(screen.getByText("반짝 발자국")).toBeVisible();
    expect(screen.getByText("연기 발자국")).toBeVisible();
    expect(screen.getAllByText("500 포인트")).toHaveLength(4);
    expect(screen.getAllByTestId("player-step-effect")).toHaveLength(4);
  });

  it("requires confirmation before buying and only calls the binding once", async () => {
    const binding = wallet();
    render(<PointShopDialog wallet={binding} onClose={vi.fn()} />);
    const fireCard = screen.getByRole("heading", { name: "불꽃 발자국" }).closest("article")!;
    fireEvent.click(within(fireCard).getByRole("button", { name: "구매" }));
    expect(screen.getByRole("alertdialog", { name: "구매할까요?" })).toHaveTextContent("500 포인트");
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(binding.purchaseEffect).not.toHaveBeenCalled();
    fireEvent.click(within(fireCard).getByRole("button", { name: "구매" }));
    fireEvent.click(screen.getByRole("button", { name: "구매 확인" }));
    expect(binding.purchaseEffect).toHaveBeenCalledTimes(1);
    expect(binding.purchaseEffect).toHaveBeenCalledWith("fire");
    expect(await screen.findByRole("status")).toHaveTextContent("불꽃 발자국 효과를 구매해 장착했어요.");
  });

  it("supports equipping, switching, and unequipping without repurchase", async () => {
    const equipEffect = vi.fn().mockResolvedValue(undefined);
    const binding = wallet({ wallet: { balance: 500, ownedEffects: ["fire", "smoke"], equippedEffect: "fire" }, equipEffect });
    render(<PointShopDialog wallet={binding} onClose={vi.fn()} />);
    const fireCard = screen.getByRole("heading", { name: "불꽃 발자국" }).closest("article")!;
    fireEvent.click(within(fireCard).getByRole("button", { name: "해제" }));
    await waitFor(() => expect(equipEffect).toHaveBeenCalledTimes(1));
    const smokeCard = screen.getByRole("heading", { name: "연기 발자국" }).closest("article")!;
    fireEvent.click(within(smokeCard).getByRole("button", { name: "장착" }));
    await waitFor(() => expect(equipEffect).toHaveBeenCalledTimes(2));
    expect(equipEffect).toHaveBeenNthCalledWith(1, null);
    expect(equipEffect).toHaveBeenNthCalledWith(2, "smoke");
  });
});
