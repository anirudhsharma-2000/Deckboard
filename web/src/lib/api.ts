/** The dashboard runs on :3000 in dev (separate from the server's :8787),
 * so REST calls need the full origin — see the CORS note in http/app.ts. */
export function apiBase(): string {
  if (typeof window === "undefined") return "";
  return `http://${window.location.hostname}:8787`;
}

export function isImageIcon(icon: string): boolean {
  return icon.startsWith("/api/icons/");
}

export function resolveIconUrl(icon: string): string {
  return isImageIcon(icon) ? `${apiBase()}${icon}` : icon;
}
