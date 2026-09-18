import os from "node:os";

// Virtual/tunnel adapters that show up as "internal: false" IPv4 interfaces
// but are never the address a phone on the same WiFi should connect to.
const VIRTUAL_PREFIXES = [
  "utun",
  "awdl",
  "llw",
  "bridge",
  "docker",
  "veth",
  "vEthernet",
  "lo",
];

export interface LocalAddress {
  name: string;
  address: string;
}

export function listLocalAddresses(): LocalAddress[] {
  const interfaces = os.networkInterfaces();
  const results: LocalAddress[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    if (VIRTUAL_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;

    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        results.push({ name, address: addr.address });
      }
    }
  }

  return results;
}

export function primaryLocalAddress(): string {
  const [first] = listLocalAddresses();
  return first?.address ?? "127.0.0.1";
}
