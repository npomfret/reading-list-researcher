import fs from "fs";
import path from "path";
import os from "os";
import { logger } from "./utils/logger.js";

export type ItemStatus = "queued" | "researching" | "generating_report" | "complete" | "failed";

export interface StateItem {
  url: string;
  title: string;
  dateAdded: string;
  status: ItemStatus;
  addedToState: string;
  publicUrl?: string;
}

export interface State {
  items: Record<string, StateItem>; // keyed by URL
}

const STATE_DIR = path.join(os.homedir(), ".reading-list-agent");
const STATE_PATH = path.join(STATE_DIR, "state.json");

function ensureStateDir(): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    logger.info(`Created state directory: ${STATE_DIR}`);
  }
}

export function loadState(): State {
  ensureStateDir();

  if (!fs.existsSync(STATE_PATH)) {
    const empty: State = { items: {} };
    saveState(empty);
    return empty;
  }

  try {
    const raw = fs.readFileSync(STATE_PATH, "utf-8");
    return JSON.parse(raw) as State;
  } catch (err: any) {
    logger.error(`Failed to read state file: ${err.message}`);
    logger.info("Starting with empty state");
    return { items: {} };
  }
}

export function saveState(state: State): void {
  ensureStateDir();

  // Atomic write: write to tmp file, then rename
  const tmpPath = STATE_PATH + `.tmp.${process.pid}`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
  fs.renameSync(tmpPath, STATE_PATH);
}

export function addItem(
  state: State,
  url: string,
  title: string,
  dateAdded: string
): boolean {
  if (state.items[url]) {
    return false; // already tracked
  }

  state.items[url] = {
    url,
    title,
    dateAdded,
    status: "queued",
    addedToState: new Date().toISOString(),
  };

  return true;
}
