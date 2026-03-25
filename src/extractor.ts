import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { logger } from "./utils/logger.js";

export interface ExtractedContent {
  title: string;
  content: string;
  author: string | null;
  excerpt: string | null;
  links: string[];
  extractionQuality: "readability" | "fallback";
}

export function extractContent(html: string, url: string): ExtractedContent {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  // Collect links before Readability modifies the DOM
  const links: string[] = [];
  doc.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
      links.push(href);
    }
  });
  const uniqueLinks = [...new Set(links)].slice(0, 50);

  // Try Readability first
  const reader = new Readability(doc);
  const article = reader.parse();

  const textContent = article?.textContent ?? "";
  if (article && textContent.trim().length > 100) {
    logger.info(`Extracted via Readability: "${article.title}" (${textContent.length} chars)`);
    return {
      title: article.title ?? "",
      content: textContent,
      author: article.byline ?? null,
      excerpt: article.excerpt ?? null,
      links: uniqueLinks,
      extractionQuality: "readability",
    };
  }

  // Fallback: innerText
  const fallbackDom = new JSDOM(html, { url });
  const body = fallbackDom.window.document.body;
  const text = body?.textContent?.trim() ?? "";

  logger.warn(`Readability failed, falling back to innerText (${text.length} chars)`);
  return {
    title: fallbackDom.window.document.title || "",
    content: text,
    author: null,
    excerpt: null,
    links: uniqueLinks,
    extractionQuality: "fallback",
  };
}
