import type { WebSocket } from "ws";
import { makeMessage, type DeckMessageOf } from "@deckboard/shared";
import type { ConnectionContext } from "../connectionRegistry.js";
import { authenticatedSockets, send } from "../connectionRegistry.js";
import { clearBackground, getActiveBackground, setPresetBackground } from "../../settings/backgroundStore.js";
import { logger } from "../../logger.js";

export function pushBackgroundSnapshot(ws: WebSocket): void {
  send(ws, makeMessage("background.snapshot", { background: getActiveBackground() }));
}

export function broadcastBackgroundSnapshot(): void {
  for (const ws of authenticatedSockets()) {
    pushBackgroundSnapshot(ws);
  }
}

// Custom (uploaded-file) backgrounds are only ever set via the
// POST /api/settings/background multipart endpoint — there's no file to
// send over WS. This handles the "preset" and "none" cases from the editor.
export function handleBackgroundUpdate(ctx: ConnectionContext, msg: DeckMessageOf<"background.update">): void {
  if (!ctx.authenticated) return;
  const { background } = msg.payload;

  if (background.type === "preset") {
    setPresetBackground(background.presetId);
  } else if (background.type === "none") {
    clearBackground();
  } else {
    logger.warn("background.update with type=custom is ignored — use the upload endpoint instead");
    return;
  }
  broadcastBackgroundSnapshot();
}
