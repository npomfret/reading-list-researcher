import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { browsePage, screenshot, closeBrowser } from "./browser.js";
import { extractContent } from "./extractor.js";
import { search } from "./search.js";

const braveApiKey = process.env.BRAVE_API_KEY;
if (!braveApiKey) {
  console.error("BRAVE_API_KEY not set");
  process.exit(1);
}

const server = new McpServer({
  name: "research",
  version: "1.0.0",
});

server.tool(
  "browse_url",
  "Browse a URL, extract its main content using Readability, and return structured text",
  { url: z.string().url().describe("The URL to browse and extract content from") },
  async ({ url }) => {
    try {
      const html = await browsePage(url);
      const extracted = extractContent(html, url);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(extracted, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error browsing ${url}: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "web_search",
  "Search the web using Brave Search and return results",
  {
    query: z.string().describe("The search query"),
    count: z.number().min(1).max(20).default(10).describe("Number of results to return"),
  },
  async ({ query, count }) => {
    try {
      const results = await search(query, braveApiKey, count);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Search error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "screenshot",
  "Take a screenshot of a URL and return it as a base64-encoded image",
  { url: z.string().url().describe("The URL to screenshot") },
  async ({ url }) => {
    try {
      const buf = await screenshot(url);
      return {
        content: [
          {
            type: "image" as const,
            data: buf.toString("base64"),
            mimeType: "image/png",
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Screenshot error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// Clean up browser on exit
process.on("beforeExit", async () => {
  await closeBrowser();
});

const transport = new StdioServerTransport();
server.connect(transport);
