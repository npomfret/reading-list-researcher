import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export interface StateEntry {
  url: string;
  title: string;
  processedAt: string;
  processor: string;
  status: "success" | "failed" | "processing";
  hostname?: string;
  reportFile?: string;
  error?: string;
}

export interface State {
  version: 1;
  processed: Record<string, StateEntry>;
}

export function loadState(path: string): State {
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as State;
  } catch {
    return { version: 1, processed: {} };
  }
}

export function saveState(path: string, state: State): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });

  const tmp = join(dir, `.state-${randomUUID()}.tmp`);
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
  renameSync(tmp, path);
}

const STALE_CLAIM_MS = 15 * 60 * 1000; // 15 minutes

export function isProcessed(state: State, url: string): boolean {
  const entry = state.processed[url];
  if (!entry) return false;
  if (entry.status === "success" || entry.status === "failed") return true;
  // "processing" — check if stale
  return !isStale(entry);
}

export function isClaimed(state: State, url: string): boolean {
  const entry = state.processed[url];
  if (!entry) return false;
  if (entry.status !== "processing") return false;
  return !isStale(entry);
}

function isStale(entry: StateEntry): boolean {
  const claimedAt = new Date(entry.processedAt).getTime();
  return Date.now() - claimedAt > STALE_CLAIM_MS;
}

export function markProcessed(state: State, entry: StateEntry): State {
  return {
    ...state,
    processed: { ...state.processed, [entry.url]: entry },
  };
}
