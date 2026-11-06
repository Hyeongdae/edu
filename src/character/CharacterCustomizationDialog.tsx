import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { APPEARANCE_OPTIONS, cloneCharacterAppearance, type CharacterLook, type CharacterRole } from "../../shared/characterAppearance";
import type { AppearanceBinding } from "../company/types";
import { PixelOfficer } from "../game/pixel/PixelOfficer";
import "./character-customization.css";

export interface CharacterCustomizationDialogProps {
  binding: AppearanceBinding;
  storageMode: "account" | "session";
  onClose: () => void;
}

const FIELDS: readonly [keyof CharacterLook, string][] = [
  ["gender", "성별"], ["hairStyle", "머리스타일"], ["hairColor", "머리색"], ["skinTone", "피부색"],
  ["eyeStyle", "눈 모양"],
  ["outfit", "상의"], ["outfitColor", "상의 색상"], ["bottoms", "하의"], ["bottomsColor", "하의 색상"],
  ["hat", "모자"], ["glasses", "안경"],
  ["shoes", "신발"], ["shoeColor", "신발 색상"], ["bag", "가방"], ["bagColor", "가방 색상"],
];
const ROLES = ["runner", "pursuer"] as const;
const ROLE_LABELS = { runner: "도망자", pursuer: "추격자" };
const STATUS_LABELS = {
  idle: "캐릭터를 골라보세요.", pending: "변경한 외형을 저장할 예정이에요.", saving: "외형 저장 중…",
  saved: "계정에 저장했어요.", error: "외형을 저장하지 못했어요.",
  "auth-required": "외형을 저장하려면 회사 계정으로 다시 로그인해 주세요.",
};

export function CharacterCustomizationDialog({ binding, storageMode, onClose }: CharacterCustomizationDialogProps): ReactElement {
  const id = useId();
  const [role, setRole] = useState<CharacterRole>("runner");
  const closeRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Partial<Record<CharacterRole, HTMLButtonElement | null>>>({});
  const look = binding.value[role];
  useEffect(() => { closeRef.current?.focus(); }, []);

  function updateField<K extends keyof CharacterLook>(field: K, value: CharacterLook[K]) {
    const next = cloneCharacterAppearance(binding.value);
    next[role][field] = value;
    binding.update(next);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "runner" : event.key === "End" ? "pursuer"
      : ROLES[(ROLES.indexOf(role) + 1) % ROLES.length];
    setRole(next);
    tabRefs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); return; }
    if (event.key !== "Tab") return;
    // Native radio groups have one tab stop: the selected radio (or their first option).
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), input:not([disabled])')];
    const stops = nodes.filter(node => !(node instanceof HTMLInputElement) || node.type !== "radio" ||
      node.checked || (!nodes.some(other => other instanceof HTMLInputElement && other.name === node.name && other.checked) &&
        nodes.find(other => other instanceof HTMLInputElement && other.name === node.name) === node));
    const first = stops[0], last = stops[stops.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return (
    <div className="character-customization-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section id="character-customization-dialog" className="character-customization-dialog" role="dialog" aria-modal="true" data-keyboard-menu
        aria-labelledby={`${id}-title`} onKeyDown={onKeyDown}>
        <header className="character-customization-header">
          <h2 id={`${id}-title`}>캐릭터 꾸미기</h2>
          <button ref={closeRef} type="button" className="character-close" onClick={onClose} aria-label="꾸미기 닫기">닫기 ×</button>
        </header>
        <div className="character-role-tabs" role="tablist" aria-label="꾸밀 캐릭터">
          {ROLES.map(value => <button key={value} ref={node => { tabRefs.current[value] = node; }} type="button" role="tab"
            id={`${id}-${value}-tab`} aria-controls={`${id}-panel`} aria-selected={role === value} tabIndex={role === value ? 0 : -1}
            onClick={() => setRole(value)} onKeyDown={onTabKeyDown}>{ROLE_LABELS[value]}</button>)}
        </div>
        <div id={`${id}-panel`} className="character-customization-body" role="tabpanel" aria-labelledby={`${id}-${role}-tab`}>
          <div className="character-preview">
            <svg viewBox="-48 -96 96 112" width="192" height="224" role="img" aria-label={`${ROLE_LABELS[role]} 미리보기`} shapeRendering="crispEdges">
              <ellipse cx="0" cy="2" rx="25" ry="4" fill="#030815" />
              <PixelOfficer variant={role === "runner" ? "young" : "older"} direction="right" pose="idle" appearance={look} />
            </svg>
            <strong>{ROLE_LABELS[role]}</strong>
            <p>고르는 즉시 게임에 적용돼요.</p>
          </div>
          <div className="character-options" tabIndex={0} aria-label="외형 선택 항목">
            {FIELDS.map(([field, label]) => <fieldset key={field}>
              <legend>{label}</legend>
              <div className="character-option-list">{APPEARANCE_OPTIONS[field].map(option => <label key={option.value} className="character-option">
                <input type="radio" name={`${id}-${role}-${field}`} value={option.value} checked={look[field] === option.value}
                  onChange={() => updateField(field, option.value)} />
                <span className="character-option-face">
                  {option.swatch && <span className="character-swatch" style={{ backgroundColor: option.swatch }} aria-hidden="true" />}
                  <span>{option.label}</span><span className="character-option-check" aria-hidden="true">✓</span>
                </span>
              </label>)}</div>
            </fieldset>)}
          </div>
        </div>
        <footer className="character-customization-footer">
          <p role="status" aria-live="polite">{storageMode === "session" ? "로컬 미리보기 · 이번 접속에서만 유지돼요."
            : binding.status === "error" ? binding.errorMessage ?? STATUS_LABELS.error : STATUS_LABELS[binding.status]}</p>
          {storageMode === "account" && binding.status === "error" && <button type="button" onClick={binding.retry}>다시 시도</button>}
        </footer>
      </section>
    </div>
  );
}
