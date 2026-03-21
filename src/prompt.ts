import type { UrlInfo } from "./processors/types.js";

export function buildPrompt(urlInfo: UrlInfo, pageContent: string): string {
  return `You are a research assistant. I have already fetched the page content for you (below). Analyze it and research the topic further using google_web_search. Do NOT describe what you will do — just do it.

URL: ${urlInfo.url}

--- PAGE CONTENT ---
${pageContent.slice(0, 30_000)}
--- END PAGE CONTENT ---

Steps:
1. Read and analyze the page content above.
2. Identify the key claims, ideas, or announcements.
3. Use google_web_search to research the topic further — find related sources, contrasting opinions, background context, recent developments. Be thorough.
4. Write your report in EXACTLY this markdown format:

# [Title of the content]

**Source**: ${urlInfo.url}
**Date Saved**: ${urlInfo.dateAdded?.toISOString().slice(0, 10) ?? "unknown"}
**Category**: [auto-detect: tech / science / business / culture / politics / other]

## Summary
[2-3 paragraph summary of the main content. Include relevant images using markdown image syntax where appropriate.]

## Key Points
[The most important takeaways, written as prose]

## Related Context
[What you found from your research — additional sources, contrasting views, background, recent developments. Cite URLs where relevant.]

## Assessment
[Brief analytical take — what's significant, what's missing, what questions remain]

IMPORTANT: Output ONLY the markdown report. No preamble, no commentary, no explanation of your process.`;
}

export function buildPodcastPrompt(report: string): string {
  return `You are writing a podcast script for TWO hosts: Alex and Sarah.

**Alex** — the hype guy. Enthusiastic, excitable, drops jokes and swears freely. Gets genuinely fired up about cool things. Sometimes goes off on tangents. Think "your smart friend who's had two beers and just read something mind-blowing."

**Sarah** — the sharp one. Cuts through bullshit, asks the hard questions, dry wit. She's the one who goes "okay but what does this actually mean?" Keeps Alex honest. Swears when something deserves it.

Together they have incredible chemistry — they riff off each other, interrupt, agree, argue, and make each other laugh.

Based on the research report below, write a podcast script.

Rules:
- Approximately 10 minutes when read aloud (~1500 words)
- Every line MUST start with either "ALEX:" or "SARAH:" — no exceptions, no narrator
- Open with a hook that grabs attention immediately
- Be genuinely entertaining — jokes, sarcasm, banter, disagreements, hot takes
- Swearing is encouraged. Don't be gratuitous but don't hold back either
- Roast stupid decisions, call out corporate bullshit, celebrate genuinely cool things
- Still be informative — cover all the key findings from the research
- Explain technical stuff like you're telling a mate at the pub
- Use [PAUSE] for dramatic beats
- End with a killer takeaway or question

Example format:
ALEX: Holy shit, you will not believe what I found this week.
SARAH: Oh god, what now?
ALEX: So there's this thing about...
SARAH: Wait, seriously? That's actually kind of amazing.

---

Research Report:

${report}

---

IMPORTANT: Output ONLY the podcast script. Every line must start with ALEX: or SARAH:. No preamble, no stage directions, no meta-commentary.`;
}
