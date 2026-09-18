import type { WebSocket } from "ws";
import { makeMessage, type DeckMessageOf } from "@deckboard/shared";
import type { ConnectionContext } from "../connectionRegistry.js";
import { send, broadcastToDashboards } from "../connectionRegistry.js";
import { validatePin, consumePin, regeneratePin, generateDeviceToken } from "../../pairing/pairingService.js";
import { getDevice, saveDevice, validateToken } from "../../pairing/deviceStore.js";
import { broadcastPairingSession } from "./hello.js";
import { pushLayoutSnapshot } from "./layout.js";
import { pushBackgroundSnapshot } from "./background.js";

function pairErrorMessage(code: "invalid_pin" | "expired" | "already_used" | "invalid_token"): string {
  switch (code) {
    case "invalid_pin":
      return "Incorrect PIN";
    case "expired":
      return "PIN expired — get a new one from the dashboard";
    case "already_used":
      return "PIN already used — get a new one from the dashboard";
    case "invalid_token":
      return "Unknown device or token, please re-pair";
  }
}

export function handlePairRequest(ws: WebSocket, ctx: ConnectionContext, msg: DeckMessageOf<"pair.request">): void {
  const { pin, deviceId, deviceName } = msg.payload;
  const result = validatePin(pin);

  if (!result.ok) {
    send(ws, makeMessage("pair.error", { code: result.code, message: pairErrorMessage(result.code) }));
    return;
  }

  consumePin();
  const deviceToken = generateDeviceToken();
  saveDevice(deviceId, { deviceToken, deviceName, pairedAt: Date.now() });

  ctx.authenticated = true;
  ctx.deviceId = deviceId;
  ctx.deviceName = deviceName;

  send(ws, makeMessage("pair.success", { deviceId, deviceToken, deviceName }));
  broadcastToDashboards(makeMessage("device.connected", { deviceId, deviceName, at: Date.now() }));
  pushLayoutSnapshot(ws);
  pushBackgroundSnapshot(ws);

  // Mint a fresh PIN so the dashboard is immediately ready for the next device.
  regeneratePin();
  broadcastPairingSession();
}

export function handlePairResume(ws: WebSocket, ctx: ConnectionContext, msg: DeckMessageOf<"pair.resume">): void {
  const { deviceId, deviceToken } = msg.payload;

  if (!validateToken(deviceId, deviceToken)) {
    send(ws, makeMessage("pair.error", { code: "invalid_token", message: pairErrorMessage("invalid_token") }));
    return;
  }

  const device = getDevice(deviceId);
  if (!device) return;

  ctx.authenticated = true;
  ctx.deviceId = deviceId;
  ctx.deviceName = device.deviceName;

  send(ws, makeMessage("pair.success", { deviceId, deviceToken, deviceName: device.deviceName }));
  broadcastToDashboards(makeMessage("device.connected", { deviceId, deviceName: device.deviceName, at: Date.now() }));
  pushLayoutSnapshot(ws);
  pushBackgroundSnapshot(ws);
}
