import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { logger } from "../logger.js";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ICONS_DIR = path.resolve(__dirname, "../../data/icons");

const FETCH_TIMEOUT_MS = 5000;
const MAX_ICON_BYTES = 2 * 1024 * 1024;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

/** Lightweight regex scan for <link rel="...icon..." href="..."> — a full DOM
 * parser is overkill for finding a handful of self-contained tags. */
function extractIconHref(html: string): string | null {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  let best: { href: string; priority: number } | null = null;

  for (const tag of linkTags) {
    const relMatch = /rel=["']([^"']+)["']/i.exec(tag);
    const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
    if (!relMatch || !hrefMatch) continue;

    const rel = relMatch[1].toLowerCase();
    if (!rel.includes("icon")) continue;

    const priority = rel.includes("apple-touch-icon") ? 2 : 1;
    if (!best || priority > best.priority) {
      best = { href: hrefMatch[1], priority };
    }
  }
  return best?.href ?? null;
}

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return "png";
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("icon")) return "ico";
  return "png";
}

/** Converts any image file to PNG in place. Android's BitmapFactory can't
 * decode SVG or classic multi-resolution ICO favicons at all — normalizing
 * everything server-side means every client (Android, the website, Coil)
 * only ever has to handle one format. macOS-only (`sips`); on other
 * platforms we fall back to serving whatever format was downloaded. */
async function normalizeToPng(sourcePath: string, targetPath: string): Promise<boolean> {
  try {
    await execFileAsync("sips", ["-s", "format", "png", sourcePath, "--out", targetPath]);
    return true;
  } catch (err) {
    logger.warn(`favicon: failed to normalize ${sourcePath} to PNG`, err);
    return false;
  }
}

async function downloadIcon(iconUrl: string): Promise<string | null> {
  const { signal, cancel } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(iconUrl, { signal });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_ICON_BYTES) return null;

    const sourceExt = extensionFromContentType(res.headers.get("content-type"));
    const hash = crypto.createHash("sha1").update(iconUrl).digest("hex").slice(0, 16);

    await fs.promises.mkdir(ICONS_DIR, { recursive: true });

    if (sourceExt === "png") {
      const filename = `favicon-${hash}.png`;
      await fs.promises.writeFile(path.join(ICONS_DIR, filename), buffer);
      return `/api/icons/${filename}`;
    }

    const sourcePath = path.join(ICONS_DIR, `.src-favicon-${hash}.${sourceExt}`);
    const targetFilename = `favicon-${hash}.png`;
    const targetPath = path.join(ICONS_DIR, targetFilename);
    await fs.promises.writeFile(sourcePath, buffer);

    if (process.platform === "darwin") {
      const ok = await normalizeToPng(sourcePath, targetPath);
      fs.promises.rm(sourcePath, { force: true }).catch(() => {});
      if (!ok) return null;
      return `/api/icons/${targetFilename}`;
    }

    // Non-macOS fallback: serve the original format as-is (best effort —
    // SVG/ICO may not render on every client).
    const fallbackFilename = `favicon-${hash}.${sourceExt}`;
    await fs.promises.rename(sourcePath, path.join(ICONS_DIR, fallbackFilename));
    return `/api/icons/${fallbackFilename}`;
  } catch (err) {
    logger.warn(`favicon: failed to download ${iconUrl}`, err);
    return null;
  } finally {
    cancel();
  }
}

/** Fetches the page, looks for a declared icon link, falls back to /favicon.ico.
 * Returns a server-relative `/api/icons/...` path, or null if nothing worked. */
export async function fetchFavicon(pageUrl: string): Promise<string | null> {
  let origin: URL;
  try {
    origin = new URL(pageUrl);
  } catch {
    return null;
  }

  const candidates: string[] = [];
  const { signal, cancel } = withTimeout(FETCH_TIMEOUT_MS);
  try {
    const pageRes = await fetch(origin.toString(), { signal, redirect: "follow" });
    const html = await pageRes.text();
    const href = extractIconHref(html);
    if (href) candidates.push(new URL(href, pageRes.url || origin).toString());
  } catch (err) {
    logger.warn(`favicon: failed to fetch page ${origin.toString()}`, err);
  } finally {
    cancel();
  }
  candidates.push(new URL("/favicon.ico", origin).toString());

  for (const candidate of candidates) {
    const icon = await downloadIcon(candidate);
    if (icon) return icon;
  }
  return null;
}
