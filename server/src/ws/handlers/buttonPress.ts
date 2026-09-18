import type { WebSocket } from "ws";
import { makeMessage, type DeckMessageOf } from "@deckboard/shared";
import type { ConnectionContext } from "../connectionRegistry.js";
import { send, broadcastToDashboards } from "../connectionRegistry.js";
import { executeAction } from "../../actions/actionRegistry.js";
import { findButton } from "../../layout/layoutStore.js";

export async function handleButtonPress(
  ws: WebSocket,
  ctx: ConnectionContext,
  msg: DeckMessageOf<"button.press">,
): Promise<void> {
  if (!ctx.authenticated || !ctx.deviceId) return;

  send(ws, makeMessage("button.press.ack", { buttonId: msg.payload.buttonId, receivedAt: Date.now() }));
  broadcastToDashboards(makeMessage("button.press", msg.payload));

  const button = findButton(msg.payload.buttonId);
  const outcome = button
    ? await executeAction(button.action)
    : { success: false, message: "Unknown button" };

  send(
    ws,
    makeMessage("action.result", {
      buttonId: msg.payload.buttonId,
      success: outcome.success,
      message: outcome.message,
    }),
  );
}
