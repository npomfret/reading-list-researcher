import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import type { ResearchOutput } from "./researcher.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderReport(data: ResearchOutput, publicUrl?: string): string {
  const dateResearched = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const aboutParts: string[] = [];
  if (data.author) aboutParts.push(`<strong>Author:</strong> ${escapeHtml(data.author)}`);
  if (data.publication) aboutParts.push(`<strong>Publication:</strong> ${escapeHtml(data.publication)}`);
  if (data.datePublished) aboutParts.push(`<strong>Published:</strong> ${escapeHtml(data.datePublished)}`);

  const relatedLinksHtml = data.relatedLinks.length > 0
    ? data.relatedLinks
        .map(
          (link) =>
            `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.title)}</a><br><span class="relevance">${escapeHtml(link.relevance)}</span></li>`
        )
        .join("\n")
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.title)}</title>
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
    max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  h1 { font-size: 1.8rem; line-height: 1.2; margin-bottom: 0.25rem; }
  .meta { color: var(--muted); font-size: 0.9rem; margin-bottom: 2rem; }
  .meta a { color: var(--muted); }
  h2 { font-size: 1.2rem; margin-top: 2rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; }
  .summary { font-size: 1.05rem; }
  ul { padding-left: 1.25rem; }
  li { margin-bottom: 0.5rem; }
  .relevance { color: var(--muted); font-size: 0.85rem; }
  .topics { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tag {
    background: var(--tag-bg); color: var(--tag-fg);
    padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.8rem;
  }
  .about-card {
    background: var(--card-bg); padding: 1rem; border-radius: 0.5rem;
    border: 1px solid var(--border);
  }
  .about-card p { margin: 0.25rem 0; }
  .notes { white-space: pre-wrap; color: var(--muted); font-size: 0.95rem; }
  .share-btn {
    display: inline-block; padding: 0.5rem 1rem; border-radius: 0.5rem;
    background: var(--accent); color: #fff; font-size: 0.9rem; cursor: pointer;
    border: none; font-family: inherit;
  }
  .share-btn:hover { opacity: 0.85; }
  .share-section { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); }
  .share-copied { color: var(--muted); font-size: 0.85rem; margin-left: 0.5rem; }
</style>
</head>
<body>

<h1>${escapeHtml(data.title)}</h1>
<div class="meta">
  <a href="${escapeHtml(data.url)}">${escapeHtml(data.url)}</a><br>
  ${escapeHtml(data.contentType)} &middot; Researched ${dateResearched}
</div>

<h2>Summary</h2>
<div class="summary">${data.summary.split("\n").map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}</div>

<h2>Key Takeaways</h2>
<ul>
${data.keyPoints.map((p) => `  <li>${escapeHtml(p)}</li>`).join("\n")}
</ul>

${aboutParts.length > 0 ? `<h2>About</h2>
<div class="about-card">
${aboutParts.map((p) => `  <p>${p}</p>`).join("\n")}
</div>` : ""}

<h2>Sentiment / Tone</h2>
<p>${escapeHtml(data.sentiment)}</p>

${relatedLinksHtml ? `<h2>Related Links</h2>
<ul>
${relatedLinksHtml}
</ul>` : ""}

${data.researchNotes ? `<h2>Research Notes</h2>
<div class="notes">${escapeHtml(data.researchNotes)}</div>` : ""}

<h2>Topics</h2>
<div class="topics">
${data.topics.map((t) => `  <span class="tag">${escapeHtml(t)}</span>`).join("\n")}
</div>

${publicUrl ? `<div class="share-section">
<button class="share-btn" onclick="navigator.clipboard.writeText('${escapeHtml(publicUrl)}').then(()=>{document.getElementById('copied').style.display='inline'});window.open('https://notebooklm.google.com','_blank')">
  Share to NotebookLM
</button>
<span id="copied" class="share-copied" style="display:none">URL copied — paste it as a website source</span>
</div>` : ""}

</body>
</html>`;
}

export function generateReport(data: ResearchOutput, hash: string, publicUrl?: string): string {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  const html = renderReport(data, publicUrl);
  const filePath = path.join(config.outputDir, `${hash}.html`);
  fs.writeFileSync(filePath, html, "utf-8");
  logger.info(`Report written to ${filePath}`);
  return filePath;
}
