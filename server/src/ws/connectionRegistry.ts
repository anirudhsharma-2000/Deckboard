import { WebSocket } from "ws";
import type { DeckMessage } from "@deckboard/shared";

export interface ConnectionContext {
  role: "controller" | "dashboard" | null;
  deviceId?: string;
  deviceName?: string;
  authenticated: boolean;
  lastSeen: number;
  remoteAddress: string;
}

const connections = new Map<WebSocket, ConnectionContext>();

export function register(ws: WebSocket, remoteAddress: string): ConnectionContext {
  const ctx: ConnectionContext = {
    role: null,
    authenticated: false,
    lastSeen: Date.now(),
    remoteAddress,
  };
  connections.set(ws, ctx);
  return ctx;
}

export function unregister(ws: WebSocket): void {
  connections.delete(ws);
}

export function getContext(ws: WebSocket): ConnectionContext | undefined {
  return connections.get(ws);
}

export function send(ws: WebSocket, message: DeckMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function sendToDevice(deviceId: string, message: DeckMessage): void {
  for (const [ws, ctx] of connections) {
    if (ctx.role === "controller" && ctx.deviceId === deviceId) {
      send(ws, message);
    }
  }
}

export function broadcastToDashboards(message: DeckMessage): void {
  for (const [ws, ctx] of connections) {
    if (ctx.role === "dashboard" && ctx.authenticated) {
      send(ws, message);
    }
  }
}

export function dashboardSockets(): WebSocket[] {
  const result: WebSocket[] = [];
  for (const [ws, ctx] of connections) {
    if (ctx.role === "dashboard" && ctx.authenticated) {
      result.push(ws);
    }
  }
  return result;
}

export function controllerSockets(): WebSocket[] {
  const result: WebSocket[] = [];
  for (const [ws, ctx] of connections) {
    if (ctx.role === "controller" && ctx.authenticated) {
      result.push(ws);
    }
  }
  return result;
}

/** Every authenticated connection, dashboard or controller — used for layout sync. */
export function authenticatedSockets(): WebSocket[] {
  const result: WebSocket[] = [];
  for (const [ws, ctx] of connections) {
    if (ctx.authenticated) {
      result.push(ws);
    }
  }
  return result;
}

export function broadcastToAll(message: DeckMessage): void {
  for (const ws of authenticatedSockets()) {
    send(ws, message);
  }
}
