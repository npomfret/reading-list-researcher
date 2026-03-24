import { query, type Message } from "@anthropic-ai/claude-agent-sdk";
import path from "path";

const RESULT_SCHEMA = {
  type: "object" as const,
  properties: {
    result: { type: "string" as const },
  },
  required: ["result"],
  additionalProperties: false,
};

async function main() {
  console.log("Starting SDK spike test...\n");

  const mcpServerPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "dummy-mcp.ts"
  );

  let finalResult: any = null;
  let structuredOutput: any = null;

  for await (const message of query({
    prompt:
      'Call the echo tool with the text "hello world", then return the result as JSON with a "result" field containing the echoed text.',
    options: {
      maxTurns: 10,
      allowedTools: ["mcp__dummy__echo"],
      mcpServers: {
        dummy: {
          command: "npx",
          args: ["tsx", mcpServerPath],
        },
      },
      outputFormat: {
        type: "json_schema",
        schema: RESULT_SCHEMA,
      },
    },
  })) {
    // Log every message type for observability
    console.log(`[${message.type}]`, JSON.stringify(message, null, 2), "\n");

    if (message.type === "result" && message.subtype === "success") {
      finalResult = message.result;
      structuredOutput = (message as any).structured_output;
    }
  }

  console.log("\n--- FINAL RESULT ---");
  console.log("result field:", typeof finalResult, finalResult?.substring?.(0, 100));
  console.log("structured_output field:", structuredOutput);

  const output = structuredOutput ?? (finalResult ? JSON.parse(finalResult) : null);
  if (output) {
    console.log("Parsed output:", output);
    const resultValue = typeof output.result === "string" ? output.result : String(output.result);
    console.log("MCP tool was called:", resultValue.includes("HELLO WORLD") ? "YES" : "UNCLEAR");
    console.log("ALL THREE VALIDATIONS PASSED");
  } else {
    console.log("ERROR: No result returned from SDK");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
