import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { State } from "../state/file-state.js";

export function regenerateIndex(outputDir: string, state: State): void {
  mkdirSync(outputDir, { recursive: true });

  const entries = Object.values(state.processed)
    .filter((e) => e.status === "success" && e.reportFile)
    .sort((a, b) => b.processedAt.localeCompare(a.processedAt));

  const rows = entries
    .map(
      (e) => `
      <tr class="entry" data-title="${escapeHtml(e.title.toLowerCase())}">
        <td class="date">${e.processedAt.slice(0, 10)}</td>
        <td><a href="reports/${escapeHtml(e.reportFile!)}">${escapeHtml(e.title || e.url)}</a></td>
        <td class="source"><a href="${escapeHtml(e.url)}">source</a></td>
      </tr>`
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reading List Research</title>
  <style>
    :root {
      --bg: #fafaf9;
      --fg: #1c1917;
      --accent: #b91c1c;
      --muted: #78716c;
      --border: #e7e5e4;
      --card-bg: #ffffff;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1c1917;
        --fg: #fafaf9;
        --accent: #fca5a5;
        --muted: #a8a29e;
        --border: #44403c;
        --card-bg: #292524;
      }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.6;
      padding: 3rem 1.5rem;
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      font-size: 1.8rem;
      font-weight: 700;
      margin-bottom: 0.3rem;
    }

    .subtitle {
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }

    .search {
      width: 100%;
      padding: 0.6rem 1rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
      background: var(--card-bg);
      color: var(--fg);
      outline: none;
    }

    .search:focus { border-color: var(--accent); }

    table { width: 100%; border-collapse: collapse; }

    th {
      text-align: left;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      padding: 0.5rem 0;
      border-bottom: 2px solid var(--border);
    }

    td {
      padding: 0.65rem 0;
      border-bottom: 1px solid var(--border);
      font-size: 0.95rem;
    }

    .date {
      color: var(--muted);
      font-size: 0.85rem;
      white-space: nowrap;
      width: 100px;
    }

    .source {
      width: 60px;
      text-align: right;
    }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .source a {
      font-size: 0.8rem;
      color: var(--muted);
    }

    .count {
      color: var(--muted);
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <h1>Reading List Research</h1>
  <p class="subtitle">${entries.length} reports</p>
  <input class="search" type="text" placeholder="Filter reports..." id="search">
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Report</th>
        <th></th>
      </tr>
    </thead>
    <tbody id="entries">
      ${rows}
    </tbody>
  </table>
  <script>
    const search = document.getElementById('search');
    const entries = document.querySelectorAll('.entry');
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      entries.forEach(e => {
        e.style.display = e.dataset.title.includes(q) ? '' : 'none';
      });
    });
  </script>
</body>
</html>`;

  writeFileSync(join(outputDir, "index.html"), html, "utf-8");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
