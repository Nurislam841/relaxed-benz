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
async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const b = await r.json().catch(() => ({ message: `Error ${r.status}` }));
    const msg = (b as any).message ?? `Error ${r.status}`;
    throw new ApiError(r.status, typeof msg === 'string' ? msg : JSON.stringify(msg), b as Record<string, unknown>);
  }
  const t = await r.text();
  return t ? JSON.parse(t) : ({} as T);
}
export const api = {
  get: <T = any>(p: string) => fetch(`/api${p}`, { credentials: 'include' }).then((r) => handle<T>(r)),
  post: <T = any>(p: string, body?: unknown) =>
    fetch(`/api${p}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => handle<T>(r)),
  patch: <T = any>(p: string, body: unknown) =>
    fetch(`/api${p}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r)),
  delete: <T = any>(p: string) =>
    fetch(`/api${p}`, { method: 'DELETE', credentials: 'include' }).then((r) => handle<T>(r)),
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
