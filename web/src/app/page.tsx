"use client";

import { useState } from "react";
import { useDeckSocket } from "../hooks/useDeckSocket";
import { PairingCard } from "../components/PairingCard";
import { EventLog } from "../components/EventLog";
import { ConnectionStatusBadge } from "../components/ConnectionStatusBadge";
import { DeviceList } from "../components/DeviceList";
import { LayoutEditor } from "../components/LayoutEditor";
import { SettingsPanel } from "../components/SettingsPanel";

const TABS = ["Pair & Monitor", "Edit Layout", "Settings"] as const;
type Tab = (typeof TABS)[number];

export default function Home() {
  const { status, pairingSession, events, devices, layout, regeneratePin, updateLayout } = useDeckSocket();
  const [tab, setTab] = useState<Tab>("Pair & Monitor");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DeckBoard</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Pair your phone on the same WiFi network
          </p>
        </div>
        <ConnectionStatusBadge status={status} />
      </header>

      <nav className="flex gap-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-900">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Pair & Monitor" && (
        <div className="grid gap-8 sm:grid-cols-2">
          <PairingCard session={pairingSession} onRegenerate={regeneratePin} />
          <div className="flex flex-col gap-8">
            <DeviceList devices={devices} />
            <EventLog events={events} />
          </div>
        </div>
      )}

      {tab === "Edit Layout" &&
        (layout ? (
          <LayoutEditor pages={layout.pages} onChange={updateLayout} />
        ) : (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading layout…</p>
        ))}

      {tab === "Settings" && <SettingsPanel />}
    </main>
  );
}
