import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "dummy",
  version: "1.0.0",
});

server.tool(
  "echo",
  "Takes a string and returns it uppercased",
  { text: z.string().describe("The text to uppercase") },
  async ({ text }) => ({
    content: [{ type: "text", text: text.toUpperCase() }],
  })
);

const transport = new StdioServerTransport();
server.connect(transport);
