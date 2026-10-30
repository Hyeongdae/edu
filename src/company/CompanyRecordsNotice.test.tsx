import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckpointPanel } from "../game/CheckpointPanel";
import { companyProfile } from "../test/companyFixtures";
import { CompanyRecordsNotice } from "./CompanyRecordsNotice";
import type { CompanyRecordBinding } from "./types";

afterEach(cleanup);
const records = (): CompanyRecordBinding => ({ profile: companyProfile(), entries: [], syncStatus: "error", pendingCount: 1,
  errorMessage: "사내 저장 실패", submitResult: vi.fn(), retry: vi.fn(), refresh: vi.fn() });

describe("company save notice", () => {
  it("keeps the actual nested retry control in the checkpoint Tab loop", () => {
    const binding = records();
    render(<CheckpointPanel stage={1} score={150} remainingTimeCs={100} onContinue={vi.fn()} onQuit={vi.fn()} disabled={false}
      recordsNotice={<CompanyRecordsNotice records={binding} />} />);
    const retry = screen.getByRole("button", { name: "기록 저장 다시 시도" });
    const quit = screen.getByRole("button", { name: "그만두기" });
    retry.focus(); fireEvent.keyDown(retry, { key: "Tab", shiftKey: true }); expect(quit).toHaveFocus();
    fireEvent.keyDown(quit, { key: "Tab" }); expect(retry).toHaveFocus();
    fireEvent.click(retry); expect(binding.retry).toHaveBeenCalledOnce();
  });

  it("stops gameplay keys while leaving Tab available to the surrounding dialog", () => {
    const parent = vi.fn();
    render(<div onKeyDown={parent}><CompanyRecordsNotice records={records()} /></div>);
    const retry = screen.getByRole("button", { name: "기록 저장 다시 시도" });
    for (const key of ["d", "j", " "]) fireEvent.keyDown(retry, { key });
    expect(parent).not.toHaveBeenCalled();
    fireEvent.keyDown(retry, { key: "Tab" }); expect(parent).toHaveBeenCalledOnce();
  });

  it("offers native login navigation and no automatic retry button after session expiry", () => {
    render(<CompanyRecordsNotice records={{ ...records(), syncStatus: "auth-required" }} />);
    expect(screen.getByRole("link", { name: "회사 계정으로 다시 로그인" })).toHaveAttribute("href", expect.stringContaining("/.auth/login/aad"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
