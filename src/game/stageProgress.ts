import { isClearedStage } from "./stageRules";
import type { ClearedStage } from "./types";

export interface StageProgressEntry { accountId: string; highestClearedStage: ClearedStage; }
export interface ReadStageProgressResult { highestClearedStage: ClearedStage; available: boolean; }
export interface SaveStageProgressResult { highestClearedStage: ClearedStage; saved: boolean; error?: "storage-unavailable"; }

const STORAGE_KEY = "stair-climb:stage-progress:v1";

function validateAccount(accountId: string): void {
  if (typeof accountId !== "string" || !accountId) throw new RangeError("accountId must be a non-empty string.");
}

function storageTarget(storage?: Storage): Storage {
  return storage ?? window.localStorage;
}

function readEntries(storage: Storage): Map<string, ClearedStage> {
  const serialized = storage.getItem(STORAGE_KEY);
  let parsed: unknown;
  try { parsed = serialized === null ? [] : JSON.parse(serialized); } catch { parsed = []; }
  const entries = new Map<string, ClearedStage>();
  if (!Array.isArray(parsed)) return entries;
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null || typeof entry.accountId !== "string" ||
      !entry.accountId || !isClearedStage(entry.highestClearedStage)) continue;
    entries.set(entry.accountId, Math.max(entries.get(entry.accountId) ?? 0, entry.highestClearedStage) as ClearedStage);
  }
  return entries;
}

export function readStageProgress(accountId: string, storage?: Storage): ReadStageProgressResult {
  validateAccount(accountId);
  try {
    return { highestClearedStage: readEntries(storageTarget(storage)).get(accountId) ?? 0, available: true };
  } catch {
    return { highestClearedStage: 0, available: false };
  }
}

export function saveStageProgress(accountId: string, clearedStage: ClearedStage, storage?: Storage): SaveStageProgressResult {
  validateAccount(accountId);
  if (!isClearedStage(clearedStage)) throw new RangeError("clearedStage must be an integer from 0 to 5.");
  let highestClearedStage = clearedStage;
  try {
    const target = storageTarget(storage);
    const entries = readEntries(target);
    highestClearedStage = Math.max(entries.get(accountId) ?? 0, clearedStage) as ClearedStage;
    if ((entries.get(accountId) ?? 0) !== highestClearedStage) {
      entries.set(accountId, highestClearedStage);
      target.setItem(STORAGE_KEY, JSON.stringify([...entries].map(([id, highest]) => ({ accountId: id, highestClearedStage: highest }))));
    }
    return { highestClearedStage, saved: true };
  } catch {
    return { highestClearedStage, saved: false, error: "storage-unavailable" };
  }
}
