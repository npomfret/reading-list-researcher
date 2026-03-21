# Task 4: State Manager

## Status: done

## Description
JSON file-based state tracking with atomic writes.

## Steps
1. Create `src/state/file-state.ts`
2. Define `StateEntry` interface (url, title, processedAt, processor, status, reportFile?, error?)
3. Define `State` interface (version: 1, processed: Record<string, StateEntry>)
4. Implement `loadState(path)` — read JSON or return empty state
5. Implement `saveState(path, state)` — atomic write via temp file + rename
6. Implement `isProcessed(state, url)` and `markProcessed(state, entry)`

## Files
- `src/state/file-state.ts`
