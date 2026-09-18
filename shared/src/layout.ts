import { z } from "zod";

export const SystemCommandSchema = z.enum([
  "lock",
  "sleep",
  "mute",
  "volume_up",
  "volume_down",
  "media_play_pause",
  "media_next",
  "media_previous",
  "screenshot_full",
  "screenshot_selection",
  "screenshot_recording",
  "empty_trash",
  "log_out",
  "restart",
  "shut_down",
]);

export type SystemCommand = z.infer<typeof SystemCommandSchema>;

// A button's configured behavior. `none` is the Phase 1 placeholder state —
// still valid in Phase 2+ for an unconfigured slot.
export const ActionConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("open_url"), url: z.string() }),
  z.object({ type: z.literal("hotkey"), keys: z.array(z.string()) }),
  z.object({ type: z.literal("obs_scene"), sceneName: z.string() }),
  z.object({ type: z.literal("launch_app"), appPath: z.string(), appName: z.string() }),
  z.object({ type: z.literal("system"), command: SystemCommandSchema }),
]);

export type ActionConfig = z.infer<typeof ActionConfigSchema>;

// Historical default (3x3) — kept for anything still importing it, but a
// page's actual size now comes from its own `rows`/`columns` fields, not
// this constant.
export const BUTTONS_PER_PAGE = 9;

export const DEFAULT_GRID_ROWS = 3;
export const DEFAULT_GRID_COLUMNS = 3;
export const MIN_GRID_SIZE = 1;
export const MAX_GRID_SIZE = 6;

export const ButtonConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  action: ActionConfigSchema,
});

export type ButtonConfig = z.infer<typeof ButtonConfigSchema>;

export const PageConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  rows: z.number().int().min(MIN_GRID_SIZE).max(MAX_GRID_SIZE).default(DEFAULT_GRID_ROWS),
  columns: z.number().int().min(MIN_GRID_SIZE).max(MAX_GRID_SIZE).default(DEFAULT_GRID_COLUMNS),
  buttons: z.array(ButtonConfigSchema),
});

export type PageConfig = z.infer<typeof PageConfigSchema>;

export const LayoutSchema = z.object({
  pages: z.array(PageConfigSchema),
});

export type Layout = z.infer<typeof LayoutSchema>;

function emptyButton(index: number): ButtonConfig {
  return {
    id: crypto.randomUUID(),
    label: `Button ${index + 1}`,
    icon: "",
    action: { type: "none" },
  };
}

export function createEmptyPage(name: string, rows = DEFAULT_GRID_ROWS, columns = DEFAULT_GRID_COLUMNS): PageConfig {
  return {
    id: crypto.randomUUID(),
    name,
    rows,
    columns,
    buttons: Array.from({ length: rows * columns }, (_, i) => emptyButton(i)),
  };
}

export function createDefaultLayout(): Layout {
  return { pages: [createEmptyPage("Home")] };
}
