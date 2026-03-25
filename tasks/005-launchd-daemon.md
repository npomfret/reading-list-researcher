# Task 005: launchd Daemon

## Status: TODO

## Goal

Run the researcher automatically via launchd. Keep the single-item-per-run model — launchd calls `npm start` every 2 minutes. Add retry logic for failed items and crash recovery for stuck items.

## Design decision

The original project plan called for a full daemon (fs.watch, job queue, rate limiting). A launchd interval runner is dramatically simpler and sufficient for the workload (~1-5 items/day). launchd handles scheduling, crash recovery, and restarts. No watcher, no queue, no long-running process.

## What to build

### 0. PID lockfile (`src/index.ts`)

Prevent overlapping runs. On startup, check `~/.reading-list-agent/agent.pid` — if the PID is still alive (`process.kill(pid, 0)`), exit 0. If stale (process dead / `ESRCH`), take over. Clean up on exit via `process.on('exit')` + signal handlers.

### 1. Retry + crash recovery (`src/state.ts`)

Add to `StateItem`: `retryCount`, `lastAttempt`, `failedReason`

New helpers:
- `recoverStuckItems(state)` — items stuck in "researching"/"generating_report" → mark failed
- `getNextItem(state, entries)` — new items first, then failed items eligible for retry (retryCount < 3, exponential backoff: 2^n minutes capped at 30)
- `isRateLimited(state)` — >20 items/hour or >50/day → true

### 2. Config (`src/config.ts`)

Add `maxRetries`, `maxItemsPerHour`, `maxItemsPerDay`

### 3. Rewire entry point (`src/index.ts`)

- Recover stuck items on startup
- Check rate limits
- Use `getNextItem()` for item selection
- Track `lastAttempt` and `failedReason`
- Exit 0 on item failure (not 1 — launchd treats non-zero as crash)

### 4. File logging (`src/utils/logger.ts`)

Add file transport: `~/.reading-list-agent/logs/agent.log` (5MB, 3 rotated)

### 5. launchd infrastructure

- `scripts/run.sh` — wrapper that cd's to project dir and runs tsx
- `com.nickpomfret.reading-list-researcher.plist` — StartInterval=120, RunAtLoad, Background priority
- `scripts/install.sh` — copy plist, launchctl load
- `scripts/uninstall.sh` — launchctl unload, remove plist

### 6. Convenience scripts (`package.json`)

`install-daemon`, `uninstall-daemon`, `logs`, `status`

## Files to create/modify

```
src/state.ts           # MODIFY
src/index.ts           # MODIFY
src/config.ts          # MODIFY
src/utils/logger.ts    # MODIFY
scripts/run.sh         # NEW
scripts/install.sh     # NEW
scripts/uninstall.sh   # NEW
com.nickpomfret.reading-list-researcher.plist  # NEW
package.json           # MODIFY
```

## Dependencies

None new — just Node.js built-ins and launchd (macOS native).

## Verification

1. `npm start` processes one item as before
2. Run again — picks next item or retries failed item after backoff
3. Kill mid-research, run again — stuck item recovered
4. `npm run install-daemon` installs and starts the launchd job
5. Add URL to Reading List, wait ≤2 min — report appears in iCloud Drive
6. `npm run uninstall-daemon` stops cleanly
