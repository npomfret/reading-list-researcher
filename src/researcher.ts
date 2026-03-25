import { query } from "@anthropic-ai/claude-agent-sdk";
import path from "path";
import { logger } from "./utils/logger.js";

export interface ResearchOutput {
  url: string;
  title: string;
  author: string | null;
  publication: string | null;
  datePublished: string | null;
  summary: string;
  keyPoints: string[];
  topics: string[];
  relatedLinks: { url: string; title: string; relevance: string }[];
  sentiment: string;
  contentType: string;
  researchNotes: string;
}

const RESEARCH_SCHEMA = {
  type: "object" as const,
  properties: {
    url: { type: "string" as const },
    title: { type: "string" as const },
    author: { type: ["string", "null"] as const },
    publication: { type: ["string", "null"] as const },
    datePublished: { type: ["string", "null"] as const },
    summary: { type: "string" as const, description: "3-5 paragraph detailed summary covering thesis, argument, evidence, counterpoints, and significance" },
    keyPoints: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "5-10 specific, detailed takeaways — each a complete thought with concrete details",
    },
    topics: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Topic tags/categories",
    },
    relatedLinks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          url: { type: "string" as const },
          title: { type: "string" as const },
          relevance: { type: "string" as const },
        },
        required: ["url", "title", "relevance"],
        additionalProperties: false,
      },
      description: "Notable related links found during research",
    },
    sentiment: { type: "string" as const, description: "Detailed description of tone, rhetorical style, and how the author positions their argument" },
    contentType: {
      type: "string" as const,
      description: "e.g. blog post, news article, research paper, tutorial, opinion piece",
    },
    researchNotes: {
      type: "string" as const,
      description: "Additional value-add: author background, broader context, reactions/counterarguments found, reliability caveats, how this fits the wider conversation",
    },
  },
  required: [
    "url",
    "title",
    "author",
    "publication",
    "datePublished",
    "summary",
    "keyPoints",
    "topics",
    "relatedLinks",
    "sentiment",
    "contentType",
    "researchNotes",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are an expert research analyst. Your job is to thoroughly research a given URL from someone's reading list and produce rich, detailed, structured output that saves the reader significant time.

## Research process

1. **Read the source thoroughly.** Browse the URL and read every section. Do not skim — understand the full argument, narrative, or explanation before summarising.

2. **Identify metadata.** Find the author, publication/site, and publication date. If not stated explicitly, check bylines, meta tags, or search the web.

3. **Follow referenced sources.** If the content cites, links to, or builds on other work, browse 3-5 of the most important references to deepen your understanding. Prioritise primary sources, data, and counterarguments.

4. **Search for context.** Do at least one web search to find:
   - Who the author is and why their perspective matters
   - Reactions, critiques, or follow-ups to this piece
   - Broader context: what debate or trend does this fit into?

5. **Synthesise.** Combine everything into the structured JSON output, following the quality guidelines below.

## Quality guidelines

- **Summary**: Write 3-5 substantial paragraphs. Open with the core thesis/finding, then walk through the main argument or narrative arc, cover supporting evidence and examples, note any limitations or counterpoints, and close with significance/implications. Write in a way that someone who hasn't read the original would understand the content fully.

- **Key points**: Provide 5-10 specific, actionable takeaways. Each should be a complete thought (1-2 sentences), not a vague label. Include specific numbers, names, or claims where relevant.

- **Sentiment**: Go beyond a single word. Describe the tone, rhetorical style, and how the author positions their argument (e.g. "Cautiously optimistic with an evidence-driven approach; the author acknowledges risks but argues the potential benefits outweigh them").

- **Content type**: Be specific (e.g. "long-form investigative journalism", "technical tutorial with code examples", "academic literature review", "founder's personal essay").

- **Research notes**: This is your space to add value beyond what the source says. Include: context you found from other sources, the author's credibility/background, how this piece fits into the broader conversation, any notable reactions or counterarguments you found, and any caveats about the source's reliability or potential biases.

- **Related links**: Include links you actually browsed or found during research, with a sentence explaining why each is relevant.

- **Topics**: Provide 3-6 specific topic tags. Prefer specific terms over generic ones (e.g. "LLM fine-tuning" not just "AI").`;

export async function runResearch(
  url: string,
  title: string
): Promise<ResearchOutput> {
  const mcpServerPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "research-mcp.ts"
  );

  logger.info(`Starting research for: "${title}"`);

  let result: ResearchOutput | null = null;

  for await (const message of query({
    prompt: `Research this URL from my reading list:\n\nTitle: ${title}\nURL: ${url}\n\nInstructions:\n1. Browse the URL and read the full content carefully\n2. Follow 3-5 of the most important referenced sources or links\n3. Search the web for context about the author and reactions to this piece\n4. Produce detailed, thorough structured output — the reader should feel they fully understand the content without reading the original`,
    options: {
      model: "claude-haiku-4-5-20251001",
      systemPrompt: SYSTEM_PROMPT,
      maxTurns: 25,
      allowedTools: [
        "mcp__research__browse_url",
        "mcp__research__web_search",
        "mcp__research__screenshot",
      ],
      mcpServers: {
        research: {
          command: "npx",
          args: ["tsx", mcpServerPath],
          env: {
            BRAVE_API_KEY: process.env.BRAVE_API_KEY ?? "",
          },
        },
      },
      outputFormat: {
        type: "json_schema",
        schema: RESEARCH_SCHEMA,
      },
    },
  })) {
    if (message.type === "assistant") {
      logger.info(`Agent: ${(message as any).content?.substring?.(0, 200) ?? "[tool use]"}`);
    }
    if (message.type === "result" && message.subtype === "success") {
      result = (message as any).structured_output ?? null;
      if (!result && message.result) {
        try {
          result = JSON.parse(message.result);
        } catch {}
      }
    }
  }

  if (!result) {
    throw new Error("Research agent returned no structured output");
  }

  logger.info(`Research complete: "${result.title}" — ${result.keyPoints.length} key points`);
  return result;
}
