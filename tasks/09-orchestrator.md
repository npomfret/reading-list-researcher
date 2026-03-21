# Task 9: Orchestrator

## Status: pending

## Description
Main pipeline that ties all components together.

## Steps
1. Create `src/orchestrator.ts`
2. Implement `createProcessor(config)` factory — returns GeminiProcessor (only option for now)
3. Implement `run(config)` — the main pipeline:
   - Load state
   - Parse reading list
   - Filter to new (unprocessed) URLs
   - Take a batch (config.batchSize)
   - For each item: process via LLM, extract category from markdown, write HTML report, update state
   - Save state after each item for crash resilience
   - Regenerate index.html after all processing
4. Uses pino for structured logging

## Files
- `src/orchestrator.ts`
