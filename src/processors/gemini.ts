import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LlmProcessor, ProcessorResult, UrlInfo } from "./types.js";
import { buildPrompt } from "../prompt.js";

const exec = promisify(execFile);

export class GeminiProcessor implements LlmProcessor {
  name = "gemini";
  constructor(private timeoutMs = 300_000) {}

  async process(urlInfo: UrlInfo): Promise<ProcessorResult> {
    const { stdout } = await exec("gemini", ["-p", buildPrompt(urlInfo)], {
      timeout: this.timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { report: stdout.trim() };
  }
}
