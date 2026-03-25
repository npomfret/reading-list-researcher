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
    summary: { type: "string" as const, description: "2-3 paragraph summary of the content" },
    keyPoints: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "3-7 key takeaways",
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
    sentiment: { type: "string" as const, description: "Overall tone/sentiment of the piece" },
    contentType: {
      type: "string" as const,
      description: "e.g. blog post, news article, research paper, tutorial, opinion piece",
    },
    researchNotes: {
      type: "string" as const,
      description: "Any additional context, caveats, or notes from the research process",
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

const SYSTEM_PROMPT = `You are a research assistant. Your job is to thoroughly research a given URL from someone's reading list and produce structured output.

Steps:
1. Browse the URL to read the full content
2. Identify the author, publication, and date
3. If the content references other important sources, browse 1-2 of the most relevant ones
4. Search the web for additional context about the topic or author if helpful
5. Compile your findings into the structured JSON output

Be thorough but efficient. Focus on understanding what the content is about, why it matters, and what the key takeaways are.`;

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
    prompt: `Research this URL from my reading list:\n\nTitle: ${title}\nURL: ${url}\n\nBrowse the URL, understand the content, search for additional context if needed, and produce the structured research output.`,
    options: {
      model: "claude-haiku-4-5-20251001",
      systemPrompt: SYSTEM_PROMPT,
      maxTurns: 15,
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
