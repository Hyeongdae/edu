import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameHud } from "./GameHud";
import { createGameState } from "./gameEngine";
import { STAGE_RULES } from "./stageRules";

describe("GameHud stage clock", () => {
  afterEach(cleanup);

  it.each([[2, false], [2, true], [4, true]] as const)("labels a %s-point gain with explicit bonus=%s", (gain, bonus) => {
    render(<GameHud state={createGameState(() => 0)} stageSecondsLeft={90} eventSecondsLeft={0}
      scoreGain={gain} scoreGainIsBonus={bonus} scoreAnimationKey={1} />);
    expect(screen.getByTestId("score-gain")).toHaveAccessibleName(`${gain}점 획득`);
    expect(screen.getByTestId("score-gain").classList.contains("is-bonus")).toBe(bonus);
  });

  it.each([
    [90, "01:30"], [61, "01:01"], [1, "00:01"], [0, "00:00"], [-1, "00:00"],
  ])("formats %s seconds as %s without starting its own clock", (remaining, text) => {
    render(<GameHud state={createGameState()} stageSecondsLeft={remaining} eventSecondsLeft={0} scoreGain={null} scoreGainIsBonus={false} scoreAnimationKey={0} />);
    expect(screen.getByRole("timer", { name: "단계 제한시간" })).toHaveAttribute("aria-live", "off");
    expect(screen.getByTestId("stage-time")).toHaveTextContent(text);
    expect(screen.getByTestId("stage-value")).toHaveTextContent("1단계");
    expect(screen.getByText("목표 150점")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("0");
    expect(screen.queryByText("남은 기회")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "이벤트 게이지" })).toHaveAttribute("aria-valuemax", "30");
  });

  it.each(STAGE_RULES)("shows stage $stage with its timed goal", (rule) => {
    render(<GameHud state={createGameState(undefined, {stage: rule.stage, highestClearedStage: rule.stage})} stageSecondsLeft={rule.durationMs / 1000} eventSecondsLeft={0} scoreGain={null} scoreGainIsBonus={false} scoreAnimationKey={0} />);
    expect(screen.getByTestId("stage-value")).toHaveTextContent(`${rule.stage}단계`);
    const seconds = rule.durationMs / 1000;
    expect(screen.getByTestId("stage-time")).toHaveTextContent(`${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`);
    expect(screen.getByText(`목표 ${rule.scoreRequired}점`)).toBeInTheDocument();
    expect(screen.queryByText("제한 없음")).not.toBeInTheDocument();
  });

  it("shows the timed stage-two clock with the existing bonus and score feedback", () => {
    const state = { ...createGameState(() => 0, {stage: 2, highestClearedStage: 1}), score: 80, eventEndsAt: 31_000 };
    render(<GameHud state={state} stageSecondsLeft={75} eventSecondsLeft={22} scoreGain={2} scoreGainIsBonus={true} scoreAnimationKey={1} />);
    expect(screen.getByTestId("stage-value")).toHaveTextContent("2단계");
    expect(screen.getByTestId("stage-time")).toHaveTextContent("01:15");
    expect(screen.getByText("목표 200점")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("80");
    expect(screen.getByTestId("score-gain")).toHaveAccessibleName("2점 획득");
    expect(screen.getByTestId("event-status")).toHaveTextContent("2배 점수 · 22초");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
  });

  it("distinguishes final clear from a stage-five time limit", () => {
    const state = { ...createGameState(() => 0, {stage: 5, highestClearedStage: 4}), status: "game-over" as const, score: 351, endReason: "cleared" as const };
    const view = render(<GameHud state={state} stageSecondsLeft={0} eventSecondsLeft={0} scoreGain={2} scoreGainIsBonus={true} scoreAnimationKey={1} />);
    expect(screen.getByTestId("stage-time")).toHaveTextContent("클리어");
    expect(screen.getByText("모든 단계 클리어")).toBeInTheDocument();
    expect(screen.getByTestId("score-value")).toHaveTextContent("351");
    view.rerender(<GameHud state={{ ...state, endReason: "time-limit" }} stageSecondsLeft={0} eventSecondsLeft={0} scoreGain={null} scoreGainIsBonus={false} scoreAnimationKey={1} />);
    expect(screen.getByTestId("stage-time")).toHaveTextContent("00:00");
    expect(screen.getByText("목표 350점")).toBeInTheDocument();
    expect(screen.queryByText("모든 단계 클리어")).not.toBeInTheDocument();
  });

  it("shows checkpoint clear and a stage-local target without a life card", () => {
    const state = { ...createGameState(), status: "checkpoint" as const, score: 151,
      highestClearedStage: 1 as const, clearedStageThisRun: 1 as const, checkpointEnteredAt: 0 };
    render(<GameHud state={state} stageSecondsLeft={0} eventSecondsLeft={20} scoreGain={2}
      scoreGainIsBonus={true} scoreAnimationKey={1} />);
    expect(screen.getByTestId("stage-time")).toHaveTextContent("클리어");
    expect(screen.getByText("목표 150점")).toBeInTheDocument();
    expect(screen.queryByText("모든 단계 클리어")).not.toBeInTheDocument();
    expect(document.querySelector(".lives-card")).toBeNull();
  });
});
