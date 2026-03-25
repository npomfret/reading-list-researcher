import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import type { ResearchOutput } from "./researcher.js";

interface IndexEntry {
  hash: string;
  title: string;
  topics: string[];
  contentType: string;
  datePublished: string | null;
  url: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadResearchEntries(): IndexEntry[] {
  if (!fs.existsSync(config.researchDir)) return [];

  const files = fs.readdirSync(config.researchDir).filter((f) => f.endsWith(".json"));
  const entries: IndexEntry[] = [];

  for (const file of files) {
    try {
      const data: ResearchOutput = JSON.parse(
        fs.readFileSync(path.join(config.researchDir, file), "utf-8")
      );
      entries.push({
        hash: file.replace(".json", ""),
        title: data.title,
        topics: data.topics,
        contentType: data.contentType,
        datePublished: data.datePublished,
        url: data.url,
      });
    } catch {
      logger.warn(`Skipping malformed research file: ${file}`);
    }
  }

  // Sort by datePublished (newest first), nulls last
  entries.sort((a, b) => {
    if (!a.datePublished && !b.datePublished) return 0;
    if (!a.datePublished) return 1;
    if (!b.datePublished) return -1;
    return new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime();
  });

  return entries;
}

function renderIndex(entries: IndexEntry[]): string {
  const cards = entries
    .map(
      (e) => `
    <a href="${e.hash}.html" class="card">
      <div class="card-type">${escapeHtml(e.contentType)}</div>
      <h2 class="card-title">${escapeHtml(e.title)}</h2>
      <div class="card-meta">
        ${e.datePublished ? escapeHtml(e.datePublished) : ""}
      </div>
      <div class="card-topics">
        ${e.topics.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}
      </div>
      <div class="card-url">${escapeHtml(new URL(e.url).hostname)}</div>
    </a>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Research Index</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --bg: #f5f5f7; --fg: #1a1a1a; --muted: #86868b; --border: #d2d2d7;
    --accent: #0066cc; --tag-bg: #e8e8ed; --tag-fg: #1d1d1f;
    --card-bg: #fff; --card-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
    --card-hover-shadow: 0 10px 30px rgba(0,0,0,0.1), 0 1px 8px rgba(0,0,0,0.06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111; --fg: #f5f5f7; --muted: #86868b; --border: #333;
      --accent: #4da6ff; --tag-bg: #2a2a2a; --tag-fg: #ccc;
      --card-bg: #1c1c1e; --card-shadow: 0 1px 3px rgba(0,0,0,0.3);
      --card-hover-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6; color: var(--fg); background: var(--bg);
    max-width: 960px; margin: 0 auto; padding: 3rem 1.5rem;
  }
  .header { text-align: center; margin-bottom: 3rem; }
  h1 { font-size: 2.4rem; font-weight: 700; margin-bottom: 0.25rem; letter-spacing: -0.02em; }
  .subtitle { color: var(--muted); font-size: 1.1rem; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }
  .card {
    display: flex; flex-direction: column;
    background: var(--card-bg); border-radius: 12px;
    padding: 1.5rem; text-decoration: none; color: var(--fg);
    box-shadow: var(--card-shadow);
    transition: box-shadow 0.2s ease, transform 0.2s ease;
    border: 1px solid var(--border);
  }
  .card:hover {
    box-shadow: var(--card-hover-shadow);
    transform: translateY(-2px);
    text-decoration: none;
  }
  .card-type {
    font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--accent); margin-bottom: 0.5rem;
  }
  .card-title {
    font-size: 1.1rem; font-weight: 600; line-height: 1.3;
    margin: 0 0 0.75rem 0; flex-grow: 1;
  }
  .card-meta { font-size: 0.85rem; color: var(--muted); margin-bottom: 0.75rem; }
  .card-topics { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem; }
  .tag {
    background: var(--tag-bg); color: var(--tag-fg);
    padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.7rem;
    font-weight: 500;
  }
  .card-url { font-size: 0.8rem; color: var(--muted); }
  .empty { text-align: center; color: var(--muted); padding: 4rem 0; font-size: 1.1rem; }
</style>
</head>
<body>

<div class="header">
  <h1>Research</h1>
  <p class="subtitle">${entries.length} item${entries.length !== 1 ? "s" : ""} researched</p>
</div>

${entries.length === 0 ? `<p class="empty">No research reports yet.</p>` : `<div class="grid">
${cards}
</div>`}

</body>
</html>`;
}

export function generateIndex(): void {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  const entries = loadResearchEntries();
  const html = renderIndex(entries);
  const filePath = path.join(config.outputDir, "index.html");
  fs.writeFileSync(filePath, html, "utf-8");
  logger.info(`Index written to ${filePath} (${entries.length} entries)`);
}
