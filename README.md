# DeckBoard

A self-hosted, LAN-only alternative to Elgato Stream Deck Mobile: an Android app
remote-controls a companion server running on your PC, with a web dashboard for
pairing and monitoring.

- **`server/`** — Node.js/TypeScript companion server. Runs on your PC, hosts the
  WebSocket connection the phone talks to, serves the web dashboard.
- **`web/`** — Next.js dashboard, served by the companion server. Used for pairing
  (QR/PIN) and live monitoring. Does not need to stay open for the phone to work.
- **`android/`** — Kotlin + Jetpack Compose app, the remote control surface.
- **`shared/`** — TypeScript message schema shared by `server` and `web`.
- **`docs/protocol.md`** — the wire protocol spec (source of truth for Android too).

## Development

```bash
npm install
npm run dev
```

This starts the companion server (`:8787`) and the dashboard dev server (`:3000`)
together. The server prints its LAN IP, port, and current pairing PIN on startup.

The Android app is built/run separately in Android Studio (`android/`), on a
device connected to the same WiFi network as your computer.

## Features

- **Real actions** (Phase 2): buttons can open a URL/app, send a keyboard
  shortcut (macOS only, via `osascript`), or switch an OBS scene
  (`obs-websocket-js`) — configured per-button from the dashboard.
- **Layout editor** (Phase 3): the dashboard's "Edit Layout" tab manages
  multiple pages of a 3×3 button grid (label, emoji icon, action), synced live
  to every connected phone via `layout.snapshot`/`layout.update`.
- **Polish** (Phase 4): Material 3 dynamic color, haptics + a press-scale
  animation on button tap, swipeable pages on Android.
- **Settings tab** (Phase 5): toggle "start on login" (`auto-launch`) and
  "switch pages with the active app" (polls the frontmost macOS app and jumps
  to a page with a matching name — name a page "Safari", focus Safari, watch
  the phone follow). Multi-device support (several phones connected to one
  server at once) works out of the box — verified with a concurrent-client
  test against the connection registry.

See `server/.env.example` for OBS/port/active-app-profile configuration.

## Manual QA

1. `npm run dev` — server logs LAN IP + port + PIN.
2. Open the dashboard in a browser — QR + PIN visible, empty event log.
3. On your phone (same WiFi), open the app and scan the QR (or enter host/PIN
   manually).
4. App goes Connecting → Paired → button grid; dashboard shows the device as
   connected.
5. In the dashboard's "Edit Layout" tab, add a button action (e.g. Open URL)
   and save — the phone's grid updates live without reopening the app.
6. Tap that button — dashboard's event log updates in real time, and the
   configured action runs on the PC (opens the URL, sends the hotkey, or
   switches the OBS scene).
7. Toggle phone WiFi off/on — app reconnects automatically, no re-pairing.
8. Force-close/reopen the app — resumes straight to the button grid.
9. Restart the server — phone resumes without re-pairing (state persisted in
   `server/data/devices.json` and `server/data/layout.json`).

See `docs/protocol.md` for the wire format and the plan file for the full
phased roadmap.
