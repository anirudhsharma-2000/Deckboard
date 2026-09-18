import { WebSocketServer } from "ws";
import type { Server } from "node:http";
import { DeckMessageSchema, makeMessage } from "@deckboard/shared";
import { logger } from "../logger.js";
import { register, unregister, getContext, send, broadcastToDashboards } from "./connectionRegistry.js";
import { handleHello, broadcastPairingSession } from "./handlers/hello.js";
import { handlePairRequest, handlePairResume } from "./handlers/pairing.js";
import { handleButtonPress } from "./handlers/buttonPress.js";
import { handleHeartbeat } from "./handlers/heartbeat.js";
import { handleLayoutGet, handleLayoutUpdate } from "./handlers/layout.js";
import { handleBackgroundUpdate } from "./handlers/background.js";
import { regeneratePin } from "../pairing/pairingService.js";

const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function attachWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, request) => {
    const remoteAddress = request.socket.remoteAddress ?? "";
    const isLoopback = LOOPBACK_ADDRESSES.has(remoteAddress);
    const ctx = register(ws, remoteAddress);
    logger.info(`connection opened from ${remoteAddress}`);

    ws.on("message", (raw) => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw.toString());
      } catch {
        send(ws, makeMessage("error", { code: "bad_json", message: "Message was not valid JSON" }));
        return;
      }

      const result = DeckMessageSchema.safeParse(parsedJson);
      if (!result.success) {
        send(ws, makeMessage("error", { code: "bad_message", message: "Message failed schema validation" }));
        return;
      }

      const msg = result.data;
      ctx.lastSeen = Date.now();

      switch (msg.type) {
        case "hello":
          handleHello(ws, ctx, msg, isLoopback);
          break;
        case "pair.request":
          handlePairRequest(ws, ctx, msg);
          break;
        case "pair.resume":
          handlePairResume(ws, ctx, msg);
          break;
        case "button.press":
          handleButtonPress(ws, ctx, msg).catch((err) => logger.error("button.press handling failed", err));
          break;
        case "heartbeat":
          handleHeartbeat(ctx);
          break;
        case "pairing.regenerate":
          regeneratePin();
          broadcastPairingSession();
          break;
        case "layout.get":
          handleLayoutGet(ws);
          break;
        case "layout.update":
          handleLayoutUpdate(ctx, msg);
          break;
        case "background.update":
          handleBackgroundUpdate(ctx, msg);
          break;
        default:
          break;
      }
    });

    ws.on("close", () => {
      const closedCtx = getContext(ws);
      logger.info(`connection closed from ${remoteAddress}`);
      if (closedCtx?.role === "controller" && closedCtx.deviceId) {
        broadcastToDashboards(
          makeMessage("device.disconnected", {
            deviceId: closedCtx.deviceId,
            deviceName: closedCtx.deviceName ?? "Unknown device",
            at: Date.now(),
          }),
        );
      }
      unregister(ws);
    });

    ws.on("error", (err) => {
      logger.error("socket error", err);
    });
  });

  return wss;
}
