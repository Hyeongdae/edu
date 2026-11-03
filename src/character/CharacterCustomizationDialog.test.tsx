import { StrictMode, useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultCharacterAppearance } from "../../shared/characterAppearance";
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
  it("edits independent parts and roles using the latest controlled value, with immediate real SVG previews", () => {
    const update = vi.fn();
    function Harness() {
      const [value, setValue] = useState(getDefaultCharacterAppearance);
      return <CharacterCustomizationDialog binding={binding({ value, update: next => { update(next); setValue(next); } })} storageMode="session" onClose={vi.fn()} />;
    }
    render(<StrictMode><Harness /></StrictMode>);
    expect(screen.getAllByRole("group")).toHaveLength(10);
    choose("모자", "캡 모자"); choose("성별", "여성"); choose("머리스타일", "묶은 머리");
    choose("옷", "카디건"); choose("옷 색상", "청록"); choose("신발", "운동화"); choose("신발 색상", "흰색");
    const runner = screen.getByRole("img", { name: "도망자 미리보기" });
    expect(runner.querySelector(".officer-cap-hat")).not.toBeNull();
    expect(runner.querySelector(".officer-hair-back")).not.toBeNull();
    expect(runner.querySelector(".officer-head-art")).toHaveAttribute("data-appearance-gender", "female");
    expect(runner.querySelector(".officer-cloth")).toHaveAttribute("fill", "#397f82");
    expect(runner.querySelector(".officer-shoe--sneakers .officer-shoe-base")).toHaveAttribute("fill", "#e6ecef");
    fireEvent.click(screen.getByRole("tab", { name: "추격자" }));
    choose("안경", "둥근 안경"); choose("피부색", "짙은 피부");
    const preview = screen.getByRole("img", { name: "추격자 미리보기" });
    expect(preview.querySelector(".officer-straw-hat")).not.toBeNull();
    expect(preview.querySelector(".officer-glasses--round")).not.toBeNull();
    expect(preview.querySelector(".officer-face-skin")).toHaveAttribute("fill", "#86533a");
    fireEvent.click(screen.getByRole("tab", { name: "도망자" }));
    expect(within(screen.getByRole("group", { name: "모자" })).getByRole("radio", { name: "캡 모자" })).toBeChecked();
    expect(update.mock.lastCall![0]).toMatchObject({ runner: { gender: "female", hat: "cap", outfit: "cardigan", shoeColor: "white" }, pursuer: { glasses: "round", skinTone: "deep", gender: "male", hat: "straw" } });
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
    const last = within(screen.getByRole("group", { name: "신발 색상" })).getByRole("radio", { name: "검정" });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" }); expect(close).toHaveFocus();
    fireEvent.click(screen.getByRole("dialog")); expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(close, { key: "Escape" }); expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("dialog").parentElement!); expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(close); expect(onClose).toHaveBeenCalledTimes(3);
  });
});
