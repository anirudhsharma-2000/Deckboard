import crypto from "node:crypto";
import { PIN_LENGTH, PIN_TTL_MS, DEVICE_TOKEN_BYTES } from "@deckboard/shared";

export interface PinSession {
  pin: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

let currentSession: PinSession | null = null;

function generatePin(): string {
  const min = 10 ** (PIN_LENGTH - 1);
  const max = 10 ** PIN_LENGTH - 1;
  return String(crypto.randomInt(min, max + 1));
}

/** Creates a brand-new PIN session, replacing any existing one. */
export function regeneratePin(): PinSession {
  const now = Date.now();
  currentSession = {
    pin: generatePin(),
    createdAt: now,
    expiresAt: now + PIN_TTL_MS,
    used: false,
  };
  return currentSession;
}

/** Returns the current session, minting a fresh one if none exists or it expired. */
export function getActiveSession(): PinSession {
  if (!currentSession || currentSession.expiresAt < Date.now()) {
    return regeneratePin();
  }
  return currentSession;
}

export type PinValidationResult =
  | { ok: true }
  | { ok: false; code: "invalid_pin" | "expired" | "already_used" };

/** Validates against the session as-is — does NOT auto-regenerate on expiry,
 * so an expired PIN correctly reports "expired" rather than silently
 * comparing against a brand new one. */
export function validatePin(pin: string): PinValidationResult {
  if (!currentSession) return { ok: false, code: "invalid_pin" };
  if (currentSession.expiresAt < Date.now()) return { ok: false, code: "expired" };
  if (currentSession.used) return { ok: false, code: "already_used" };
  if (currentSession.pin !== pin) return { ok: false, code: "invalid_pin" };
  return { ok: true };
}

export function consumePin(): void {
  if (currentSession) currentSession.used = true;
}

export function generateDeviceToken(): string {
  return crypto.randomBytes(DEVICE_TOKEN_BYTES).toString("base64url");
}
