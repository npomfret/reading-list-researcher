import dotenv from "dotenv";
import path from "path";
import os from "os";
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
  stateDir: path.join(os.homedir(), ".reading-list-agent"),
  statePath: path.join(os.homedir(), ".reading-list-agent", "state.json"),
  researchDir: path.join(os.homedir(), ".reading-list-agent", "research"),
  bookmarksPlist: path.join(os.homedir(), "Library", "Safari", "Bookmarks.plist"),
  outputDir: path.join(
    os.homedir(),
    "Library",
    "Mobile Documents",
    "com~apple~CloudDocs",
    "ResearchPods"
  ),
};
