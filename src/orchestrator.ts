import pino from "pino";
import type { Config } from "./config.js";
import { parseReadingList } from "./watcher/safari-reading-list.js";
import { loadState, saveState, isProcessed, markProcessed } from "./state/file-state.js";
import type { LlmProcessor } from "./processors/types.js";
import { GeminiProcessor } from "./processors/gemini.js";
import { writeReport, slugify } from "./writers/html-report.js";
import { regenerateIndex } from "./writers/index-page.js";

function createProcessor(config: Config): LlmProcessor {
  const timeout = config.processingTimeout * 1000;
  switch (config.processor) {
    case "gemini":
      return new GeminiProcessor(timeout);
  }
}

export async function run(config: Config) {
  const log = pino({ level: config.logLevel });
  const processor = createProcessor(config);

  let state = loadState(config.statePath);
  const allItems = parseReadingList(config.bookmarksPlist);
  const newItems = allItems.filter((item) => !isProcessed(state, item.url));

  log.info({ total: allItems.length, new: newItems.length }, "Scan complete");
  if (newItems.length === 0) return;

  const batch = newItems.slice(0, config.batchSize);
  log.info({ count: batch.length }, "Processing batch");

  for (const item of batch) {
    const title = item.title || item.url;
    try {
      log.info({ url: item.url }, "Processing");
      const result = await processor.process(item);

      const categoryMatch = result.report.match(/\*\*Category\*\*:\s*(.+)/i);
      const category = categoryMatch?.[1]?.trim() ?? "uncategorized";
      const date = new Date().toISOString().slice(0, 10);
      const slug = slugify(title);

      const reportFile = await writeReport(config.reportsDir, {
        title, url: item.url, date, category, slug,
      }, result.report);

      state = markProcessed(state, {
        url: item.url,
        title,
        processedAt: new Date().toISOString(),
        processor: processor.name,
        status: "success",
        reportFile,
      });

      saveState(config.statePath, state);
      log.info({ url: item.url }, "Done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ url: item.url, error: msg }, "Failed");

      state = markProcessed(state, {
        url: item.url,
        title,
        processedAt: new Date().toISOString(),
        processor: processor.name,
        status: "failed",
        error: msg,
      });
      saveState(config.statePath, state);
    }
  }

  regenerateIndex(config.outputDir, state);
  log.info("Index regenerated");
}
