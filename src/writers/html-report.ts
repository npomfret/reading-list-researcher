import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

export interface ReportMeta {
  title: string;
  url: string;
  date: string;
  category: string;
  slug: string;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function writeReport(
  reportsDir: string,
  meta: ReportMeta,
  markdown: string
): Promise<string> {
  mkdirSync(reportsDir, { recursive: true });

  const htmlContent = await marked(markdown);
  const filename = `${meta.date}-${meta.slug}.html`;
  const filepath = join(reportsDir, filename);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title)}</title>
  <style>
    :root {
      --bg: #fafaf9;
      --fg: #1c1917;
      --accent: #b91c1c;
      --muted: #78716c;
      --border: #e7e5e4;
      --card-bg: #ffffff;
      --max-w: 680px;
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
      font-family: 'Georgia', 'Times New Roman', serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.7;
      padding: 3rem 1.5rem;
      max-width: var(--max-w);
      margin: 0 auto;
    }

    .meta {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.8rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.5rem;
    }

    .meta a {
      color: var(--muted);
      text-decoration: underline;
      text-decoration-color: var(--border);
    }

    .category {
      display: inline-block;
      background: var(--accent);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 0.15rem 0.5rem;
      border-radius: 2px;
      margin-bottom: 1rem;
    }

    h1 {
      font-size: 2.2rem;
      line-height: 1.2;
      margin-bottom: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    h2 {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-top: 2.5rem;
      margin-bottom: 0.75rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid var(--border);
    }

    p { margin-bottom: 1.2rem; }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    blockquote {
      border-left: 3px solid var(--accent);
      padding: 0.5rem 1.2rem;
      margin: 1.5rem 0;
      font-style: italic;
      color: var(--muted);
    }

    code {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.85em;
      background: var(--card-bg);
      padding: 0.15em 0.35em;
      border-radius: 3px;
      border: 1px solid var(--border);
    }

    pre {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
      margin: 1.2rem 0;
    }

    pre code {
      border: none;
      background: none;
      padding: 0;
    }

    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2rem 0;
    }

    .back-link {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 0.85rem;
      margin-bottom: 2rem;
      display: block;
    }

    ul, ol { margin-bottom: 1.2rem; padding-left: 1.5rem; }
    li { margin-bottom: 0.3rem; }
  </style>
</head>
<body>
  <a class="back-link" href="../index.html">&larr; All Reports</a>
  <div class="category">${escapeHtml(meta.category)}</div>
  <div class="meta">
    ${escapeHtml(meta.date)} &middot;
    <a href="${escapeHtml(meta.url)}">Original source</a>
  </div>
  <article>
    ${htmlContent}
  </article>
</body>
</html>`;

  writeFileSync(filepath, html, "utf-8");
  return filename;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
