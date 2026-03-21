import type { UrlInfo } from "./processors/types.js";

export function buildPrompt(urlInfo: UrlInfo): string {
  return `Navigate to this URL in the browser and write a research report.

URL: ${urlInfo.url}
Title: ${urlInfo.title || "Unknown"}

Instructions:
1. Navigate to the URL and read the full page content
2. Identify the key claims, ideas, or announcements
3. Find 2-3 important outbound links or related sources and navigate to them
4. Write a report in EXACTLY this markdown format:

# [Title of the content]

**Source**: ${urlInfo.url}
**Date Saved**: ${urlInfo.dateAdded?.toISOString().slice(0, 10) ?? "unknown"}
**Category**: [auto-detect: tech / science / business / culture / politics / other]

## Summary
[2-3 paragraph summary of the main content]

## Key Points
[The most important takeaways, written as prose]

## Related Context
[What you found from following related links — additional context, contrasting views, background]

## Assessment
[Brief analytical take — what's significant, what's missing, what questions remain]

Output ONLY the markdown report. No preamble.`;
}
