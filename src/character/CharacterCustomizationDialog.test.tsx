import { StrictMode, useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPEARANCE_OPTIONS, getDefaultCharacterAppearance } from "../../shared/characterAppearance";
import type { AppearanceBinding } from "../company/types";
import { CharacterCustomizationDialog } from "./CharacterCustomizationDialog";

afterEach(cleanup);
function binding(overrides: Partial<AppearanceBinding> = {}): AppearanceBinding {
  return { value: getDefaultCharacterAppearance(), status: "idle", errorMessage: null, update: vi.fn(), retry: vi.fn(), ...overrides };
}
function choose(group: string, option: string) {
  fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("radio", { name: option }));
}

describe("character editor", () => {
  it.each([{ role: "runner", label: "도망자" }, { role: "pursuer", label: "추격자" }] as const)(
    "changes only $role gender, updates real geometry and keeps the draft through save states", ({ role, label }) => {
      const initial = getDefaultCharacterAppearance();
      Object.assign(initial.runner, { hairStyle: "long", hairColor: "pink", skinTone: "tan", outfit: "hoodie", outfitColor: "sky",
        hat: "beanie", glasses: "round", shoes: "boots", shoeColor: "navy", eyeStyle: "smile", bag: "backpack", bagColor: "beige" });
      Object.assign(initial.pursuer, { hairStyle: "curly", hairColor: "gray", skinTone: "deep", outfit: "vest", outfitColor: "orange",
        hat: "beret", glasses: "square", shoes: "sneakers", shoeColor: "red", eyeStyle: "sharp", bag: "briefcase", bagColor: "brown" });
      const update = vi.fn(), retry = vi.fn();
      function Harness({ status }: { status: AppearanceBinding["status"] }) {
        const [value, setValue] = useState(initial);
        return <CharacterCustomizationDialog binding={binding({ value, status, retry,
          errorMessage: status === "error" ? "저장 연결 오류" : null,
          update: next => { update(next); setValue(next); } })} storageMode="account" onClose={vi.fn()} />;
      }
      const view = render(<Harness status="idle" />);
      const editor = within(screen.getByRole("dialog"));
      fireEvent.click(editor.getByRole("tab", { name: label }));
      const preview = editor.getByRole("img");
      const selectors = [".officer-face-outline", ".officer-eyebrows path", ".officer-torso-outline"];
      const original = selectors.map(selector => preview.querySelector(selector)!.getAttribute("d"));
      const female = editor.getByRole("radio", { name: "여성" });
      fireEvent.click(female); female.focus();
      const expected = { ...initial, [role]: { ...initial[role], gender: "female" } };
      expect(update).toHaveBeenCalledExactlyOnceWith(expected);
      selectors.forEach((selector, i) => expect(preview.querySelector(selector)!.getAttribute("d")).not.toBe(original[i]));
      expect(preview.querySelector(".officer-eyelashes path")).not.toBeNull();
      for (const status of ["pending", "saving", "saved", "error", "auth-required"] as const) {
        view.rerender(<Harness status={status} />);
        expect(female).toBeChecked(); expect(female).toHaveFocus();
        expect(preview.querySelector(".officer-eyes")).toHaveAttribute("data-eye-style", initial[role].eyeStyle);
        expect(preview.querySelector(".officer-outfit")).toHaveAttribute("data-appearance-gender", "female");
        if (status === "error") {
          expect(screen.getByRole("status")).toHaveTextContent("저장 연결 오류");
          fireEvent.click(editor.getByRole("button", { name: "다시 시도" }));
          expect(retry).toHaveBeenCalledOnce();
        }
      }
      expect(update).toHaveBeenCalledOnce();
      fireEvent.click(editor.getByRole("radio", { name: "남성" }));
      expect(update).toHaveBeenLastCalledWith(initial);
      selectors.forEach((selector, i) => expect(preview.querySelector(selector)!.getAttribute("d")).toBe(original[i]));
      expect(preview.querySelector(".officer-eyelashes")).toBeNull();
    });

  it("offers the complete catalog in thirteen labelled groups for either role", () => {
    render(<CharacterCustomizationDialog binding={binding()} storageMode="session" onClose={vi.fn()} />);
    const labels = ["성별", "머리스타일", "머리색", "피부색", "눈 모양", "옷", "옷 색상", "모자", "안경", "신발", "신발 색상", "가방", "가방 색상"];
    const fields = ["gender", "hairStyle", "hairColor", "skinTone", "eyeStyle", "outfit", "outfitColor", "hat", "glasses", "shoes", "shoeColor", "bag", "bagColor"] as const;
    for (const role of ["도망자", "추격자"]) {
      fireEvent.click(screen.getByRole("tab", { name: role }));
      const groups = screen.getAllByRole("group");
      expect(groups).toHaveLength(labels.length);
      groups.forEach((group, index) => {
        expect(group).toHaveAccessibleName(labels[index]);
        const radios = within(group).getAllByRole("radio");
        expect(radios).toHaveLength(APPEARANCE_OPTIONS[fields[index]].length);
        APPEARANCE_OPTIONS[fields[index]].forEach(option => {
          expect(within(group).getByRole("radio", { name: option.label })).toHaveAttribute("value", option.value);
        });
        expect(radios.filter(radio => (radio as HTMLInputElement).checked)).toHaveLength(1);
      });
    }
  });

  it("retains bag color while unequipped and restores selected eyes after removing sunglasses", () => {
    function Harness() {
      const [value, setValue] = useState(getDefaultCharacterAppearance);
      return <CharacterCustomizationDialog binding={binding({ value, update: setValue })} storageMode="session" onClose={vi.fn()} />;
    }
    render(<Harness />);
    const preview = screen.getByRole("img");
    const color = within(screen.getByRole("group", { name: "가방 색상" })).getByRole("radio", { name: "베이지" });
    expect(color).toBeEnabled(); fireEvent.click(color); expect(color).toBeChecked();
    expect(preview.querySelector("[data-bag-kind]")).toBeNull();
    for (const [label, kind] of [["백팩", "backpack"], ["노트북 가방", "laptop"], ["크로스백", "crossbody"], ["서류가방", "briefcase"]]) {
      choose("가방", label);
      expect(preview.querySelector(`[data-bag-kind="${kind}"] .officer-bag-fill`)).toHaveAttribute("fill", "#c8b38b");
      choose("가방", "없음"); expect(preview.querySelector("[data-bag-kind]")).toBeNull();
      expect(color).toBeChecked(); expect(color).toBeEnabled();
    }
    choose("눈 모양", "웃는 눈"); choose("안경", "선글라스");
    expect(preview.querySelector(".officer-sunglass-lenses")).not.toBeNull();
    expect(preview.querySelector(".officer-eyes")).toHaveAttribute("data-eye-style", "smile");
    choose("안경", "없음");
    expect(preview.querySelector(".officer-sunglass-lenses")).toBeNull();
    expect(preview.querySelector(".officer-eyes")).toHaveAttribute("data-expression", "normal");
    expect(preview.querySelector(".officer-eyes")).toHaveAttribute("data-eye-style", "smile");
    choose("안경", "사각 안경");
    expect(preview.querySelector(".officer-glasses--square .officer-eyes")).toHaveAttribute("data-eye-style", "smile");
  });

  it("edits independent parts and roles using the latest controlled value, with immediate real SVG previews", () => {
    const update = vi.fn();
    function Harness() {
      const [value, setValue] = useState(getDefaultCharacterAppearance);
      return <CharacterCustomizationDialog binding={binding({ value, update: next => { update(next); setValue(next); } })} storageMode="session" onClose={vi.fn()} />;
    }
    render(<StrictMode><Harness /></StrictMode>);
    expect(screen.getAllByRole("group")).toHaveLength(13);
    choose("모자", "캡 모자"); choose("성별", "여성"); choose("머리스타일", "묶은 머리");
    choose("옷", "후드티"); choose("옷 색상", "청록"); choose("신발", "부츠"); choose("신발 색상", "흰색");
    choose("머리스타일", "장발"); choose("눈 모양", "동그란 눈"); choose("가방", "백팩"); choose("가방 색상", "남색");
    choose("성별", "남성"); choose("성별", "여성");
    const runner = screen.getByRole("img", { name: "도망자 미리보기" });
    expect(runner.querySelector(".officer-cap-hat")).not.toBeNull();
    expect(runner.querySelector(".officer-hair-back")).not.toBeNull();
    expect(runner.querySelector(".officer-head-art")).toHaveAttribute("data-appearance-gender", "female");
    expect(runner.querySelector(".officer-cloth")).toHaveAttribute("fill", "#397f82");
    expect(runner.querySelector(".officer-shoe--boots .officer-shoe-base")).toHaveAttribute("fill", "#e6ecef");
    expect(runner.querySelector(".officer-hoodie-details")).not.toBeNull();
    expect(runner.querySelector(".officer-eyes")).toHaveAttribute("data-eye-style", "round");
    expect(runner.querySelector('[data-bag-kind="backpack"] .officer-bag-fill')).toHaveAttribute("fill", "#30466d");
    fireEvent.click(screen.getByRole("tab", { name: "추격자" }));
    choose("안경", "둥근 안경"); choose("피부색", "짙은 피부");
    choose("머리스타일", "곱슬머리"); choose("옷", "조끼"); choose("모자", "베레모");
    choose("눈 모양", "날카로운 눈"); choose("가방", "서류가방"); choose("가방 색상", "갈색");
    const preview = screen.getByRole("img", { name: "추격자 미리보기" });
    expect(preview.querySelector(".officer-beret-hat")).not.toBeNull();
    expect(preview.querySelector(".officer-glasses--round")).not.toBeNull();
    expect(preview.querySelector(".officer-face-skin")).toHaveAttribute("fill", "#86533a");
    expect(preview.querySelector(".officer-hair--curly")).not.toBeNull();
    expect(preview.querySelector(".officer-vest-details")).not.toBeNull();
    expect(preview.querySelector('.officer-glasses--round .officer-eyes')).toHaveAttribute("data-eye-style", "sharp");
    expect(preview.querySelector('[data-bag-kind="briefcase"] .officer-bag-fill')).toHaveAttribute("fill", "#785039");
    fireEvent.click(screen.getByRole("tab", { name: "도망자" }));
    expect(within(screen.getByRole("group", { name: "모자" })).getByRole("radio", { name: "캡 모자" })).toBeChecked();
    expect(update.mock.lastCall![0]).toMatchObject({ version: 3,
      runner: { gender: "female", hairStyle: "long", hat: "cap", outfit: "hoodie", shoeColor: "white", eyeStyle: "round", bag: "backpack", bagColor: "navy" },
      pursuer: { glasses: "round", skinTone: "deep", gender: "male", hat: "beret", hairStyle: "curly", outfit: "vest", eyeStyle: "sharp", bag: "briefcase", bagColor: "brown" } });
    expect(screen.getByRole("status")).toHaveTextContent("이번 접속에서만 유지돼요");
  });

  it("supports roving keyboard tabs without saving and links the selected panel", () => {
    const value = binding();
    render(<CharacterCustomizationDialog binding={value} storageMode="account" onClose={vi.fn()} />);
    const runner = screen.getByRole("tab", { name: "도망자" }), pursuer = screen.getByRole("tab", { name: "추격자" });
    runner.focus(); fireEvent.keyDown(runner, { key: "ArrowRight" });
    expect(pursuer).toHaveFocus(); expect(pursuer).toHaveAttribute("aria-selected", "true"); expect(runner.tabIndex).toBe(-1);
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("추격자");
    fireEvent.keyDown(pursuer, { key: "Home" }); expect(runner).toHaveFocus();
    fireEvent.keyDown(runner, { key: "End" }); expect(pursuer).toHaveFocus();
    fireEvent.keyDown(pursuer, { key: "ArrowLeft" }); expect(runner).toHaveFocus();
    expect(value.update).not.toHaveBeenCalled();
  });

  it.each(["idle", "pending", "saving", "saved", "auth-required"] as const)("reports account %s without stealing option focus", status => {
    const value = binding();
    const view = render(<CharacterCustomizationDialog binding={value} storageMode="account" onClose={vi.fn()} />);
    const radio = screen.getByRole("radio", { name: "남성" }); radio.focus();
    view.rerender(<CharacterCustomizationDialog binding={{ ...value, status }} storageMode="account" onClose={vi.fn()} />);
    expect(radio).toHaveFocus();
    const expected = { idle: "캐릭터를 골라보세요", pending: "저장할 예정", saving: "저장 중", saved: "계정에 저장했어요", "auth-required": "다시 로그인" };
    expect(screen.getByRole("status")).toHaveTextContent(expected[status]);
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
  });

  it("keeps the draft while displaying errors and retries, and describes session mode honestly", () => {
    const value = binding({ status: "error", errorMessage: "연결을 확인해 주세요." }); value.value.runner.hat = "cap";
    const view = render(<CharacterCustomizationDialog binding={value} storageMode="account" onClose={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("연결을 확인해 주세요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" })); expect(value.retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("img").querySelector(".officer-cap-hat")).not.toBeNull();
    view.rerender(<CharacterCustomizationDialog binding={value} storageMode="session" onClose={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("로컬 미리보기");
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
  });

  it("traps Tab at the selected last radio, closes with Escape, and ignores interior clicks", () => {
    const onClose = vi.fn();
    render(<CharacterCustomizationDialog binding={binding()} storageMode="session" onClose={onClose} />);
    const close = screen.getByRole("button", { name: "꾸미기 닫기" }); expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    const last = within(screen.getByRole("group", { name: "가방 색상" })).getByRole("radio", { name: "검정" });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" }); expect(close).toHaveFocus();
    fireEvent.click(screen.getByRole("dialog")); expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(close, { key: "Escape" }); expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("dialog").parentElement!); expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(close); expect(onClose).toHaveBeenCalledTimes(3);
  });
});
