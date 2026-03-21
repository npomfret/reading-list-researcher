#!/usr/bin/env node
import { cosmiconfig } from "cosmiconfig";
import { ConfigSchema } from "./config.js";
import { run } from "./orchestrator.js";

async function main() {
  const explorer = cosmiconfig("readinglist");
  const result = await explorer.search();
  const config = ConfigSchema.parse(result?.config ?? {});
  await run(config);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
