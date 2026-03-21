import { z } from "zod";

const home = process.env.HOME ?? "/Users/unknown";
const icloudBase = `${home}/Library/Mobile Documents/com~apple~CloudDocs/ReadingListResearcher`;

export const ConfigSchema = z.object({
  processor: z.enum(["gemini"]).default("gemini"),
  batchSize: z.number().default(5),
  processingTimeout: z.number().default(300),
  bookmarksPlist: z.string().default(`${home}/Library/Safari/Bookmarks.plist`),
  outputDir: z.string().default(icloudBase),
  statePath: z.string().default(`${icloudBase}/state.json`),
  reportsDir: z.string().default(`${icloudBase}/reports`),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;
