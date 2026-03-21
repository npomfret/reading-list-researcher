# Task 10: CLI Entry Point

## Status: pending

## Description
Wire up the CLI with cosmiconfig for configuration loading.

## Steps
1. Update `src/index.ts`
2. Use cosmiconfig to search for `readinglist` config
3. Parse config through Zod schema
4. Call `run(config)` from orchestrator
5. Handle fatal errors with process.exit(1)

## Files
- `src/index.ts`
