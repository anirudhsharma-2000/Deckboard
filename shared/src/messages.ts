import { z } from "zod";
import { PROTOCOL_VERSION } from "./constants.js";
import { PageConfigSchema } from "./layout.js";
import { BackgroundConfigSchema } from "./background.js";

// See docs/protocol.md — the hand-maintained wire-format spec. Keep this file
// and that doc in sync; Android's Messages.kt is hand-written to match both.

const HelloPayload = z.object({
  role: z.enum(["controller", "dashboard"]),
  clientVersion: z.string(),
});

const HelloAckPayload = z.object({
  serverVersion: z.string(),
  protocolVersion: z.literal(PROTOCOL_VERSION),
});

const PairRequestPayload = z.object({
  pin: z.string(),
  deviceId: z.string(),
  deviceName: z.string(),
});

const PairResumePayload = z.object({
  deviceId: z.string(),
  deviceToken: z.string(),
});

const PairSuccessPayload = z.object({
  deviceId: z.string(),
  deviceToken: z.string(),
  deviceName: z.string(),
});

const PairErrorCode = z.enum([
  "invalid_pin",
  "expired",
  "already_used",
  "invalid_token",
]);

const PairErrorPayload = z.object({
  code: PairErrorCode,
  message: z.string(),
});

const PairingSessionPayload = z.object({
  pin: z.string(),
  host: z.string(),
  port: z.number(),
  qrUri: z.string(),
  expiresAt: z.number(),
});

const PairingRegeneratePayload = z.object({});

const ButtonPressPayload = z.object({
  buttonId: z.string(),
  label: z.string(),
  pressedAt: z.number(),
});

const ButtonPressAckPayload = z.object({
  buttonId: z.string(),
  receivedAt: z.number(),
});

const DeviceConnectedPayload = z.object({
  deviceId: z.string(),
  deviceName: z.string(),
  at: z.number(),
});

const DeviceDisconnectedPayload = z.object({
  deviceId: z.string(),
  deviceName: z.string(),
  at: z.number(),
});

const HeartbeatPayload = z.object({});

const ErrorPayload = z.object({
  code: z.string(),
  message: z.string(),
});

const LayoutGetPayload = z.object({});

const LayoutSnapshotPayload = z.object({
  pages: z.array(PageConfigSchema),
  activePageId: z.string(),
});

const LayoutUpdatePayload = z.object({
  pages: z.array(PageConfigSchema),
});

const ActionResultPayload = z.object({
  buttonId: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
});

const LayoutActivePagePayload = z.object({
  pageId: z.string(),
});

const BackgroundSnapshotPayload = z.object({
  background: BackgroundConfigSchema,
});

const BackgroundUpdatePayload = z.object({
  background: BackgroundConfigSchema,
});

function envelope<Type extends string, Payload extends z.ZodTypeAny>(
  type: Type,
  payload: Payload,
) {
  return z.object({
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal(type),
    id: z.string(),
    ts: z.number(),
    payload,
  });
}

export const DeckMessageSchema = z.discriminatedUnion("type", [
  envelope("hello", HelloPayload),
  envelope("hello.ack", HelloAckPayload),
  envelope("pair.request", PairRequestPayload),
  envelope("pair.resume", PairResumePayload),
  envelope("pair.success", PairSuccessPayload),
  envelope("pair.error", PairErrorPayload),
  envelope("pairing.session", PairingSessionPayload),
  envelope("pairing.regenerate", PairingRegeneratePayload),
  envelope("button.press", ButtonPressPayload),
  envelope("button.press.ack", ButtonPressAckPayload),
  envelope("device.connected", DeviceConnectedPayload),
  envelope("device.disconnected", DeviceDisconnectedPayload),
  envelope("heartbeat", HeartbeatPayload),
  envelope("error", ErrorPayload),
  envelope("layout.get", LayoutGetPayload),
  envelope("layout.snapshot", LayoutSnapshotPayload),
  envelope("layout.update", LayoutUpdatePayload),
  envelope("action.result", ActionResultPayload),
  envelope("layout.activePage", LayoutActivePagePayload),
  envelope("background.snapshot", BackgroundSnapshotPayload),
  envelope("background.update", BackgroundUpdatePayload),
]);

export type DeckMessage = z.infer<typeof DeckMessageSchema>;

export type DeckMessageType = DeckMessage["type"];

export type DeckMessageOf<Type extends DeckMessageType> = Extract<
  DeckMessage,
  { type: Type }
>;

export type HelloPayload = z.infer<typeof HelloPayload>;
export type HelloAckPayload = z.infer<typeof HelloAckPayload>;
export type PairRequestPayload = z.infer<typeof PairRequestPayload>;
export type PairResumePayload = z.infer<typeof PairResumePayload>;
export type PairSuccessPayload = z.infer<typeof PairSuccessPayload>;
export type PairErrorPayload = z.infer<typeof PairErrorPayload>;
export type PairingSessionPayload = z.infer<typeof PairingSessionPayload>;
export type PairingRegeneratePayload = z.infer<
  typeof PairingRegeneratePayload
>;
export type ButtonPressPayload = z.infer<typeof ButtonPressPayload>;
export type ButtonPressAckPayload = z.infer<typeof ButtonPressAckPayload>;
export type DeviceConnectedPayload = z.infer<typeof DeviceConnectedPayload>;
export type DeviceDisconnectedPayload = z.infer<
  typeof DeviceDisconnectedPayload
>;
export type HeartbeatPayload = z.infer<typeof HeartbeatPayload>;
export type ErrorPayload = z.infer<typeof ErrorPayload>;
export type LayoutGetPayload = z.infer<typeof LayoutGetPayload>;
export type LayoutSnapshotPayload = z.infer<typeof LayoutSnapshotPayload>;
export type LayoutUpdatePayload = z.infer<typeof LayoutUpdatePayload>;
export type ActionResultPayload = z.infer<typeof ActionResultPayload>;
export type LayoutActivePagePayload = z.infer<typeof LayoutActivePagePayload>;
export type BackgroundSnapshotPayload = z.infer<typeof BackgroundSnapshotPayload>;
export type BackgroundUpdatePayload = z.infer<typeof BackgroundUpdatePayload>;

/** Builds a fully-formed envelope for `type`, generating `id`/`ts`/`v`. */
export function makeMessage<Type extends DeckMessageType>(
  type: Type,
  payload: DeckMessageOf<Type>["payload"],
): DeckMessageOf<Type> {
  return {
    v: PROTOCOL_VERSION,
    type,
    id: crypto.randomUUID(),
    ts: Date.now(),
    payload,
  } as DeckMessageOf<Type>;
}
