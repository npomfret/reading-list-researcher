# Task 003: Research Pipeline

## Status: IN PROGRESS

## Goal

Make the app actually research a Reading List item. One URL in, structured `ResearchOutput` JSON out. Uses Claude Agent SDK with a custom MCP server exposing browser (Patchright) and web search (Brave) tools.

## What to build

1. **Brave Search wrapper** (`src/search.ts`) — calls Brave Search API, returns `{ title, url, snippet }[]`
2. **Browser module** (`src/browser.ts`) — Patchright headless with persistent Chrome profile
3. **Content extractor** (`src/extractor.ts`) — Readability + jsdom, fallback to innerText
4. **Research MCP server** (`src/research-mcp.ts`) — stdio MCP server with `browse_url`, `web_search`, `screenshot` tools
5. **Research agent** (`src/researcher.ts`) — Claude Agent SDK orchestration with structured JSON output
6. **Wire into `src/index.ts`** — research the item, save output, update state

## Key patterns

- MCP server: follows `spike/dummy-mcp.ts` (McpServer + StdioServerTransport + zod schemas)
- SDK: follows `spike/test-sdk.ts` (query() + outputFormat + structured_output field)
- Single-item processing: no loop, process 1 item and exit

## Dependencies

```
npm install patchright @mozilla/readability jsdom zod
npm install -D @types/jsdom
```

## Verification

1. `npx tsx src/index.ts` with an unprocessed item
2. Confirm research runs (logs show MCP tool calls)
3. Confirm `ResearchOutput` JSON saved to `~/.reading-list-agent/research/`
4. Confirm state updated to "complete"
5. Run again — picks next unprocessed item
