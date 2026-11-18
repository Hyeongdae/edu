import { describe, expect, it } from "vitest";
import { createPointCoinSeed, getCollectedPointCoinIndices, hasPointCoin, POINT_COIN_SPAWN_CHANCE } from "./coinDrops";

describe("deterministic point coin drops", () => {
  it("creates a uint32 seed from the injected random source", () => {
    expect(createPointCoinSeed(() => 0)).toBe(0);
    expect(createPointCoinSeed(() => 0.5)).toBe(0x80000000);
    expect(() => createPointCoinSeed(() => 1)).toThrow(RangeError);
  });

  it("keeps each run and stair roll stable and distributes rolls near five percent", () => {
    const seed = 0x12345678;
    const beforeRouteExtension = Array.from({ length: 100 }, (_, index) => hasPointCoin(seed, index + 1));
    const extendedRouteRead = Array.from({ length: 100 }, (_, index) => hasPointCoin(seed, index + 1));
    expect(extendedRouteRead).toEqual(beforeRouteExtension);
    const coinCount = Array.from({ length: 10_000 }, (_, index) => hasPointCoin(seed, index + 1)).filter(Boolean).length;
    expect(coinCount / 10_000).toBeGreaterThanOrEqual(0.035);
    expect(coinCount / 10_000).toBeLessThanOrEqual(0.065);
    expect(POINT_COIN_SPAWN_CHANCE).toBe(0.05);
  });

  it("collects each coin crossed once in order and skips obstacles", () => {
    const seed = 87654321;
    const expected = Array.from({ length: 100 }, (_, index) => index + 4)
      .filter((index) => hasPointCoin(seed, index));
    expect(getCollectedPointCoinIndices(seed, 3, 103)).toEqual(expected);
    expect(getCollectedPointCoinIndices(seed, 3, 103, (index) => index === expected[0])).toEqual(expected.slice(1));
    expect(() => getCollectedPointCoinIndices(seed, 3, 3)).toThrow(RangeError);
  });

  it("rejects invalid seeds and stair ranges", () => {
    expect(() => hasPointCoin(1.5, 2)).toThrow(RangeError);
    expect(() => hasPointCoin(1, -1)).toThrow(RangeError);
    expect(() => getCollectedPointCoinIndices(1, -1, 2)).toThrow(RangeError);
    expect(() => getCollectedPointCoinIndices(1, 3, 2)).toThrow(RangeError);
  });
});
