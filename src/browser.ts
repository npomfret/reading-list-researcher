import { chromium, type BrowserContext, type Page } from "patchright";
import path from "path";
import os from "os";
import { logger } from "./utils/logger.js";

const CHROME_PROFILE = path.join(
  os.homedir(),
  ".reading-list-agent",
  "chrome-profile"
);

let context: BrowserContext | null = null;

export async function launchBrowser(): Promise<BrowserContext> {
  if (context) return context;

  logger.info("Launching browser (Patchright headless)");
  context = await chromium.launchPersistentContext(CHROME_PROFILE, {
    headless: true,
  });
  return context;
}

export async function browsePage(url: string): Promise<string> {
  const ctx = await launchBrowser();
  const page: Page = await ctx.newPage();

  try {
    logger.info(`Browsing: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Wait a bit for JS-rendered content
    await page.waitForTimeout(2000);
    return await page.content();
  } finally {
    await page.close();
  }
}

export async function screenshot(url: string): Promise<Buffer> {
  const ctx = await launchBrowser();
  const page: Page = await ctx.newPage();

  try {
    logger.info(`Screenshot: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2000);
    return await page.screenshot({ fullPage: false });
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
    logger.info("Browser closed");
  }
}
