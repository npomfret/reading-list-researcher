# Reading List Research Agent — Project Plan

## Overview

A macOS daemon that watches Apple Reading List for new entries, researches each one using Claude Code SDK (free with Max plan) with a headless browser for content extraction, and produces a rich HTML research report synced to iCloud Drive. Podcast generation via NotebookLM is a Phase 2 addition once the core research loop is proven.

## Design Decisions

### Browser: Patchright (stealth Playwright fork)

Headless Chrome via Patchright with a persistent browser profile. Invisible, no UI, runs as a background process. Patchright's stealth patches handle Cloudflare, DataDome, and similar bot detection. The API is identical to Playwright.

**Rejected:** Raw Playwright (detected by bot protection), Puppeteer (older, less maintained), Claude-in-Chrome MCP (takes over the user's visible browser).

### Research LLM: Claude Code SDK with Max plan ($0/item)

Use `@anthropic-ai/claude-agent-sdk` to run Claude Code as a subprocess for each research task. With a Max plan, this is free — no per-token API cost. The SDK supports custom MCP servers, so we attach our own browser and search tools. It also supports structured JSON output via `outputFormat`, which gives us typed research results directly.

**Why not direct API (`@anthropic-ai/sdk`):** Costs ~$0.05-0.15 per item with Sonnet. At 5-10 items/day that's $10-45/month. The SDK is a subprocess per research task (slightly heavier), but the cost saving is significant.

**Why not Claude Code CLI via child_process:** The SDK provides a proper async generator API with typed messages, MCP server attachment, and structured output. Shelling out to `claude` would require parsing stdout.

### Runtime: Standalone TypeScript daemon

A Node.js/TypeScript daemon that uses the Claude Code SDK for research and runs as a launchd service.

**Rejected:** Python (user prefers TypeScript, Patchright has first-class Node.js support).

### Output delivery: iCloud Drive

Write HTML reports to `~/Library/Mobile Documents/com~apple~CloudDocs/ResearchPods/`. iCloud handles sync to all Apple devices automatically. No infrastructure to maintain.

**Known limitation:** No API to force sync. Files sync when macOS decides — typically seconds to a few minutes.

### State: Local JSON file (v1)

Single local JSON file tracking processed URLs by content hash. No cross-machine coordination in v1.

**Why not iCloud claim files:** iCloud is eventually consistent, not a lock service. The 15-second claim wait described in the original plan is theater — it doesn't prevent races, and duplicate processing wastes real money (LLM calls, not just CPU). Multi-machine coordination is a Phase 3 concern, and only if actually needed.

### Trigger: File watcher + polling reconciliation

`fs.watch` on Bookmarks.plist for responsiveness, plus a 60-second polling check as a safety net. Full plist diff on startup to catch anything missed while the daemon was down.

**Why both:** `fs.watch` on macOS can miss events when files are written atomically (temp file + rename), which is how Safari writes the plist. Watcher-only detection is a hint, not a guarantee. The correct model is periodic reconciliation with watcher-based acceleration.

### Content extraction: Readability library + fallbacks

Mozilla's Readability (the algorithm behind Firefox Reader View) as the primary content extractor. Falls back to `document.body.innerText`. Each extraction tagged with a quality indicator.

**Why not just innerText:** `innerText` includes navigation, ads, footers — garbage for research. Readability strips to article content. But we don't need a full "fallback ladder" (PDF handling, paywall busting, lazy-render detection) in v1 — those are known limitations, not solved problems.

### Research quality: Source-backed claims

Every summary point, quote, and author claim in the research output references a source URL. Not a full provenance graph, but enough to audit whether Claude extracted, inferred, or hallucinated.

### Web search: Brave Search API

Free tier available, simple REST API, good quality. Avoids the CAPTCHA risk of searching Google via headless Chrome. Exposed to the research agent as a custom MCP tool.

### Podcast: Deferred to Phase 2

NotebookLM's podcast generation is excellent, but `notebooklm-mcp-cli` relies on browser automation of Google's UI — exactly the kind of dependency that breaks silently and strands the whole pipeline. Ship the research loop first, add podcasts after.

### Podcast scope (Phase 2): One per item

Each Reading List item gets its own podcast episode. A daily digest mode (batch all items into one episode) is appealing and could be added as a secondary mode.

## Rejected Ideas

| Idea | Why rejected |
|------|-------------|
| **Direct Claude API (`@anthropic-ai/sdk`)** | ~$0.05-0.15/item, ~$30/month. Max plan makes SDK free. |
| **Claude Code CLI via `child_process`** | SDK provides typed async API, structured output. No stdout parsing. |
| **Claude Code as the daemon runtime** | Designed for interactive sessions, not fire-and-forget daemons. |
| **Python agent** | User prefers TypeScript. Patchright has first-class Node.js support. |
| **Raw Playwright (no Patchright)** | Detected by Cloudflare, DataDome, etc. Patchright is a drop-in replacement. |
| **Puppeteer** | Older, less maintained. No stealth fork. Playwright API is better. |
| **Claude-in-Chrome MCP** | Takes over the user's visible browser. Not suitable for background daemon. |
| **Second macOS user for visible Chrome** | Requires active login session via Fast User Switching. Overkill. |
| **`document.body.innerText` for extraction** | Includes nav, ads, footers. Readability strips to article content. |
| **Full extraction fallback ladder (PDFs, paywalls, SPAs)** | Scope creep for v1. Known limitations, not solved problems. |
| **iCloud claim files for multi-machine state** | iCloud is eventually consistent, not a lock service. 15-second wait is theater. |
| **SQLite in iCloud** | SQLite + cloud sync = corruption risk. Known bad pattern. |
| **Redis / external state store** | Requires infrastructure. Whole point is zero-infra. |
| **Cron-only trigger (no fs.watch)** | Less responsive. But polling IS included as a safety net alongside fs.watch. |
| **macOS Folder Actions / Automator** | Less flexible, harder to integrate with TypeScript pipeline. |
| **Searching Google via headless Chrome** | Will trigger CAPTCHAs in daemon context. Brave Search API is cleaner. |
| **SerpAPI** | Paid. Brave free tier is sufficient. |
| **Tavily** | Good but adds a paid dependency. Brave free tier covers the need. |
| **NotebookLM Enterprise API (for now)** | Requires GCP project + IAM setup + possible allowlist. Revisit in Phase 5. |
| **`notebooklm-py` (unofficial Python SDK)** | Undocumented APIs, can break without notice. |
| **Skip NotebookLM / use ElevenLabs TTS** | NotebookLM's conversational podcast format is uniquely good. |
| **Docker container for output hosting** | Overkill. iCloud sync handles delivery to all Apple devices. |
| **GitHub Pages** | Adds git ops and deploy pipeline for no benefit over iCloud. |
| **Local web server (nginx/caddy)** | Only works on local network. iCloud works everywhere. |
| **Daily digest podcast (v1)** | Appealing but adds complexity. Per-item first, digest mode later. |
| **Full provenance graph** | Intellectually correct, practically expensive. Source-backed claims is the middle ground. |
| **Remove items from Reading List after processing** | Risky plist manipulation. User clears manually. |

## Architecture

```
┌─────────────────────┐
│  Apple Reading List  │  ~/Library/Safari/Bookmarks.plist
│  (iCloud synced)     │
└────────┬────────────┘
         │ fs.watch + 60s polling
         ▼
┌─────────────────────┐
│   Watcher            │  Parse binary plist, diff against known state,
│   + Reconciler       │  emit new URLs
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Job Queue          │  Concurrency=1, per-stage timeouts,
│                      │  independent item processing
└────────┬────────────┘
         │ For each unprocessed URL
         ▼
┌─────────────────────┐
│   Research Agent     │  Claude Code SDK (Max plan, $0/item)
│   + MCP Tools        │  Browse, extract, follow links, web search
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  HTML Report         │  Self-contained, responsive, dark mode
│  Generator           │  Source-backed claims with citations
└────────┬────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  iCloud Drive Output                          │
│  ~/Library/Mobile Documents/                  │
│    com~apple~CloudDocs/ResearchPods/          │
└──────────────────────────────────────────────┘
```

## Tech Stack

- **Language:** TypeScript (Node.js)
- **Research LLM:** Claude Code SDK (`@anthropic-ai/claude-agent-sdk`) — free with Max plan
- **Browser automation:** Patchright (stealth Playwright fork)
- **Content extraction:** @mozilla/readability + jsdom
- **Web search:** Brave Search API (free tier)
- **Templates:** Handlebars
- **Logging:** winston
- **Process manager:** launchd (macOS native daemon)
- **Package manager:** pnpm

## Project Structure

```
reading-list-researcher/
├── package.json
├── tsconfig.json
├── .env                          # BRAVE_API_KEY, config
├── src/
│   ├── index.ts                  # Entry point — daemon lifecycle
│   ├── watcher.ts                # Reading List file watcher + polling reconciler
│   ├── state.ts                  # Local state manager (processed URLs)
│   ├── queue.ts                  # Simple job queue with timeouts
│   ├── researcher.ts             # Orchestrates research for a single URL
│   ├── browser.ts                # Patchright persistent context wrapper
│   ├── extractor.ts              # Content extraction (Readability + fallback)
│   ├── research-mcp.ts            # MCP server exposing browse/search/screenshot tools
│   ├── search.ts                 # Brave Search API wrapper
│   ├── report.ts                 # HTML report generator
│   └── utils/
│       ├── plist.ts              # Binary plist parsing helpers
│       ├── icloud.ts             # iCloud Drive path resolution
│       └── logger.ts             # Structured logging
├── templates/
│   └── report.hbs                # HTML report template
├── scripts/
│   ├── run.sh                    # Wrapper script for launchd (sources env, runs node)
│   ├── install.sh                # Setup script (deps, Chrome profile, launchd)
│   └── uninstall.sh
└── com.researchpods.agent.plist  # launchd daemon config (no secrets)
```

## Component Specifications

### 1. Reading List Watcher (`watcher.ts`)

**Purpose:** Detect new Reading List entries via file watching and periodic reconciliation.

**Implementation:**

- **Dual trigger:** `fs.watch` on `~/Library/Safari/Bookmarks.plist` with 5-second debounce, plus a 60-second `setInterval` poll. Both trigger the same reconciliation function.
- **Startup reconciliation:** On daemon start, immediately parse the plist and diff against known state. This catches anything added while the daemon was down.
- On trigger, run `plutil -convert json -o - ~/Library/Safari/Bookmarks.plist` to get JSON
- Navigate the JSON tree:
    - Root → `Children` array → find item where `Title` === `"com.apple.ReadingList"`
    - That item's `Children` array contains the Reading List entries
- Each entry has:
    - `URLString` — the URL
    - `URIDictionary.title` — the page title
    - `ReadingList.DateAdded` — when it was added
    - `ReadingList.PreviewText` — snippet
- Diff entries against state to find new URLs
- Emit new URLs to the job queue

**Edge cases:**
- Safari writes the plist atomically (temp + rename) — `fs.watch` may miss events, hence the polling fallback
- The file may be locked briefly during writes — retry on EBUSY with exponential backoff (3 attempts)
- Debounce is essential because Safari may write multiple times per save

### 2. State Manager (`state.ts`)

**Purpose:** Track which URLs have been processed, are in progress, or have failed.

**Implementation:**

- Single JSON file at `~/.reading-list-agent/state.json`
- Schema:

```typescript
interface State {
  version: 1;
  items: Record<string, StateEntry>;  // keyed by sha256(url)
}

interface StateEntry {
  url: string;
  title: string;
  status: "queued" | "researching" | "generating_report" | "complete" | "failed";
  queued_at: string;       // ISO 8601
  started_at?: string;
  completed_at?: string;
  error?: string;
  output_dir?: string;     // relative path to output folder
  retry_count: number;
}
```

- **Retry logic:** Failed items retried up to 3 times with exponential backoff (1h, 4h, 24h). After 3 failures, marked as permanently failed.
- **Atomic writes:** Write to temp file, then rename, to prevent corruption if the process dies mid-write.

### 3. Job Queue (`queue.ts`)

**Purpose:** Process items independently with timeouts, preventing one stuck item from blocking others.

**Implementation:**

- Simple in-memory queue with concurrency of 1 (can increase later)
- Per-item timeout: 10 minutes for research, 2 minutes for report generation
- Items are processed independently — a failure in one does not affect others
- On timeout, the item is marked failed and the next item starts
- **Cost controls:**
    - Maximum 20 items per hour
    - Maximum 50 items per day
    - If limits are hit, remaining items stay queued for the next window
    - These limits prevent runaway costs from bugs or plist parsing errors

### 4. Browser Module (`browser.ts`)

**Purpose:** Provide a persistent headless Chrome instance via Patchright.

**Implementation:**

- Use `patchright` with `launchPersistentContext` (not `launch` + `newContext` — the latter does not persist cookies):

```typescript
import { chromium } from "patchright";

const context = await chromium.launchPersistentContext(
  CHROME_PROFILE_DIR,
  {
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
    viewport: { width: 1440, height: 900 },
  }
);
```

- **Profile directory:** `~/.reading-list-agent/chrome-profile/` — cookies persist between runs
- **Rate limiting:** 2-5 second delay between page loads
- **Timeouts:** 30-second page load timeout, skip URLs that fail

### 5. Content Extractor (`extractor.ts`)

**Purpose:** Extract clean article content from web pages.

**Implementation:**

- **Primary:** Parse page HTML with jsdom + @mozilla/readability
- **Fallback:** `document.body.innerText` if Readability returns null
- **Metadata extraction:** title, author, description, Open Graph data, published date from meta tags
- **Link extraction:** All `<a>` hrefs from the page, filtered to same-domain or explicitly relevant
- **Quality indicator:** Each extraction tagged as:
    - `"full"` — Readability successfully extracted article content
    - `"partial"` — fell back to innerText or metadata was incomplete
    - `"failed"` — page didn't load or returned empty content

**Known v1 limitations (not addressed):**
- Paywalled content — will extract whatever is publicly visible
- PDF links — will fail, logged as known limitation
- Heavy SPA pages — Readability may not work, falls back to innerText
- Lazy-loaded content — may miss below-fold content

### 6. Research Agent (`researcher.ts`)

**Purpose:** Orchestrate the full research flow for a single URL using Claude Code SDK.

**How it works:** Each research task spawns a Claude Code subprocess via the SDK. We attach a custom MCP server that exposes our browser and search tools. The SDK's `outputFormat` option gives us typed JSON output matching our `ResearchOutput` schema directly — no parsing needed.

**Implementation:**

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function runResearch(url: string, title: string): Promise<ResearchOutput> {
  let result: ResearchOutput | null = null;

  for await (const message of query({
    prompt: `Research this bookmarked URL: ${url} ("${title}")`,
    options: {
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      maxTurns: 25,
      allowedTools: [
        "mcp__research__browse_url",
        "mcp__research__web_search",
        "mcp__research__screenshot",
      ],
      disallowedTools: ["Bash", "Write", "Edit", "Read"],  // research only, no filesystem
      mcpServers: {
        research: {
          command: "node",
          args: ["./dist/research-mcp.js"],
          env: { BRAVE_API_KEY: config.braveApiKey },
        },
      },
      outputFormat: {
        type: "json_schema",
        schema: RESEARCH_OUTPUT_SCHEMA,
      },
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      result = JSON.parse(message.result);
    }
  }

  if (!result) throw new Error("Research agent returned no result");
  return result;
}
```

**System prompt:**

```
You are a research agent. You have been given a URL that the user bookmarked.
Your job is to:
1. Read and understand the primary content at the URL
2. Identify the author and publication
3. Assess the credibility and perspective of the source
4. Follow 2-3 of the most important links from the page for deeper context
5. Search the web for corroborating or contrasting viewpoints
6. Search the web for the author's background and expertise
7. Compile a structured research summary

IMPORTANT: Every claim in your output must reference the source URL it came from.
If you cannot find information, say so — do not infer or fabricate.
Mark each field with how it was derived: "extracted" (directly from page),
"searched" (found via web search), or "unavailable" (could not determine).
```

### 6a. Research MCP Server (`research-mcp.ts`)

**Purpose:** Expose browser and search tools to the Claude Code SDK research agent.

This is a stdio MCP server that the SDK launches as a subprocess. It provides three tools:

- **`browse_url`** — navigates Patchright to a URL, extracts content via Readability, returns structured page data (title, content, author, links, extraction quality)
- **`web_search`** — queries Brave Search API, returns titles/URLs/snippets
- **`screenshot`** — takes a screenshot of a URL, saves to disk, returns the file path

**Research output schema:**

```typescript
interface Source {
  url: string;
  title: string;
  accessed_at: string;
  extraction_quality: "full" | "partial" | "failed";
}

interface SourcedClaim {
  text: string;
  source_url: string;          // which source this came from
  derivation: "extracted" | "searched" | "unavailable";
}

interface ResearchOutput {
  url: string;
  title: string;
  date_researched: string;

  // Sources visited during research
  sources: Source[];

  // Primary content
  summary: string;                    // 2-3 paragraph summary
  key_points: SourcedClaim[];         // Main takeaways with source references
  quotes: SourcedClaim[];             // Notable quotes with source references

  // Source analysis
  author: {
    name: string | null;
    bio: SourcedClaim | null;
    expertise: SourcedClaim | null;
    other_works: SourcedClaim[];
  };
  publication: {
    name: string | null;
    type: string | null;              // blog, news outlet, academic, etc.
    credibility_notes: SourcedClaim | null;
  };

  // Broader context
  related_coverage: {
    url: string;
    title: string;
    perspective: string;              // agrees, disagrees, adds context
    summary: string;
  }[];

  // Follow-up content from links in the article
  followed_links: {
    url: string;
    title: string;
    relevance: string;
    summary: string;
  }[];

  // Media
  screenshots: string[];

  // Meta
  topics: string[];
  reading_time_estimate: string;
}
```

### 7. HTML Report Generator (`report.ts`)

**Purpose:** Generate a self-contained, visually appealing HTML research report.

**Implementation:**

- Handlebars template with the `ResearchOutput` data
- Fully self-contained HTML:
    - Inline CSS (clean typography — Substack/Medium style)
    - Base64-encoded screenshots
    - All links are absolute URLs
- Responsive design — iPhone, iPad, and Mac
- Dark mode via `prefers-color-scheme`
- **Sections:**
    1. Header — title, original URL, date, reading time
    2. Summary — 2-3 paragraph overview
    3. Key Takeaways — sourced bullet points with citation links
    4. Notable Quotes — styled blockquotes with attribution
    5. About the Author — bio, expertise, other works (with sources)
    6. About the Source — publication info, credibility notes
    7. Related Coverage — contrasting/supporting articles
    8. Deep Dives — summaries of followed links
    9. Topics/Tags
    10. Sources — full list of all URLs visited during research, with extraction quality

### 8. Index Page Generator

On each new report, regenerate `ResearchPods/index.html` — a listing of all research items with links, dates, and topics. This is the entry point for browsing research on any device.

### 9. Daemon (`index.ts`)

**Purpose:** Long-running process that ties everything together.

```typescript
async function main() {
  const logger = createLogger();
  const state = new StateManager();
  const queue = new JobQueue({ concurrency: 1, maxPerHour: 20, maxPerDay: 50 });
  const browser = await BrowserManager.launch();

  logger.info("Reading List Research Agent started", {
    machine: os.hostname(),
    output_dir: ICLOUD_OUTPUT_DIR,
  });

  // Process a single item — called by the queue
  async function processItem(item: ReadingListEntry) {
    await state.updateStatus(item.url, "researching");
    const research = await runResearch(browser, item.url, item.title);

    await state.updateStatus(item.url, "generating_report");
    const outputDir = await generateReport(research);
    await regenerateIndex();

    await state.complete(item.url, outputDir);
    await notify(`Research complete: ${item.title}`);
    logger.info("Completed", { url: item.url, output: outputDir });
  }

  // Reconciliation: diff plist against state, queue new items
  async function reconcile() {
    const entries = await parseReadingList();
    const newItems = entries.filter(e => !state.isKnown(e.url));
    for (const item of newItems) {
      state.markQueued(item.url, item.title);
      queue.add(() => processItem(item));
    }
  }

  // Watcher (fast detection) + polling (safety net)
  const watcher = new ReadingListWatcher({ onTrigger: reconcile, debounceMs: 5000 });
  watcher.start();
  setInterval(reconcile, 60_000);

  // Initial reconciliation on startup
  await reconcile();

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("Shutting down...");
    watcher.stop();
    await browser.close();
    process.exit(0);
  });
}
```

### 10. Notifications

Send a macOS notification when research completes or fails:

```typescript
import { execFile } from "child_process";

function notify(message: string) {
  execFile("osascript", [
    "-e", `display notification "${message}" with title "Research Agent"`
  ]);
}
```

This is part of v1, not polish — a daemon that silently fails is worse than one that never ran.

## launchd Configuration

File: `com.researchpods.agent.plist` — points to a wrapper script, does NOT contain secrets.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.researchpods.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>INSTALL_DIR/scripts/run.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>LOG_DIR/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>LOG_DIR/stderr.log</string>
</dict>
</plist>
```

`scripts/run.sh`:
```bash
#!/bin/bash
set -euo pipefail
source "$HOME/.config/reading-list-agent/env"
exec /usr/local/bin/node "$(dirname "$0")/../dist/index.js"
```

Secrets live in `~/.config/reading-list-agent/env`, not in the plist or the repo.

## Configuration (`~/.config/reading-list-agent/env`)

```bash
# Brave Search (free tier)
BRAVE_API_KEY=BSA...

# Paths (defaults shown — override only if needed)
ICLOUD_BASE=~/Library/Mobile Documents/com~apple~CloudDocs/ResearchPods
READING_LIST_PLIST=~/Library/Safari/Bookmarks.plist
CHROME_PROFILE=~/.reading-list-agent/chrome-profile

# Behavior
WATCHER_DEBOUNCE_MS=5000
POLL_INTERVAL_MS=60000
MAX_FOLLOWED_LINKS=3
PAGE_LOAD_TIMEOUT_MS=30000
RATE_LIMIT_DELAY_MS=3000
MAX_ITEMS_PER_HOUR=20
MAX_ITEMS_PER_DAY=50
MAX_RETRIES=3
```

## Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest",
    "@anthropic-ai/sdk": "latest",
    "@modelcontextprotocol/sdk": "latest",
    "patchright": "latest",
    "@mozilla/readability": "latest",
    "jsdom": "latest",
    "handlebars": "^4.7.0",
    "winston": "^3.11.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "@types/jsdom": "latest",
    "tsx": "^4.7.0"
  }
}
```

Note: `@anthropic-ai/claude-agent-sdk` is the Claude Code SDK for spawning research agents. `@modelcontextprotocol/sdk` is for building the research MCP server that exposes our browser/search tools.

## Build Order

### Phase 1: Foundation + Watcher (get the trigger working)

1. Project scaffolding — package.json, tsconfig, directory structure
2. Logger — structured logging with winston
3. Config loader — parse env file, validate required values
4. iCloud path utilities — resolve iCloud Drive path
5. Plist parser — parse Bookmarks.plist, extract Reading List entries
6. State manager — local JSON state with atomic writes
7. Watcher + reconciler — fs.watch + polling + startup diff
8. **Verify:** Add something to Reading List, confirm watcher detects it

### Phase 2: Research (one URL in, structured data out)

9. Browser module — Patchright persistent context, page loading
10. Content extractor — Readability + innerText fallback + metadata
11. Brave Search wrapper — web search tool
12. Research MCP server — stdio server exposing browse/search/screenshot tools
13. Research agent — Claude Code SDK integration with MCP server + structured output
14. Job queue — concurrency control, timeouts, rate limits
15. **Verify:** Give it a URL, confirm it produces a complete ResearchOutput with source references

### Phase 3: Output (first visible result)

16. HTML report template — responsive, dark mode, citation links
17. Report generator — render template, embed screenshots
18. Index page generator — listing of all research items
19. macOS notifications — completion and failure alerts
20. **Verify:** Generate a report, open on iPhone/Mac, verify it looks good and citations link to real sources

### Phase 4: Daemon (wire it together)

21. Wire everything in index.ts
22. Error handling — per-item try/catch, retry logic, graceful degradation
23. Wrapper script + launchd plist (no secrets in plist)
24. Install script — deps, Chrome profile, env file template, launchd registration
25. **Verify end-to-end:** Add a URL to Reading List, wait, confirm report appears in iCloud and notification fires

### Phase 5: Podcast (after core loop is proven)

26. Evaluate NotebookLM integration options (MCP CLI vs Enterprise API)
27. Podcast source document generator — transform ResearchOutput into narrative briefing
28. NotebookLM integration — create notebook, add sources, generate audio, download MP3
29. Add podcast link to HTML report template
30. **Verify:** Generate a podcast, confirm audio quality and report linkage

### Phase 6: Multi-machine (only if needed)

31. Migrate state to iCloud-synced directory
32. Content-hash based idempotent outputs (same input = same output path)
33. Duplicate detection on output write (if output exists with matching hash, skip)

## Cost Summary

**LLM research: $0** — Claude Code SDK with Max plan, included in subscription.
**Web search: ~$0** — Brave Search API free tier (2,000 queries/month).
**NotebookLM (Phase 5): $0** — included with Gemini subscription.

The only ongoing cost is the Max plan subscription itself.

## Rate Controls

| Control | Value | Purpose |
|---------|-------|---------|
| Max items/hour | 20 | Prevent runaway processing from bugs |
| Max items/day | 50 | Protect against plist parsing errors flooding the queue |
| Max retries | 3 | Don't endlessly retry broken URLs |
| Research timeout | 10 min | Kill stuck Claude Code SDK subprocesses |
| Report timeout | 2 min | Kill stuck report generation |
| Page load timeout | 30 sec | Skip unresponsive sites |

## Known v1 Limitations

- **Paywalled content:** Extracts only publicly visible content. No paywall bypass.
- **PDFs:** Not handled. Logged as failed extraction.
- **Heavy SPAs:** Readability may not work. Falls back to innerText (noisy).
- **Single machine only:** No cross-machine coordination in v1.
- **No podcast:** Deferred to Phase 5 to de-risk the core loop.
- **iCloud sync latency:** Reports may take seconds to minutes to appear on other devices.
- **Reading List items not modified:** Processed items stay in the Reading List. User clears manually.
