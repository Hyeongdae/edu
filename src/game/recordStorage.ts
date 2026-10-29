export type GameRecordScope = "ascent" | "descent";

export const DESCENT_LEADERBOARD_KEY = "stair-descent:leaderboard:v2";
export const LEGACY_DESCENT_LEADERBOARD_KEY = "stair-descent:leaderboard:v1";
export const DESCENT_PROGRESS_KEY = "stair-descent:stage-progress:v1";
export const DESCENT_RESET_KEY = "stair-descent:records-reset:v1";

export interface DescentRecordPreparation { complete: boolean; }

/** Retire only the untimed descent ranking; never touch new rankings or unlocks. */
export function prepareDescentLeaderboard(storage: Storage): DescentRecordPreparation {
  try {
    if (storage.getItem(LEGACY_DESCENT_LEADERBOARD_KEY) !== null) storage.removeItem(LEGACY_DESCENT_LEADERBOARD_KEY);
    return { complete: true };
  } catch {
    return { complete: false };
  }
}

const LEGACY_RECORD_KEYS = Object.freeze([
  "stair-climb:leaderboard:v1",
  "stair-climb:leaderboard:v2",
  "stair-climb:leaderboard:v3",
  "stair-climb:leaderboard:v4",
  "stair-climb:leaderboard:v5",
  "stair-climb:stage-progress:v1",
]);

/** Retire only ascent records, once per storage; never reset descent records on retry. */
export function prepareDescentRecords(storage: Storage): DescentRecordPreparation {
  try {
    if (storage.getItem(DESCENT_RESET_KEY) === "1") return { complete: true };
  } catch {
    return { complete: false };
  }

  let complete = true;
  for (const key of LEGACY_RECORD_KEYS) {
    try {
      if (storage.getItem(key) !== null) storage.removeItem(key);
    } catch {
      complete = false;
    }
  }
  if (complete) {
    try { storage.setItem(DESCENT_RESET_KEY, "1"); } catch { complete = false; }
  }
  return { complete };
}
