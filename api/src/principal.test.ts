import { describe, expect, it } from "vitest";
import { ACTOR, principal } from "../test/fixtures";
import { readAuthenticatedActor } from "./principal";

describe("SWA platform principal", () => {
  it("uses the verified platform ID and Unicode name without looking at claims", () => {
    expect(readAuthenticatedActor(principal({ claims: [{ typ: "name", val: "do-not-trust-this-field" }] }))).toEqual(ACTOR);
  });

  it("accepts a registered tenant guest and bounds verified display text", () => {
    expect(readAuthenticatedActor(principal({ userId: "guest-id", userDetails: "  외부 게스트  " })))
      .toEqual({ accountId: "guest-id", displayName: "외부 게스트" });
    expect(readAuthenticatedActor(principal({ userDetails: "가".repeat(300) }))?.displayName).toHaveLength(200);
  });

  it.each([null, "", "%%%", "e30", "e30=\n", "A".repeat(16388), Buffer.from("not-json").toString("base64"),
    Buffer.from([0xff, 0xff]).toString("base64"), Buffer.from("[]").toString("base64"), Buffer.from("null").toString("base64")])(
    "rejects invalid or oversized headers without throwing: %s", (header) => {
      expect(readAuthenticatedActor(header)).toBeNull();
    },
  );

  it.each([
    { identityProvider: "github" }, { identityProvider: "" }, { userRoles: ["anonymous"] },
    { userRoles: "authenticated" }, { userRoles: ["authenticated", 1] }, { userRoles: [] },
    { userId: " " }, { userId: 123 }, { userId: "x".repeat(1025) },
    { userDetails: "" }, { userDetails: null },
  ])("rejects an unauthenticated or malformed identity: %j", (overrides) => {
    expect(readAuthenticatedActor(principal(overrides))).toBeNull();
  });
});
