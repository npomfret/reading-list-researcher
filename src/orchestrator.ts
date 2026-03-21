import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";
import pino from "pino";
import type { Config } from "./config.js";
import { parseReadingList } from "./watcher/safari-reading-list.js";
import { loadState, saveState, isProcessed, isClaimed, markProcessed } from "./state/file-state.js";
import type { LlmProcessor } from "./processors/types.js";
import { GeminiProcessor } from "./processors/gemini.js";
import { buildPodcastPrompt } from "./prompt.js";
import { fetchPage } from "./browser/fetch-page.js";
import { writeReport, slugify } from "./writers/html-report.js";
import { regenerateIndex } from "./writers/index-page.js";
import { synthesize } from "./tts/synthesize.js";

function createProcessor(config: Config): LlmProcessor {
  const timeout = config.processingTimeout * 1000;
  switch (config.processor) {
    case "gemini":
      return new GeminiProcessor(timeout);
  }
}

export async function run(config: Config) {
  const host = hostname();
  const log = pino({ level: config.logLevel, timestamp: pino.stdTimeFunctions.isoTime });
  const processor = createProcessor(config);

  let state = loadState(config.statePath);
  const allItems = parseReadingList(config.bookmarksPlist);
  const newItems = allItems.filter((item) => !isProcessed(state, item.url));

  log.info({ host, total: allItems.length, new: newItems.length }, "Scan complete");
  if (newItems.length === 0) return;

  const batch = newItems.slice(0, config.batchSize);
  log.info({ host, count: batch.length }, "Processing batch");

  for (const item of batch) {
    const title = item.title || item.url;

    // Re-read state for latest iCloud sync before each item
    state = loadState(config.statePath);
    if (isProcessed(state, item.url) || isClaimed(state, item.url)) {
      log.info({ host, url: item.url }, "Skipping — already claimed or processed");
      continue;
    }

    // Claim this URL
    state = markProcessed(state, {
      url: item.url,
      title,
      processedAt: new Date().toISOString(),
      processor: processor.name,
      status: "processing",
      hostname: host,
    });
    saveState(config.statePath, state);
    log.info({ host, url: item.url }, "Claimed");

    try {
      log.info({ host, url: item.url }, "Fetching page");
      const page = await fetchPage(item.url);
      log.info({ url: item.url, chars: page.text.length, title: page.title }, "Page fetched");

      log.info({ url: item.url }, "Generating report");
      const result = await processor.process(item, page.text);

      // Quality gate: reject reports that are too short or lack structure
      const hasHeading = /^## /m.test(result.report);
      if (result.report.length < 200 || !hasHeading) {
        log.error({
          url: item.url,
          length: result.report.length,
          hasHeading,
          preview: result.report.slice(0, 500),
        }, "Quality gate failed");
        throw new Error("Report too short or malformed");
      }

      // Extract title from markdown h1
      const titleMatch = result.report.match(/^#\s+(.+)$/m);
      const extractedTitle = titleMatch?.[1]?.trim() ?? (item.title || item.url);

      const categoryMatch = result.report.match(/\*\*Category\*\*:\s*(.+)/i);
      const category = categoryMatch?.[1]?.trim() ?? "uncategorized";
      const date = new Date().toISOString().slice(0, 10);
      const slug = slugify(extractedTitle);

      const reportDir = await writeReport(config.reportsDir, {
        title: extractedTitle, url: item.url, date, category, slug,
      }, result.report);

      // Generate podcast script from the research
      let hasPodcast = false;
      log.info({ url: item.url }, "Generating podcast script");
      try {
        const podcastScript = await processor.generate(buildPodcastPrompt(result.report));
        const podcastMdPath = join(config.reportsDir, reportDir, "podcast.md");
        writeFileSync(podcastMdPath, podcastScript, "utf-8");

        // Synthesize podcast audio
        log.info({ url: item.url }, "Synthesizing podcast audio");
        const mp3Path = join(config.reportsDir, reportDir, "podcast.mp3");
        await synthesize(podcastScript, mp3Path);
        hasPodcast = true;
        log.info({ url: item.url }, "Podcast audio ready");
      } catch (podcastErr) {
        const podcastMsg = podcastErr instanceof Error ? podcastErr.message : String(podcastErr);
        log.warn({ url: item.url, error: podcastMsg }, "Podcast generation failed");
      }

      // Re-write HTML with podcast player if audio was generated
      if (hasPodcast) {
        await writeReport(config.reportsDir, {
          title: extractedTitle, url: item.url, date, category, slug,
        }, result.report, true);
      }

      state = markProcessed(state, {
        url: item.url,
        title: extractedTitle,
        processedAt: new Date().toISOString(),
        processor: processor.name,
        status: "success",
        hostname: host,
        reportFile: reportDir,
      });

      saveState(config.statePath, state);
      regenerateIndex(config.outputDir, state);
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
        hostname: host,
        error: msg,
      });
      saveState(config.statePath, state);
    }
  }
}
