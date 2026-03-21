import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const TTS_SCRIPT = join(__dirname, "..", "..", "scripts", "tts.py");
const VENV_PYTHON = join(__dirname, "..", "..", ".venv", "bin", "python3");

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")          // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")       // bold
    .replace(/\*(.+?)\*/g, "$1")           // italic
    .replace(/`(.+?)`/g, "$1")             // inline code
    .replace(/^(?!(?:ALEX|SARAH):)[-*]\s+/gm, "") // list markers (preserve speaker lines)
    .replace(/^>\s+/gm, "")                // blockquotes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/^---+$/gm, "")               // horizontal rules
    .replace(/\[PAUSE\]/gi, "...")          // pause markers → natural pause
    .replace(/\n{3,}/g, "\n\n")            // collapse excessive newlines
    .trim();
}

export async function synthesize(script: string, outputMp3Path: string): Promise<void> {
  const plainText = stripMarkdown(script);

  // Write to temp file for the Python script to read
  const tmpTextFile = outputMp3Path.replace(".mp3", ".txt");
  writeFileSync(tmpTextFile, plainText, "utf-8");

  try {
    await exec(VENV_PYTHON, [TTS_SCRIPT, tmpTextFile, outputMp3Path], {
      timeout: 600_000, // 10 min — long scripts take a while
      maxBuffer: 10 * 1024 * 1024,
    });
  } finally {
    try { unlinkSync(tmpTextFile); } catch {}
  }
}
