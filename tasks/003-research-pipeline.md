# Task 003: Research Pipeline

## Status: DONE (2026-03-25)

## Goal

Make the app actually research a Reading List item. One URL in, structured `ResearchOutput` JSON out. Uses Claude Agent SDK with a custom MCP server exposing browser (Patchright) and web search (Brave) tools.

## What was built

1. **Brave Search wrapper** (`src/search.ts`) — calls Brave Search API, returns `{ title, url, snippet }[]`
2. **Browser module** (`src/browser.ts`) — Patchright headless with persistent Chrome profile at `~/.reading-list-agent/chrome-profile/`
3. **Content extractor** (`src/extractor.ts`) — Readability + jsdom, fallback to innerText
4. **Research MCP server** (`src/research-mcp.ts`) — stdio MCP server with `browse_url`, `web_search`, `screenshot` tools
5. **Research agent** (`src/researcher.ts`) — Claude Agent SDK orchestration with structured `ResearchOutput` JSON output (15 turn max)
6. **Wired into `src/index.ts`** — researches item, saves output to `~/.reading-list-agent/research/<hash>.json`, updates state to complete/failed

## Notes

- Added `"type": "module"` to `package.json` (required for SDK ESM import)
- Added npm scripts: `start`, `typecheck`, `research-mcp`
- Verified end-to-end: researched a LlamaIndex docs page in ~1 minute, produced valid structured JSON
