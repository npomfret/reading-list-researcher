# Reading List Researcher

Watches your Safari Reading List for new URLs, researches each one using Gemini, and generates magazine-style HTML reports with two-host podcast audio — all synced via iCloud Drive.

## What it does

1. Reads new URLs from Safari's Reading List (Bookmarks.plist)
2. Fetches page content with headless Chromium (Playwright)
3. Sends content to Gemini CLI for deep research (including web search)
4. Generates a structured HTML report with summary, key points, context, and assessment
5. Generates a two-host podcast script (Alex & Sarah) and synthesizes audio via ElevenLabs
6. Writes everything to iCloud Drive so it syncs across your Macs
7. Runs every 15 minutes via launchd

## Prerequisites

- macOS with Safari
- Node.js 18+
- Python 3.12 (for TTS)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed and authenticated
- ffmpeg (`brew install ffmpeg`)
- Terminal needs **Full Disk Access** (System Settings → Privacy & Security → Full Disk Access) to read Safari's Bookmarks.plist

## Setup

```bash
# Clone
git clone git@github.com:npomfret/reading-list-researcher.git
cd reading-list-researcher

# Install Node dependencies
npm install

# Install Playwright's Chromium
npx playwright install chromium

# Create Python venv for TTS
python3.12 -m venv .venv
.venv/bin/pip install elevenlabs

# Create .env with your ElevenLabs API key
echo "ELEVENLABS_API_KEY=sk_your_key_here" > .env
```

## Configuration

Config is loaded via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) — add a `readinglist` key to `package.json` or create `.readinglistrc.json`:

| Option | Default | Description |
|---|---|---|
| `processor` | `"gemini"` | LLM processor to use |
| `batchSize` | `5` | URLs to process per run |
| `processingTimeout` | `120` | Gemini CLI timeout in seconds |
| `bookmarksPlist` | `~/Library/Safari/Bookmarks.plist` | Path to Safari bookmarks |
| `outputDir` | `~/Library/Mobile Documents/com~apple~CloudDocs/ReadingListResearcher` | iCloud Drive output dir |
| `logLevel` | `"info"` | Log level (debug/info/warn/error) |

## Running

```bash
# Development
npm run dev

# Build
npm run build

# Run built version
node dist/index.js
```

## Running on a schedule (launchd)

```bash
# Copy the plist (edit paths inside first if needed)
cp launchd/com.user.reading-list-researcher.plist ~/Library/LaunchAgents/

# Load it — runs every 15 minutes
launchctl load ~/Library/LaunchAgents/com.user.reading-list-researcher.plist

# Check status
launchctl list | grep reading-list

# Unload
launchctl unload ~/Library/LaunchAgents/com.user.reading-list-researcher.plist
```

## Multi-machine support

Multiple Macs can run this simultaneously. State is synced via iCloud Drive with a claim-before-process pattern — each machine claims a URL before processing it, preventing duplicates. Stale claims (>15 min) are automatically released.

## Output structure

```
~/Library/Mobile Documents/com~apple~CloudDocs/ReadingListResearcher/
├── index.html              # Searchable index of all reports
├── state.json              # Processing state (synced via iCloud)
└── reports/
    └── 2026-03-21-article-title/
        ├── index.html      # Magazine-style research report
        ├── podcast.md      # Two-host podcast script
        └── podcast.mp3     # Synthesized podcast audio
```

## Development

```bash
npm run lint    # Type check
npm test        # Run tests
```
