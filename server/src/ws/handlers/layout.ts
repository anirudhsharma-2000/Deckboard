import type { WebSocket } from "ws";
import { makeMessage, type DeckMessageOf } from "@deckboard/shared";
import type { ConnectionContext } from "../connectionRegistry.js";
import { authenticatedSockets, send } from "../connectionRegistry.js";
import { getActivePageId, getLayout, updateLayout } from "../../layout/layoutStore.js";

export function pushLayoutSnapshot(ws: WebSocket): void {
  send(ws, makeMessage("layout.snapshot", { pages: getLayout().pages, activePageId: getActivePageId() }));
}

export function broadcastLayoutSnapshot(): void {
  for (const ws of authenticatedSockets()) {
    pushLayoutSnapshot(ws);
  }
}

export function handleLayoutGet(ws: WebSocket): void {
  pushLayoutSnapshot(ws);
}

export function handleLayoutUpdate(ctx: ConnectionContext, msg: DeckMessageOf<"layout.update">): void {
  if (!ctx.authenticated) return;
  updateLayout(msg.payload.pages);
  broadcastLayoutSnapshot();
}
