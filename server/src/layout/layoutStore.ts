import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultLayout, LayoutSchema, type ButtonConfig, type Layout, type PageConfig } from "@deckboard/shared";
import { logger } from "../logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const LAYOUT_FILE = path.join(DATA_DIR, "layout.json");

interface StoredState {
  layout: Layout;
  activePageId: string;
}

function load(): StoredState {
  try {
    const raw = fs.readFileSync(LAYOUT_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { layout?: unknown; activePageId?: string };
    // Parsed (not just cast) so older layout.json files saved before pages
    // had `rows`/`columns` get those fields backfilled via the schema's
    // defaults, instead of silently loading pages that are missing them.
    const result = LayoutSchema.safeParse(parsed.layout);
    if (result.success && result.data.pages.length) {
      return { layout: result.data, activePageId: parsed.activePageId ?? result.data.pages[0].id };
    }
  } catch {
    // no saved layout yet — fall through to the default
  }
  const layout = createDefaultLayout();
  return { layout, activePageId: layout.pages[0].id };
}

function persist(next: StoredState): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LAYOUT_FILE, JSON.stringify(next, null, 2));
  } catch (err) {
    logger.error("failed to persist layout.json", err);
  }
}

let state: StoredState = load();

export function getLayout(): Layout {
  return state.layout;
}

export function getActivePageId(): string {
  if (!state.layout.pages.some((page) => page.id === state.activePageId)) {
    state.activePageId = state.layout.pages[0]?.id ?? "";
  }
  return state.activePageId;
}

/** Returns false if pageId doesn't exist in the current layout. */
export function setActivePageId(pageId: string): boolean {
  if (!state.layout.pages.some((page) => page.id === pageId)) return false;
  state.activePageId = pageId;
  persist(state);
  return true;
}

export function updateLayout(pages: PageConfig[]): void {
  const activePageId = pages.some((page) => page.id === state.activePageId)
    ? state.activePageId
    : (pages[0]?.id ?? "");
  state = { layout: { pages }, activePageId };
  persist(state);
}

export function findButton(buttonId: string): ButtonConfig | undefined {
  for (const page of state.layout.pages) {
    const button = page.buttons.find((b) => b.id === buttonId);
    if (button) return button;
  }
  return undefined;
}

/** Case-insensitive lookup used by Phase 5 active-app profile mapping. */
export function findPageByName(name: string): PageConfig | undefined {
  const target = name.toLowerCase();
  return state.layout.pages.find((page) => page.name.toLowerCase() === target);
}
