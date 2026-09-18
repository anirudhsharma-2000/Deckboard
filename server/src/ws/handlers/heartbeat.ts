import type { ConnectionContext } from "../connectionRegistry.js";

export function handleHeartbeat(ctx: ConnectionContext): void {
  ctx.lastSeen = Date.now();
}
