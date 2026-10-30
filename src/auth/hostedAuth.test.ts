import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHostedAccount, getHostedLoginUrl, parseHostedIdentity } from "./hostedAuth";

const principal = {
  identityProvider: "aad", userId: "swa-user-id", userDetails: "회사원 A", userRoles: ["anonymous", "authenticated"],
};

afterEach(() => vi.unstubAllGlobals());

describe("hosted platform identity", () => {
  it("maps only the verified platform fields to the minimal game account", () => {
    expect(parseHostedIdentity({ clientPrincipal: { ...principal, claims: [{ typ: "name", val: "ignored" }] } }))
      .toEqual({ status: "authenticated", account: { homeAccountId: "swa-user-id", username: "회사원 A", name: "회사원 A" } });
  });

  it("accepts a registered guest with the same authenticated provider contract", () => {
    expect(parseHostedIdentity({ clientPrincipal: { ...principal, userId: "guest-id", userDetails: " 게스트 " } }))
      .toMatchObject({ account: { homeAccountId: "guest-id", username: "게스트", name: "게스트" } });
  });

  it("treats an explicit null principal as signed out", () => {
    expect(parseHostedIdentity({ clientPrincipal: null })).toEqual({ status: "signed-out" });
  });

  it.each([null, [], "html", {}, { userId: "forged" }, { clientPrincipal: undefined }])(
    "rejects invalid envelopes rather than inventing a signed-out profile: %j", (value) => {
      expect(() => parseHostedIdentity(value)).toThrow("Invalid hosted identity");
    },
  );

  it.each([
    { identityProvider: "github" }, { identityProvider: "" }, { userId: "" }, { userId: " " }, { userId: 1 },
    { userId: "a".repeat(1025) }, { userDetails: " " }, { userDetails: null },
    { userRoles: ["anonymous"] }, { userRoles: "authenticated" }, { userRoles: ["authenticated", 1] },
  ])("rejects unexpected provider, identity or roles: %j", (override) => {
    expect(() => parseHostedIdentity({ clientPrincipal: { ...principal, ...override } })).toThrow();
  });

  it("fetches only the same-origin session with cookies and no cached identity", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ clientPrincipal: principal }));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    expect(await fetchHostedAccount(signal)).toMatchObject({ status: "authenticated" });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/.auth/me", {
      method: "GET", credentials: "include", cache: "no-store", mode: "same-origin", redirect: "error",
      headers: { Accept: "application/json" }, signal,
    });
  });

  it.each([401, 403, 500])("rejects HTTP%s without treating a failed read as signed out", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ clientPrincipal: null }, { status })));
    await expect(fetchHostedAccount(new AbortController().signal)).rejects.toThrow("Unable to read");
  });

  it("rejects redirected login HTML, invalid JSON and malformed identity responses", async () => {
    const responses = [new Response("<html>login</html>", { headers: { "content-type": "text/html" } }),
      new Response("invalid-json", { headers: { "content-type": "application/json" } }), Response.json({})];
    for (const response of responses) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(fetchHostedAccount(new AbortController().signal)).rejects.toThrow();
    }
  });

  it("propagates aborts so the gate can discard an obsolete request", async () => {
    const aborted = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(aborted));
    await expect(fetchHostedAccount(new AbortController().signal)).rejects.toBe(aborted);
  });
});

describe("safe hosted login return paths", () => {
  it.each(["/", "/?test=1#stage", "/game", "/game?next=https://example.com", "/%ED%9A%8C%EC%82%AC"])(
    "preserves a same-origin relative return path: %s", (path) => {
      const url = new URL(getHostedLoginUrl(path), "https://game.example");
      expect(url.origin).toBe("https://game.example");
      expect(url.pathname).toBe("/.auth/login/aad");
      expect(url.searchParams.get("post_login_redirect_uri")).toBe(path);
    },
  );

  it.each(["", "game", "https://evil.example", "//evil.example", "/\\evil", "/\n/evil", "/\u0000evil",
    "/%2fevil", "/%252fevil", "/%255cevil", "/%0a/evil", "/%7fevil", "/bad%", "/bad path"])(
    "replaces unsafe or ambiguous return paths with root: %s", (path) => {
      expect(new URL(getHostedLoginUrl(path), "https://game.example").searchParams.get("post_login_redirect_uri")).toBe("/");
    },
  );

  it("defaults to the game root", () => {
    expect(getHostedLoginUrl()).toBe("/.auth/login/aad?post_login_redirect_uri=%2F");
  });
});
