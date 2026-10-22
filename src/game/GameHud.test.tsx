import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameHud } from "./GameHud";
import { createGameState } from "./gameEngine";

describe("GameHud stage clock", () => {
  afterEach(cleanup);

  it.each([
    [90, "01:30"], [61, "01:01"], [1, "00:01"], [0, "00:00"], [-1, "00:00"],
  ])("formats %s seconds as %s without starting its own clock", (remaining, text) => {
    render(<GameHud state={createGameState()} stageSecondsLeft={remaining} eventSecondsLeft={0} scoreGain={null} scoreAnimationKey={0} />);
    expect(screen.getByRole("timer", { name: "단계 제한시간" })).toHaveAttribute("aria-live", "off");
    expect(screen.getByTestId("stage-time")).toHaveTextContent(text);
    expect(screen.getByTestId("stage-value")).toHaveTextContent("1단계");
    expect(screen.getByText("300점 달성 시 2단계")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
    expect(screen.getByLabelText("남은 기회 3회")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "이벤트 게이지" })).toHaveAttribute("aria-valuemax", "30");
  });

  it("shows an unlimited stage-two clock with the existing bonus and score feedback", () => {
    const state = { ...createGameState(), stage: 2 as const, score: 301, eventEndsAt: 31_000 };
    render(<GameHud state={state} stageSecondsLeft={null} eventSecondsLeft={22} scoreGain={2} scoreAnimationKey={1} />);
    expect(screen.getByTestId("stage-value")).toHaveTextContent("2단계");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("제한 없음");
    expect(screen.getByText("계속 도전 중")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("301");
    expect(screen.getByTestId("score-gain")).toHaveAccessibleName("2점 획득");
    expect(screen.getByTestId("event-status")).toHaveTextContent("2배 점수 · 22초");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
  });
});
