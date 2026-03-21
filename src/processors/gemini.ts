import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { LlmProcessor, ProcessorResult, UrlInfo } from "./types.js";
import { buildPrompt } from "../prompt.js";

const exec = promisify(execFile);

const home = process.env.HOME ?? "/Users/unknown";
const LOG_DIR = join(home, "Library/Mobile Documents/com~apple~CloudDocs/ReadingListResearcher/logs");

function logGemini(label: string, stdout: string, stderr: string): void {
  mkdirSync(LOG_DIR, { recursive: true });
  const timestamp = new Date().toISOString();
  const logFile = join(LOG_DIR, `gemini-${timestamp.slice(0, 10)}.log`);
  const entry = [
    `\n=== ${label} @ ${timestamp} ===`,
    `--- stdout (${stdout.length} chars) ---`,
    stdout.slice(0, 2000),
    stdout.length > 2000 ? `\n... truncated (${stdout.length} total chars)` : "",
    `--- stderr ---`,
    stderr || "(empty)",
    `=== end ===\n`,
  ].join("\n");
  appendFileSync(logFile, entry, "utf-8");
}

export class GeminiProcessor implements LlmProcessor {
  name = "gemini";
  constructor(private timeoutMs = 300_000) {}

  async process(urlInfo: UrlInfo, pageContent: string): Promise<ProcessorResult> {
    const { stdout, stderr } = await exec("gemini", ["-p", buildPrompt(urlInfo, pageContent)], {
      timeout: this.timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    logGemini(`process: ${urlInfo.url}`, stdout, stderr);
    return { report: stdout.trim() };
  }

  async generate(prompt: string): Promise<string> {
    const { stdout, stderr } = await exec("gemini", ["-p", prompt], {
      timeout: this.timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    logGemini("generate: podcast", stdout, stderr);
    return stdout.trim();
  }
}
