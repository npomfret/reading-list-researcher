# Task 6: Prompt Template

## Status: pending

## Description
Shared LLM prompt template for generating research reports.

## Steps
1. Create `src/prompt.ts`
2. Implement `buildPrompt(urlInfo)` that generates a structured prompt instructing the LLM to:
   - Visit the URL and read full content
   - Identify key claims/ideas
   - Follow 2-3 outbound links
   - Write a markdown report with: title, source, date, category, summary, key points, related context, assessment

## Files
- `src/prompt.ts`
