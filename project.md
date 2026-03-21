# Reading List Researcher — Design v3

## Overview

Safari Reading List → iCloud sync → Mac watcher detects new URLs → pluggable LLM CLI (Claude Code / Gemini / Codex) visits, analyzes, follows links → writes magazine-style HTML reports to iCloud Drive → index.html links to all reports. All state and output is flat files in iCloud Drive, visible from every Mac.

## Architecture

```
┌──────────────┐     iCloud      ┌──────────────────────────────────────┐
│  Any device  │  ──────────►    │  Mac (processor)                     │
│  Share →     │   sync          │                                      │
│  Reading List│                 │  ~/Library/Safari/Bookmarks.plist    │
└──────────────┘                 │         │                            │
                                 │         ▼                            │
                                 │  ┌─────────────┐                    │
                                 │  │  Watcher     │ every 15min       │
                                 │  │  (launchd)   │ via launchd       │
                                 │  └──────┬──────┘                    │
                                 │         │                            │
                                 │         ▼                            │
                                 │  ┌─────────────┐                    │
                                 │  │ state.json   │ iCloud Drive      │
                                 │  │ (processed)  │                    │
                                 │  └──────┬──────┘                    │
                                 │         │ new URLs                   │
                                 │         ▼                            │
                                 │  ┌─────────────┐                    │
                                 │  │ LLM CLI     │ pluggable:         │
                                 │  │ processor   │ claude/gemini/codex│
                                 │  └──────┬──────┘                    │
                                 │         │ markdown                   │
                                 │         ▼                            │
                                 │  ┌─────────────┐                    │
                                 │  │ HTML writer  │ magazine-style     │
                                 │  │ + index.html │                    │
                                 │  └─────────────┘                    │
                                 │         │                            │
                                 └─────────┼────────────────────────────┘
                                           │ iCloud Drive sync
                                           ▼
                                 ┌──────────────────┐
                                 │  All other Macs   │
                                 │  see reports via   │
                                 │  iCloud Drive      │
                                 └──────────────────┘
```

## File Layout (iCloud Drive)

```
~/Library/Mobile Documents/com~apple~CloudDocs/
└── ReadingListResearcher/
    ├── state.json                          # processed URLs tracker
    ├── index.html                          # report index with links
    └── reports/
        ├── 2026-03-21-some-article.html    # individual report
        ├── 2026-03-21-another-piece.html
        └── ...
```

Opening `index.html` in a browser gives you a browsable, searchable list of all reports. Each report is a standalone magazine-style HTML page.

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict)
- **Build**: tsup (prod), tsx (dev)
- **Package manager**: npm
- **Plist parsing**: simple-plist
- **Markdown → HTML**: marked
- **Logging**: pino
- **Config**: cosmiconfig + zod
- **Testing**: vitest
- **No database. No Docker. No server.**

## Project Structure

```
reading-list-researcher/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    # CLI entry point
│   ├── config.ts                   # config schema + loading
│   ├── watcher/
│   │   └── safari-reading-list.ts  # Bookmarks.plist parser
│   ├── state/
│   │   └── file-state.ts           # state.json read/write with lock
│   ├── processors/
│   │   ├── types.ts                # LlmProcessor interface
│   │   ├── claude.ts               # Claude Code CLI adapter
│   │   ├── gemini.ts               # Gemini CLI adapter
│   │   └── codex.ts                # Codex CLI adapter
│   ├── writers/
│   │   ├── types.ts                # ReportWriter interface
│   │   ├── html-report.ts          # magazine-style HTML generator
│   │   └── index-page.ts           # index.html generator
│   ├── prompt.ts                   # shared LLM prompt template
│   └── orchestrator.ts             # main pipeline
├── templates/
│   ├── report.html                 # report HTML template
│   └── index.html                  # index page HTML template
├── test/
│   ├── watcher.test.ts
│   ├── state.test.ts
│   └── orchestrator.test.ts
└── launchd/
    └── com.user.reading-list-researcher.plist
```

## Components

### 1. Config — `src/config.ts`

```typescript
import { z } from "zod";

const home = process.env.HOME ?? "/Users/unknown";
const icloudBase = `${home}/Library/Mobile Documents/com~apple~CloudDocs/ReadingListResearcher`;

export const ConfigSchema = z.object({
  processor: z.enum(["claude", "gemini", "codex"]).default("claude"),
  batchSize: z.number().default(5),
  processingTimeout: z.number().default(300),
  bookmarksPlist: z.string().default(`${home}/Library/Safari/Bookmarks.plist`),
  outputDir: z.string().default(icloudBase),
  statePath: z.string().default(`${icloudBase}/state.json`),
  reportsDir: z.string().default(`${icloudBase}/reports`),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;
```

### 2. Watcher — `src/watcher/safari-reading-list.ts`

```typescript
import plist from "simple-plist";

export interface ReadingListItem {
  url: string;
  title: string;
  dateAdded: Date | null;
  previewText?: string;
}

interface BookmarkNode {
  Title?: string;
  URLString?: string;
  URIDictionary?: { title?: string };
  ReadingList?: { DateAdded?: Date; PreviewText?: string };
  Children?: BookmarkNode[];
}

export function parseReadingList(plistPath: string): ReadingListItem[] {
  const data = plist.readFileSync(plistPath) as BookmarkNode;
  const items: ReadingListItem[] = [];

  const rlNode = data.Children?.find(
    (c) => c.Title === "com.apple.ReadingList"
  );
  if (!rlNode?.Children) return items;

  for (const entry of rlNode.Children) {
    const url = entry.URLString;
    if (!url) continue;
    items.push({
      url,
      title: entry.URIDictionary?.title ?? "",
      dateAdded: entry.ReadingList?.DateAdded ?? null,
      previewText: entry.ReadingList?.PreviewText,
    });
  }

  return items;
}
```

### 3. State — `src/state/file-state.ts`

Simple JSON file. Uses a write-to-temp-then-rename pattern to avoid partial writes.

```typescript
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export interface StateEntry {
  url: string;
  title: string;
  processedAt: string;
  processor: string;
  status: "success" | "failed";
  reportFile?: string;
  error?: string;
}

export interface State {
  version: 1;
  processed: Record<string, StateEntry>; // keyed by URL
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

  // Atomic write: write to temp file, then rename
  const tmp = join(dir, `.state-${randomUUID()}.tmp`);
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
  renameSync(tmp, path);
}

export function isProcessed(state: State, url: string): boolean {
  return url in state.processed;
}

export function markProcessed(state: State, entry: StateEntry): State {
  return {
    ...state,
    processed: { ...state.processed, [entry.url]: entry },
  };
}
```

### 4. Processor Interface — `src/processors/types.ts`

```typescript
export interface UrlInfo {
  url: string;
  title: string;
  dateAdded: Date | null;
}

export interface ProcessorResult {
  report: string; // markdown
}

export interface LlmProcessor {
  name: string;
  process(urlInfo: UrlInfo): Promise<ProcessorResult>;
}
```

### 5. Claude Code Adapter — `src/processors/claude.ts`

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LlmProcessor, ProcessorResult, UrlInfo } from "./types.js";
import { buildPrompt } from "../prompt.js";

const exec = promisify(execFile);

export class ClaudeProcessor implements LlmProcessor {
  name = "claude";
  constructor(private timeoutMs = 300_000) {}

  async process(urlInfo: UrlInfo): Promise<ProcessorResult> {
    const { stdout } = await exec(
      "claude",
      ["-p", buildPrompt(urlInfo), "--allowedTools", "mcp__*", "--output-format", "text"],
      { timeout: this.timeoutMs, maxBuffer: 10 * 1024 * 1024 }
    );
    return { report: stdout.trim() };
  }
}
```

### 6. Gemini CLI Adapter — `src/processors/gemini.ts`

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LlmProcessor, ProcessorResult, UrlInfo } from "./types.js";
import { buildPrompt } from "../prompt.js";

const exec = promisify(execFile);

export class GeminiProcessor implements LlmProcessor {
  name = "gemini";
  constructor(private timeoutMs = 300_000) {}

  async process(urlInfo: UrlInfo): Promise<ProcessorResult> {
    const { stdout } = await exec("gemini", ["-p", buildPrompt(urlInfo)], {
      timeout: this.timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { report: stdout.trim() };
  }
}
```

### 7. Codex Adapter — `src/processors/codex.ts`

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LlmProcessor, ProcessorResult, UrlInfo } from "./types.js";
import { buildPrompt } from "../prompt.js";

const exec = promisify(execFile);

export class CodexProcessor implements LlmProcessor {
  name = "codex";
  constructor(private timeoutMs = 300_000) {}

  async process(urlInfo: UrlInfo): Promise<ProcessorResult> {
    const { stdout } = await exec(
      "codex",
      ["--quiet", "--prompt", buildPrompt(urlInfo)],
      { timeout: this.timeoutMs, maxBuffer: 10 * 1024 * 1024 }
    );
    return { report: stdout.trim() };
  }
}
```

### 8. Prompt Template — `src/prompt.ts`

```typescript
import type { UrlInfo } from "./processors/types.js";

export function buildPrompt(urlInfo: UrlInfo): string {
  return `Visit this URL and write a research report.

URL: ${urlInfo.url}
Title: ${urlInfo.title || "Unknown"}

Instructions:
1. Visit the URL and read the full content
2. Identify the key claims, ideas, or announcements
3. Find 2-3 important outbound links or related sources and visit them
4. Write a report in EXACTLY this markdown format:

# [Title of the content]

**Source**: ${urlInfo.url}
**Date Saved**: ${urlInfo.dateAdded?.toISOString().slice(0, 10) ?? "unknown"}
**Category**: [auto-detect: tech / science / business / culture / politics / other]

## Summary
[2-3 paragraph summary of the main content]

## Key Points
[The most important takeaways, written as prose]

## Related Context
[What you found from following related links — additional context, contrasting views, background]

## Assessment
[Brief analytical take — what's significant, what's missing, what questions remain]

Output ONLY the markdown report. No preamble.`;
}
```

### 9. HTML Report Writer — `src/writers/html-report.ts`

Generates a standalone magazine-style HTML page per report. Inline CSS, no external dependencies — opens beautifully from the filesystem.

```typescript
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

export interface ReportMeta {
  title: string;
  url: string;
  date: string;
  category: string;
  slug: string;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function writeReport(
  reportsDir: string,
  meta: ReportMeta,
  markdown: string
): Promise<string> {
  mkdirSync(reportsDir, { recursive: true });

  const htmlContent = await marked(markdown);
  const filename = `${meta.date}-${meta.slug}.html`;
  const filepath = join(reportsDir, filename);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title)}</title>
  <style>
    :root {
      --bg: #fafaf9;
      --fg: #1c1917;
      --accent: #b91c1c;
      --muted: #78716c;
      --border: #e7e5e4;
      --card-bg: #ffffff;
      --max-w: 680px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1c1917;
        --fg: #fafaf9;
        --accent: #fca5a5;
        --muted: #a8a29e;
        --border: #44403c;
        --card-bg: #292524;
      }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.7;
      padding: 3rem 1.5rem;
      max-width: var(--max-w);
      margin: 0 auto;
    }

    .meta {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.8rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.5rem;
    }

    .meta a {
      color: var(--muted);
      text-decoration: underline;
      text-decoration-color: var(--border);
    }

    .category {
      display: inline-block;
      background: var(--accent);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 0.15rem 0.5rem;
      border-radius: 2px;
      margin-bottom: 1rem;
    }

    h1 {
      font-size: 2.2rem;
      line-height: 1.2;
      margin-bottom: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    h2 {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-top: 2.5rem;
      margin-bottom: 0.75rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid var(--border);
    }

    p { margin-bottom: 1.2rem; }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    blockquote {
      border-left: 3px solid var(--accent);
      padding: 0.5rem 1.2rem;
      margin: 1.5rem 0;
      font-style: italic;
      color: var(--muted);
    }

    code {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.85em;
      background: var(--card-bg);
      padding: 0.15em 0.35em;
      border-radius: 3px;
      border: 1px solid var(--border);
    }

    pre {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
      margin: 1.2rem 0;
    }

    pre code {
      border: none;
      background: none;
      padding: 0;
    }

    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2rem 0;
    }

    .back-link {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.85rem;
      margin-bottom: 2rem;
      display: block;
    }

    ul, ol { margin-bottom: 1.2rem; padding-left: 1.5rem; }
    li { margin-bottom: 0.3rem; }
  </style>
</head>
<body>
  <a class="back-link" href="../index.html">&larr; All Reports</a>
  <div class="category">${escapeHtml(meta.category)}</div>
  <div class="meta">
    ${escapeHtml(meta.date)} &middot;
    <a href="${escapeHtml(meta.url)}">Original source</a>
  </div>
  <article>
    ${htmlContent}
  </article>
</body>
</html>`;

  writeFileSync(filepath, html, "utf-8");
  return filename;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

### 10. Index Page Generator — `src/writers/index-page.ts`

Regenerated on every run. Lists all reports, newest first, searchable via a tiny JS filter.

```typescript
import { writeFileSync, readdirSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { State } from "../state/file-state.js";

export function regenerateIndex(outputDir: string, state: State): void {
  mkdirSync(outputDir, { recursive: true });

  const entries = Object.values(state.processed)
    .filter((e) => e.status === "success" && e.reportFile)
    .sort((a, b) => b.processedAt.localeCompare(a.processedAt));

  const rows = entries
    .map(
      (e) => `
      <tr class="entry" data-title="${escapeHtml(e.title.toLowerCase())}">
        <td class="date">${e.processedAt.slice(0, 10)}</td>
        <td><a href="reports/${escapeHtml(e.reportFile!)}">${escapeHtml(e.title || e.url)}</a></td>
        <td class="source"><a href="${escapeHtml(e.url)}">source</a></td>
      </tr>`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reading List Research</title>
  <style>
    :root {
      --bg: #fafaf9;
      --fg: #1c1917;
      --accent: #b91c1c;
      --muted: #78716c;
      --border: #e7e5e4;
      --card-bg: #ffffff;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1c1917;
        --fg: #fafaf9;
        --accent: #fca5a5;
        --muted: #a8a29e;
        --border: #44403c;
        --card-bg: #292524;
      }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.6;
      padding: 3rem 1.5rem;
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      font-size: 1.8rem;
      font-weight: 700;
      margin-bottom: 0.3rem;
    }

    .subtitle {
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }

    .search {
      width: 100%;
      padding: 0.6rem 1rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
      background: var(--card-bg);
      color: var(--fg);
      outline: none;
    }

    .search:focus { border-color: var(--accent); }

    table { width: 100%; border-collapse: collapse; }

    th {
      text-align: left;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      padding: 0.5rem 0;
      border-bottom: 2px solid var(--border);
    }

    td {
      padding: 0.65rem 0;
      border-bottom: 1px solid var(--border);
      font-size: 0.95rem;
    }

    .date {
      color: var(--muted);
      font-size: 0.85rem;
      white-space: nowrap;
      width: 100px;
    }

    .source {
      width: 60px;
      text-align: right;
    }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .source a {
      font-size: 0.8rem;
      color: var(--muted);
    }

    .count {
      color: var(--muted);
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <h1>Reading List Research</h1>
  <p class="subtitle">${entries.length} reports</p>
  <input class="search" type="text" placeholder="Filter reports..." id="search">
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Report</th>
        <th></th>
      </tr>
    </thead>
    <tbody id="entries">
      ${rows}
    </tbody>
  </table>
  <script>
    const search = document.getElementById('search');
    const entries = document.querySelectorAll('.entry');
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      entries.forEach(e => {
        e.style.display = e.dataset.title.includes(q) ? '' : 'none';
      });
    });
  </script>
</body>
</html>`;

  writeFileSync(join(outputDir, "index.html"), html, "utf-8");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

### 11. Orchestrator — `src/orchestrator.ts`

```typescript
import pino from "pino";
import type { Config } from "./config.js";
import { parseReadingList } from "./watcher/safari-reading-list.js";
import { loadState, saveState, isProcessed, markProcessed } from "./state/file-state.js";
import type { LlmProcessor } from "./processors/types.js";
import { ClaudeProcessor } from "./processors/claude.js";
import { GeminiProcessor } from "./processors/gemini.js";
import { CodexProcessor } from "./processors/codex.js";
import { writeReport, slugify } from "./writers/html-report.js";
import { regenerateIndex } from "./writers/index-page.js";

function createProcessor(config: Config): LlmProcessor {
  const timeout = config.processingTimeout * 1000;
  switch (config.processor) {
    case "claude":  return new ClaudeProcessor(timeout);
    case "gemini":  return new GeminiProcessor(timeout);
    case "codex":   return new CodexProcessor(timeout);
  }
}

export async function run(config: Config) {
  const log = pino({ level: config.logLevel });
  const processor = createProcessor(config);

  let state = loadState(config.statePath);
  const allItems = parseReadingList(config.bookmarksPlist);
  const newItems = allItems.filter((item) => !isProcessed(state, item.url));

  log.info({ total: allItems.length, new: newItems.length }, "Scan complete");
  if (newItems.length === 0) return;

  const batch = newItems.slice(0, config.batchSize);
  log.info({ count: batch.length }, "Processing batch");

  for (const item of batch) {
    const title = item.title || item.url;
    try {
      log.info({ url: item.url }, "Processing");
      const result = await processor.process(item);

      // Extract category from the markdown (rough parse)
      const categoryMatch = result.report.match(/\*\*Category\*\*:\s*(.+)/i);
      const category = categoryMatch?.[1]?.trim() ?? "uncategorized";
      const date = new Date().toISOString().slice(0, 10);
      const slug = slugify(title);

      const reportFile = await writeReport(config.reportsDir, {
        title, url: item.url, date, category, slug,
      }, result.report);

      state = markProcessed(state, {
        url: item.url,
        title,
        processedAt: new Date().toISOString(),
        processor: processor.name,
        status: "success",
        reportFile,
      });

      // Save state after each successful item (crash resilience)
      saveState(config.statePath, state);
      log.info({ url: item.url }, "Done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ url: item.url, error: msg }, "Failed");

      state = markProcessed(state, {
        url: item.url,
        title,
        processedAt: new Date().toISOString(),
        processor: processor.name,
        status: "failed",
        error: msg,
      });
      saveState(config.statePath, state);
    }
  }

  // Regenerate index after all processing
  regenerateIndex(config.outputDir, state);
  log.info("Index regenerated");
}
```

### 12. Entry Point — `src/index.ts`

```typescript
#!/usr/bin/env node
import { cosmiconfig } from "cosmiconfig";
import { ConfigSchema } from "./config.js";
import { run } from "./orchestrator.js";

async function main() {
  const explorer = cosmiconfig("readinglist");
  const result = await explorer.search();
  const config = ConfigSchema.parse(result?.config ?? {});
  await run(config);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

### 13. package.json

```json
{
  "name": "reading-list-researcher",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "reading-list-researcher": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "cosmiconfig": "^9.0.0",
    "marked": "^12.0.0",
    "pino": "^9.0.0",
    "simple-plist": "^1.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

### 14. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

### 15. launchd Agent

`launchd/com.user.reading-list-researcher.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.reading-list-researcher</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/YOU/reading-list-researcher/dist/index.js</string>
    </array>
    <key>StartInterval</key>
    <integer>900</integer>
    <key>StandardOutPath</key>
    <string>/tmp/reading-list-researcher.out</string>
    <key>StandardErrorPath</key>
    <string>/tmp/reading-list-researcher.err</string>
    <key>RunAtLoad</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>/Users/YOU</string>
    </dict>
</dict>
</plist>
```

## Configuration

`~/.readinglistrc.json`:

```json
{
  "processor": "claude",
  "batchSize": 5,
  "processingTimeout": 300,
  "logLevel": "info"
}
```

## Setup

1. Grant **Full Disk Access** to Terminal (or node) in System Settings → Privacy & Security
2. `git clone ... && cd reading-list-researcher`
3. `npm install && npm run build`
4. Create `~/.readinglistrc.json`
5. Test: `npm run dev`
6. Install launchd agent (update paths in plist first):
   ```bash
   cp launchd/com.user.reading-list-researcher.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.user.reading-list-researcher.plist
   ```
7. Verify: `launchctl list | grep reading-list`

## Open Questions

1. **iCloud sync latency**: state.json and reports sync to other Macs via iCloud. Typically fast (seconds to minutes) but not guaranteed. Reports may appear on other Macs with a slight delay.

2. **Conflict on state.json**: If you accidentally run the processor on two Macs simultaneously, one write wins. The atomic rename helps prevent corruption, but you could lose a few entries. Mitigation: only install the launchd agent on one Mac.

3. **Retry failed URLs**: Currently marked as failed and skipped forever. Worth adding a retry-after-24h mechanism?

4. **LLM CLI flags**: The exact CLI flags for claude/gemini/codex may need tuning. The processor adapters are intentionally thin so you can adjust easily.

5. **Report quality**: The magazine CSS supports dark mode, good typography, and mobile. But the LLM output quality depends heavily on the prompt and which tool you use. Worth A/B testing processors on the same URLs initially.