import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BackgroundConfig } from "@deckboard/shared";
import { logger } from "../logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
export const BACKGROUNDS_DIR = path.join(DATA_DIR, "backgrounds");
const META_FILE = path.join(DATA_DIR, "background.json");

interface BackgroundMeta {
  type: "none" | "preset" | "custom";
  presetId?: string;
  filename?: string;
}

function load(): BackgroundMeta {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, "utf-8")) as BackgroundMeta;
  } catch {
    return { type: "none" };
  }
}

function persist(next: BackgroundMeta): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(META_FILE, JSON.stringify(next, null, 2));
  } catch (err) {
    logger.error("failed to persist background.json", err);
  }
}

let meta: BackgroundMeta = load();

export function ensureBackgroundsDir(): void {
  fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true });
}

export function getActiveBackground(): BackgroundConfig {
  if (meta.type === "preset" && meta.presetId) {
    return { type: "preset", presetId: meta.presetId };
  }
  if (meta.type === "custom" && meta.filename) {
    return { type: "custom", url: `/api/background/${meta.filename}` };
  }
  return { type: "none" };
}

function removeFile(filename: string): void {
  fs.rm(path.join(BACKGROUNDS_DIR, filename), () => {
    // best-effort cleanup — a leftover file in a gitignored cache dir is harmless
  });
}

function clearCustomFileIfAny(): void {
  if (meta.type === "custom" && meta.filename) {
    removeFile(meta.filename);
  }
}

export function setPresetBackground(presetId: string): void {
  clearCustomFileIfAny();
  meta = { type: "preset", presetId };
  persist(meta);
}

export function setCustomBackgroundFile(filename: string): void {
  clearCustomFileIfAny();
  meta = { type: "custom", filename };
  persist(meta);
}

export function clearBackground(): void {
  clearCustomFileIfAny();
  meta = { type: "none" };
  persist(meta);
}
