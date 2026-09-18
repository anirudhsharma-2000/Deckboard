"use client";

import type { ButtonConfig } from "../lib/protocol";
import { isImageIcon, resolveIconUrl } from "../lib/api";

interface Props {
  button: ButtonConfig;
  onClick?: () => void;
}

export function ButtonTile({ button, onClick }: Props) {
  const hasImage = isImageIcon(button.icon);
  const hasLabel = button.label.trim().length > 0;

  return (
    <button
      onClick={onClick}
      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-neutral-200 bg-white p-3 text-center shadow-sm transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600"
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary server-fetched icon, not a build-time asset
        <img src={resolveIconUrl(button.icon)} alt="" className="h-10 w-10 rounded-lg object-contain" />
      ) : button.icon ? (
        <span className="text-2xl leading-none">{button.icon}</span>
      ) : null}

      {hasLabel && (
        <span className="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">{button.label}</span>
      )}
    </button>
  );
}
