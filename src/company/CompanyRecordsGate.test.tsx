import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "../game/GameScreen";
import { companyProfile, deferred } from "../test/companyFixtures";
import { CompanyRecordsGate } from "./CompanyRecordsGate";

const account = { homeAccountId: "employee-a", username: "company-user", name: "회사원 A" };
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function enterSelection() {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  fireEvent.click(screen.getByRole("button", { name: "게임 시작" }));
}

describe("company profile bootstrap gate", () => {
  it("restores stage-three selection from the server before creating a game, without reading local game records", async () => {
    localStorage.setItem("stair-descent:progress:v2", "old demo data");
    const read = vi.spyOn(Storage.prototype, "getItem");
    const fetcher = vi.fn((path: string) => Promise.resolve(Response.json(path === "/api/profile"
      ? companyProfile({ highestClearedStage: 2 }) : { entries: [] })));
    vi.stubGlobal("fetch", fetcher);
    render(<StrictMode><CompanyRecordsGate account={account}>{(records) => <GameScreen account={account} companyRecords={records} />}</CompanyRecordsGate></StrictMode>);
    expect(screen.queryByRole("button", { name: "게임 시작" })).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "게임 시작" }); enterSelection();
    expect(screen.getByRole("button", { name: "3단계 선택" })).toHaveAttribute("aria-pressed", "true");
    expect(read.mock.calls.every(([key]) => key.startsWith("stair-descent:company:production:pending:v1:"))).toBe(true);
  });

  it("does not invent an empty official profile after a failed read, and retries successfully", async () => {
    let profileReads = 0;
    vi.stubGlobal("fetch", vi.fn((path: string) => Promise.resolve(Response.json(path === "/api/profile"
      ? (++profileReads === 1 ? {} : companyProfile({ highestClearedStage: 2 })) : { entries: [] }))));
    render(<CompanyRecordsGate account={account}>{(records) => <GameScreen account={account} companyRecords={records} />}</CompanyRecordsGate>);
    fireEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    await screen.findByRole("button", { name: "게임 시작" }); enterSelection();
    expect(screen.getByRole("button", { name: "3단계 선택" })).toBeEnabled();
    expect(profileReads).toBe(2);
  });

  it("offers login rather than game access for an expired session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    render(<CompanyRecordsGate account={account}>{() => <p>Unsafe game</p>}</CompanyRecordsGate>);
    expect(await screen.findByRole("link", { name: "회사 계정으로 다시 로그인" })).toBeVisible();
    expect(screen.queryByText("Unsafe game")).not.toBeInTheDocument();
  });

  it("unmounts the old account while loading another account and restores only that account's progress", async () => {
    const second = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn((path: string, init: RequestInit) => path === "/api/leaderboard"
      ? Promise.resolve(Response.json({ entries: [] })) : (init.headers as Record<string, string>)["X-Game-Account"] === "employee-a"
        ? Promise.resolve(Response.json(companyProfile({ highestClearedStage: 2 }))) : second.promise));
    const child = (records: Parameters<Parameters<typeof CompanyRecordsGate>[0]["children"]>[0]) => (
      <p>{records.profile.accountId}: cleared {records.profile.highestClearedStage}</p>
    );
    const view = render(<CompanyRecordsGate account={account}>{child}</CompanyRecordsGate>);
    await screen.findByText("employee-a: cleared 2");
    view.rerender(<CompanyRecordsGate account={{ ...account, homeAccountId: "employee-b" }}>{child}</CompanyRecordsGate>);
    expect(screen.queryByText("employee-a: cleared 2")).not.toBeInTheDocument();
    await act(async () => second.resolve(Response.json(companyProfile({ accountId: "employee-b" }))));
    expect(await screen.findByText("employee-b: cleared 0")).toBeVisible();
  });

  it("aborts bootstrap requests on unmount and ignores late data", async () => {
    const late = deferred<Response>();
    const fetcher = vi.fn(() => late.promise);
    vi.stubGlobal("fetch", fetcher);
    const child = vi.fn(() => <p>Game</p>);
    const view = render(<CompanyRecordsGate account={account}>{child}</CompanyRecordsGate>);
    view.unmount();
    expect((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
    await act(async () => late.resolve(Response.json(companyProfile())));
    await waitFor(() => expect(child).not.toHaveBeenCalled());
  });
});
