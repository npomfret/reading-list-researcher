import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

function ensureDocsDir(): void {
  if (!fs.existsSync(config.docsDir)) {
    fs.mkdirSync(config.docsDir, { recursive: true });
  }
}

export function deployReport(reportPath: string, hash: string): string {
  ensureDocsDir();
  const dest = path.join(config.docsDir, `${hash}.html`);
  fs.copyFileSync(reportPath, dest);
  return `${config.githubPagesBaseUrl}/${hash}.html`;
}

export function deployIndex(): void {
  ensureDocsDir();
  const src = path.join(config.outputDir, "index.html");
  if (!fs.existsSync(src)) return;
  fs.copyFileSync(src, path.join(config.docsDir, "index.html"));
}
