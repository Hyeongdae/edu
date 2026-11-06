import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PauseMenuDialog, type PauseMenuDialogProps } from "./PauseMenuDialog";
import { handleDirectionalMenuNavigation } from "./directionalMenuNavigation";

afterEach(cleanup);

function makeProps(overrides: Partial<PauseMenuDialogProps> = {}): PauseMenuDialogProps {
  return {
    modeName: "단계 모드",
    confirmation: null,
    onResume: vi.fn(),
    onRequestRestart: vi.fn(),
    onRequestTitle: vi.fn(),
    onConfirm: vi.fn(),
    onCancelConfirmation: vi.fn(),
    ...overrides,
  };
}

describe("PauseMenuDialog", () => {
  it("moves through pause and confirmation actions with arrow keys", () => {
    const props = makeProps();
    const view = render(<main onKeyDown={handleDirectionalMenuNavigation}><PauseMenuDialog {...props} /></main>);
    const resume = screen.getByRole("button", { name: "게임 재개" });
    const restart = screen.getByRole("button", { name: "다시시작" });
    const title = screen.getByRole("button", { name: "타이틀로 돌아가기" });
    expect(resume).toHaveFocus();
    fireEvent.keyDown(resume, { key: "ArrowDown" });
    expect(restart).toHaveFocus();
    fireEvent.keyDown(restart, { key: "ArrowDown" });
    expect(title).toHaveFocus();
    fireEvent.keyDown(title, { key: "ArrowDown" });
    expect(title).toHaveFocus();

    view.rerender(<main onKeyDown={handleDirectionalMenuNavigation}><PauseMenuDialog {...props} confirmation="restart" /></main>);
    const yes = screen.getByRole("button", { name: "예" });
    const no = screen.getByRole("button", { name: "아니오" });
    expect(yes).toHaveFocus();
    fireEvent.keyDown(yes, { key: "ArrowDown" });
    expect(no).toHaveFocus();
    fireEvent.keyDown(yes, { key: "Enter" });
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it("shows the three pause actions and focuses resume", () => {
    const props = makeProps();
    render(<PauseMenuDialog {...props} />);

    const dialog = screen.getByRole("dialog", { name: "단계 모드 일시정지" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "게임 재개" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "다시시작" })).toBeVisible();
    expect(screen.getByRole("button", { name: "타이틀로 돌아가기" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "다시시작" }));
    expect(props.onRequestRestart).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "타이틀로 돌아가기" }));
    expect(props.onRequestTitle).toHaveBeenCalledOnce();
  });

  it("shows a restart confirmation and returns to the pause menu on no or Escape", () => {
    const props = makeProps({ confirmation: "restart" });
    const view = render(<PauseMenuDialog {...props} />);

    expect(screen.getByRole("dialog", { name: "다시시작할까요?" })).toBeVisible();
    expect(screen.getByText("현재 단계 모드 진행을 초기화하고 0점부터 다시 시작할까요?")).toBeVisible();
    expect(screen.getByRole("button", { name: "예" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "아니오" }));
    expect(props.onCancelConfirmation).toHaveBeenCalledOnce();

    view.rerender(<PauseMenuDialog {...props} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onCancelConfirmation).toHaveBeenCalledTimes(2);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("confirms title return and traps Tab in the dialog", () => {
    const props = makeProps({ confirmation: "title" });
    const view = render(<PauseMenuDialog {...props} />);

    expect(screen.getByRole("dialog", { name: "타이틀로 돌아갈까요?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "예" }));
    expect(props.onConfirm).toHaveBeenCalledOnce();

    view.rerender(<PauseMenuDialog {...props} confirmation={null} />);
    const resume = screen.getByRole("button", { name: "게임 재개" });
    const title = screen.getByRole("button", { name: "타이틀로 돌아가기" });
    title.focus();
    fireEvent.keyDown(title, { key: "Tab" });
    expect(resume).toHaveFocus();
    fireEvent.keyDown(resume, { key: "Tab", shiftKey: true });
    expect(title).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onResume).toHaveBeenCalledOnce();
  });
});
