# Task 002: Foundation + Watcher

## Status: TODO

## Goal

Set up the project scaffolding and get the Reading List watcher working end-to-end: detect new entries added to Safari's Reading List, diff against local state, and log them. No research, no reports — just reliable detection.

## What to build

1. **Project scaffolding** — tsconfig.json, src/ directory structure, npm scripts to run via tsx (no compilation step)
2. **Logger** — structured logging with winston (console transport for now, file transport later for launchd)
3. **Config loader** — load `~/.config/reading-list-agent/env` via dotenv, validate required values, export typed config object
4. **iCloud path utilities** — resolve and validate the iCloud Drive output path (`~/Library/Mobile Documents/com~apple~CloudDocs/ResearchPods/`)
5. **Plist parser** — run `plutil -convert json` on `~/Library/Safari/Bookmarks.plist`, navigate the JSON tree to extract Reading List entries (URLString, title, DateAdded)
6. **State manager** — local JSON state file at `~/.reading-list-agent/state.json` with atomic writes (write to tmp + rename). Track items as `queued | researching | generating_report | complete | failed`
7. **Watcher + reconciler** — `fs.watch` on Bookmarks.plist with 5-second debounce, plus 60-second polling interval. Both trigger reconciliation: parse plist, diff against state, log new URLs. Startup reconciliation to catch items missed while stopped.

## Implementation notes

- Run everything via `npx tsx` — no TypeScript compilation, no dist/ directory
- The project plan references `./dist/research-mcp.js` in the researcher code — that will change to `./src/research-mcp.ts` run via tsx when we get there
- State file should be created automatically on first run if it doesn't exist
- Config loader should fail fast with clear error messages for missing required values (just BRAVE_API_KEY for now)
- Watcher should handle EBUSY errors on the plist file (Safari writes atomically) with retry

## Files to create

```
tsconfig.json
src/
  index.ts              # Entry point — for now just starts watcher + logs
  watcher.ts            # fs.watch + polling + debounce
  state.ts              # JSON state manager with atomic writes
  config.ts             # Config loader (dotenv + validation)
  utils/
    plist.ts            # Bookmarks.plist parser
    icloud.ts           # iCloud Drive path resolution
    logger.ts           # Winston logger setup
```

## Verification

1. Start the watcher: `npx tsx src/index.ts`
2. Open Safari, add a URL to Reading List
3. Confirm the watcher logs the new URL within ~5 seconds (fs.watch path) or ~60 seconds (polling path)
4. Restart the watcher, confirm it does NOT re-log the same URL (state persists)
5. Add another URL while the watcher is stopped, then start it — confirm it catches the missed item on startup reconciliation

## Dependencies to install

```
npm install winston dotenv
npm install -D @types/node
```

(patchright, readability, jsdom, handlebars etc. are not needed yet)
