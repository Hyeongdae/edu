import type { GameStage } from "../game/types";
import { isGameStage } from "../game/stageRules";
import { migrateLegacyStageProgress } from "../game/stageProgress";
import { DESCENT_LEADERBOARD_KEY, prepareDescentRecords } from "../game/recordStorage";
import type { GameRecordScope } from "../game/recordStorage";

export interface LeaderboardEntry {
  accountId: string;
  displayName: string;
  bestStage: GameStage;
  bestScore: number;
  achievedAt: string;
}

export interface SaveBestScoreResult {
  entries: LeaderboardEntry[];
  saved: boolean;
  error?: "storage-unavailable";
}

const STORAGE_KEY = "stair-climb:leaderboard:v5";
const LEGACY_STORAGE_KEYS = ["stair-climb:leaderboard:v1", "stair-climb:leaderboard:v2", "stair-climb:leaderboard:v3"];

function comparePerformance(
  a: Pick<LeaderboardEntry, "bestStage" | "bestScore">,
  b: Pick<LeaderboardEntry, "bestStage" | "bestScore">,
): number {
  return b.bestStage - a.bestStage || b.bestScore - a.bestScore;
}

function clearLegacyScores(storage: Storage): void {
  const migration = migrateLegacyStageProgress(storage);
  const keys = migration.available ? [...LEGACY_STORAGE_KEYS, "stair-climb:leaderboard:v4"] : LEGACY_STORAGE_KEYS;
  for (const key of keys) {
    try {
      if (storage.getItem(key) !== null) storage.removeItem(key);
    } catch {
      // Retain the legacy source for retry; a cleanup failure must not hide valid new rankings.
    }
  }
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.accountId === "string" && entry.accountId.length > 0 &&
    typeof entry.displayName === "string" &&
    isGameStage(entry.bestStage) &&
    Number.isInteger(entry.bestScore) && (entry.bestScore as number) >= 0 &&
    typeof entry.achievedAt === "string" && !Number.isNaN(Date.parse(entry.achievedAt))
  );
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function readFromStorage(storage: Storage, scope: GameRecordScope): LeaderboardEntry[] {
  if (scope === "descent") prepareDescentRecords(storage);
  else clearLegacyScores(storage);
  const key = scope === "descent" ? DESCENT_LEADERBOARD_KEY : STORAGE_KEY;
  const serialized = storage.getItem(key);
  if (serialized === null) return [];

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed) || !parsed.every(isLeaderboardEntry)) {
      throw new Error("Invalid leaderboard data");
    }
    const unique = new Map<string, LeaderboardEntry>();
    for (const entry of parsed) unique.set(entry.accountId, entry);
    return [...unique.values()];
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Corrupt data should not prevent a new game from starting.
    }
    return [];
  }
}

export function readLeaderboard(storage?: Storage, scope: GameRecordScope = "ascent"): LeaderboardEntry[] {
  const target = storage ?? browserStorage();
  if (!target) return [];
  try {
    return readFromStorage(target, scope);
  } catch {
    return [];
  }
}

export function getTopScores(entries: LeaderboardEntry[], limit = 10): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => comparePerformance(a, b) || Date.parse(a.achievedAt) - Date.parse(b.achievedAt))
    .slice(0, Math.max(0, Math.floor(limit)));
}

export function saveBestScore(
  entry: Omit<LeaderboardEntry, "achievedAt">,
  storage?: Storage,
  now = new Date(),
  scope: GameRecordScope = "ascent",
): SaveBestScoreResult {
  if (!isGameStage(entry.bestStage)) {
    throw new RangeError("bestStage must be an integer from 1 to 5.");
  }
  if (!Number.isInteger(entry.bestScore) || entry.bestScore < 0) {
    throw new RangeError("bestScore must be a non-negative integer.");
  }
  if (typeof entry.accountId !== "string" || !entry.accountId) {
    throw new RangeError("accountId must be a non-empty string.");
  }

  const target = storage ?? browserStorage();
  if (!target) return { entries: [], saved: false, error: "storage-unavailable" };

  let entries: LeaderboardEntry[];
  try {
    entries = readFromStorage(target, scope);
  } catch {
    return { entries: [], saved: false, error: "storage-unavailable" };
  }

  const previous = entries.find((item) => item.accountId === entry.accountId);
  if (previous && comparePerformance(entry, previous) >= 0) {
    return { entries, saved: true };
  }

  const updated: LeaderboardEntry = { ...entry, achievedAt: now.toISOString() };
  const nextEntries = previous
    ? entries.map((item) => item.accountId === entry.accountId ? updated : item)
    : [...entries, updated];

  try {
    target.setItem(scope === "descent" ? DESCENT_LEADERBOARD_KEY : STORAGE_KEY, JSON.stringify(nextEntries));
    return { entries: nextEntries, saved: true };
  } catch {
    return { entries, saved: false, error: "storage-unavailable" };
  }
}
