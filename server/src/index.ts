import http from "node:http";
import { createApp } from "./http/app.js";
import { attachWebSocketServer } from "./ws/server.js";
import { ACTIVE_APP_PROFILES_ENABLED, PORT } from "./config.js";
import { logger } from "./logger.js";
import { getActiveSession } from "./pairing/pairingService.js";
import { listLocalAddresses, primaryLocalAddress } from "./network/localIp.js";
import { startActiveAppWatcher } from "./profiles/activeAppWatcher.js";

const app = createApp();
const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(PORT, () => {
  const session = getActiveSession();
  const addresses = listLocalAddresses();
  const primary = primaryLocalAddress();

  logger.info("DeckBoard server running");
  logger.info(`  Dashboard/API: http://${primary}:${PORT}`);
  logger.info(`  WebSocket:     ws://${primary}:${PORT}/ws`);
  logger.info(`  Pairing PIN:   ${session.pin} (expires ${new Date(session.expiresAt).toLocaleTimeString()})`);

  if (addresses.length > 1) {
    logger.info(`  Other local addresses: ${addresses.map((a) => `${a.name}=${a.address}`).join(", ")}`);
  }

  if (ACTIVE_APP_PROFILES_ENABLED) {
    startActiveAppWatcher();
  }
});
