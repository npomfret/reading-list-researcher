import { chromium } from "playwright";

export interface PageContent {
  title: string;
  text: string;
  url: string;
}

export async function fetchPage(url: string, timeoutMs = 30_000): Promise<PageContent> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    // Dismiss common popups/banners
    page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    // Wait a bit for JS rendering
    await page.waitForTimeout(3000);

    // Try to dismiss cookie banners and overlays
    const dismissSelectors = [
      '[aria-label="Close"]',
      '[aria-label="Dismiss"]',
      'button:has-text("Accept")',
      'button:has-text("Got it")',
      'button:has-text("Close")',
      'button:has-text("No thanks")',
      'button:has-text("Reject")',
      'button:has-text("Decline")',
    ];
    for (const sel of dismissSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 })) {
          await btn.click({ timeout: 1000 });
          await page.waitForTimeout(500);
        }
      } catch {}
    }

    const title = await page.title();

    // Extract main text content
    const text = await page.evaluate(() => {
      // Remove script, style, nav, footer, header elements
      const remove = document.querySelectorAll("script, style, nav, footer, header, aside, [role='banner'], [role='navigation']");
      remove.forEach((el) => el.remove());

      // Try to find main content
      const main = document.querySelector("main, article, [role='main']");
      const target = main ?? document.body;

      return (target as HTMLElement).innerText.trim();
    });

    return { title, text: text.slice(0, 50_000), url: page.url() };
  } finally {
    await browser.close();
  }
}
