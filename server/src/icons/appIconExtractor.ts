import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { logger } from "../logger.js";
import { ICONS_DIR } from "./faviconFetcher.js";

const execFileAsync = promisify(execFile);

const APP_DIRS = [
  "/Applications",
  "/Applications/Utilities",
  "/System/Applications",
  "/System/Applications/Utilities",
  path.join(process.env.HOME ?? "", "Applications"),
].filter(Boolean);

export interface InstalledApp {
  name: string;
  path: string;
  iconUrl: string | null;
}

async function listAppBundles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && e.name.endsWith(".app")).map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

async function readInfoPlist(appPath: string): Promise<Record<string, unknown> | null> {
  const plistPath = path.join(appPath, "Contents", "Info.plist");
  try {
    const { stdout } = await execFileAsync("plutil", ["-convert", "json", "-o", "-", plistPath]);
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function convertIcnsToPng(icnsPath: string, outPath: string): Promise<boolean> {
  try {
    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    // 256px source so the icon stays crisp even though tiles render it small.
    await execFileAsync("sips", ["-s", "format", "png", "-Z", "256", icnsPath, "--out", outPath]);
    return true;
  } catch (err) {
    logger.warn(`app icon: failed to convert ${icnsPath}`, err);
    return false;
  }
}

async function resolveAppIcon(appPath: string, plist: Record<string, unknown>): Promise<string | null> {
  const iconFileName = plist.CFBundleIconFile as string | undefined;
  if (!iconFileName) return null; // some apps only ship an Assets.car icon — not extractable without a heavier toolchain

  const baseName = iconFileName.endsWith(".icns") ? iconFileName : `${iconFileName}.icns`;
  const icnsPath = path.join(appPath, "Contents", "Resources", baseName);
  if (!fs.existsSync(icnsPath)) return null;

  const hash = crypto.createHash("sha1").update(appPath).digest("hex").slice(0, 16);
  const outPath = path.join(ICONS_DIR, `app-${hash}.png`);

  if (!fs.existsSync(outPath)) {
    const ok = await convertIcnsToPng(icnsPath, outPath);
    if (!ok) return null;
  }
  return `/api/icons/${path.basename(outPath)}`;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

let cache: { apps: InstalledApp[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Scans /Applications (+ ~/Applications, /System/Applications) for .app bundles,
 * reading each one's name and extracting its .icns icon as a cached PNG.
 * macOS-only — returns [] everywhere else. */
export async function listInstalledApps(): Promise<InstalledApp[]> {
  if (process.platform !== "darwin") return [];
  if (cache && cache.expiresAt > Date.now()) return cache.apps;

  const bundleLists = await Promise.all(APP_DIRS.map(listAppBundles));
  const bundles = [...new Set(bundleLists.flat())];

  const apps = await mapWithConcurrency(bundles, 8, async (appPath): Promise<InstalledApp | null> => {
    const plist = await readInfoPlist(appPath);
    if (!plist) return null;
    const name =
      (plist.CFBundleDisplayName as string | undefined) ??
      (plist.CFBundleName as string | undefined) ??
      path.basename(appPath, ".app");
    const iconUrl = await resolveAppIcon(appPath, plist);
    return { name, path: appPath, iconUrl };
  });

  const result = apps.filter((a): a is InstalledApp => a !== null).sort((a, b) => a.name.localeCompare(b.name));
  cache = { apps: result, expiresAt: Date.now() + CACHE_TTL_MS };
  return result;
}
