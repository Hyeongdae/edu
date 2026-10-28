import { isClearedStage } from "./stageRules";
import type { ClearedStage } from "./types";
import { DESCENT_PROGRESS_KEY, prepareDescentRecords } from "./recordStorage";
import type { GameRecordScope } from "./recordStorage";

export interface StageProgressEntry { accountId: string; highestClearedStage: ClearedStage; }
export interface ReadStageProgressResult { highestClearedStage: ClearedStage; available: boolean; }
export interface SaveStageProgressResult { highestClearedStage: ClearedStage; saved: boolean; error?: "storage-unavailable"; }
export interface StageProgressMigrationResult { entries: StageProgressEntry[]; available: boolean; }

const STORAGE_KEY = "stair-climb:stage-progress:v1";
const LEGACY_RANKING_KEY = "stair-climb:leaderboard:v4";

function validateAccount(accountId: string): void {
  if (typeof accountId !== "string" || !accountId) throw new RangeError("accountId must be a non-empty string.");
}

function storageTarget(storage?: Storage): Storage {
  return storage ?? window.localStorage;
}

function parseArray(serialized: string | null): unknown[] {
  try {
    const parsed: unknown = serialized === null ? [] : JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readEntries(storage: Storage, key = STORAGE_KEY): Map<string, ClearedStage> {
  const entries = new Map<string, ClearedStage>();
  for (const value of parseArray(storage.getItem(key))) {
    if (typeof value !== "object" || value === null) continue;
    const entry = value as Record<string, unknown>;
    if (typeof entry.accountId !== "string" ||
      !entry.accountId || !isClearedStage(entry.highestClearedStage)) continue;
    entries.set(entry.accountId, Math.max(entries.get(entry.accountId) ?? 0, entry.highestClearedStage) as ClearedStage);
  }
  return entries;
}

function readLegacyEntries(storage: Storage): Map<string, ClearedStage> {
  const entries = new Map<string, ClearedStage>();
  for (const value of parseArray(storage.getItem(LEGACY_RANKING_KEY))) {
    if (typeof value !== "object" || value === null) continue;
    const entry = value as Record<string, unknown>;
    if (typeof entry.accountId !== "string" || !entry.accountId || typeof entry.displayName !== "string" ||
      !isClearedStage(entry.bestStage) || typeof entry.bestScore !== "number" ||
      !Number.isInteger(entry.bestScore) || entry.bestScore < 0 ||
      typeof entry.achievedAt !== "string" || Number.isNaN(Date.parse(entry.achievedAt))) continue;
    entries.set(entry.accountId, Math.max(entries.get(entry.accountId) ?? 0, entry.bestStage) as ClearedStage);
  }
  return entries;
}

function progressEntries(entries: Map<string, ClearedStage>): StageProgressEntry[] {
  return [...entries].map(([accountId, highestClearedStage]) => ({ accountId, highestClearedStage }));
}

/** Persist all known legacy clears before any later ranking reset; never remove the source. */
export function migrateLegacyStageProgress(storage?: Storage): StageProgressMigrationResult {
  let target: Storage;
  try { target = storageTarget(storage); } catch { return { entries: [], available: false }; }

  let entries = new Map<string, ClearedStage>();
  let legacy = new Map<string, ClearedStage>();
  let available = true;
  // Read both independently so a blocked source does not hide the other source's known clears.
  try { entries = readEntries(target); } catch { available = false; }
  try { legacy = readLegacyEntries(target); } catch { available = false; }
  let changed = false;
  for (const [accountId, highest] of legacy) {
    if (highest > (entries.get(accountId) ?? 0)) {
      entries.set(accountId, highest);
      changed = true;
    }
  }
  const merged = progressEntries(entries);
  // Incomplete reads must not overwrite account rows that could not be recovered.
  if (available && changed) {
    try { target.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { available = false; }
  }
  return { entries: merged, available };
}

/** Ascent reads may migrate legacy clears; descent reads use independent progress only. */
export function readStageProgress(accountId: string, storage?: Storage, scope: GameRecordScope = "ascent"): ReadStageProgressResult {
  validateAccount(accountId);
  if (scope === "descent") {
    try {
      const target = storageTarget(storage);
      prepareDescentRecords(target);
      return { highestClearedStage: readEntries(target, DESCENT_PROGRESS_KEY).get(accountId) ?? 0, available: true };
    } catch {
      return { highestClearedStage: 0, available: false };
    }
  }
  const migration = migrateLegacyStageProgress(storage);
  return { highestClearedStage: migration.entries.find((entry) => entry.accountId === accountId)?.highestClearedStage ?? 0,
    available: migration.available };
}

export function saveStageProgress(accountId: string, clearedStage: ClearedStage, storage?: Storage, scope: GameRecordScope = "ascent"): SaveStageProgressResult {
  validateAccount(accountId);
  if (!isClearedStage(clearedStage)) throw new RangeError("clearedStage must be an integer from 0 to 5.");
  let highestClearedStage = clearedStage;
  try {
    const target = storageTarget(storage);
    if (scope === "descent") prepareDescentRecords(target);
    const migration = scope === "descent"
      ? { entries: progressEntries(readEntries(target, DESCENT_PROGRESS_KEY)), available: true }
      : migrateLegacyStageProgress(target);
    const entries = new Map(migration.entries.map((entry) => [entry.accountId, entry.highestClearedStage]));
    highestClearedStage = Math.max(entries.get(accountId) ?? 0, clearedStage) as ClearedStage;
    if (!migration.available) return { highestClearedStage, saved: false, error: "storage-unavailable" };
    if ((entries.get(accountId) ?? 0) !== highestClearedStage) {
      entries.set(accountId, highestClearedStage);
      target.setItem(scope === "descent" ? DESCENT_PROGRESS_KEY : STORAGE_KEY, JSON.stringify(progressEntries(entries)));
    }
    return { highestClearedStage, saved: true };
  } catch {
    return { highestClearedStage, saved: false, error: "storage-unavailable" };
  }
}
