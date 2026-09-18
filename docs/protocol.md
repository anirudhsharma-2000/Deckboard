# DeckBoard Wire Protocol (v1)

This is the hand-maintained source of truth for the WebSocket message format.
`shared/src/messages.ts` (Zod) enforces this at runtime for the server and website.
Android's `data/protocol/Messages.kt` is hand-written to match this doc exactly,
since Kotlin cannot import the TypeScript schema directly.

Whenever this doc changes, update both `shared/src/messages.ts` and
`android/.../data/protocol/Messages.kt` in the same change.

## Endpoint

`ws://<host>:<port>/ws` — default port `8787`.

## Envelope

Every message, in both directions, is wrapped in the same envelope:

```json
{
  "v": 1,
  "type": "button.press",
  "id": "6c2f9e2a-2222-4b31-9b1a-000000000000",
  "ts": 1755730000000,
  "payload": { }
}
```

- `v` — protocol version (currently `1`).
- `type` — message type, see table below.
- `id` — UUID, unique per message. Reserved for Phase 2 request/response correlation
  (`action.execute` → `action.result`); in Phase 1 it's only used for logging.
- `ts` — unix ms timestamp when the message was created.
- `payload` — type-specific body, see below.

## Roles

Every connection sends `hello` first, declaring its role:

- `controller` — the Android app.
- `dashboard` — the website. Only auto-authorized when the connection's remote
  address is loopback (127.0.0.1 / ::1) — the dashboard is only ever viewed on
  the same machine as the server.

## Message Types

| type | direction | payload |
|---|---|---|
| `hello` | client → server | `{ role: "controller" \| "dashboard", clientVersion: string }` |
| `hello.ack` | server → client | `{ serverVersion: string, protocolVersion: 1 }` |
| `pair.request` | controller → server | `{ pin: string, deviceId: string, deviceName: string }` |
| `pair.resume` | controller → server | `{ deviceId: string, deviceToken: string }` |
| `pair.success` | server → controller | `{ deviceId: string, deviceToken: string, deviceName: string }` |
| `pair.error` | server → controller | `{ code: "invalid_pin" \| "expired" \| "already_used" \| "invalid_token", message: string }` |
| `pairing.session` | server → dashboard | `{ pin: string, host: string, port: number, qrUri: string, expiresAt: number }` |
| `pairing.regenerate` | dashboard → server | `{}` |
| `button.press` | controller → server | `{ buttonId: string, label: string, pressedAt: number }` |
| `button.press.ack` | server → controller | `{ buttonId: string, receivedAt: number }` |
| `device.connected` | server → dashboard | `{ deviceId: string, deviceName: string, at: number }` |
| `device.disconnected` | server → dashboard | `{ deviceId: string, deviceName: string, at: number }` |
| `heartbeat` | controller → server | `{}` |
| `error` | server → client | `{ code: string, message: string }` |
| `layout.get` | client → server | `{}` — request the current layout |
| `layout.snapshot` | server → client | `{ pages: PageConfig[], activePageId: string }` — sent on connect and whenever the layout or active page changes |
| `layout.update` | dashboard → server | `{ pages: PageConfig[] }` — full replace; server persists it and re-broadcasts a fresh `layout.snapshot` to every connected client (dashboards and controllers) |
| `action.result` | server → controller | `{ buttonId: string, success: boolean, message?: string }` |
| `layout.activePage` | server → controller | `{ pageId: string }` — pushed when the active page changes (manually or via app-profile auto-switch, Phase 5) |
| `background.snapshot` | server → client | `{ background: BackgroundConfig }` — sent on connect (hello for dashboard, pair success for controller) and whenever it changes |
| `background.update` | dashboard → server | `{ background: BackgroundConfig }` — `type: "custom"` is ignored here (uploads go through `POST /api/settings/background` instead, since there's no file to send over WS) |

### Background types

```ts
type BackgroundConfig =
  | { type: "none" }
  | { type: "preset"; presetId: string }
  | { type: "custom"; url: string };   // server-relative "/api/background/<file>" path
```

Presets are defined once in `shared/src/background.ts` (`BACKGROUND_PRESETS`) as
`{ id, name, colors: [string, string] }` — a two-color gradient, not an image
file, so both the website (CSS) and Android (Compose `Brush`) render it
natively. Android hand-mirrors this list — see
`data/protocol/Background.kt` and keep it in sync when presets change.

### Layout types

```ts
type ActionConfig =
  | { type: "none" }
  | { type: "open_url"; url: string }
  | { type: "hotkey"; keys: string[] }       // e.g. ["cmd", "shift", "s"]
  | { type: "obs_scene"; sceneName: string }
  | { type: "launch_app"; appPath: string; appName: string }   // macOS .app bundle path
  | { type: "system"; command: SystemCommand };

type SystemCommand =
  | "lock" | "sleep" | "mute" | "volume_up" | "volume_down"
  | "media_play_pause" | "media_next" | "media_previous"
  | "screenshot_full" | "screenshot_selection" | "screenshot_recording"
  | "empty_trash" | "log_out" | "restart" | "shut_down";

interface ButtonConfig {
  id: string;
  label: string;
  icon: string;    // emoji, an "/api/icons/<file>" server-relative image path, or empty
  action: ActionConfig;
}

interface PageConfig {
  id: string;
  name: string;
  rows: number;      // 1-6, defaults to 3
  columns: number;    // 1-6, defaults to 3
  buttons: ButtonConfig[];   // rows * columns entries, row-major order
}
```

`button.press`'s `buttonId` is looked up against the persisted layout server-side
to find its `ActionConfig` and execute it — the wire payload for `button.press`
itself is unchanged from Phase 1.

### Icon fetching (REST, not WebSocket)

The dashboard editor fetches/lists icons over plain HTTP rather than the WS
protocol, since they're one-shot request/response and binary-ish (images):

| endpoint | method | purpose |
|---|---|---|
| `/api/apps` | GET | `{ apps: { name, path, iconUrl }[] }` — installed macOS apps for the "Launch App" picker, `iconUrl` is an `/api/icons/...` path or null |
| `/api/icons/favicon` | POST `{ url }` | fetches and caches the target site's favicon, returns `{ icon: "/api/icons/<file>" }` |
| `/api/icons/:filename` | GET | serves a cached icon file (favicon or extracted app icon) |

A `ButtonConfig.icon` value is treated as an image reference if it starts with
`/api/icons/`; otherwise it's rendered as literal text (an emoji, typically).
Both `/api/apps` and app-icon extraction are macOS-only (`plutil`/`sips`); on
other platforms `/api/apps` returns an empty list and favicon fetching still
works everywhere.

## Auth model

A connection becomes "authenticated" after a successful `pair.request` or
`pair.resume`. The server tracks this per-socket in its connection registry —
there is no per-message signing. This matches the LAN-only threat model:
the PIN/token pair gates *authorization*, not transport privacy. `ws://` is
unencrypted; `wss://` with a self-signed cert is a documented future option,
not implemented in Phase 1.

## QR payload

The website renders a QR code (and shows the same info as text) encoding:

```
deckboard://pair?v=1&host=<ip>&port=8787&pin=<pin>
```

## Later phase notes

- Phase 5 profile auto-switching (`layout.activePage`) only runs on macOS today
  (uses `osascript` to poll the frontmost app); other platforms simply never
  emit it, and manual page switching still works everywhere.
- `hotkey` and `system` actions are executed via `osascript` (System Events
  verbs/keystrokes) and are macOS-only for now; on other platforms the server
  reports `action.result` with `success: false` instead of throwing.
  `system.command`s like `restart`/`shut_down`/`log_out` are
  destructive/disruptive by nature — same as a real Stream Deck's System
  actions — there is no confirmation step before they run.
- The three `media_*` commands post real system-wide HID media-key events
  (`osascript -l JavaScript` + `CGEventPost`, the same NX_KEYTYPE_PLAY/NEXT/
  PREVIOUS codes a physical keyboard sends) rather than scripting one app by
  name — works no matter what's currently "now playing" for apps that
  register with the MediaRemote framework (Music, Spotify, ...). Browsers
  usually don't register a page's `<video>`/`<audio>` there, so
  `media_play_pause` specifically checks whether the frontmost app is a
  known browser and, if so, toggles playback via JS executed in the active
  tab instead (requires "Allow JavaScript from Apple Events" enabled in
  that browser's View/Develop menu). `media_next`/`media_previous` stay
  HID-key-only — there's no generic DOM equivalent across sites.
- `launch_app` fires an additional, non-blocking `System Events` activation
  retry loop (~2.5s) after `open()` so slow-starting apps (JVM-based IDEs,
  etc.) still end up focused once their window actually appears, instead of
  opening silently behind whatever else is frontmost.
- The three `screenshot_*` commands simulate the literal ⌘⇧3/⌘⇧4/⌘⇧5
  keystrokes (`key code` + modifiers via System Events) rather than shelling
  out to `screencapture` directly — this respects whatever save
  location/clipboard-only preference the user has already set in the
  Screenshot app, same as pressing the real keys.
