/**
 * Helpers for reading the deployment-time public URLs (`BACKEND_PUBLIC_URL`,
 * `FRONTEND_URL`).
 *
 * Render's `fromService: { property: host }` ships **just the hostname** —
 * `aitu-unilms-backend.onrender.com` — with no scheme. Several callers need
 * a proper `https://` URL (Telegram `setWebhook` rejects scheme-less hosts;
 * inline-button URLs in notifications must be absolute). These helpers add
 * the scheme defensively without forcing every operator to remember it.
 *
 * Set as `https://...` already (e.g. for local Docker dev with
 * `BACKEND_PUBLIC_URL=http://localhost:4000`)? Pass-through, no double scheme.
 */

/** Normalise a raw env value to a fully-qualified URL with no trailing slash. */
export function normaliseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Backend's public origin (e.g. `https://aitu-unilms-backend.onrender.com`). */
export function getBackendPublicUrl(): string | undefined {
  return normaliseUrl(process.env.BACKEND_PUBLIC_URL);
}

/** Frontend's public origin (e.g. `https://aitu-unilms-frontend.onrender.com`). */
export function getFrontendUrl(): string | undefined {
  return normaliseUrl(process.env.FRONTEND_URL);
}

/**
 * Best-effort base URL for "user-facing" links — prefers FRONTEND_URL because
 * notifications/buttons point at the web UI, not the API. Falls back to
 * BACKEND_PUBLIC_URL so notifications still link somewhere reasonable if only
 * the API host is known.
 */
export function getUserFacingBaseUrl(): string {
  return getFrontendUrl() ?? getBackendPublicUrl() ?? '';
}

/**
 * Telegram rejects `http://localhost`, `http://127.0.0.1`, and any non-HTTPS
 * URL in inline keyboard buttons (`url` and `web_app` field) with
 * 400 Bad Request — which crashes the bot polling loop. Callers should
 * gate their button construction on this so the message still goes out
 * (just without a clickable link).
 */
export function isTelegramSafeUrl(url: string | undefined | null): url is string {
  return !!url && url.startsWith('https://');
}
