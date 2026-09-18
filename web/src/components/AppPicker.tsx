"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBase, resolveIconUrl } from "../lib/api";

export interface InstalledApp {
  name: string;
  path: string;
  iconUrl: string | null;
}

interface Props {
  onPick: (app: InstalledApp) => void;
}

export function AppPicker({ onPick }: Props) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`${apiBase()}/api/apps`)
      .then((res) => res.json())
      .then((data) => setApps(data.apps ?? []))
      .catch(() => setApps([]));
  }, []);

  const filtered = useMemo(() => {
    if (!apps) return [];
    const q = query.trim().toLowerCase();
    return q ? apps.filter((a) => a.name.toLowerCase().includes(q)) : apps;
  }, [apps, query]);

  return (
    <div className="flex flex-col gap-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search apps…"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
      />

      {apps === null ? (
        <p className="py-4 text-center text-sm text-neutral-400 dark:text-neutral-500">Loading apps…</p>
      ) : filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-400 dark:text-neutral-500">No apps found.</p>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
          {filtered.map((app) => (
            <button
              key={app.path}
              onClick={() => onPick(app)}
              className="flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
            >
              {app.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary server-fetched icon, not a build-time asset
                <img src={resolveIconUrl(app.iconUrl)} alt="" className="h-6 w-6 rounded" />
              ) : (
                <span className="h-6 w-6 rounded bg-neutral-200 dark:bg-neutral-700" />
              )}
              <span className="truncate text-neutral-700 dark:text-neutral-200">{app.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
