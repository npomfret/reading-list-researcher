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
  const rows = entries
    .map(
      (e) => `
    <tr>
      <td><a href="${e.hash}.html">${escapeHtml(e.title)}</a></td>
      <td>${escapeHtml(e.contentType)}</td>
      <td>${e.datePublished ? escapeHtml(e.datePublished) : "&mdash;"}</td>
      <td class="topics">${e.topics.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</td>
    </tr>`
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
    --bg: #fff; --fg: #1a1a1a; --muted: #666; --border: #e0e0e0;
    --accent: #0066cc; --tag-bg: #f0f0f0; --tag-fg: #333;
    --card-bg: #fafafa;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1a1a1a; --fg: #e0e0e0; --muted: #999; --border: #333;
      --accent: #4da6ff; --tag-bg: #2a2a2a; --tag-fg: #ccc;
      --card-bg: #222;
    }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6; color: var(--fg); background: var(--bg);
    max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  .subtitle { color: var(--muted); margin-bottom: 2rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border); }
  th { font-size: 0.85rem; text-transform: uppercase; color: var(--muted); }
  .tag {
    background: var(--tag-bg); color: var(--tag-fg);
    padding: 0.15rem 0.5rem; border-radius: 1rem; font-size: 0.75rem;
    display: inline-block; margin: 0.1rem;
  }
  .topics { max-width: 300px; }
  @media (max-width: 600px) {
    table, thead, tbody, th, td, tr { display: block; }
    thead { display: none; }
    td { padding: 0.25rem 0; border: none; }
    td:first-child { font-weight: 600; padding-top: 1rem; }
    tr { border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; }
  }
</style>
</head>
<body>

<h1>Research Index</h1>
<p class="subtitle">${entries.length} item${entries.length !== 1 ? "s" : ""} researched</p>

${entries.length === 0 ? "<p>No research reports yet.</p>" : `<table>
<thead>
  <tr><th>Title</th><th>Type</th><th>Published</th><th>Topics</th></tr>
</thead>
<tbody>
${rows}
</tbody>
</table>`}

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
