import { createRef } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameInstructionsDialog } from "./GameInstructionsDialog";

afterEach(cleanup);

describe("GameInstructionsDialog", () => {
  it("explains keyboard and mobile controls and the five-stage office challenge", () => {
    const onClose = vi.fn();
    render(<GameInstructionsDialog onClose={onClose} closeButtonRef={createRef<HTMLButtonElement>()}
      dialogRef={createRef<HTMLElement>()} onKeyDown={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "게임 설명" })).toBeVisible();
    const controls = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(controls[0]).toContain("D 한 칸 내려가기");
    expect(controls[1]).toContain("J 모퉁이에서 방향을 바꾸며 한 칸 내려가기");
    expect(controls[2]).toContain("Space 장애물을 넘어 두 칸 이동하기");
    expect(screen.getByText(/모바일에서는 화면의 내려가기, 방향 바꾸기, 점프 버튼/)).toBeVisible();
    expect(screen.getByText("5단계를 모두 클리어하고 멋지게 퇴근해봐요 화이팅! 잡히면 야근일지도..")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "게임 설명 닫기" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders every stage from the shared rules with duration, score, obstacle chance, and pursuer pace", () => {
    render(<GameInstructionsDialog onClose={vi.fn()} closeButtonRef={createRef<HTMLButtonElement>()}
      dialogRef={createRef<HTMLElement>()} onKeyDown={vi.fn()} />);

    const table = screen.getByRole("table", { name: "단계별 목표와 난이도" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(6);
    const expected = [
      ["1단계", "90초", "150점", "10%", "0.5초마다 1칸"],
      ["2단계", "75초", "200점", "20%", "0.4초마다 1칸"],
      ["3단계", "65초", "250점", "30%", "0.35초마다 1칸"],
      ["4단계", "60초", "300점", "40%", "0.3초마다 1칸"],
      ["5단계", "50초", "350점", "50%", "0.28초마다 1칸"],
    ];
    expected.forEach((values, index) => {
      expect(within(rows[index + 1]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(values.slice(1));
      expect(within(rows[index + 1]).getByRole("rowheader")).toHaveTextContent(values[0]);
    });
  });

  it("forwards keyboard events to the parent focus and Escape handler", () => {
    const onKeyDown = vi.fn();
    render(<GameInstructionsDialog onClose={vi.fn()} closeButtonRef={createRef<HTMLButtonElement>()}
      dialogRef={createRef<HTMLElement>()} onKeyDown={onKeyDown} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onKeyDown).toHaveBeenCalledOnce();
  });
});
