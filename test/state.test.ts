import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadState, saveState, isProcessed, markProcessed } from "../src/state/file-state.js";
import type { State, StateEntry } from "../src/state/file-state.js";

const tmpDir = join(import.meta.dirname, ".tmp-state-test");
const statePath = join(tmpDir, "state.json");

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadState", () => {
  it("returns empty state when file does not exist", () => {
    const state = loadState(statePath);
    expect(state).toEqual({ version: 1, processed: {} });
  });

  it("reads existing state file", async () => {
    const existing: State = {
      version: 1,
      processed: {
        "https://example.com": {
          url: "https://example.com",
          title: "Example",
          processedAt: "2026-01-01T00:00:00.000Z",
          processor: "gemini",
          status: "success",
          reportFile: "2026-01-01-example.html",
        },
      },
    };
    const { writeFileSync } = await import("node:fs");
    writeFileSync(statePath, JSON.stringify(existing), "utf-8");

    const state = loadState(statePath);
    expect(state.processed["https://example.com"].title).toBe("Example");
  });
});

describe("saveState", () => {
  it("creates directories and writes state atomically", () => {
    const nested = join(tmpDir, "deep", "nested", "state.json");
    const state: State = { version: 1, processed: {} };
    saveState(nested, state);

    expect(existsSync(nested)).toBe(true);
    const raw = readFileSync(nested, "utf-8");
    expect(JSON.parse(raw)).toEqual(state);
  });
});

describe("isProcessed", () => {
  it("returns false for unknown URLs", () => {
    const state: State = { version: 1, processed: {} };
    expect(isProcessed(state, "https://new.com")).toBe(false);
  });

  it("returns true for known URLs", () => {
    const state: State = {
      version: 1,
      processed: {
        "https://known.com": {
          url: "https://known.com",
          title: "Known",
          processedAt: "2026-01-01T00:00:00.000Z",
          processor: "gemini",
          status: "success",
        },
      },
    };
    expect(isProcessed(state, "https://known.com")).toBe(true);
  });
});

describe("markProcessed", () => {
  it("adds entry to state immutably", () => {
    const state: State = { version: 1, processed: {} };
    const entry: StateEntry = {
      url: "https://example.com",
      title: "Example",
      processedAt: "2026-01-01T00:00:00.000Z",
      processor: "gemini",
      status: "success",
      reportFile: "2026-01-01-example.html",
    };

    const newState = markProcessed(state, entry);
    expect(newState.processed["https://example.com"]).toEqual(entry);
    expect(state.processed["https://example.com"]).toBeUndefined();
  });
});
