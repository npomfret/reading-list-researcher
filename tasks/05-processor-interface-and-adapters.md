# Task 5: Processor Interface & LLM Adapters

## Status: pending

## Description
Define the LLM processor interface and implement adapters for Claude, Gemini, and Codex CLIs.

## Steps
1. Create `src/processors/types.ts` — `UrlInfo`, `ProcessorResult`, `LlmProcessor` interface
2. Create `src/processors/claude.ts` — `ClaudeProcessor` using `execFile("claude", ["-p", prompt, "--allowedTools", "mcp__*", "--output-format", "text"])`
3. Create `src/processors/gemini.ts` — `GeminiProcessor` using `execFile("gemini", ["-p", prompt])`
4. Create `src/processors/codex.ts` — `CodexProcessor` using `execFile("codex", ["--quiet", "--prompt", prompt])`
5. All adapters accept a timeout parameter and use 10MB maxBuffer

## Files
- `src/processors/types.ts`
- `src/processors/claude.ts`
- `src/processors/gemini.ts`
- `src/processors/codex.ts`
