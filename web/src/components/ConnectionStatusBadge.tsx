import type { ConnectionStatus } from "../hooks/useDeckSocket";

const LABELS: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  connected: "Connected",
  disconnected: "Disconnected",
};

const DOT_COLORS: Record<ConnectionStatus, string> = {
  connecting: "bg-amber-400",
  connected: "bg-emerald-500",
  disconnected: "bg-red-500",
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
      <span className={`h-2 w-2 rounded-full ${DOT_COLORS[status]}`} />
      {LABELS[status]}
    </div>
  );
}
