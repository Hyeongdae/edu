import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCosmosEmulatorHarness } from "../test/cosmosEmulatorHarness";

const productionSettings = [
  "GAME_RECORDS_COSMOS_CONNECTION_STRING",
  "GAME_RECORDS_COSMOS_DATABASE",
  "GAME_RECORDS_COSMOS_CONTAINER",
  "GAME_RECORDS_CONNECTION_STRING",
  "GAME_RECORDS_TABLE",
];

beforeEach(() => {
  vi.stubEnv("COSMOS_EMULATOR_ENDPOINT", "http://127.0.0.1:8081/");
  for (const name of productionSettings) vi.stubEnv(name, undefined);
});

afterEach(() => vi.unstubAllEnvs());

describe("Cosmos emulator integration guard", () => {
  it("requires the explicit emulator endpoint", async () => {
    vi.stubEnv("COSMOS_EMULATOR_ENDPOINT", undefined);
    await expect(createCosmosEmulatorHarness()).rejects.toThrow("Set COSMOS_EMULATOR_ENDPOINT");
  });

  it.each([
    "https://company.documents.azure.com:8081/",
    "https://198.51.100.7:8081/",
    "http://localhost:8082/",
    "http://user:pass@127.0.0.1:8081/",
  ])("rejects a non-emulator endpoint: %s", async (endpoint) => {
    vi.stubEnv("COSMOS_EMULATOR_ENDPOINT", endpoint);
    await expect(createCosmosEmulatorHarness()).rejects.toThrow("local emulator gateway");
  });

  it.each(productionSettings)("refuses to run when production setting %s is present", async (name) => {
    vi.stubEnv(name, "test-only sentinel");
    await expect(createCosmosEmulatorHarness()).rejects.toThrow("refuse production record settings");
  });
});
