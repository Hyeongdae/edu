export const POINT_COIN_SPAWN_CHANCE = 0.05;

const UINT32_RANGE = 0x1_0000_0000;

/** Consume one value from the run's injected RNG and turn it into a uint32 coin seed. */
export function createPointCoinSeed(random: () => number): number {
  if (typeof random !== "function") throw new RangeError("A random source is required.");
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Random source values must be in [0, 1).");
  }
  return Math.floor(value * UINT32_RANGE) >>> 0;
}

/** Hash a run seed and stair index to a stable, evenly distributed uint32 roll. */
function coinRoll(seed: number, stairIndex: number): number {
  let value = (seed ^ Math.imul(stairIndex + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}

export function hasPointCoin(seed: number, stairIndex: number): boolean {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) throw new RangeError("Coin seed must be a finite integer.");
  if (!Number.isSafeInteger(stairIndex) || stairIndex < 0) throw new RangeError("Stair index must be a non-negative safe integer.");
  return coinRoll(seed, stairIndex) / UINT32_RANGE < POINT_COIN_SPAWN_CHANCE;
}

export function getCollectedPointCoinIndices(
  seed: number,
  fromExclusive: number,
  toInclusive: number,
  isObstacle?: (stairIndex: number) => boolean,
): number[] {
  if (!Number.isSafeInteger(fromExclusive) || fromExclusive < 0 ||
    !Number.isSafeInteger(toInclusive) || toInclusive < 0 || fromExclusive >= toInclusive ||
    (isObstacle !== undefined && typeof isObstacle !== "function")) {
    throw new RangeError("Coin pickup range must be an increasing pair of stair indices.");
  }
  const collected: number[] = [];
  for (let index = fromExclusive + 1; index <= toInclusive; index += 1) {
    if (hasPointCoin(seed, index) && !isObstacle?.(index)) collected.push(index);
  }
  return collected;
}
