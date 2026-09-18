"use client";

import { useState } from "react";
import {
  createEmptyPage,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  type ActionConfig,
  type ButtonConfig,
  type PageConfig,
  type SystemCommand,
} from "../lib/protocol";
import { apiBase, isImageIcon, resolveIconUrl } from "../lib/api";
import { ButtonTile } from "./ButtonTile";
import { AppPicker, type InstalledApp } from "./AppPicker";

const SYSTEM_COMMANDS: { value: SystemCommand; label: string }[] = [
  { value: "lock", label: "Lock Screen" },
  { value: "sleep", label: "Sleep" },
  { value: "mute", label: "Mute" },
  { value: "volume_up", label: "Volume Up" },
  { value: "volume_down", label: "Volume Down" },
  { value: "media_play_pause", label: "Play / Pause" },
  { value: "media_next", label: "Next Track" },
  { value: "media_previous", label: "Previous Track" },
  { value: "screenshot_full", label: "Screenshot (Full Screen) ⌘⇧3" },
  { value: "screenshot_selection", label: "Screenshot (Selection) ⌘⇧4" },
  { value: "screenshot_recording", label: "Screenshot & Recording ⌘⇧5" },
  { value: "empty_trash", label: "Empty Trash" },
  { value: "log_out", label: "Log Out" },
  { value: "restart", label: "Restart" },
  { value: "shut_down", label: "Shut Down" },
];

interface Props {
  pages: PageConfig[];
  onChange: (pages: PageConfig[]) => void;
}

export function LayoutEditor({ pages, onChange }: Props) {
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [editingButton, setEditingButton] = useState<{ pageIndex: number; buttonIndex: number } | null>(null);

  const page = pages[selectedPageIndex] ?? pages[0];

  function addPage() {
    const next = [...pages, createEmptyPage(`Page ${pages.length + 1}`)];
    onChange(next);
    setSelectedPageIndex(next.length - 1);
  }

  function renamePage(index: number, name: string) {
    onChange(pages.map((p, i) => (i === index ? { ...p, name } : p)));
  }

  function removePage(index: number) {
    if (pages.length <= 1) return;
    const next = pages.filter((_, i) => i !== index);
    onChange(next);
    setSelectedPageIndex((current) => Math.min(current, next.length - 1));
  }

  function saveButton(pageIndex: number, buttonIndex: number, updated: ButtonConfig) {
    onChange(
      pages.map((p, pi) =>
        pi === pageIndex
          ? { ...p, buttons: p.buttons.map((b, bi) => (bi === buttonIndex ? updated : b)) }
          : p,
      ),
    );
    setEditingButton(null);
  }

  function resizeGrid(pageIndex: number, rows: number, columns: number) {
    const target = pages[pageIndex];
    const targetCount = rows * columns;
    let nextButtons: ButtonConfig[];

    if (targetCount <= target.buttons.length) {
      const removed = target.buttons.slice(targetCount);
      const removedHasContent = removed.some((b) => b.action.type !== "none" || b.label.trim() || b.icon);
      if (
        removedHasContent &&
        !window.confirm(`Shrinking this grid removes ${removed.length} button(s) that already have content. Continue?`)
      ) {
        return;
      }
      nextButtons = target.buttons.slice(0, targetCount);
    } else {
      const added = Array.from({ length: targetCount - target.buttons.length }, () => ({
        id: crypto.randomUUID(),
        label: "",
        icon: "",
        action: { type: "none" as const },
      }));
      nextButtons = [...target.buttons, ...added];
    }

    onChange(pages.map((p, i) => (i === pageIndex ? { ...p, rows, columns, buttons: nextButtons } : p)));
  }

  if (!page) return null;

  const gridSizeOptions = Array.from({ length: MAX_GRID_SIZE - MIN_GRID_SIZE + 1 }, (_, i) => i + MIN_GRID_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {pages.map((p, index) => (
          <PageTab
            key={p.id}
            page={p}
            active={index === selectedPageIndex}
            onSelect={() => setSelectedPageIndex(index)}
            onRename={(name) => renamePage(index, name)}
            onRemove={pages.length > 1 ? () => removePage(index) : undefined}
          />
        ))}
        <button
          onClick={addPage}
          className="rounded-full border border-dashed border-neutral-300 px-3 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          + Page
        </button>
      </div>

      <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
        <label className="flex items-center gap-2">
          Rows
          <select
            value={page.rows}
            onChange={(e) => resizeGrid(selectedPageIndex, Number(e.target.value), page.columns)}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800"
          >
            {gridSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Columns
          <select
            value={page.columns}
            onChange={(e) => resizeGrid(selectedPageIndex, page.rows, Number(e.target.value))}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 dark:border-neutral-700 dark:bg-neutral-800"
          >
            {gridSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${page.columns}, minmax(0, 1fr))` }}>
        {page.buttons.map((button, index) => (
          <ButtonTile
            key={button.id}
            button={button}
            onClick={() => setEditingButton({ pageIndex: selectedPageIndex, buttonIndex: index })}
          />
        ))}
      </div>

      {editingButton && (
        <ButtonEditorModal
          button={pages[editingButton.pageIndex].buttons[editingButton.buttonIndex]}
          onCancel={() => setEditingButton(null)}
          onSave={(updated) => saveButton(editingButton.pageIndex, editingButton.buttonIndex, updated)}
        />
      )}
    </div>
  );
}

function PageTab({
  page,
  active,
  onSelect,
  onRename,
  onRemove,
}: {
  page: PageConfig;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onRemove?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(page.name);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim()) onRename(draft.trim());
          else setDraft(page.name);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="rounded-full border border-neutral-300 px-3 py-1 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900"
      />
    );
  }

  return (
    <div className="group flex items-center">
      <button
        onClick={onSelect}
        onDoubleClick={() => {
          setDraft(page.name);
          setEditing(true);
        }}
        className={`rounded-full px-3 py-1 text-sm transition ${
          active
            ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
        }`}
      >
        {page.name}
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hidden text-xs text-neutral-400 hover:text-red-500 group-hover:inline"
          aria-label={`Remove ${page.name}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

const inputClass =
  "mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

function labelLooksDefault(label: string): boolean {
  return /^Button \d+$/.test(label.trim());
}

function ButtonEditorModal({
  button,
  onCancel,
  onSave,
}: {
  button: ButtonConfig;
  onCancel: () => void;
  onSave: (button: ButtonConfig) => void;
}) {
  const [label, setLabel] = useState(button.label);
  const [icon, setIcon] = useState(button.icon);
  const [actionType, setActionType] = useState<ActionConfig["type"]>(button.action.type);
  const [url, setUrl] = useState(button.action.type === "open_url" ? button.action.url : "");
  const [hotkey, setHotkey] = useState(button.action.type === "hotkey" ? button.action.keys.join("+") : "");
  const [sceneName, setSceneName] = useState(button.action.type === "obs_scene" ? button.action.sceneName : "");
  const [appPath, setAppPath] = useState(button.action.type === "launch_app" ? button.action.appPath : "");
  const [appName, setAppName] = useState(button.action.type === "launch_app" ? button.action.appName : "");
  const [showAppPicker, setShowAppPicker] = useState(false);
  // Tracks whether `icon` currently reflects the picked app's icon, so we can
  // clear it if the user switches the action away from "Launch App" — without
  // this, the icon silently keeps pointing at an app whose launch action no
  // longer matches what the button actually does (e.g. picking Android
  // Studio's icon, then changing the action to a system command leaves an
  // Android Studio-looking button that doesn't launch Android Studio).
  const [iconFromAppPicker, setIconFromAppPicker] = useState(false);
  const [systemCommand, setSystemCommand] = useState<SystemCommand>(
    button.action.type === "system" ? button.action.command : "lock",
  );
  const [fetchingIcon, setFetchingIcon] = useState(false);

  function buildAction(): ActionConfig {
    switch (actionType) {
      case "open_url":
        return { type: "open_url", url: url.trim() };
      case "hotkey":
        return { type: "hotkey", keys: hotkey.split("+").map((k) => k.trim()).filter(Boolean) };
      case "obs_scene":
        return { type: "obs_scene", sceneName: sceneName.trim() };
      case "launch_app":
        return { type: "launch_app", appPath, appName };
      case "system":
        return { type: "system", command: systemCommand };
      case "none":
        return { type: "none" };
    }
  }

  async function fetchFaviconForUrl() {
    if (!url.trim()) return;
    setFetchingIcon(true);
    try {
      const res = await fetch(`${apiBase()}/api/icons/favicon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.icon) setIcon(data.icon);
      }
    } catch {
      // no icon is a fine fallback — the button still saves and works
    } finally {
      setFetchingIcon(false);
    }
  }

  function pickApp(app: InstalledApp) {
    setAppPath(app.path);
    setAppName(app.name);
    if (app.iconUrl) {
      setIcon(app.iconUrl);
      setIconFromAppPicker(true);
    }
    if (!label.trim() || labelLooksDefault(label)) setLabel(app.name);
    setShowAppPicker(false);
  }

  function handleActionTypeChange(newType: ActionConfig["type"]) {
    if (newType !== "launch_app" && iconFromAppPicker) {
      // The icon was borrowed from the app picker to match "Launch App" —
      // carrying it over to a different action would leave a button that
      // looks like it launches that app but doesn't.
      setIcon("");
      setIconFromAppPicker(false);
    }
    setActionType(newType);
  }

  function clearAction() {
    onSave({ ...button, label: "", icon: "", action: { type: "none" } });
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Edit button
        </h3>

        <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Icon</label>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-300 bg-neutral-50 text-lg dark:border-neutral-700 dark:bg-neutral-800">
            {isImageIcon(icon) ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary server-fetched icon, not a build-time asset
              <img src={resolveIconUrl(icon)} alt="" className="h-full w-full object-cover" />
            ) : (
              icon || "—"
            )}
          </div>
          {isImageIcon(icon) ? (
            <button
              type="button"
              onClick={() => {
                setIcon("");
                setIconFromAppPicker(false);
              }}
              className="text-xs text-neutral-500 hover:text-red-500 dark:text-neutral-400"
            >
              Clear icon
            </button>
          ) : (
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              placeholder="Emoji (optional)"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
            />
          )}
          {fetchingIcon && <span className="text-xs text-neutral-400">Fetching…</span>}
        </div>

        <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Label (optional)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Leave blank for an icon-only button"
          className={inputClass}
        />

        <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Action</label>
        <select
          value={actionType}
          onChange={(e) => handleActionTypeChange(e.target.value as ActionConfig["type"])}
          className={inputClass}
        >
          <option value="none">None</option>
          <option value="open_url">Open URL</option>
          <option value="launch_app">Launch App (macOS)</option>
          <option value="hotkey">Hotkey (macOS)</option>
          <option value="obs_scene">OBS scene</option>
          <option value="system">System Action (macOS)</option>
        </select>

        {actionType === "open_url" && (
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={fetchFaviconForUrl}
            placeholder="https://example.com"
            className={inputClass}
          />
        )}
        {actionType === "launch_app" && (
          <div className="mb-3">
            {appPath && !showAppPicker ? (
              <div className="flex items-center justify-between rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
                <span className="truncate text-neutral-700 dark:text-neutral-200">{appName}</span>
                <button
                  type="button"
                  onClick={() => setShowAppPicker(true)}
                  className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
                >
                  Change
                </button>
              </div>
            ) : (
              <AppPicker onPick={pickApp} />
            )}
          </div>
        )}
        {actionType === "hotkey" && (
          <input value={hotkey} onChange={(e) => setHotkey(e.target.value)} placeholder="cmd+shift+s" className={inputClass} />
        )}
        {actionType === "system" && (
          <select
            value={systemCommand}
            onChange={(e) => setSystemCommand(e.target.value as SystemCommand)}
            className={inputClass}
          >
            {SYSTEM_COMMANDS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        {actionType === "obs_scene" && (
          <input value={sceneName} onChange={(e) => setSceneName(e.target.value)} placeholder="Scene name" className={inputClass} />
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={clearAction}
            className="rounded-full px-4 py-1.5 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            Clear action
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="rounded-full px-4 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave({ ...button, label: label.trim(), icon, action: buildAction() })}
              className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
