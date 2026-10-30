import { Fragment, useEffect, useState, type ReactNode } from "react";
import type { GameAccount } from "./gameAccount";
import { fetchHostedAccount, getHostedLoginUrl, type HostedIdentity } from "./hostedAuth";

interface HostedAuthGateProps {
  children: (account: GameAccount) => ReactNode;
}

type IdentityState = HostedIdentity | { status: "loading" | "error" };

export function HostedAuthGate({ children }: HostedAuthGateProps) {
  const [state, setState] = useState<IdentityState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void fetchHostedAccount(controller.signal).then(
      (identity) => { if (current && !controller.signal.aborted) setState(identity); },
      () => { if (current && !controller.signal.aborted) setState({ status: "error" }); },
    );
    return () => {
      current = false;
      controller.abort();
    };
  }, [attempt]);

  if (state.status === "authenticated") {
    return <Fragment key={state.account.homeAccountId}>{children(state.account)}</Fragment>;
  }

  const retry = () => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  };

  return (
    <main className="auth-page" aria-busy={state.status === "loading"}>
      <section className="auth-card" aria-live="polite">
        <p className="eyebrow">사내 전용 게임</p>
        {state.status === "loading" ? (
          <><h1>회사 계정을 확인하고 있어요</h1><p>잠시만 기다려 주세요.</p></>
        ) : state.status === "error" ? (
          <>
            <h1>로그인 정보를 확인하지 못했어요</h1>
            <p role="alert">연결 상태를 확인한 뒤 다시 시도해 주세요.</p>
            <button className="primary-button" type="button" onClick={retry}>다시 시도</button>
          </>
        ) : (
          <>
            <h1>덱스 탈출 넘버원</h1>
            <p>회사 계정으로 로그인하면 게임을 시작할 수 있어요.</p>
            <a className="primary-button" href={getHostedLoginUrl(
              window.location.pathname + window.location.search + window.location.hash,
            )}>회사 계정으로 로그인</a>
          </>
        )}
      </section>
    </main>
  );
}
