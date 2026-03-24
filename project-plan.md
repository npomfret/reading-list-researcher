# Reading List Research Agent — Project Plan

## Overview

A daemon that watches the macOS Apple Reading List for new entries, automatically researches each one using a headless browser and LLM, generates a podcast via NotebookLM, produces a rich HTML research report, and syncs everything to iCloud Drive for access across all devices.

## Design Decisions & Alternatives Considered

### Browser approach: Headless Chrome via Patchright ✅ (chosen)

**Chosen:** Headless Chrome using Patchright (stealth Playwright fork) with a dedicated Chrome profile directory. Invisible, no UI, runs as a background process.

**Alternatives considered:**

- **Second macOS user account:** Create a dedicated macOS user for the agent. The agent would control a visible Chrome instance in that user's session, completely hidden from the primary user via Fast User Switching. **Why not:** GUI apps on macOS need a WindowServer connection, meaning the second user must have an active login session (logged in and switched away). Adds complexity for marginal benefit. Headless mode works for the vast majority of sites. Could revisit this if we hit sites that detect headless Chrome despite Patchright's stealth patches.

- **Claude in Chrome MCPs (mcp__Claude_in_Chrome, mcp__Control_Chrome):** Use the existing Chrome MCP tools available in Cowork to control the user's real browser. **Why not:** Takes over the user's visible browser session, interrupting their work. Good for interactive use but not for a background daemon.

- **Raw Playwright (without Patchright):** Standard Playwright with Chromium. **Why not:** Many sites detect and block Playwright's default Chromium. Patchright's stealth patches handle Cloudflare, DataDome, and similar bot detection with no extra effort. The API is identical so there's no downside.

- **Puppeteer + Chrome:** Similar to Playwright but older, less maintained. **Why not:** Patchright/Playwright has better API, auto-waits, and the stealth fork exists. No reason to use Puppeteer.

### Agent runtime: Standalone TypeScript daemon ✅ (chosen)

**Chosen:** A standalone Node.js/TypeScript daemon that uses the Claude API directly with tool use for research. Runs as a launchd service.

**Alternatives considered:**

- **Claude Code as the agent runtime:** Use Claude Code CLI (with Max plan) to orchestrate everything, potentially using Claude Code skills for each phase. **Why not:** Claude Code is designed for interactive developer sessions, not long-running background daemons. The Max plan covers usage costs, but the runtime model (human-in-the-loop, terminal-based) doesn't fit a fire-and-forget daemon. However, Claude Code IS the right tool to BUILD this project — just not to BE the runtime.

- **Claude Agent SDK (`@anthropic-ai/claude-code-sdk`):** Run Claude Code programmatically as a subprocess. **Why not:** Heavier than needed. We don't need Claude Code's file editing, git, or terminal capabilities. We just need the Claude API with tool use for the research phase. Direct API usage is simpler, cheaper, and gives us full control over the tool implementations.

- **Python-based agent:** Use Python with the Anthropic Python SDK. **Why not:** User prefers TypeScript. Patchright has first-class Node.js support. The ecosystem (plist parsing, Handlebars templates, etc.) works well in Node.

### NotebookLM integration: `notebooklm-mcp-cli` ✅ (chosen to start)

**Chosen:** Start with `notebooklm-mcp-cli` package which provides both a CLI (`nlm`) and MCP server. Handles auth, notebook creation, source management, and podcast generation via browser automation.

**Alternatives considered:**

- **NotebookLM Enterprise API (official Google Cloud):** Shipped Sept 2025. Proper REST API for creating notebooks, adding sources, and a standalone Podcast API that generates audio without even needing a notebook. **Why not yet:** Requires a GCP project, IAM configuration, and the Podcast API is GA-with-allowlist (may need to request access). This is the better long-term solution — cleaner, more reliable, no browser automation fragility. Plan to migrate to this once the initial version is working. If user already has GCP set up, could start here instead.

- **`notebooklm-skill` (PleasePrompto):** Claude Code skill using Patchright to automate NotebookLM UI. **Why not:** Designed for querying existing notebooks, not creating them and adding sources. The `notebooklm-mcp-cli` is more complete — 35 tools covering the full lifecycle.

- **`notebooklm-py` (unofficial Python SDK):** Full programmatic access via undocumented Google APIs. **Why not:** Uses undocumented APIs that can break without notice. Not worth the risk for a long-running daemon.

- **Skip NotebookLM entirely, use a different TTS/podcast solution:** Generate podcasts using a local TTS model or a different API (ElevenLabs, etc.). **Why not:** NotebookLM's podcast generation is genuinely good — it creates a conversational two-host format that synthesizes information, not just reads it aloud. Hard to replicate.

### Output delivery: iCloud Drive sync ✅ (chosen)

**Chosen:** Write output files (HTML reports + MP3 podcasts) directly to `~/Library/Mobile Documents/com~apple~CloudDocs/ResearchPods/`. iCloud handles sync to all devices automatically.

**Alternatives considered:**

- **Docker container on a server:** Run a web server in Docker to host the research output. **Why not:** Overkill for serving static files. Adds infrastructure to maintain (SSL certs, domain, Docker updates). The user already has iCloud sync across all their Apple devices.

- **GitHub Pages or similar static hosting:** Push output to a git repo, serve via Pages. **Why not:** Adds complexity (git operations, deploy pipeline) for no real benefit over iCloud.

- **Local web server on the Mac:** Run nginx/caddy to serve the output folder. **Why not:** Only accessible on the local network (unless you set up tunneling). iCloud gives access everywhere.

**Known limitation of iCloud:** No API to force sync. Files sync "when macOS decides" — typically seconds to a few minutes. Large MP3 files may take longer and show as "cloud only" on other devices until opened. Acceptable for this use case.

### State coordination: Claim files in iCloud ✅ (chosen)

**Chosen:** Per-URL JSON claim files in an iCloud-synced `.state/` directory. Each machine writes a claim file before starting work, with a 15-second wait to detect conflicts.

**Alternatives considered:**

- **SQLite database in iCloud:** Single state database file. **Why not:** SQLite + cloud sync = corruption risk. Multiple machines writing to the same SQLite file through iCloud is a known bad pattern.

- **Redis or other external state store:** Centralized coordination. **Why not:** Requires infrastructure. The whole point is zero-infra.

- **Output directory as implicit state:** Just check if the output folder exists before processing. **Why not:** No way to distinguish "in progress on another machine" from "not started." Would lead to duplicate work during the processing window.

- **No coordination at all:** Accept duplicate work. **Why not:** Podcast generation takes time and API resources. Worth avoiding duplicates even if the coordination is imperfect.

**Known limitation:** iCloud sync latency means there's a small race window (~15-30 seconds) where two machines could both claim the same URL. The 15-second wait mitigates this but doesn't eliminate it. Worst case: duplicate research, second machine overwrites with identical content. Not harmful.

### Trigger mechanism: Continuous file watcher ✅ (chosen)

**Chosen:** `fs.watch` on the Bookmarks.plist file with debounce, running as a launchd daemon.

**Alternatives considered:**

- **Manual trigger ("hey Claude, process my reading list"):** User kicks off processing via Claude Code or a CLI command. **Why not:** User wants it fully automatic. Items should be researched without any manual intervention.

- **Cron job every N minutes:** Poll the plist on a schedule. **Why not:** `fs.watch` is more responsive (near-instant detection) and more efficient (no wasted cycles). Cron is a fine fallback if `fs.watch` proves unreliable with iCloud-synced plist files.

- **macOS Folder Actions / Automator:** Use native macOS automation to detect plist changes. **Why not:** Less flexible, harder to integrate with the rest of the TypeScript pipeline. `fs.watch` keeps everything in one process.

### Podcast scope: One podcast per Reading List item ✅ (chosen)

**Chosen:** Each new Reading List item gets its own research report and podcast episode.

**Alternatives considered:**

- **Daily digest podcast:** Batch all items added that day into a single podcast episode. **Could revisit:** This is actually appealing and could be added as a second mode. The daemon could do per-item research immediately, then run a daily job (e.g., 8 PM) that compiles all of that day's research into a single digest podcast. Would require a scheduler or a second launchd job.

- **Weekly summary:** Too infrequent, items lose relevance.

### LLM for research: Claude Sonnet ✅ (chosen)

**Chosen:** Claude Sonnet for the research agent. Good balance of capability and cost for a task that runs many times per day.

**Alternatives considered:**

- **Claude Opus:** Better reasoning but ~5x more expensive. The research task (read, summarize, search, compile) doesn't need Opus-level reasoning. Could use Opus for a final "editorial review" pass if quality isn't high enough with Sonnet.

- **Claude Haiku:** Cheapest but may miss nuance in source analysis and author credibility assessment. Could use for simple extraction tasks within the pipeline.

- **Gemini:** Since we're already using Google for NotebookLM, could use Gemini for research too. **Why not:** Claude is better at structured output and tool use. Keep the best tool for each job.

## Architecture

```
┌─────────────────────┐
│  Apple Reading List  │  ~/Library/Safari/Bookmarks.plist
│  (iCloud synced)     │
└────────┬────────────┘
         │ fs.watch + debounce
         ▼
┌─────────────────────┐
│   Reading List       │  Parse binary plist, diff against known state,
│   Watcher            │  emit new URLs
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   State Manager      │  Claim-based coordination via iCloud
│                      │  Prevents duplicate work across machines
└────────┬────────────┘
         │ For each unclaimed URL
         ▼
┌─────────────────────┐
│   Research Agent     │  Headless Chrome (Patchright) + Claude API
│                      │  Browse, extract, follow links, web search
└────────┬────────────┘
         │
         ├──────────────────────┐
         ▼                      ▼
┌─────────────────────┐  ┌─────────────────────┐
│  HTML Report         │  │  NotebookLM          │
│  Generator           │  │  Integration         │
│                      │  │  (podcast + storage)  │
└────────┬────────────┘  └────────┬────────────┘
         │                        │
         ▼                        ▼
┌──────────────────────────────────────────────┐
│  iCloud Drive Output                          │
│  ~/Library/Mobile Documents/                  │
│    com~apple~CloudDocs/ResearchPods/          │
└──────────────────────────────────────────────┘
```

## Tech Stack

- **Language:** TypeScript (Node.js)
- **Browser automation:** Patchright (stealth Playwright fork)
- **LLM:** Claude API via `@anthropic-ai/sdk`
- **NotebookLM:** `notebooklm-mcp-cli` package (provides both CLI `nlm` and MCP server)
- **Process manager:** launchd (macOS native daemon)
- **Package manager:** pnpm

## Project Structure

```
reading-list-agent/
├── package.json
├── tsconfig.json
├── .env                          # ANTHROPIC_API_KEY, config
├── src/
│   ├── index.ts                  # Entry point — daemon lifecycle
│   ├── watcher.ts                # Reading List file watcher + parser
│   ├── state.ts                  # Claim-based state manager
│   ├── researcher.ts             # Orchestrates research for a single URL
│   ├── browser.ts                # Patchright headless Chrome wrapper
│   ├── claude.ts                 # Claude API client with tool use
│   ├── report.ts                 # HTML report generator
│   ├── notebooklm.ts            # NotebookLM integration (MCP or API)
│   ├── podcast.ts                # Podcast generation orchestration
│   └── utils/
│       ├── plist.ts              # Binary plist parsing helpers
│       ├── icloud.ts             # iCloud Drive path resolution
│       ├── hash.ts               # URL hashing for state files
│       └── logger.ts             # Structured logging
├── templates/
│   └── report.html               # HTML report template (Handlebars or similar)
├── com.researchpods.agent.plist  # launchd daemon config
└── scripts/
    ├── install.sh                # Setup script (deps, Chrome profile, launchd)
    └── uninstall.sh
```

## Component Specifications

### 1. Reading List Watcher (`watcher.ts`)

**Purpose:** Detect new Reading List entries by monitoring the Bookmarks.plist file.

**Implementation:**

- Watch `~/Library/Safari/Bookmarks.plist` using `fs.watch` with a 5-second debounce (the file gets written multiple times per save)
- On change, run `plutil -convert json -o - ~/Library/Safari/Bookmarks.plist` to get JSON
- The Reading List lives inside the plist at a specific path. Navigate the JSON tree:
    - Root → `Children` array → find item where `Title` === `"com.apple.ReadingList"`
    - That item's `Children` array contains the Reading List entries
- Each entry has:
    - `URLString` — the URL
    - `URIDictionary.title` — the page title
    - `ReadingList.DateAdded` — when it was added
    - `ReadingList.DateLastFetched` — when Safari fetched it
    - `ReadingList.PreviewText` — snippet
- Compare entries against previous known set (keep in memory + persist to state dir)
- Emit new URLs to the processing pipeline

**Edge cases:**
- The plist is a binary plist, not XML — must use `plutil` to convert
- Safari may update the file multiple times rapidly — debounce is essential
- The file may be locked briefly during writes — retry on EBUSY

### 2. State Manager (`state.ts`)

**Purpose:** Coordinate across multiple machines to prevent duplicate research.

**Implementation:**

- State directory: `~/Library/Mobile Documents/com~apple~CloudDocs/ResearchPods/.state/`
- Each URL gets a claim file named `{sha256(url)}.json`
- Claim file schema:

```typescript
interface ClaimFile {
  url: string;
  title: string;
  machine: string;        // os.hostname()
  claimed_at: string;     // ISO 8601
  status: "claimed" | "researching" | "generating_report" | "generating_podcast" | "complete" | "failed";
  completed_at?: string;
  error?: string;
  output_dir?: string;    // relative path to output folder
}
```

- **Claim flow:**
    1. Hash the URL → check if `{hash}.json` exists in `.state/`
    2. If exists and status is not `"failed"` → skip (already claimed or done)
    3. If not exists → write claim file with status `"claimed"`
    4. Wait 15 seconds (iCloud sync window)
    5. Re-read the claim file — if `machine` still matches ours, proceed
    6. If another machine overwrote it with an earlier `claimed_at`, back off
    7. Update status as processing progresses
    8. On completion, update to `"complete"` with `completed_at` and `output_dir`
    9. On failure, update to `"failed"` with `error` message

- **Retry logic:** Failed items can be retried after a configurable interval (default 1 hour). Check if `status === "failed"` and `claimed_at` is older than the retry interval.

### 3. Browser Module (`browser.ts`)

**Purpose:** Provide a headless Chrome instance via Patchright for web browsing.

**Implementation:**

- Use `patchright` npm package (drop-in Playwright replacement with stealth)
- Launch Chrome in headless mode with a dedicated profile directory:

```typescript
import { chromium } from "patchright";

const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-blink-features=AutomationControlled",
  ],
});

const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...",
  viewport: { width: 1440, height: 900 },
});
```

- **Profile management:** Store browser profile at `~/.reading-list-agent/chrome-profile/` so cookies persist between runs (useful if you log into sites)
- **Page content extraction:**
    - Navigate to URL, wait for `networkidle`
    - Extract main content using `document.body.innerText` or a readability library
    - Capture page title, meta description, author meta tags, Open Graph data
    - Screenshot the page for potential inclusion in report
    - Extract all links from the page for potential follow-up
- **Rate limiting:** Wait 2-5 seconds between page loads to avoid triggering bot detection
- **Timeouts:** 30-second page load timeout, skip URLs that fail to load

### 4. Research Agent (`researcher.ts`)

**Purpose:** Orchestrate the full research flow for a single URL.

**Implementation:**

This is a Claude-powered agent using tool use. The agent gets a system prompt and a set of tools, then decides how to research the topic.

**System prompt for the research agent:**

```
You are a research agent. You have been given a URL that the user bookmarked.
Your job is to:
1. Read and understand the primary content at the URL
2. Identify the author and publication
3. Assess the credibility and perspective of the source
4. Follow 2-3 of the most important links from the page to get deeper context
5. Do a brief web search on the topic to find corroborating or contrasting viewpoints
6. Do a brief web search on the author to understand their background and expertise
7. Compile a structured research summary

Be thorough but not exhaustive. Aim for 10-15 minutes of research per item.
Output your findings as structured JSON matching the ResearchOutput schema.
```

**Tools available to the research agent:**

```typescript
tools: [
  {
    name: "browse_url",
    description: "Open a URL in the headless browser and extract its content",
    input_schema: { url: string }
  },
  {
    name: "web_search",
    description: "Search the web using a search engine",
    input_schema: { query: string }
  },
  {
    name: "screenshot",
    description: "Take a screenshot of the current page",
    input_schema: { url: string }
  },
  {
    name: "extract_links",
    description: "Get all links from a page, optionally filtered by relevance",
    input_schema: { url: string, filter?: string }
  }
]
```

**Research output schema:**

```typescript
interface ResearchOutput {
  url: string;
  title: string;
  date_researched: string;

  // Primary content
  summary: string;              // 2-3 paragraph summary
  key_points: string[];         // Bullet points of main takeaways
  quotes: string[];             // Notable quotes from the content

  // Source analysis
  author: {
    name: string;
    bio: string;                // What we found about them
    expertise: string;
    other_works: string[];      // Other notable things they've written
  };
  publication: {
    name: string;
    type: string;               // blog, news outlet, academic, etc.
    credibility_notes: string;
  };

  // Broader context
  related_coverage: {
    url: string;
    title: string;
    perspective: string;        // How it relates — agrees, disagrees, adds context
  }[];

  // Follow-up content from links in the article
  followed_links: {
    url: string;
    title: string;
    relevance: string;
    summary: string;
  }[];

  // Media
  screenshots: string[];        // File paths to screenshots taken
  key_images: string[];          // Important images from the page

  // Meta
  topics: string[];              // Tags/topics for categorization
  reading_time_estimate: string; // Of the original article
}
```

### 5. HTML Report Generator (`report.ts`)

**Purpose:** Generate a self-contained, visually appealing HTML research report.

**Implementation:**

- Use a template engine (Handlebars) with the `ResearchOutput` data
- The HTML file must be fully self-contained:
    - Inline CSS (clean, readable typography — think Substack/Medium style)
    - Base64-encoded images where feasible (screenshots, key images)
    - External images can use direct URLs (they'll load when the file is opened)
    - All links are absolute URLs
- Sections of the report:
    1. **Header:** Title, original URL, date researched, reading time
    2. **Summary:** The 2-3 paragraph summary
    3. **Key Takeaways:** Main points as a clean list
    4. **Notable Quotes:** Styled blockquotes
    5. **About the Author:** Author bio, expertise, other works
    6. **About the Source:** Publication info, credibility notes
    7. **Related Coverage:** Links to related articles with perspective summaries
    8. **Deep Dives:** Summaries of followed links
    9. **Topics/Tags:** For categorization
    10. **References:** Full list of all URLs visited during research
- Responsive design — should look good on iPhone, iPad, and Mac
- Dark mode support via `prefers-color-scheme` media query
- Include a link to the podcast MP3 at the top if available

### 6. NotebookLM Integration (`notebooklm.ts`)

**Purpose:** Create NotebookLM notebooks and generate podcasts.

**Implementation — Option A: `notebooklm-mcp-cli` (recommended to start):**

- Install: `uv tool install notebooklm-mcp-cli`
- Setup auth: `nlm auth login` (one-time, opens browser for Google auth)
- For each research item:
    1. Create a new notebook: `nlm notebook create --title "Research: {title}"`
    2. Add sources — the research output as text, plus the original URL
    3. Generate podcast: use the notebook's audio overview feature
    4. Download the generated audio as MP3
- Wrap CLI calls in `child_process.execFile` or use the MCP server programmatically

**Implementation — Option B: NotebookLM Enterprise API (if GCP available):**

- Requires a GCP project with the Discovery Engine API enabled
- Create notebook: `POST /v1alpha/projects/{project}/locations/{location}/notebooks`
- Add sources: `POST /v1alpha/projects/{project}/locations/{location}/notebooks/{id}/sources:batchCreate`
- The Standalone Podcast API can generate audio without even creating a notebook — just send source content and get MP3 back
- This is cleaner but requires GCP setup + may need allowlist access for the Podcast API

**Implementation — Option C: Hybrid**

- Use `notebooklm-mcp-cli` for notebook creation and source management
- Use the Enterprise Podcast API for audio generation (more reliable than UI automation)

### 7. Podcast Generator (`podcast.ts`)

**Purpose:** Generate podcast audio for the research.

**Implementation:**

- After the research phase completes, compile a "podcast source document" — a curated version of the research output optimized for audio generation. This should read like a briefing document, not raw data.
- Feed this to NotebookLM (via whichever integration method is chosen)
- Download the resulting MP3
- Save to the output directory alongside the HTML report
- The podcast source document should include:
    - A narrative summary of the content
    - Key controversies or interesting angles
    - Author background (makes for good podcast discussion)
    - Contrasting viewpoints from related coverage
    - Questions the research raised but didn't fully answer

### 8. Daemon (`index.ts`)

**Purpose:** Long-running process that ties everything together.

**Implementation:**

```typescript
async function main() {
  const logger = createLogger();
  const state = new StateManager(ICLOUD_STATE_DIR);
  const watcher = new ReadingListWatcher();
  const browser = await BrowserManager.launch();

  logger.info("Reading List Research Agent started", {
    machine: os.hostname(),
    output_dir: ICLOUD_OUTPUT_DIR,
  });

  watcher.on("new-items", async (items: ReadingListEntry[]) => {
    for (const item of items) {
      const claimed = await state.tryClaim(item.url, item.title);
      if (!claimed) {
        logger.info("Skipping (already claimed)", { url: item.url });
        continue;
      }

      try {
        // Research
        await state.updateStatus(item.url, "researching");
        const research = await runResearch(browser, item.url, item.title);

        // Generate HTML report
        await state.updateStatus(item.url, "generating_report");
        const outputDir = await generateReport(research);

        // Generate podcast
        await state.updateStatus(item.url, "generating_podcast");
        await generatePodcast(research, outputDir);

        // Done
        await state.complete(item.url, outputDir);
        logger.info("Completed", { url: item.url, output: outputDir });
      } catch (err) {
        await state.fail(item.url, err.message);
        logger.error("Failed", { url: item.url, error: err.message });
      }
    }
  });

  // Start watching
  watcher.start();

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("Shutting down...");
    watcher.stop();
    await browser.close();
    process.exit(0);
  });
}
```

## launchd Configuration

File: `com.researchpods.agent.plist`

Install to `~/Library/LaunchAgents/` and load with `launchctl load`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.researchpods.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/YOUR_USERNAME/reading-list-agent/dist/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/reading-list-agent/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/YOUR_USERNAME/Library/Logs/reading-list-agent/stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>ANTHROPIC_API_KEY</key>
        <string>your-api-key-here</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
```

## Configuration (`.env`)

```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514   # sonnet for research, saves cost

# Paths
ICLOUD_BASE=~/Library/Mobile Documents/com~apple~CloudDocs/ResearchPods
READING_LIST_PLIST=~/Library/Safari/Bookmarks.plist
CHROME_PROFILE=~/.reading-list-agent/chrome-profile

# Behavior
WATCHER_DEBOUNCE_MS=5000
CLAIM_WAIT_SECONDS=15
MAX_FOLLOWED_LINKS=3
PAGE_LOAD_TIMEOUT_MS=30000
RATE_LIMIT_DELAY_MS=3000
RETRY_FAILED_AFTER_MS=3600000

# NotebookLM (choose one)
NOTEBOOKLM_METHOD=mcp-cli          # or "enterprise-api"
# If using Enterprise API:
# GCP_PROJECT_NUMBER=123456789
# GCP_LOCATION=global
```

## Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "patchright": "latest",
    "handlebars": "^4.7.0",
    "plist": "^3.1.0",
    "sharp": "latest",
    "winston": "^3.11.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0"
  }
}
```

Note: The `plist` npm package can parse binary plists directly, which may be simpler than shelling out to `plutil`. Test both approaches — `plutil` is more reliable but requires a child process.

## Build Order

Build and test each component in isolation before wiring them together.

### Phase 1: Foundation
1. **Project scaffolding** — package.json, tsconfig, directory structure
2. **Logger** — structured logging with winston
3. **iCloud path utilities** — resolve the iCloud Drive path reliably
4. **Config loader** — parse .env, validate required values

### Phase 2: Watcher + State
5. **Plist parser** — parse Bookmarks.plist, extract Reading List entries
6. **State manager** — claim/check/complete/fail logic with iCloud state files
7. **Watcher** — fs.watch with debounce, emit new items
8. **Integration test** — add something to Reading List, verify watcher detects it and state claim works

### Phase 3: Research
9. **Browser module** — Patchright Chrome launcher, page content extraction, screenshots
10. **Claude research agent** — system prompt, tools, structured output
11. **Web search tool** — implement the `web_search` tool (can use a search API or scrape)
12. **Integration test** — give it a URL, verify it produces a complete ResearchOutput

### Phase 4: Output
13. **HTML report template** — design the report, responsive, dark mode
14. **Report generator** — render template with research data, embed images
15. **Integration test** — generate a report, open it on iPhone/Mac, verify it looks good

### Phase 5: Podcast
16. **NotebookLM setup** — install notebooklm-mcp-cli, authenticate
17. **Podcast source document generator** — transform ResearchOutput into a narrative briefing
18. **NotebookLM integration** — create notebook, add sources, trigger podcast, download MP3
19. **Integration test** — generate a podcast for a research item

### Phase 6: Daemon
20. **Wire everything together** in index.ts
21. **Error handling** — retry logic, graceful degradation (if podcast fails, still produce the report)
22. **launchd plist** — create and test the daemon config
23. **Install script** — automate setup (deps, Chrome profile, launchd registration)
24. **End-to-end test** — add a URL to Reading List, wait, verify report + podcast appear in iCloud

### Phase 7: Polish
25. **Index page** — generate a root `index.html` in the ResearchPods folder that lists all research items with links (regenerated on each new item)
26. **Notification** — send a macOS notification when research is complete (via `osascript`)
27. **Cleanup** — handle Reading List items that are removed (don't delete research, just note it)
28. **Monitoring** — log rotation, health check endpoint (optional)

## Key Technical Notes

### Apple Reading List plist structure

The Bookmarks.plist is a nested structure. The path to Reading List items is:

```
Root (dict)
  └── Children (array)
       └── [item where Title == "com.apple.ReadingList"] (dict)
            └── Children (array)
                 └── [each Reading List entry] (dict)
                      ├── URLString: "https://..."
                      ├── URIDictionary (dict)
                      │    └── title: "Page Title"
                      └── ReadingList (dict)
                           ├── DateAdded: Date
                           ├── DateLastFetched: Date
                           └── PreviewText: "snippet..."
```

### iCloud Drive path

The iCloud Drive root on macOS is:
```
~/Library/Mobile Documents/com~apple~CloudDocs/
```

This is a real filesystem path. Files written here sync automatically. There is no API to force sync — it happens when macOS decides. Typically within seconds to a few minutes.

### Patchright vs Playwright

Patchright is a fork of Playwright that adds anti-detection patches. The API is identical to Playwright. Key differences:
- Passes common bot detection (Cloudflare, DataDome, etc.)
- Uses real Chrome binary, not Chromium
- Import from `patchright` instead of `playwright`
- Everything else (selectors, waits, screenshots) works the same

### Web search implementation

For the research agent's web search capability, options:
1. **Brave Search API** — free tier available, good quality, simple REST API
2. **SerpAPI** — Google results, paid but reliable
3. **Patchright + Google** — use the headless browser to search Google directly (works but may trigger CAPTCHAs)
4. **Tavily** — built for AI agents, good structured results

Recommend Brave Search API for simplicity and cost.

### Cost estimation

Per Reading List item (rough estimates):
- Claude API (research agent): ~$0.05-0.15 (sonnet, ~10k input + 2k output tokens across several tool calls)
- Web search API: ~$0.001-0.01
- NotebookLM: free (consumer) or included in Gemini subscription
- **Total: ~$0.05-0.20 per item**

At 5 items per day, that's ~$1/day or ~$30/month.