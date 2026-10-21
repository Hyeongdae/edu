import { useMsal } from "@azure/msal-react";
import type { AccountInfo } from "@azure/msal-browser";
import { AuthGate } from "./auth/AuthGate";
import { GameScreen } from "./game/GameScreen";
import "./app.css";

interface AppProps {
  configurationError: string | null;
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

  return (
    <GameScreen account={account as AccountInfo} />
  );
}

export default function App({ configurationError }: AppProps) {
  if (configurationError) {
    return <AuthConfigurationMessage message={configurationError} />;
  }

  return (
    <AuthGate>
      <ProtectedAppShell />
    </AuthGate>
  );
}
