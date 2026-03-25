import { execFile } from "child_process";

export function notify(message: string, title = "Research Agent"): void {
  execFile("osascript", [
    "-e",
    `display notification "${message}" with title "${title}"`,
  ]);
}
