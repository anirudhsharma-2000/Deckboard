import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AutoLaunch from "auto-launch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const SERVER_DIR = path.resolve(__dirname, "../..");
const LAUNCH_SCRIPT = path.join(DATA_DIR, "start-deckboard.sh");

/**
 * auto-launch points the OS login-item directly at a binary with no argv, so
 * pointing it at `node` alone would launch a bare REPL, not the server. We
 * generate a tiny wrapper script that cd's into the server dir and runs the
 * built entrypoint, and register *that* as the login item instead.
 */
function ensureLaunchScript(): string {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const script = `#!/bin/sh\ncd "${SERVER_DIR}"\nexec "${process.execPath}" dist/index.js\n`;
  fs.writeFileSync(LAUNCH_SCRIPT, script, { mode: 0o755 });
  return LAUNCH_SCRIPT;
}

let autoLaunch: AutoLaunch | null = null;

function getAutoLaunch(): AutoLaunch {
  autoLaunch ??= new AutoLaunch({ name: "DeckBoard", path: ensureLaunchScript() });
  return autoLaunch;
}

export async function isAutostartEnabled(): Promise<boolean> {
  try {
    return await getAutoLaunch().isEnabled();
  } catch {
    return false;
  }
}

export async function setAutostartEnabled(enabled: boolean): Promise<boolean> {
  const launcher = getAutoLaunch();
  if (enabled) {
    await launcher.enable();
  } else {
    await launcher.disable();
  }
  return isAutostartEnabled();
}
