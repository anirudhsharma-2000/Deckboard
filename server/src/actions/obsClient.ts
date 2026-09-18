import OBSWebSocket from "obs-websocket-js";
import { OBS_WEBSOCKET_PASSWORD, OBS_WEBSOCKET_URL } from "../config.js";

let obs: OBSWebSocket | null = null;
let connected = false;

async function getClient(): Promise<OBSWebSocket> {
  if (obs && connected) return obs;

  obs ??= new OBSWebSocket();
  if (!connected) {
    await obs.connect(OBS_WEBSOCKET_URL, OBS_WEBSOCKET_PASSWORD);
    connected = true;
    obs.once("ConnectionClosed", () => {
      connected = false;
    });
  }
  return obs;
}

/** Throws if OBS isn't running or the scene doesn't exist — caller turns this into an ActionOutcome. */
export async function switchObsScene(sceneName: string): Promise<void> {
  const client = await getClient();
  await client.call("SetCurrentProgramScene", { sceneName });
}
