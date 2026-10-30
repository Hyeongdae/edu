import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { GameAccount } from "../auth/gameAccount";
import { getHostedLoginUrl } from "../auth/hostedAuth";
import { CompanyRecordStore } from "./CompanyRecordStore";
import type { CompanyRecordBinding } from "./types";

interface CompanyRecordsGateProps {
  account: GameAccount;
  children: (records: CompanyRecordBinding) => ReactNode;
}

function AccountRecordsGate({ account, children }: CompanyRecordsGateProps) {
  const [store] = useState(() => new CompanyRecordStore(account.homeAccountId));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { store.start(); return () => store.stop(); }, [store]);

  if (snapshot.status === "ready") return children(snapshot.binding);
  return (
    <main className="auth-page" aria-busy={snapshot.status === "loading"}>
      <section className="auth-card" aria-live="polite">
        <h1>{snapshot.status === "loading" ? "사내 기록을 불러오고 있어요" : "사내 기록을 불러오지 못했어요"}</h1>
        {snapshot.status === "error" ? <>
          <p role="alert">{snapshot.message}</p>
          {snapshot.authRequired && <a className="primary-button" href={getHostedLoginUrl()}>회사 계정으로 다시 로그인</a>}
          <button className="primary-button" type="button" onClick={store.retry}>다시 시도</button>
        </> : <p>저장된 단계와 회사 랭킹을 확인하고 있어요.</p>}
      </section>
    </main>
  );
}

export function CompanyRecordsGate(props: CompanyRecordsGateProps) {
  return <AccountRecordsGate key={props.account.homeAccountId} {...props} />;
}
