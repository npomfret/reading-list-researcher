import path from "path";
import os from "os";
import fs from "fs";
import { logger } from "./logger.js";

const ICLOUD_BASE = path.join(
  os.homedir(),
  "Library",
  "Mobile Documents",
  "com~apple~CloudDocs"
);

const OUTPUT_DIR = path.join(ICLOUD_BASE, "ResearchPods");

export function getOutputDir(): string {
  if (!fs.existsSync(ICLOUD_BASE)) {
    logger.error(`iCloud Drive not found at ${ICLOUD_BASE}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    logger.info(`Created output directory: ${OUTPUT_DIR}`);
  }

  return OUTPUT_DIR;
}
