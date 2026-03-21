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

Together they have incredible chemistry — they riff off each other, interrupt, agree, argue, and make each other laugh. They are NOT reading from a script — they are having a real conversation. They REACT to what the other person says.

Based on the research report below, write a podcast script.

Rules:
- Approximately 10 minutes when read aloud (~1500 words)
- Every line MUST start with either "ALEX:" or "SARAH:" — no exceptions, no narrator
- Open with a hook that grabs attention immediately
- Be genuinely entertaining — jokes, sarcasm, banter, disagreements, hot takes
- Swearing is encouraged. Don't be gratuitous but don't hold back either
- Still be informative — cover all the key findings from the research
- End with a killer takeaway or question

MAKING IT SOUND REAL — this is the most important part:

Speech patterns:
- Filler words: "well," "I mean," "you know," "actually," "right," "like," "honestly"
- ALWAYS contractions: don't, can't, it's, that's, won't, shouldn't, would've, could've
- Sentence fragments. Not complete thoughts. Just... pieces.
- Run-on sentences connected with "and" and "but" like real speech
- Self-corrections: "So it's like a— no wait, it's more like..."
- Emphasis with ALL CAPS on key words: "that is WILD" or "absolutely NOT"

Reactive listening (critical — this makes it feel real):
- Short interjections while the other talks: "mhm," "yeah," "right," "totally," "no way," "wait what," "huh"
- Genuine reactions: "Oh COME on!" / "[laughs] that's insane" / "[sighs] of course they did"
- Building on what the other said: "Yeah and the crazy part is..."
- Disagreeing then coming around: "Okay I was skeptical but... shit, you might be right"

Interruptions and flow:
- Cut each other off with dashes: "ALEX: So the whole thing is basically—" then "SARAH: [interrupted] Hold on, hold on."
- Talk over each other: "[overlapping] Yeah exactly!"
- Finish each other's sentences
- Circle back: "Wait go back to the thing about..."

Audio cues (the TTS engine interprets these):
- [laughs], [chuckle], [sighs], [gasp], [scoffs] — use liberally where natural
- [excited], [hesitantly], [sarcastically], [deadpan] — for tone shifts
- [interrupted], [overlapping] — for natural dialogue flow
- [pause] or <break time="1.0s" /> — for dramatic beats

Example:
ALEX: [excited] Okay okay okay so... holy shit. You ready for this?
SARAH: [sighs] Oh god. What now?
ALEX: So I'm reading this paper, right, and they basically—
SARAH: [interrupted] Wait which paper? The one from—
ALEX: [overlapping] Yeah yeah, the one about, you know, the thing we were talking about last week.
SARAH: Oh! Okay yeah. Go on.
ALEX: So they basically figured out that the whole approach everyone's been using is just... [pause] wrong.
SARAH: Like, FUNDAMENTALLY wrong?
ALEX: Completely. And— okay here's the funny part— someone called this like two years ago and everyone just ignored them.
SARAH: [laughs] Of course they did. Classic.
ALEX: I know, right? And now everyone's acting all surprised and—
SARAH: [scoffs] "Oh we never could have predicted this." Yeah okay.
ALEX: [laughs] Exactly!

---

Research Report:

${report}

---

IMPORTANT: Output ONLY the podcast script. Every line must start with ALEX: or SARAH:. No preamble, no stage directions, no meta-commentary.`;
}
