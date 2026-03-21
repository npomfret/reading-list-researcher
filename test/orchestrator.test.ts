import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const tmpDir = join(import.meta.dirname, ".tmp-orch-test");
const statePath = join(tmpDir, "state.json");
const reportsDir = join(tmpDir, "reports");

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

vi.mock("../src/watcher/safari-reading-list.js", () => ({
  parseReadingList: () => [
    {
      url: "https://example.com/article",
      title: "Test Article",
      dateAdded: new Date("2026-01-15"),
      previewText: "A test article",
    },
  ],
}));

vi.mock("../src/browser/fetch-page.js", () => ({
  fetchPage: async () => ({
    title: "Test Article",
    text: "This is the page content for testing.",
    url: "https://example.com/article",
  }),
}));

vi.mock("../src/processors/gemini.js", () => ({
  GeminiProcessor: class {
    name = "gemini";
    async process() {
      return {
        report: `# Test Article

**Source**: https://example.com/article
**Date Saved**: 2026-01-15
**Category**: tech

## Summary
This is a test summary.

## Key Points
Key point one.

## Related Context
Related context here.

## Assessment
Assessment here.`,
      };
    }
    async generate() { return "Podcast script here."; }
  },
}));

vi.mock("../src/tts/synthesize.js", () => ({
  synthesize: async () => {},
}));

describe("orchestrator", () => {
  it("processes new items and writes reports", async () => {
    const { run } = await import("../src/orchestrator.js");

    await run({
      processor: "gemini",
      batchSize: 5,
      processingTimeout: 300,
      bookmarksPlist: "/fake/path",
      outputDir: tmpDir,
      statePath,
      reportsDir,
      logLevel: "error",
    });

    // State should be written
    expect(existsSync(statePath)).toBe(true);
    const state = JSON.parse(readFileSync(statePath, "utf-8"));
    expect(state.processed["https://example.com/article"].status).toBe("success");

    // Report should be written
    const reportFile = state.processed["https://example.com/article"].reportFile;
    expect(existsSync(join(reportsDir, reportFile))).toBe(true);

    // Index should be written
    expect(existsSync(join(tmpDir, "index.html"))).toBe(true);
  });
});
