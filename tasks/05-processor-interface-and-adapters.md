# Task 5: Processor Interface & Gemini Adapter

## Status: done

## Description
Define the LLM processor interface and implement the Gemini CLI adapter. Claude/Codex adapters deferred.

## Steps
1. Create `src/processors/types.ts` — `UrlInfo`, `ProcessorResult`, `LlmProcessor` interface
2. Create `src/processors/gemini.ts` — `GeminiProcessor` using `execFile("gemini", ["-p", prompt])` with:
   - Timeout parameter (default 300s)
   - 10MB maxBuffer
   - Inherits `GOOGLE_CLOUD_PROJECT` from `.gemini/.env` (handled by gemini CLI itself)
3. Gemini CLI Browser Agent runs headless via `~/.gemini/settings.json`:
   ```json
   {
     "agents": {
       "overrides": { "browser_agent": { "enabled": true } },
       "browser": { "headless": true, "sessionMode": "isolated" }
     }
   }
   ```
   This is a one-time user setup — our code just invokes `gemini -p`

## Files
- `src/processors/types.ts`
- `src/processors/gemini.ts`
