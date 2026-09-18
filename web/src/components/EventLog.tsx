import type { LogEvent } from "../hooks/useDeckSocket";

interface Props {
  events: LogEvent[];
}

export function EventLog({ events }: Props) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Activity
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Waiting for a button press…</p>
      ) : (
        <ul className="flex-1 space-y-2 overflow-y-auto">
          {events.map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-neutral-700 dark:text-neutral-200">{event.message}</span>
              <span className="shrink-0 font-mono text-xs text-neutral-400 dark:text-neutral-500">
                {new Date(event.at).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
