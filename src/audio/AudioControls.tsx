import type { AudioPreferences } from "./audioPreferences";
import "./audio.css";

interface AudioControlsProps {
  preferences: AudioPreferences;
  onChange: (next: AudioPreferences) => void;
  autoplayBlocked: boolean;
  onEnableAudio: () => void;
}

export function AudioControls({ preferences, onChange, autoplayBlocked, onEnableAudio }: AudioControlsProps) {
  const changeVolume = (channel: "bgm" | "effects", value: number) => {
    onChange({ ...preferences, [`${channel}Volume`]: value / 100 });
  };

  const toggleMute = (channel: "bgm" | "effects") => {
    const key = channel === "bgm" ? "bgmMuted" : "effectsMuted";
    onChange({ ...preferences, [key]: !preferences[key] });
  };

  return (
    <section className="audio-controls" aria-label="오디오 설정">
      <div className="audio-controls-heading">
        <div>
          <p className="audio-eyebrow">GAME AUDIO</p>
          <strong>사운드 설정</strong>
        </div>
        {autoplayBlocked && (
          <button className="audio-enable-button" type="button" onClick={onEnableAudio}>
            음악 켜기
          </button>
        )}
      </div>
      <div className="audio-channel">
        <label htmlFor="bgm-volume">배경 음악</label>
        <input
          id="bgm-volume"
          aria-label="배경 음악 음량"
          type="range"
          min="0"
          max="100"
          value={Math.round(preferences.bgmVolume * 100)}
          onChange={(event) => changeVolume("bgm", Number(event.currentTarget.value))}
        />
        <button
          className="audio-mute-button"
          type="button"
          aria-label={preferences.bgmMuted ? "배경 음악 켜기" : "배경 음악 음소거"}
          aria-pressed={preferences.bgmMuted}
          onClick={() => toggleMute("bgm")}
        >
          {preferences.bgmMuted ? "켜기" : "음소거"}
        </button>
      </div>
      <div className="audio-channel">
        <label htmlFor="effects-volume">효과음</label>
        <input
          id="effects-volume"
          aria-label="효과음 음량"
          type="range"
          min="0"
          max="100"
          value={Math.round(preferences.effectsVolume * 100)}
          onChange={(event) => changeVolume("effects", Number(event.currentTarget.value))}
        />
        <button
          className="audio-mute-button"
          type="button"
          aria-label={preferences.effectsMuted ? "효과음 켜기" : "효과음 음소거"}
          aria-pressed={preferences.effectsMuted}
          onClick={() => toggleMute("effects")}
        >
          {preferences.effectsMuted ? "켜기" : "음소거"}
        </button>
      </div>
      {autoplayBlocked && <p className="audio-autoplay-note" role="status">브라우저에서 자동 재생이 차단됐어요. 버튼을 눌러 음악을 시작하세요.</p>}
    </section>
  );
}
