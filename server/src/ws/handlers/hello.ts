import type { WebSocket } from "ws";
import { makeMessage, QR_SCHEME, PROTOCOL_VERSION, type DeckMessageOf } from "@deckboard/shared";
import type { ConnectionContext } from "../connectionRegistry.js";
import { send, dashboardSockets } from "../connectionRegistry.js";
import { getActiveSession } from "../../pairing/pairingService.js";
import { primaryLocalAddress } from "../../network/localIp.js";
import { PORT } from "../../config.js";
import { pushLayoutSnapshot } from "./layout.js";
import { pushBackgroundSnapshot } from "./background.js";

const SERVER_VERSION = "0.1.0";

export function handleHello(
  ws: WebSocket,
  ctx: ConnectionContext,
  msg: DeckMessageOf<"hello">,
  isLoopback: boolean,
): void {
  ctx.role = msg.payload.role;

  if (ctx.role === "dashboard") {
    if (!isLoopback) {
      send(ws, makeMessage("error", { code: "forbidden", message: "Dashboard role is only allowed from localhost" }));
      ws.close();
      return;
    }
    ctx.authenticated = true;
  }

  send(ws, makeMessage("hello.ack", { serverVersion: SERVER_VERSION, protocolVersion: PROTOCOL_VERSION }));

  if (ctx.role === "dashboard") {
    pushPairingSession(ws);
    pushLayoutSnapshot(ws);
    pushBackgroundSnapshot(ws);
  }
}

export function pushPairingSession(ws: WebSocket): void {
  const session = getActiveSession();
  const host = primaryLocalAddress();
  const qrUri = `${QR_SCHEME}://pair?v=1&host=${host}&port=${PORT}&pin=${session.pin}`;
  send(
    ws,
    makeMessage("pairing.session", {
      pin: session.pin,
      host,
      port: PORT,
      qrUri,
      expiresAt: session.expiresAt,
    }),
  );
}

export function broadcastPairingSession(): void {
  for (const ws of dashboardSockets()) {
    pushPairingSession(ws);
  }
}
