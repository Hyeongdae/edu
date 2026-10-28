import { InteractionStatus } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { useEffect, useState, type ReactNode } from "react";
import { loginRequest } from "./authConfig";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { accounts, inProgress, instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!instance.getActiveAccount() && accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
    }
  }, [accounts, instance]);

  const signIn = async () => {
    setLoginError(null);

    try {
      await instance.loginRedirect(loginRequest);
    } catch {
      setLoginError("로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  if (inProgress !== InteractionStatus.None) {
    return (
      <main className="auth-page" aria-busy="true">
        <section className="auth-card" aria-live="polite">
          <p className="eyebrow">회사 계정 확인</p>
          <h1>로그인 중입니다</h1>
          <p>Microsoft Entra ID 인증을 기다리고 있어요.</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">사내 전용 게임</p>
          <h1>계단 내려오기</h1>
          <p>회사 계정으로 로그인하면 게임을 시작할 수 있어요.</p>
          {loginError && <p className="message message-error" role="alert">{loginError}</p>}
          <button className="primary-button" onClick={() => void signIn()}>
            회사 계정으로 로그인
          </button>
        </section>
      </main>
    );
  }

  return children;
}
