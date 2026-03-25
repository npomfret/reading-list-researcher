import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

const PROJECT_ROOT = process.cwd();

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

export function pushDeploy(): void {
  const status = execFileSync("git", ["status", "--porcelain", "docs/"], {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
  }).trim();

  if (!status) {
    logger.info("Nothing to deploy — docs/ is clean");
    return;
  }

  execFileSync("git", ["add", "docs/"], { cwd: PROJECT_ROOT });
  execFileSync("git", ["commit", "-m", `Deploy reports — ${new Date().toISOString()}`], {
    cwd: PROJECT_ROOT,
    timeout: 15_000,
  });
  execFileSync("git", ["push"], {
    cwd: PROJECT_ROOT,
    timeout: 30_000,
  });
  logger.info("Pushed docs/ to GitHub Pages");
}
