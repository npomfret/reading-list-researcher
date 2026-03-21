import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
const TTS_SCRIPT = join(PROJECT_ROOT, "scripts", "tts.py");
const VENV_PYTHON = join(PROJECT_ROOT, ".venv", "bin", "python3");

function loadEnv(): Record<string, string> {
  try {
    const envFile = readFileSync(join(PROJECT_ROOT, ".env"), "utf-8");
    const env: Record<string, string> = {};
    for (const line of envFile.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) env[match[1].trim()] = match[2].trim();
    }
    return env;
  } catch {
    return {};
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")          // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")       // bold
    .replace(/\*(.+?)\*/g, "$1")           // italic
    .replace(/`(.+?)`/g, "$1")             // inline code
    .replace(/^(?!(?:ALEX|SARAH):)[-*]\s+/gm, "") // list markers (preserve speaker lines)
    .replace(/^>\s+/gm, "")                // blockquotes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links — but NOT audio tags like [laughs]
    .replace(/^---+$/gm, "")               // horizontal rules
    .replace(/\[PAUSE\]/gi, "[pause]")     // normalize pause markers
    .replace(/\n{3,}/g, "\n\n")            // collapse excessive newlines
    .trim();
}

export async function synthesize(script: string, outputMp3Path: string): Promise<void> {
  const plainText = stripMarkdown(script);
  const dotenv = loadEnv();

  const tmpTextFile = outputMp3Path.replace(".mp3", ".txt");
  writeFileSync(tmpTextFile, plainText, "utf-8");

  try {
    await exec(VENV_PYTHON, [TTS_SCRIPT, tmpTextFile, outputMp3Path], {
      timeout: 600_000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, ...dotenv },
    });
  } finally {
    try { unlinkSync(tmpTextFile); } catch {}
  }
}
