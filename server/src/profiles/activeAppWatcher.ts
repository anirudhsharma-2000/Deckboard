import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { makeMessage } from "@deckboard/shared";
import { logger } from "../logger.js";
import { findPageByName, getActivePageId, setActivePageId } from "../layout/layoutStore.js";
import { broadcastToAll } from "../ws/connectionRegistry.js";

const execFileAsync = promisify(execFile);
const POLL_INTERVAL_MS = 2000;

let timer: ReturnType<typeof setInterval> | null = null;

async function getFrontmostAppName(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'tell application "System Events" to get name of first application process whose frontmost is true',
    ]);
    return stdout.trim() || null;
  } catch (err) {
    logger.warn("failed to read frontmost app (Automation permission may not be granted yet)", err);
    return null;
  }
}

async function tick(): Promise<void> {
  const appName = await getFrontmostAppName();
  if (!appName) return;

  const page = findPageByName(appName);
  if (!page || page.id === getActivePageId()) return;

  if (setActivePageId(page.id)) {
    broadcastToAll(makeMessage("layout.activePage", { pageId: page.id }));
    logger.info(`active app "${appName}" matched page "${page.name}" — switching active page`);
  }
}

/** Name a page after a macOS app (e.g. "Safari") and this jumps to it automatically
 * when that app is focused. No-op on non-macOS platforms. */
export function startActiveAppWatcher(): void {
  if (timer || process.platform !== "darwin") return;
  timer = setInterval(() => {
    tick().catch((err) => logger.error("activeAppWatcher tick failed", err));
  }, POLL_INTERVAL_MS);
  logger.info("active-app profile watcher started");
}

export function stopActiveAppWatcher(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info("active-app profile watcher stopped");
  }
}

export function isActiveAppWatcherRunning(): boolean {
  return timer !== null;
}
