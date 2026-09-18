import express, { type Express } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getActiveSession } from "../pairing/pairingService.js";
import { primaryLocalAddress } from "../network/localIp.js";
import { OBS_WEBSOCKET_URL, PORT } from "../config.js";
import { isAutostartEnabled, setAutostartEnabled } from "../autostart/autostart.js";
import { isActiveAppWatcherRunning, startActiveAppWatcher, stopActiveAppWatcher } from "../profiles/activeAppWatcher.js";
import { logger } from "../logger.js";
import { listInstalledApps } from "../icons/appIconExtractor.js";
import { fetchFavicon, ICONS_DIR } from "../icons/faviconFetcher.js";
import { BACKGROUND_PRESETS } from "@deckboard/shared";
import {
  BACKGROUNDS_DIR,
  clearBackground,
  ensureBackgroundsDir,
  getActiveBackground,
  setCustomBackgroundFile,
  setPresetBackground,
} from "../settings/backgroundStore.js";
import { broadcastBackgroundSnapshot } from "../ws/handlers/background.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Built by `npm run build -w web` (Next.js static export) — see docs/protocol.md
// and the root README for the dev-vs-prod split (next dev on :3000 in dev).
const WEB_DIST = path.resolve(__dirname, "../../../web/out");

const backgroundUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureBackgroundsDir();
      cb(null, BACKGROUNDS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `bg-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  // The dashboard runs on :3000 in dev (separate from the server's :8787),
  // so its Settings panel needs CORS to call these — same trust boundary as
  // the WS "dashboard" role, which is already loopback-only.
  app.use("/api", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,DELETE");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/pairing", (_req, res) => {
    const session = getActiveSession();
    res.json({
      pin: session.pin,
      host: primaryLocalAddress(),
      port: PORT,
      expiresAt: session.expiresAt,
    });
  });

  app.get("/api/settings", async (_req, res) => {
    res.json({
      autostartEnabled: await isAutostartEnabled(),
      obsUrl: OBS_WEBSOCKET_URL,
      activeAppProfilesSupported: process.platform === "darwin",
      activeAppProfilesEnabled: isActiveAppWatcherRunning(),
      background: getActiveBackground(),
    });
  });

  app.post("/api/settings/autostart", async (req, res) => {
    const enabled = Boolean(req.body?.enabled);
    try {
      const autostartEnabled = await setAutostartEnabled(enabled);
      res.json({ autostartEnabled });
    } catch (err) {
      logger.error("failed to update autostart setting", err);
      res.status(500).json({ error: "Failed to update autostart setting" });
    }
  });

  app.post("/api/settings/active-app-profiles", (req, res) => {
    const enabled = Boolean(req.body?.enabled);
    if (enabled) {
      startActiveAppWatcher();
    } else {
      stopActiveAppWatcher();
    }
    res.json({ activeAppProfilesEnabled: isActiveAppWatcherRunning() });
  });

  app.get("/api/apps", async (_req, res) => {
    res.json({ apps: await listInstalledApps() });
  });

  app.post("/api/icons/favicon", async (req, res) => {
    const url = typeof req.body?.url === "string" ? req.body.url : null;
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    const icon = await fetchFavicon(url);
    if (!icon) {
      res.status(502).json({ error: "Could not fetch a favicon for that URL" });
      return;
    }
    res.json({ icon });
  });

  app.get("/api/icons/:filename", (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      res.status(400).end();
      return;
    }
    res.sendFile(path.join(ICONS_DIR, filename), (err) => {
      if (err) res.status(404).end();
    });
  });

  app.get("/api/settings/background/presets", (_req, res) => {
    res.json({ presets: BACKGROUND_PRESETS });
  });

  app.post("/api/settings/background", backgroundUpload.single("image"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No image uploaded (or it wasn't an image file)" });
      return;
    }
    setCustomBackgroundFile(req.file.filename);
    broadcastBackgroundSnapshot();
    res.json({ background: getActiveBackground() });
  });

  app.post("/api/settings/background/preset", (req, res) => {
    const presetId = typeof req.body?.presetId === "string" ? req.body.presetId : null;
    if (!presetId || !BACKGROUND_PRESETS.some((p) => p.id === presetId)) {
      res.status(400).json({ error: "Unknown presetId" });
      return;
    }
    setPresetBackground(presetId);
    broadcastBackgroundSnapshot();
    res.json({ background: getActiveBackground() });
  });

  app.delete("/api/settings/background", (_req, res) => {
    clearBackground();
    broadcastBackgroundSnapshot();
    res.json({ background: getActiveBackground() });
  });

  app.get("/api/background/:filename", (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      res.status(400).end();
      return;
    }
    res.sendFile(path.join(BACKGROUNDS_DIR, filename), (err) => {
      if (err) res.status(404).end();
    });
  });

  app.use(express.static(WEB_DIST));

  return app;
}
