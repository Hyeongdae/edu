import { getHostedLoginUrl } from "../auth/hostedAuth";
import type { CompanyRecordBinding } from "./types";

export function CompanyRecordsNotice({ records }: { records: CompanyRecordBinding }) {
  if (records.syncStatus === "idle" && !records.errorMessage && !records.pendingCount) return null;
  return (
    <div className="company-records-notice" onKeyDown={(event) => {
      if (["d", "j", " "].includes(event.key.toLowerCase()) || event.code === "Space") event.stopPropagation();
    }}>
      <p role="status">{records.errorMessage ?? (records.pendingCount ? `사내 기록 저장 중 · 대기 ${records.pendingCount}건` : "사내 기록을 확인하고 있어요.")}</p>
      {records.syncStatus === "auth-required" ? (
        <a href={getHostedLoginUrl()}>회사 계정으로 다시 로그인</a>
      ) : (records.syncStatus === "error" || records.errorMessage) && (
        <button type="button" onClick={records.retry}>기록 저장 다시 시도</button>
      )}
    </div>
  );
}
