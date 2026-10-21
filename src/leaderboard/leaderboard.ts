export interface LeaderboardEntry {
  accountId: string;
  displayName: string;
  bestScore: number;
  achievedAt: string;
}

export interface SaveBestScoreResult {
  entries: LeaderboardEntry[];
  saved: boolean;
  error?: "storage-unavailable";
}

const STORAGE_KEY = "stair-climb:leaderboard:v1";

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.accountId === "string" && entry.accountId.length > 0 &&
    typeof entry.displayName === "string" &&
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

function readFromStorage(storage: Storage): LeaderboardEntry[] {
  const serialized = storage.getItem(STORAGE_KEY);
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
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Corrupt data should not prevent a new game from starting.
    }
    return [];
  }
}

export function readLeaderboard(storage?: Storage): LeaderboardEntry[] {
  const target = storage ?? browserStorage();
  if (!target) return [];
  try {
    return readFromStorage(target);
  } catch {
    return [];
  }
}

export function getTopScores(entries: LeaderboardEntry[], limit = 10): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => b.bestScore - a.bestScore || Date.parse(a.achievedAt) - Date.parse(b.achievedAt))
    .slice(0, Math.max(0, Math.floor(limit)));
}

export function saveBestScore(
  entry: Omit<LeaderboardEntry, "achievedAt">,
  storage?: Storage,
  now = new Date(),
): SaveBestScoreResult {
  if (!Number.isInteger(entry.bestScore) || entry.bestScore < 0) {
    throw new RangeError("bestScore must be a non-negative integer.");
  }
  if (!entry.accountId) throw new RangeError("accountId must not be empty.");

  const target = storage ?? browserStorage();
  if (!target) return { entries: [], saved: false, error: "storage-unavailable" };

  let entries: LeaderboardEntry[];
  try {
    entries = readFromStorage(target);
  } catch {
    return { entries: [], saved: false, error: "storage-unavailable" };
  }

  const previous = entries.find((item) => item.accountId === entry.accountId);
  if (previous && entry.bestScore <= previous.bestScore) {
    return { entries, saved: true };
  }

  const updated: LeaderboardEntry = { ...entry, achievedAt: now.toISOString() };
  const nextEntries = previous
    ? entries.map((item) => item.accountId === entry.accountId ? updated : item)
    : [...entries, updated];

  try {
    target.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    return { entries: nextEntries, saved: true };
  } catch {
    return { entries, saved: false, error: "storage-unavailable" };
  }
}
