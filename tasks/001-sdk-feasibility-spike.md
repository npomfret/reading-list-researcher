# Task 001: SDK Feasibility Spike

## Status: TODO

## Goal

Validate that the Claude Code SDK (`@anthropic-ai/claude-agent-sdk`) works as the plan assumes before committing the architecture. If this fails, fall back to direct API (`@anthropic-ai/sdk`) with Sonnet.

## What to validate

1. **Max plan subprocess usage** — Can we spawn a Claude Code SDK subprocess from a Node.js script and get a response without hitting auth or entitlement issues?
2. **Custom MCP server attachment** — Can we attach a stdio MCP server that exposes a dummy tool, and have the SDK agent call it?
3. **Structured JSON output** — Does `outputFormat: { type: "json_schema", schema: ... }` return parseable JSON matching our schema?

## Steps

1. `pnpm init` + install `@anthropic-ai/claude-agent-sdk`, `@modelcontextprotocol/sdk`, `typescript`, `tsx`
2. Write a minimal MCP server (`spike/dummy-mcp.ts`) that exposes one tool: `echo` — takes a string, returns it uppercased
3. Write a spike script (`spike/test-sdk.ts`) that:
   - Calls `query()` with a simple prompt ("Call the echo tool with 'hello world', then return the result as JSON")
   - Attaches the dummy MCP server via `mcpServers`
   - Restricts tools to only `mcp__dummy__echo`
   - Uses `outputFormat` with a simple JSON schema: `{ result: string }`
   - Logs every message from the async generator to see what the SDK returns
4. Run it: `npx tsx spike/test-sdk.ts`
5. Check: Did it call the MCP tool? Did it return structured JSON? Any auth errors?

## Success criteria

- The SDK subprocess starts and authenticates with the Max plan
- The agent calls the custom MCP tool and receives the response
- The final result is valid JSON matching the schema
- No per-token charges appear (confirm it's using Max plan, not API credits)

## Failure plan

If any of the above fail, document what broke and switch the plan to use `@anthropic-ai/sdk` directly with `claude-sonnet-4-20250514`. Update `project-plan.md` accordingly.

## Files to create

```
spike/
  dummy-mcp.ts      # Minimal MCP server with one tool
  test-sdk.ts        # SDK test script
```
