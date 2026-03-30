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
import { deployReport, deployIndex, pushDeploy } from "./deploy.js";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processOne(): Promise<boolean> {
  const entries = parseReadingList(config.bookmarksPlist);

  if (entries.length === 0) {
    return false;
  }

  const state = loadState();
  const newEntry = entries.find((e) => !state.items[e.url]);

  if (!newEntry) {
    return false;
  }

  addItem(state, newEntry.url, newEntry.title, newEntry.dateAdded);
  saveState(state);

  logger.info(`Processing: "${newEntry.title}"`, { url: newEntry.url });

  state.items[newEntry.url].status = "researching";
  saveState(state);

  try {
    const output = await runResearch(newEntry.url, newEntry.title);

    if (!fs.existsSync(config.researchDir)) {
      fs.mkdirSync(config.researchDir, { recursive: true });
    }

    const hash = crypto.createHash("sha256").update(newEntry.url).digest("hex").slice(0, 16);
    const outputPath = `${config.researchDir}/${hash}.json`;
    fs.writeFileSync(outputPath, JSON.stringify({ ...output, researchedAt: new Date().toISOString() }, null, 2));

    logger.info(`Research saved to ${outputPath}`);

    state.items[newEntry.url].status = "generating_report";
    saveState(state);

    let reportPath = generateReport(output, hash);
    generateIndex();

    if (config.deployEnabled) {
      const publicUrl = deployReport(reportPath, hash);
      state.items[newEntry.url].publicUrl = publicUrl;

      reportPath = generateReport(output, hash, publicUrl);
      deployReport(reportPath, hash);
      deployIndex();
      pushDeploy();

      logger.info(`Deployed to ${publicUrl}`);
    }

    state.items[newEntry.url].status = "complete";
    saveState(state);

    notify(`Research complete: "${output.title}"`);
    logger.info(`Done: "${newEntry.title}" — report: ${reportPath}`);
  } catch (err: any) {
    logger.error(`Research failed for "${newEntry.title}": ${err.message}`);
    state.items[newEntry.url].status = "failed";
    saveState(state);
    notify(`Research failed: "${newEntry.title}"`, "Research Agent");
  }

  return true;
}

async function main(): Promise<void> {
  logger.info("Reading List Researcher starting up (continuous mode)");

  while (true) {
    // Drain all pending items
    let processed = 0;
    while (await processOne()) {
      processed++;
    }

    if (processed > 0) {
      logger.info(`Processed ${processed} item(s)`);
    }

    logger.info(`Polling again in ${POLL_INTERVAL_MS / 1000 / 60} minutes...`);
    await sleep(POLL_INTERVAL_MS);
  }
}

main();
