import type { ConnectedDevice } from "../hooks/useDeckSocket";

export function DeviceList({ devices }: { devices: ConnectedDevice[] }) {
  if (devices.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Connected devices
      </h2>
      <ul className="space-y-2">
        {devices.map((device) => (
          <li key={device.deviceId} className="flex items-center justify-between text-sm">
            <span className="text-neutral-700 dark:text-neutral-200">{device.deviceName}</span>
            <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
              since {new Date(device.connectedAt).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
