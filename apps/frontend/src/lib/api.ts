export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Full error body — used by callers that need extra fields (e.g. `requires2fa`). */
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * Standard request lifecycle:
 *
 *   1. Fire the request with `credentials: include` so cookies flow.
 *   2. On 401, try ONCE to refresh the access token (POST /auth/refresh).
 *      `/auth/refresh` reads the long-lived `refresh_token` cookie and
 *      writes fresh `access_token` + `refresh_token` cookies back.
 *   3. If refresh succeeds, replay the original request once.
 *   4. If refresh itself 401s (refresh token expired / TOTP changed),
 *      give up and surface the original 401 to the caller — UI shows
 *      the login screen.
 *
 * Without this, every request fails 15 minutes after login when the
 * access token expires. The user sees endpoints intermittently 401 and
 * features like Kahoot Host live silently fail (no toast, no redirect).
 */

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // De-dupe — multiple concurrent 401s share a single refresh attempt.
  if (refreshing) return refreshing;
  refreshing = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const b = await r.json().catch(() => ({ message: `Error ${r.status}` }));
    const msg = (b as any).message ?? `Error ${r.status}`;
    throw new ApiError(r.status, typeof msg === 'string' ? msg : JSON.stringify(msg), b as Record<string, unknown>);
  }
  const t = await r.text();
  return t ? JSON.parse(t) : ({} as T);
}

/**
 * Issue a fetch with credentials, and if it comes back 401, try a refresh
 * cycle and replay the request once. Auth + refresh endpoints themselves
 * bypass the retry path (`skipRefresh: true`) to avoid infinite loops.
 */
async function fetchWithAuth(input: string, init?: RequestInit & { skipRefresh?: boolean }): Promise<Response> {
  const { skipRefresh, ...rest } = init ?? {};
  const opts: RequestInit = { credentials: 'include', ...rest };
  const first = await fetch(input, opts);
  if (first.status !== 401 || skipRefresh) return first;
  // 401 path → try to refresh, then replay exactly once.
  const ok = await tryRefresh();
  if (!ok) return first; // refresh itself failed — let original 401 propagate
  return fetch(input, opts);
}

export const api = {
  get: <T = any>(p: string) => fetchWithAuth(`/api${p}`).then((r) => handle<T>(r)),
  post: <T = any>(p: string, body?: unknown) =>
    fetchWithAuth(`/api${p}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      // /auth/refresh and /auth/login MUST skip the retry path — they're
      // either the refresh itself (loop) or unauthenticated by design.
      skipRefresh: p.startsWith('/auth/refresh') || p.startsWith('/auth/login') || p.startsWith('/auth/register'),
    }).then((r) => handle<T>(r)),
  patch: <T = any>(p: string, body: unknown) =>
    fetchWithAuth(`/api${p}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r)),
  delete: <T = any>(p: string) => fetchWithAuth(`/api${p}`, { method: 'DELETE' }).then((r) => handle<T>(r)),
  uploadWithProgress: <T = any>(p: string, body: FormData, onProgress: (pct: number) => void): Promise<T> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api${p}`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(xhr.responseText ? JSON.parse(xhr.responseText) : ({} as T));
          } catch {
            resolve({} as T);
          }
        } else {
          try {
            reject(new ApiError(xhr.status, JSON.parse(xhr.responseText)?.message ?? `Error ${xhr.status}`));
          } catch {
            reject(new ApiError(xhr.status, `Error ${xhr.status}`));
          }
        }
      };
      xhr.onerror = () => reject(new ApiError(0, 'Network error'));
      xhr.send(body);
    }),
};
