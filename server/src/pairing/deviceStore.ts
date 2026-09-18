import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DEVICES_FILE = path.join(DATA_DIR, "devices.json");

export interface StoredDevice {
  deviceToken: string;
  deviceName: string;
  pairedAt: number;
}

type DeviceMap = Record<string, StoredDevice>;

function load(): DeviceMap {
  try {
    const raw = fs.readFileSync(DEVICES_FILE, "utf-8");
    return JSON.parse(raw) as DeviceMap;
  } catch {
    return {};
  }
}

function persist(devices: DeviceMap): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
  } catch (err) {
    logger.error("failed to persist devices.json", err);
  }
}

let cache: DeviceMap = load();

export function getDevice(deviceId: string): StoredDevice | undefined {
  return cache[deviceId];
}

export function saveDevice(deviceId: string, device: StoredDevice): void {
  cache[deviceId] = device;
  persist(cache);
}

export function validateToken(deviceId: string, token: string): boolean {
  const device = cache[deviceId];
  return device !== undefined && device.deviceToken === token;
}
