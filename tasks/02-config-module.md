# Task 2: Config Module

## Status: done

## Description
Create the config schema and type using Zod with cosmiconfig integration.

## Steps
1. Create `src/config.ts` with Zod schema defining: processor (gemini only for now), batchSize, processingTimeout, bookmarksPlist path, outputDir, statePath, reportsDir, logLevel
2. All fields have sensible defaults pointing to iCloud Drive paths
3. Export `Config` type via `z.infer`

## Files
- `src/config.ts`
