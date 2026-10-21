import { useMsal } from "@azure/msal-react";
import { AuthGate } from "./auth/AuthGate";
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

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">로그인 완료</p>
        <h1>계단 오르기</h1>
        <p>{account?.name ?? "회사 계정"}님, 환영합니다.</p>
        <p className="setup-note">게임 앱 준비 중</p>
      </section>
    </main>
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
