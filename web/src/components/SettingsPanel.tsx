"use client";

import { useEffect, useState } from "react";
import { apiBase, resolveIconUrl } from "../lib/api";
import { BACKGROUND_PRESETS, type BackgroundConfig } from "../lib/protocol";

interface Settings {
  autostartEnabled: boolean;
  obsUrl: string;
  activeAppProfilesSupported: boolean;
  activeAppProfilesEnabled: boolean;
  background: BackgroundConfig;
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);

  useEffect(() => {
    fetch(`${apiBase()}/api/settings`)
      .then((res) => res.json())
      .then(setSettings)
      .catch(() => setSettings(null));
  }, []);

  async function pickPreset(presetId: string) {
    const res = await fetch(`${apiBase()}/api/settings/background/preset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId }),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings((prev) => (prev ? { ...prev, background: data.background } : prev));
    }
  }

  async function uploadBackground(file: File) {
    setUploadingBackground(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`${apiBase()}/api/settings/background`, { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setSettings((prev) => (prev ? { ...prev, background: data.background } : prev));
      }
    } finally {
      setUploadingBackground(false);
    }
  }

  async function clearBackground() {
    const res = await fetch(`${apiBase()}/api/settings/background`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      setSettings((prev) => (prev ? { ...prev, background: data.background } : prev));
    }
  }

  async function toggleAutostart() {
    if (!settings) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/api/settings/autostart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !settings.autostartEnabled }),
      });
      const updated = await res.json();
      setSettings((prev) => (prev ? { ...prev, autostartEnabled: updated.autostartEnabled } : prev));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActiveAppProfiles() {
    if (!settings) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/api/settings/active-app-profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !settings.activeAppProfilesEnabled }),
      });
      const updated = await res.json();
      setSettings((prev) => (prev ? { ...prev, activeAppProfilesEnabled: updated.activeAppProfilesEnabled } : prev));
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading settings…</p>;
  }

  const { background } = settings;

  return (
    <div className="flex flex-col gap-6">
      <SettingRow
        title="Start DeckBoard on login"
        description="Launch the companion server automatically when you sign in."
        checked={settings.autostartEnabled}
        onToggle={toggleAutostart}
        disabled={busy}
      />

      <SettingRow
        title="Switch pages with the active app"
        description={
          settings.activeAppProfilesSupported
            ? "Automatically jump to a page named after whichever app is focused on this computer (macOS only)."
            : "Only supported on macOS right now."
        }
        checked={settings.activeAppProfilesEnabled}
        onToggle={toggleActiveAppProfiles}
        disabled={busy || !settings.activeAppProfilesSupported}
      />

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Phone background
        </h3>
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-300">
          Sets the background behind the button grid on your phone — pick a preset or upload your own image.
        </p>

        <div className="mb-4 flex flex-wrap gap-3">
          <button
            onClick={clearBackground}
            className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 text-xs text-neutral-500 dark:text-neutral-400 ${
              background.type === "none"
                ? "border-neutral-900 dark:border-neutral-100"
                : "border-transparent bg-neutral-100 dark:bg-neutral-800"
            }`}
            title="None"
          >
            None
          </button>
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => pickPreset(preset.id)}
              title={preset.name}
              className={`h-12 w-12 rounded-xl border-2 ${
                background.type === "preset" && background.presetId === preset.id
                  ? "border-neutral-900 dark:border-neutral-100"
                  : "border-transparent"
              }`}
              style={{ background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})` }}
            />
          ))}
        </div>

        {background.type === "custom" && (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary server-fetched image, not a build-time asset
          <img src={resolveIconUrl(background.url)} alt="" className="mb-4 h-24 w-full rounded-lg object-cover" />
        )}

        <label
          className={`inline-block cursor-pointer rounded-full bg-neutral-900 px-4 py-1.5 text-sm text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 ${
            uploadingBackground ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {uploadingBackground ? "Uploading…" : "Upload custom image"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploadingBackground}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadBackground(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          OBS integration
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Assign an &ldquo;OBS scene&rdquo; action to a button, connecting to{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">{settings.obsUrl}</code>.
          Set <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">OBS_WEBSOCKET_URL</code>{" "}
          / <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">OBS_WEBSOCKET_PASSWORD</code>{" "}
          env vars to point elsewhere.
        </p>
      </div>
    </div>
  );
}

function SettingRow({
  title,
  description,
  checked,
  onToggle,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{title}</div>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={checked}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
          checked ? "bg-neutral-900 dark:bg-neutral-100" : "bg-neutral-300 dark:bg-neutral-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition dark:bg-neutral-900 ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
