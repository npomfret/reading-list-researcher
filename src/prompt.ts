import type { UrlInfo } from "./processors/types.js";

function getSiteSpecificInstructions(url: string): string {
  // GitHub repos — check issues for community discussion
  if (/^https?:\/\/github\.com\/[^/]+\/[^/]+/.test(url)) {
    return `
SITE-SPECIFIC (GitHub): This is a GitHub repository. In addition to the README/page content:
- Search for the project's most-discussed issues — sort by most comments. The top issues often reveal what users actually care about, pain points, and feature requests.
- Check if there are recent releases or a changelog.
- Look at the star count and contributor activity to gauge traction.
- Search for community reactions, blog posts, or comparisons with alternatives.`;
  }

  // X/Twitter — search for context around the tweet
  if (/^https?:\/\/(x\.com|twitter\.com)\//.test(url)) {
    return `
SITE-SPECIFIC (X/Twitter): This is a tweet/post. The page content may be limited.
- Search for the author and their background — are they credible on this topic?
- Search for reactions and quote-tweets discussing this post.
- Look for the broader conversation or news story this tweet is referencing.`;
  }

  // arXiv papers
  if (/^https?:\/\/arxiv\.org\//.test(url)) {
    return `
SITE-SPECIFIC (arXiv): This is a research paper.
- Search for discussions about this paper on social media, blogs, and forums.
- Look for related work and how this paper fits into the broader research landscape.
- Check if there's a code implementation or demo available.`;
  }

  // Hacker News
  if (/^https?:\/\/news\.ycombinator\.com\//.test(url)) {
    return `
SITE-SPECIFIC (Hacker News): This is a HN discussion.
- Focus on the most upvoted comments — they often contain expert insights.
- Identify the original source being discussed and research it directly.
- Look for contrarian views in the comments.`;
  }

  // YouTube
  if (/^https?:\/\/(www\.)?youtube\.com\//.test(url) || /^https?:\/\/youtu\.be\//.test(url)) {
    return `
SITE-SPECIFIC (YouTube): This is a video.
- The page content may just be metadata. Search for a transcript or summary.
- Look for discussions about this video on Reddit, Twitter, or blogs.
- Check the channel's credibility and audience.`;
  }

  return "";
}

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
${getSiteSpecificInstructions(urlInfo.url)}
4. Write your report in EXACTLY this markdown format:

# [Title of the content]

**Source**: ${urlInfo.url}
**Date Saved**: ${urlInfo.dateAdded?.toISOString().slice(0, 10) ?? "unknown"}
**Category**: [auto-detect: tech / science / business / culture / politics / other]

## Summary
[4-5 detailed paragraphs covering the main content thoroughly. Include relevant images using markdown image syntax where appropriate. Don't just skim — explain the substance.]

## Key Points
[Detailed prose covering all important takeaways. Use multiple paragraphs if needed. Explain WHY each point matters, not just what it is.]

## How It Works
[If applicable — explain the technical approach, methodology, or mechanism in detail. Skip this section if it doesn't apply.]

## Related Context
[Thorough coverage of what you found from your research — additional sources, contrasting views, background, recent developments, competing approaches. Cite URLs where relevant. This section should be substantial.]

## Assessment
[In-depth analytical take — what's significant, what's missing, what questions remain, who should care about this and why]

IMPORTANT: Output ONLY the markdown report. No preamble, no commentary, no explanation of your process.`;
}

export function buildPodcastPrompt(report: string): string {
  return `You are writing a podcast script for TWO hosts: Alex and Sarah.

**Alex** — genuinely enthusiastic and positive. Gets excited about ideas and sees the potential in things. Drops jokes, swears casually, and has infectious energy. He's the one who goes "okay but think about what this MEANS" — he connects dots and gets fired up about possibilities. Not naive though — he asks real questions.

**Sarah** — the skeptical optimist. She's genuinely curious and wants things to be good, but she's not going to let bullshit slide. Asks the hard "yeah but..." questions. Dry wit. When something IS actually impressive, she'll admit it — "okay fine, that's actually pretty cool." She keeps Alex grounded but she's not a downer. Swears when something deserves it.

Together they balance each other perfectly — Alex brings the excitement, Sarah pressure-tests it, and they usually land somewhere honest and insightful. They are NOT reading from a script — they are having a real conversation. They REACT to what the other person says. The overall vibe is two smart people who are genuinely interested in the topic and enjoying the conversation.

Based on the research report below, write a podcast script.

Rules:
- Approximately 5 minutes when read aloud (~750 words)
- Every line MUST start with either "ALEX:" or "SARAH:" — no exceptions, no narrator
- Open with a quick intro — Alex or Sarah briefly says what today's topic is ("So today we're looking at..." or "Alright, so this one's about...") in 1-2 sentences, then dive straight into the hook
- Be genuinely entertaining — jokes, banter, good-natured disagreements
- Overall tone is POSITIVE and curious — they're excited to explore this topic
- But also SKEPTICAL — they question claims, push back on hype, ask "does this actually work?"
- When something is genuinely cool, they celebrate it. When it's overhyped, they call it out with humour not cynicism
- Swearing is casual and natural, not angry — "oh shit that's cool" not "this is fucking stupid"
- Still be informative — cover all the key findings from the research
- End on an upbeat, forward-looking note — what's exciting, what to watch for

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
