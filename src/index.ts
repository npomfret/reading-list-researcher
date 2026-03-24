import { logger } from "./utils/logger.js";
import { config } from "./config.js";
import { parseReadingList } from "./utils/plist.js";
import { loadState, saveState, addItem } from "./state.js";

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

// TODO: research + report generation goes here
