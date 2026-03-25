# Reading List Researcher

Automatically researches every article in your Safari Reading List using AI, generates detailed HTML reports, and deploys them to GitHub Pages for easy sharing with NotebookLM.

## How it works

1. **Reads your Safari Reading List** — parses `~/Library/Safari/Bookmarks.plist` to find saved articles
2. **Researches each article** — uses a Claude-powered agent that browses the content, follows referenced sources, searches for context about the author and topic, and synthesises everything into structured output
3. **Generates HTML reports** — each article gets a self-contained report with summary, key takeaways, sentiment analysis, related links, and topic tags
4. **Deploys to GitHub Pages** — reports are pushed to `docs/` and served publicly, with a "Share to NotebookLM" button on each page
5. **Polls continuously** — processes all pending items then checks for new ones every 5 minutes

## Requirements

- macOS (uses Safari bookmarks and `osascript` for notifications)
- Node.js 18+
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) logged in (the research agent runs via the Claude Agent SDK)
- A [Brave Search API](https://brave.com/search/api/) key

## Setup

```bash
npm install
```

Create a `.env` file with all required variables:

```
BRAVE_API_KEY=your_brave_api_key
STATE_DIR=~/.reading-list-agent
BOOKMARKS_PLIST=~/Library/Safari/Bookmarks.plist
OUTPUT_DIR=~/Library/Mobile Documents/com~apple~CloudDocs/ResearchPods
```

To enable GitHub Pages deployment (optional), add your pages URL:

```
GITHUB_PAGES_BASE_URL=https://yourusername.github.io/your-repo-name
```

Then enable GitHub Pages on your repo (Settings > Pages) to serve from the `docs/` folder on the `master` branch. Deployment is automatically enabled when `GITHUB_PAGES_BASE_URL` is set. Each report gets a "Share to NotebookLM" button that copies the public URL and opens NotebookLM.

To explicitly disable deployment even with a URL set, add `DEPLOY_ENABLED=false`.

## Usage

```bash
# Run continuously — processes all pending items, then polls every 5 minutes
npm start

# Reset all state and output (start fresh)
npm run reset

# Type-check
npm run typecheck
```

## What the research agent does

For each article, the agent:

- Reads the full content using a headless browser with Mozilla Readability extraction
- Follows 3–5 referenced sources to deepen understanding
- Searches the web for author background, reactions, and broader context
- Produces a structured report with: summary (3–5 paragraphs), 5–10 key takeaways, sentiment/tone analysis, related links, topic tags, and research notes

## Project structure

```
src/
  index.ts          — main loop: poll reading list, process items, deploy
  researcher.ts     — Claude agent orchestration and research prompt
  research-mcp.ts   — MCP server exposing browse, search, and screenshot tools
  report.ts         — individual HTML report generation
  report-index.ts   — index page with card grid of all reports
  deploy.ts         — copy reports to docs/ and git push for GitHub Pages
  config.ts         — environment and path configuration
  state.ts          — tracks which URLs have been processed
  browser.ts        — Patchright headless browser for fetching pages
  extractor.ts      — content extraction via Mozilla Readability
  search.ts         — Brave Search API client
  utils/
    plist.ts        — Safari bookmarks plist parser
    notify.ts       — macOS notification helper
    logger.ts       — Winston logger
```

## Output

- **HTML reports** are written to iCloud Drive at `~/Library/Mobile Documents/com~apple~CloudDocs/ResearchPods/`
- **Research JSON** is stored at `~/.reading-list-agent/research/`
- **GitHub Pages** reports are deployed to `docs/` in this repo

## License

MIT — see [LICENSE](LICENSE)
