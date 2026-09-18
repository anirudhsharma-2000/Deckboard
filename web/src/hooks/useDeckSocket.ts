"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DeckMessageSchema, makeMessage, type PageConfig, type PairingSessionPayload } from "../lib/protocol";
import { getWsUrl } from "../lib/wsUrl";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface LogEvent {
  id: string;
  at: number;
  message: string;
}

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  connectedAt: number;
}

export interface LayoutState {
  pages: PageConfig[];
  activePageId: string;
}

const CLIENT_VERSION = "0.1.0";
const MAX_EVENTS = 200;
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 10000;

export function useDeckSocket() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [pairingSession, setPairingSession] = useState<PairingSessionPayload | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [layout, setLayout] = useState<LayoutState | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let backoff = MIN_BACKOFF_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function pushEvent(message: string) {
      setEvents((prev) => [{ id: crypto.randomUUID(), at: Date.now(), message }, ...prev].slice(0, MAX_EVENTS));
    }

    function connect() {
      if (cancelled) return;
      const url = getWsUrl();
      if (!url) return;

      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        backoff = MIN_BACKOFF_MS;
        setStatus("connected");
        ws.send(JSON.stringify(makeMessage("hello", { role: "dashboard", clientVersion: CLIENT_VERSION })));
      };

      ws.onmessage = (event) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }
        const result = DeckMessageSchema.safeParse(parsed);
        if (!result.success) return;
        const msg = result.data;

        switch (msg.type) {
          case "pairing.session":
            setPairingSession(msg.payload);
            break;
          case "device.connected":
            setDevices((prev) => [
              ...prev.filter((d) => d.deviceId !== msg.payload.deviceId),
              { deviceId: msg.payload.deviceId, deviceName: msg.payload.deviceName, connectedAt: msg.payload.at },
            ]);
            pushEvent(`${msg.payload.deviceName} connected`);
            break;
          case "device.disconnected":
            setDevices((prev) => prev.filter((d) => d.deviceId !== msg.payload.deviceId));
            pushEvent(`${msg.payload.deviceName} disconnected`);
            break;
          case "button.press":
            pushEvent(`Button pressed: ${msg.payload.label}`);
            break;
          case "layout.snapshot":
            setLayout({ pages: msg.payload.pages, activePageId: msg.payload.activePageId });
            break;
          default:
            break;
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setStatus("disconnected");
        reconnectTimer = setTimeout(() => {
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
          connect();
        }, backoff);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const regeneratePin = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(makeMessage("pairing.regenerate", {})));
    }
  }, []);

  const updateLayout = useCallback((pages: PageConfig[]) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(makeMessage("layout.update", { pages })));
    }
  }, []);

  return { status, pairingSession, events, devices, layout, regeneratePin, updateLayout };
}
