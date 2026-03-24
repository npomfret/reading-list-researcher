import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { logger } from "./logger.js";

export interface ReadingListEntry {
  url: string;
  title: string;
  dateAdded: string;
}

export function parseReadingList(plistPath: string): ReadingListEntry[] {
  if (!fs.existsSync(plistPath)) {
    logger.error(`Bookmarks.plist not found at ${plistPath}`);
    return [];
  }

  // Copy to tmp first — Safari may have the file locked
  const tmpPath = path.join(os.tmpdir(), `bookmarks-${Date.now()}.plist`);

  try {
    fs.copyFileSync(plistPath, tmpPath);
    return extractViaPlutil(tmpPath);
  } catch (err: any) {
    if (err.code === "EBUSY" || err.code === "EPERM") {
      logger.warn(`Plist file busy, will retry on next cycle: ${err.message}`);
    } else {
      logger.error(`Failed to parse plist: ${err.message}`);
    }
    return [];
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

function plutilExtract(keyPath: string, plistFile: string): string | null {
  try {
    return execSync(
      `plutil -extract "${keyPath}" raw "${plistFile}"`,
      { timeout: 10000, encoding: "utf-8" }
    ).trim();
  } catch {
    return null;
  }
}

function extractViaPlutil(plistFile: string): ReadingListEntry[] {
  // Find the Reading List folder among top-level children
  const topCount = parseInt(plutilExtract("Children", plistFile) ?? "0", 10);
  let rlIndex = -1;

  for (let i = 0; i < topCount; i++) {
    const title = plutilExtract(`Children.${i}.Title`, plistFile);
    if (title === "com.apple.ReadingList") {
      rlIndex = i;
      break;
    }
  }

  if (rlIndex === -1) {
    logger.warn("Reading List folder not found in bookmarks");
    return [];
  }

  const itemCount = parseInt(
    plutilExtract(`Children.${rlIndex}.Children`, plistFile) ?? "0",
    10
  );

  const entries: ReadingListEntry[] = [];
  const base = `Children.${rlIndex}.Children`;

  for (let i = 0; i < itemCount; i++) {
    const url = plutilExtract(`${base}.${i}.URLString`, plistFile);
    if (!url) continue;

    const title =
      plutilExtract(`${base}.${i}.URIDictionary.title`, plistFile) ?? url;
    const dateAdded =
      plutilExtract(`${base}.${i}.ReadingList.DateAdded`, plistFile) ?? "";

    entries.push({ url, title, dateAdded });
  }

  return entries;
}
