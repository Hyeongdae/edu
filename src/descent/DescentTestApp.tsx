import { useEffect, useRef, useState, type ReactElement } from "react";
import { createAudioController } from "../audio/audioController";
import { DEFAULT_AUDIO_PREFERENCES, type AudioPreferences } from "../audio/audioPreferences";
import { DescentGameScreen } from "./DescentGameScreen";
import "./descent.css";

function DescentAudioShell(): ReactElement {
  const [audioController] = useState(() => createAudioController());
  const [preferences, setPreferences] = useState(() => ({ ...DEFAULT_AUDIO_PREFERENCES }));
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const mounted = useRef(false);
  const audioAttempt = useRef(0);

  useEffect(() => {
    mounted.current = true;
    audioAttempt.current++;
    return () => {
      mounted.current = false;
      audioController.dispose();
    };
  }, [audioController]);

  useEffect(() => { audioController.setPreferences(preferences); }, [audioController, preferences]);

  const enableAudio = () => {
    const attempt = ++audioAttempt.current;
    void audioController.startBgm().then(playing => {
      if (mounted.current && attempt === audioAttempt.current) setAutoplayBlocked(!playing);
    }).catch(() => {
      if (mounted.current && attempt === audioAttempt.current) setAutoplayBlocked(true);
    });
  };
  const changePreferences = (next: AudioPreferences) => { setPreferences({ ...next }); };

  return <DescentGameScreen audioController={audioController} audioPreferences={preferences}
    autoplayBlocked={autoplayBlocked} onAudioPreferencesChange={changePreferences} onEnableAudio={enableAudio} />;
}

export function DescentTestApp({ enabled }: { enabled: boolean }): ReactElement {
  return enabled ? <DescentAudioShell /> : (
    <main className="descent-unavailable"><h1>로컬 개발 전용 테스트입니다</h1>
      <p>내려오기 테스트는 로컬 데모 개발 서버에서 실행할 수 있어요.</p></main>
  );
}
