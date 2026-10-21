import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AudioControls } from "./AudioControls";
import { DEFAULT_AUDIO_PREFERENCES } from "./audioPreferences";

describe("AudioControls", () => {
  it("keeps BGM and effects volume and mute controls separate", () => {
    const onChange = vi.fn();
    render(
      <AudioControls
        preferences={DEFAULT_AUDIO_PREFERENCES}
        onChange={onChange}
        autoplayBlocked={false}
        onEnableAudio={() => {}}
      />,
    );

    fireEvent.change(screen.getByRole("slider", { name: "배경 음악 음량" }), { target: { value: "25" } });
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_AUDIO_PREFERENCES, bgmVolume: 0.25 });
    fireEvent.click(screen.getByRole("button", { name: "효과음 음소거" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_AUDIO_PREFERENCES, effectsMuted: true });
  });

  it("shows a manual start button when autoplay is blocked", () => {
    const onEnableAudio = vi.fn();
    render(
      <AudioControls
        preferences={DEFAULT_AUDIO_PREFERENCES}
        onChange={() => {}}
        autoplayBlocked
        onEnableAudio={onEnableAudio}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "음악 켜기" }));
    expect(onEnableAudio).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent(/자동 재생이 차단/);
  });
});
