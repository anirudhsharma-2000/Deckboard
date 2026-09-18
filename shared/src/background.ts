import { z } from "zod";

// A small curated set of gradients, defined as color stops rather than image
// files — both the website (CSS) and Android (Compose Brush) can render a
// two-color gradient natively, so no image generation/storage is needed for
// presets. Keep this list and docs/protocol.md's copy in sync (Android
// mirrors it by hand — see data/protocol/Background.kt).
export const BACKGROUND_PRESETS = [
  { id: "midnight", name: "Midnight", colors: ["#0f172a", "#1e293b"] },
  { id: "sunset", name: "Sunset", colors: ["#f97316", "#ec4899"] },
  { id: "ocean", name: "Ocean", colors: ["#0ea5e9", "#0f172a"] },
  { id: "forest", name: "Forest", colors: ["#065f46", "#022c22"] },
  { id: "violet", name: "Violet", colors: ["#7c3aed", "#1e1b4b"] },
  { id: "graphite", name: "Graphite", colors: ["#27272a", "#09090b"] },
] as const satisfies { id: string; name: string; colors: [string, string] }[];

export function getBackgroundPreset(id: string) {
  return BACKGROUND_PRESETS.find((p) => p.id === id);
}

export const BackgroundConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("preset"), presetId: z.string() }),
  z.object({ type: z.literal("custom"), url: z.string() }),
]);

export type BackgroundConfig = z.infer<typeof BackgroundConfigSchema>;
