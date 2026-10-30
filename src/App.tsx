import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import type { AccountInfo } from "@azure/msal-browser";
import { AuthGate } from "./auth/AuthGate";
import { HostedAuthGate } from "./auth/HostedAuthGate";
import type { AuthMode } from "./auth/authConfig";
import type { GameAccount } from "./auth/gameAccount";
import { CompanyRecordsGate } from "./company/CompanyRecordsGate";
import type { CompanyRecordBinding } from "./company/types";
import { GameScreen } from "./game/GameScreen";
import { createAudioController } from "./audio/audioController";
import { loadAudioPreferences, saveAudioPreferences, type AudioPreferences } from "./audio/audioPreferences";
import "./app.css";

interface AppProps {
  configurationError: string | null;
  localDemoMode?: boolean;
  authMode?: AuthMode;
}

function AuthConfigurationMessage({ message }: { message: string }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">로그인 설정 필요</p>
        <h1>Entra ID를 연결해 주세요</h1>
        <p>{message}</p>
        <p className="setup-note">
          저장소 루트의 <code>.env.example</code>을 <code>.env.local</code>로 복사해 값을
          설정한 다음 개발 서버를 다시 시작하세요.
        </p>
      </section>
    </main>
  );
}

function GameAppShell({ account, companyRecords }: { account: GameAccount; companyRecords?: CompanyRecordBinding }) {
  const [audioController] = useState(() => createAudioController());
  const [audioPreferences, setAudioPreferences] = useState(() => loadAudioPreferences());
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    audioController.setPreferences(audioPreferences);
  }, [audioController, audioPreferences]);

  useEffect(() => {
    if (!account.homeAccountId) return undefined;
    let mounted = true;
    void audioController.startBgm().then((playing) => {
      if (mounted) setAutoplayBlocked(!playing);
    });
    return () => {
      mounted = false;
      audioController.dispose();
    };
  }, [account.homeAccountId, audioController]);

  const handleAudioPreferencesChange = (next: AudioPreferences) => {
    setAudioPreferences(next);
    audioController.setPreferences(next);
    saveAudioPreferences(next);
  };

  const enableAudio = () => {
    void audioController.startBgm().then((playing) => setAutoplayBlocked(!playing));
  };

  return (
    <GameScreen
      key={account.homeAccountId}
      account={account}
      companyRecords={companyRecords}
      audioController={audioController}
      audioPreferences={audioPreferences}
      autoplayBlocked={autoplayBlocked}
      onAudioPreferencesChange={handleAudioPreferencesChange}
      onEnableAudio={enableAudio}
    />
  );
}

function ProtectedAppShell() {
  const { accounts, instance } = useMsal();
  const account = instance.getActiveAccount() ?? accounts[0];

  if (!account) {
    return (
      <main className="auth-page">
        <section className="auth-card" role="alert">
          <p className="eyebrow">계정을 확인할 수 없습니다</p>
          <h1>다시 로그인해 주세요</h1>
          <p>인증된 계정 정보를 찾지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.</p>
        </section>
      </main>
    );
  }

  return <GameAppShell key={account.homeAccountId} account={account} />;
}

const localDemoAccount: AccountInfo = {
  homeAccountId: "local-demo-account",
  environment: "local",
  tenantId: "local",
  username: "local-demo@localhost",
  localAccountId: "local-demo-account",
  name: "로컬 테스트 사용자",
};

export default function App({ configurationError, localDemoMode = false, authMode = "entra-spa" }: AppProps) {
  if (authMode === "azure-static-web-apps") {
    return <HostedAuthGate>{(account) => (
      <CompanyRecordsGate account={account}>{(records) => (
        <GameAppShell key={account.homeAccountId} account={account} companyRecords={records} />
      )}</CompanyRecordsGate>
    )}</HostedAuthGate>;
  }

  if (localDemoMode && import.meta.env.DEV) {
    return <GameAppShell key={localDemoAccount.homeAccountId} account={localDemoAccount} />;
  }

  if (configurationError) {
    return <AuthConfigurationMessage message={configurationError} />;
  }

  return (
    <AuthGate>
      <ProtectedAppShell />
    </AuthGate>
  );
}
