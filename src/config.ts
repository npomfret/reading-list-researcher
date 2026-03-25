import dotenv from "dotenv";
import path from "path";
import { logger } from "./utils/logger.js";

dotenv.config(); // loads .env from project root

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    logger.error(`Missing required environment variable: ${key}`);
    logger.error(`Set it in .env or export it before running`);
    process.exit(1);
  }
  return value;
}

export const config = {
  braveApiKey: requireEnv("BRAVE_API_KEY"),
  stateDir: requireEnv("STATE_DIR"),
  statePath: path.join(requireEnv("STATE_DIR"), "state.json"),
  researchDir: path.join(requireEnv("STATE_DIR"), "research"),
  bookmarksPlist: requireEnv("BOOKMARKS_PLIST"),
  outputDir: requireEnv("OUTPUT_DIR"),
  deployEnabled: process.env.DEPLOY_ENABLED !== "false" && !!process.env.GITHUB_PAGES_BASE_URL,
  docsDir: path.join(process.cwd(), "docs"),
  githubPagesBaseUrl: process.env.GITHUB_PAGES_BASE_URL || "",
};
