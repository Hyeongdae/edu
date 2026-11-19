import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { getPointEffectPrice, type PointEffectId } from "../../shared/companyRecords";
import type { PointWalletBinding } from "../company/types";
import { PlayerStepEffect } from "./PointCoin";
import "./point-shop.css";

export interface PointShopDialogProps { wallet: PointWalletBinding; storageMode?: "account" | "local"; onClose(): void; }

const CATALOG: readonly { id: PointEffectId; name: string; description: string }[] = [
  { id: "sparkle", name: "반짝 발자국", description: "발걸음마다 별빛이 반짝입니다." },
  { id: "smoke", name: "구름 발자국", description: "발밑에 픽셀 구름이 피어오릅니다." },
  { id: "fire", name: "불꽃 발자국", description: "계단을 밟으면 작은 불꽃이 피어납니다." },
  { id: "heart", name: "하트 발자국", description: "발걸음마다 작은 하트가 떠오릅니다." },
];

export function PointShopDialog({ wallet, storageMode = "local", onClose }: PointShopDialogProps): ReactElement {
  const [confirming, setConfirming] = useState<PointEffectId | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLButtonElement>(null);
  const purchaseRefs = useRef<Partial<Record<PointEffectId, HTMLButtonElement | null>>>({});
  const cardTitle = (id: PointEffectId) => CATALOG.find((item) => item.id === id)!.name;
  const canMutate = !busy && wallet.status === "idle";

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => { if (confirming) confirmationRef.current?.focus(); }, [confirming]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation();
      if (confirming) setConfirming(null); else onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled])')];
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  async function confirmPurchase() {
    if (!confirming || !canMutate) return;
    const item = confirming;
    setBusy(true); setMessage(null);
    try {
      await wallet.purchaseEffect(item);
      setMessage(`${cardTitle(item)} 효과를 구매해 장착했어요.`);
      setConfirming(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "구매를 완료하지 못했어요. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  async function equip(effectId: PointEffectId | null) {
    if (!canMutate) return;
    setBusy(true); setMessage(null);
    try { await wallet.equipEffect(effectId); setMessage(effectId ? `${cardTitle(effectId)} 효과를 장착했어요.` : "발자국 효과를 해제했어요."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "장착 설정을 저장하지 못했어요."); }
    finally { setBusy(false); }
  }

  return <div className="point-shop-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section id="point-shop-dialog" className="point-shop-dialog" role="dialog" aria-modal="true" aria-labelledby="point-shop-title" data-keyboard-menu onKeyDown={onKeyDown}>
      <header className="point-shop-header"><div><p className="game-title-kicker">STEP EFFECTS</p><h2 id="point-shop-title">포인트 상점 <span className="point-shop-mode-note">(무한모드 전용)</span></h2></div>
        <button ref={closeRef} type="button" className="point-shop-close" onClick={onClose}>닫기</button></header>
      <div className="point-shop-summary"><strong aria-live="polite">보유 포인트 <span>{wallet.wallet.balance} 포인트</span></strong>
        {storageMode === "local" && <span>로컬 테스트 저장</span>}
        <span>{wallet.wallet.equippedEffect ? `장착 중: ${cardTitle(wallet.wallet.equippedEffect)}` : "장착 중인 효과 없음"}</span></div>
      {(wallet.status === "error" || wallet.status === "auth-required") && <p className="point-shop-error" role="alert">
        {wallet.errorMessage ?? "포인트 정보를 불러오지 못했어요."} <button type="button" onClick={wallet.retry}>다시 시도</button></p>}
      <div className="point-shop-catalog">
        {CATALOG.map((item, index) => {
          const owned = wallet.wallet.ownedEffects.includes(item.id);
          const equipped = wallet.wallet.equippedEffect === item.id;
          const price = getPointEffectPrice(item.id);
          return <article className="point-shop-card" key={item.id}>
            <div className={`point-shop-preview is-${item.id}`} aria-hidden="true"><svg viewBox={item.id === "fire" ? "-42 -58 84 70" : "-48 -96 96 112"} shapeRendering="crispEdges">
              <ellipse cx="0" cy="2" rx="25" ry="4" fill="#030815"/><PlayerStepEffect effect={item.id} animationKey={index}/>
            </svg></div>
            <div className="point-shop-card-copy"><h3>{item.name}</h3><p>{item.description}</p>
              <strong>{owned ? "보유 중" : `${price} 포인트`}</strong></div>
            <div className="point-shop-card-actions">
              {equipped ? <><span className="point-shop-equipped">장착 중</span><button type="button" disabled={!canMutate} onClick={() => void equip(null)}>해제</button></>
                : owned ? <button type="button" disabled={!canMutate} onClick={() => void equip(item.id)}>장착</button>
                  : <button ref={(node) => { purchaseRefs.current[item.id] = node; }} type="button"
                    disabled={!canMutate || wallet.wallet.balance < price} onClick={() => { setMessage(null); setConfirming(item.id); }}>구매</button>}
            </div>
          </article>;
        })}
      </div>
      <footer className="point-shop-footer"><p role={message ? "status" : undefined} aria-live="polite">{message ?? "게임에서 코인을 모아 발자국 효과를 꾸며보세요."}</p>
        {wallet.status === "saving" && <span>저장 중…</span>}</footer>
      {confirming && <div className="point-shop-confirm-backdrop"><section className="point-shop-confirm" role="alertdialog" aria-modal="true"
        aria-labelledby="point-shop-confirm-title" aria-describedby="point-shop-confirm-description">
        <h3 id="point-shop-confirm-title">구매할까요?</h3><p id="point-shop-confirm-description">{cardTitle(confirming)} 효과를 {getPointEffectPrice(confirming)} 포인트에 구매할까요? 구매 후 바로 장착됩니다.</p>
        <div><button type="button" disabled={busy} onClick={() => { const id = confirming; setConfirming(null); purchaseRefs.current[id]?.focus(); }}>취소</button>
          <button ref={confirmationRef} type="button" disabled={!canMutate || wallet.wallet.balance < getPointEffectPrice(confirming)} onClick={() => void confirmPurchase()}>{busy ? "구매 중…" : "구매 확인"}</button></div>
      </section></div>}
    </section>
  </div>;
}
