import fs from "fs";
import crypto from "crypto";
import { logger } from "./utils/logger.js";
import { config } from "./config.js";
import { parseReadingList } from "./utils/plist.js";
import { loadState, saveState, addItem } from "./state.js";
import { runResearch } from "./researcher.js";
import { generateReport } from "./report.js";
import { generateIndex } from "./report-index.js";
import { notify } from "./utils/notify.js";

logger.info("Reading List Researcher starting up");

const entries = parseReadingList(config.bookmarksPlist);

if (entries.length === 0) {
  logger.info("No reading list entries found");
  process.exit(0);
}

const state = loadState();

// Find the first item not already in state
const newEntry = entries.find((e) => !state.items[e.url]);

if (!newEntry) {
  logger.info("No new items to process");
  process.exit(0);
}

addItem(state, newEntry.url, newEntry.title, newEntry.dateAdded);
saveState(state);

logger.info(`Processing: "${newEntry.title}"`, { url: newEntry.url });

// Update status to researching
state.items[newEntry.url].status = "researching";
saveState(state);

try {
  const output = await runResearch(newEntry.url, newEntry.title);

  // Save research output
  if (!fs.existsSync(config.researchDir)) {
    fs.mkdirSync(config.researchDir, { recursive: true });
  }

  const hash = crypto.createHash("sha256").update(newEntry.url).digest("hex").slice(0, 16);
  const outputPath = `${config.researchDir}/${hash}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  logger.info(`Research saved to ${outputPath}`);

  // Generate HTML report
  state.items[newEntry.url].status = "generating_report";
  saveState(state);

  const reportPath = generateReport(output, hash);
  generateIndex();

  state.items[newEntry.url].status = "complete";
  saveState(state);

  notify(`Research complete: "${output.title}"`);
  logger.info(`Done: "${newEntry.title}" — report: ${reportPath}`);
} catch (err: any) {
  logger.error(`Research failed: ${err.message}`);
  state.items[newEntry.url].status = "failed";
  saveState(state);
  notify(`Research failed: "${newEntry.title}"`, "Research Agent");
  process.exit(1);
}
