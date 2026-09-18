"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { PairingSessionPayload } from "../lib/protocol";

interface Props {
  session: PairingSessionPayload | null;
  onRegenerate: () => void;
}

export function PairingCard({ session, onRegenerate }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Pair a device
      </h2>

      {session ? (
        <>
          <div className="rounded-xl bg-white p-4">
            <QRCodeSVG value={session.qrUri} size={200} />
          </div>
          <div className="text-center">
            <div className="font-mono text-4xl font-semibold tracking-[0.3em] text-neutral-900 dark:text-neutral-50">
              {session.pin}
            </div>
            <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {session.host}:{session.port}
            </div>
          </div>
          <ExpiryCountdown expiresAt={session.expiresAt} />
        </>
      ) : (
        <div className="py-10 text-sm text-neutral-500 dark:text-neutral-400">Waiting for server…</div>
      )}

      <button
        onClick={onRegenerate}
        className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        Regenerate code
      </button>
    </div>
  );
}

function ExpiryCountdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = Math.max(0, expiresAt - now);
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);

  return (
    <div className="text-xs text-neutral-400 dark:text-neutral-500">
      Expires in {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}
