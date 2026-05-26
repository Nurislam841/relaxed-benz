'use client';

import { io, Socket } from 'socket.io-client';

/**
 * socket.io client for the Kahoot namespace.
 *
 * Auth flow (why this isn't just cookies):
 *   - In prod the frontend is on `aitu-unilms.vercel.app` and the backend
 *     is on `aitu-unilms-backend.onrender.com`. Cookies set by login live
 *     on the Vercel domain — they're domain-bound and the browser never
 *     ships them on the **direct** WebSocket upgrade to the Render host.
 *     SameSite=None can't fix that; it's cross-*site* policy, not
 *     cross-*domain* delivery.
 *   - So we explicitly fetch the access_token via the same-origin
 *     `/api/auth/socket-token` proxy (cookies travel normally there),
 *     then hand the raw JWT to socket.io as `auth.token`. The gateway's
 *     `authenticate()` already prefers that channel over the cookie.
 *
 * Reconnect is disabled because a quiz session doesn't gracefully
 * recover from drops — a disconnect = the player is out for that round
 * and rejoins via the join code.
 */
export async function createKahootSocket(): Promise<Socket> {
  // In dev, the backend runs on :4000. In prod, NEXT_PUBLIC_API_URL points
  // at the absolute backend URL so we connect to the Render host.
  // The /kahoot suffix matches `@WebSocketGateway({ namespace: '/kahoot' })`.
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') ?? 'http://localhost:4000';

  // Fetch the token through the same-origin proxy. credentials:'include'
  // ensures the Vercel-domain cookie travels to the proxy, which forwards
  // it to the backend, which echoes the JWT back to us.
  const r = await fetch('/api/auth/socket-token', { credentials: 'include' });
  const { token } = (await r.json().catch(() => ({ token: undefined }))) as { token?: string };

  return io(`${base}/kahoot`, {
    // withCredentials keeps the cookie path working in dev (localhost
    // same-site) as a belt-and-braces fallback. Prod auth comes from
    // `auth.token` below.
    withCredentials: true,
    auth: token ? { token } : undefined,
    transports: ['websocket', 'polling'],
    reconnection: false,
  });
}
