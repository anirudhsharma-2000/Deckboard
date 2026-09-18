export const PORT = Number(process.env.DECKBOARD_PORT ?? 8787);

export const OBS_WEBSOCKET_URL = process.env.OBS_WEBSOCKET_URL ?? "ws://127.0.0.1:4455";
export const OBS_WEBSOCKET_PASSWORD = process.env.OBS_WEBSOCKET_PASSWORD;

/** Phase 5: polls the frontmost app on macOS to auto-switch the active page. */
export const ACTIVE_APP_PROFILES_ENABLED = process.env.DECKBOARD_APP_PROFILES === "1";
